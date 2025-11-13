import socketio
from libs.ecs import World, Id, Query, tag, component
import random
import json
import libs.vector as vector
from libs.vector_map import VectorMap
from libs.config import Config
from time import time
from asyncio import sleep
from typing import Dict, List

Vector = vector.Vector
SocketServer = socketio.AsyncServer

# singletons
GameConfig = component()
FoodVectorMap = component()

# types
Food = tag()
Player = tag()
Session = component()

# metadata
Name = component()
Parent = component()

# gameplay
MergeDebounce = component()

# physics
Mass = component()
Position = component()
Velocity = component()
MoveDirection = component()

def map(x: float, inmin: float, inmax: float, outmin: float, outmax: float) -> float:
    return outmin + (x - inmin) * (outmax - outmin) / (inmax - inmin)

def clamp(x: float, min: float, max: float) -> float:
    if (x > max): 
        return max
    if (x < min):
        return min
    return x

def point_to_vector(config: Config, point: tuple[float, float]) -> Vector:
    max_x = config.game.width / 2
    max_y = config.game.height / 2
    return Vector(
        clamp(point[0], -max_x, max_x),
        clamp(point[1], -max_y, max_y)
    )

def mass_to_radius(config: Config, mass: float) -> float:
    return config.game.base_radius + mass * config.game.mass_radius_consant

def speed_from_mass(config: Config, mass: float) -> float:
    game_config = config.game
    return map(
        mass, 
        game_config.minimum_mass, game_config.maximum_mass, 
        game_config.maximum_speed, game_config.minimum_speed
    )

def can_eat_glob(position: Vector, radius: float, other_position: Vector, other_radius: float) -> bool:
    vector_to_other = (other_position - position)
    distance_to_other = vector.magnitude(vector_to_other)
    return (distance_to_other < (radius - other_radius))

def create_glob(world: World, mass: float, position: Vector) -> Id:
    glob = world.entity()
    world.set(glob, Mass, mass)
    world.set(glob, Position, position)
    return glob

def spawn_food(world: World, config: Config, vector_map: VectorMap) -> Id:
    half_width = config.game.width // 2
    half_height = config.game.height // 2
    position = Vector(
        random.randint(-half_width, half_width), 
        random.randint(-half_height, half_height)
    )

    entity = create_glob(world, config.game.food_mass, position)
    world.add(entity, Food)
    vector_map.insert(entity, position)

    return entity

def spawn_player(world: World, parent: Id, mass: float, position: Vector) -> Id:
    glob = create_glob(world, mass, position)
    world.add(glob, Player)
    world.add(glob, parent)
    world.set(glob, Parent, parent)
    world.set(glob, Velocity, Vector())
    world.set(glob, MoveDirection, Vector())
    return glob

def eat_food(world: World, delta_time: float):
    config: Config | None = world.get(GameConfig, GameConfig)
    vector_map: VectorMap | None = world.get(FoodVectorMap, FoodVectorMap)

    assert config != None
    assert vector_map != None

    for entity, mass, position in Query(world, Mass, Position).with_ids(Player):
        radius = mass_to_radius(config, mass)
        food_globs = vector_map.query_radius(position, radius)

        for food_entity in food_globs:
            if (not world.contains(food_entity)):
                continue

            food_mass: float | None = world.get(food_entity, Mass)
            food_position: Vector | None = world.get(food_entity, Position)

            assert food_mass != None
            assert food_position != None

            food_radius = mass_to_radius(config, food_mass)
            if not can_eat_glob(position, radius, food_position, food_radius):
                continue

            mass += food_mass
            world.delete(food_entity)
            vector_map.remove(food_entity, food_position)

            spawn_food(world, config, vector_map)
            
        world.set(entity, Mass, mass)

def eat_players(world: World, delta_time: float):
    config: Config | None = world.get(GameConfig, GameConfig)
    assert config != None

    for entity, mass, position, parent in Query(world, Mass, Position, Parent):
        radius = mass_to_radius(config, mass)

        for other_entity, other_mass, other_position in Query(world, Mass, Position).with_ids(Player):
            if other_entity == entity:
                continue

            if other_mass >= mass:
                continue

            if world.has(other_entity, parent) and world.has(other_entity, MergeDebounce):
                continue

            other_radius = mass_to_radius(config, other_mass)
            if not can_eat_glob(position, radius, other_position, other_radius):
                continue

            mass += other_mass
            world.delete(other_entity)

        world.set(entity, Mass, mass)

def update_velocity(world: World, delta_time: float):
    config: Config | None = world.get(GameConfig, GameConfig)
    assert config != None

    for entity, mass, velocity in Query(world, Mass, Velocity):
        velocity = vector.friction(velocity, config.game.friction, delta_time)

        direction = world.get(entity, MoveDirection)
        if (direction != None):
            speed = speed_from_mass(config, mass)
            if (vector.magnitude(velocity) <= speed):
                velocity = vector.accelerate(velocity, direction, speed, config.game.acceleration, delta_time)

        world.set(entity, Velocity, velocity)

def update_positions(world: World, delta_time: float):
    config: Config | None = world.get(GameConfig, GameConfig)
    vector_map: VectorMap | None = world.get(FoodVectorMap, FoodVectorMap)

    assert config != None
    assert vector_map != None

    half_width = config.game.width / 2
    half_height = config.game.height / 2

    for entity, mass, position, velocity in Query(world, Mass, Position, Velocity):
        old_position = position
        position = Vector(
            clamp(position.x + velocity.x * delta_time, -half_width, half_width), 
            clamp(position.y + velocity.y * delta_time, -half_height, half_height)
        )

        parent = world.get(entity, Parent)
        if (parent != None):
            radius = mass_to_radius(config, mass)

            for sibling_entity, sibling_mass, sibling_position in Query(world, Mass, Position).with_ids(MergeDebounce, parent):
                if (sibling_entity == entity):
                    continue

                sibling_radius = mass_to_radius(config, sibling_mass)
                radius_summed = (radius + sibling_radius)

                vector_to = (sibling_position - position)
                distance_to = vector.magnitude(vector_to)

                if (distance_to < radius_summed):
                    push_amount = (radius_summed - distance_to) + 0.1
                    push_vector = vector.normalize(vector_to) if distance_to != 0 else Vector(1, 0)
                    position -= (push_vector * push_amount)
        elif (world.has(entity, Food)):
            vector_map.remove(entity, old_position)
            vector_map.insert(entity, position)
                    
        world.set(entity, Position, position)

def erode_merge_debounces(world: World, delta_time: float):
    for entity, debounce in Query(world, MergeDebounce):
        debounce -= delta_time
        if (debounce <= 0):
            world.remove(entity, MergeDebounce)
            continue

        world.set(entity, MergeDebounce, debounce)

def serialize_world(world: World, server_time: float) -> str:
    globs = []
    players = []
    world_state = [server_time, players, globs]

    player_index_map = {}

    for entity, name, session in Query(world, Name, Session):
        player_index = len(players)
        player_index_map[entity] = player_index
        players.append((name, session))

    for entity, mass, position in Query(world, Mass, Position):
        parent = world.get(entity, Parent)
        player_index = -1
        if parent != None:
            player_index = player_index_map.get(parent)

        globs.append((entity, mass, (position.x, position.y), player_index))

    return json.dumps(world_state)

class GameInstance():
    world: World
    config: Config
    socket: SocketServer
    vector_map: VectorMap
    _entity_map: Dict[str, Id]

    def __init__(self, socket: SocketServer, world: World, config: Config) -> None:
        vector_map = VectorMap()

        self.world = world
        self.config = config
        self.socket = socket
        self.vector_map = vector_map
        self._entity_map = {}
        
        world.set(GameConfig, GameConfig, config)
        world.set(FoodVectorMap, FoodVectorMap, vector_map)
        
        for _ in range(1, config.game.maximum_food):
            spawn_food(world, config, vector_map)

        pass

    def connect(self, sid: str, environ):
        world = self.world
        entity = world.entity()
        world.set(entity, Session, sid)
        self._entity_map[sid] = entity

    def disconnect(self, sid: str):
        world = self.world
        entity_map = self._entity_map

        entity = entity_map.get(sid)
        if entity == None:
            return
        
        entity_map.pop(sid)
        
        for child, _ in Query(world, entity):
            world.delete(child)
                
        world.delete(entity)

        print(f"* deleted entity: {entity}")    

    def respawn(self, sid: str, name: str):
        entity = self._entity_map.get(sid, None)
        if entity == None:
            raise Exception
        
        world = self.world
        world.set(entity, Name, name)

        position = Vector()
        glob_entity = spawn_player(world, entity, self.config.game.starting_mass, position)

        print(f"* created entity: {glob_entity} ({name})")

    def move(self, sid: str, target_point: tuple[float, float]):
        entity = self._entity_map.get(sid, None)
        if entity == None:
            raise Exception
        
        world = self.world
        target_position = point_to_vector(self.config, target_point)

        for glob_entity, position in Query(world, Position).with_ids(entity):
            direction = (target_position - position)
            if vector.magnitude(direction) != 0:
                direction = vector.normalize(direction)

            world.set(glob_entity, MoveDirection, direction)

    def shoot(self, sid: str, target_point: tuple[float, float]):
        entity = self._entity_map.get(sid, None)
        if entity == None:
            raise Exception
        
        world = self.world
        config = self.config
        vector_map = self.vector_map
        target_position = point_to_vector(self.config, target_point)

        food_mass = config.game.food_mass
        food_diameter = mass_to_radius(config, config.game.food_mass) * 2 
        minimum_mass = config.game.minimum_mass

        for glob_entity, mass, position in Query(world, Mass, Position).with_ids(entity):
            if (mass <= minimum_mass):
                continue

            direction = (target_position - position)
            if (vector.magnitude(direction) == 0):
                direction = Vector(1, 0)
            else:
                direction = vector.normalize(direction)

            radius = mass_to_radius(config, mass)
            spawn_offset = (direction * (radius + food_diameter))
            spawn_position = position + spawn_offset

            food_entity = spawn_food(world, config, vector_map)

            world.set(glob_entity, Mass, max(minimum_mass, mass - food_mass))
            world.set(food_entity, Position, spawn_position)
            world.set(food_entity, Velocity, direction * 512)

    def split(self, sid: str, target_point: tuple[float, float]):
        entity = self._entity_map.get(sid, None)
        if entity == None:
            raise Exception
        
        world = self.world
        config = self.config
        target_position = point_to_vector(self.config, target_point)

        minimum_mass = config.game.minimum_mass
        merge_debounce = config.game.merge_debounce

        for original_entity, mass, position in Query(world, Mass, Position).with_ids(entity):
            half_mass = (mass / 2)
            if (half_mass < minimum_mass):
                continue

            direction = (target_position - position)
            if (vector.magnitude(direction) == 0):
                direction = Vector(1, 0)
            else:
                direction = vector.normalize(direction)

            radius = mass_to_radius(config, half_mass)
            position += direction * radius

            split_entity = spawn_player(world, entity, half_mass, position)
            world.set(split_entity, Velocity, direction * 512)
            world.set(split_entity, MergeDebounce, merge_debounce)
            world.set(original_entity, Mass, half_mass)

    async def init_game_loop(self):
        world = self.world
        config = self.config
        socket = self.socket

        last_time = time()
        tick_rate = (1.0 / config.server.update_rate)
        server_time = 0.0

        while True:
            curr_time = time()
            delta_time = curr_time - last_time
            server_time += delta_time
            last_time = curr_time

            erode_merge_debounces(world, delta_time)
            update_velocity(world, delta_time)
            update_positions(world, delta_time)
            eat_food(world, delta_time)
            eat_players(world, delta_time)
            world_state = serialize_world(world, server_time)
            await socket.emit("snapshot", world_state)

            elapsed = time() - curr_time
            await sleep(max(0, tick_rate - elapsed))