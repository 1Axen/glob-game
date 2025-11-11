import socketio
from ecs import World, Id, Query, tag, component
import random
import json
import vector
from config import Config
from time import time
from asyncio import sleep
from typing import Dict

Vector = vector.Vector
SocketServer = socketio.AsyncServer

# types
Food = tag()
Session = component()

# metadata
Name = component()
Parent = component()

# physics
Mass = component()
Position = component()
Velocity = component()
MoveDirection = component()

def map(x: float, inmin: float, inmax: float, outmin: float, outmax: float) -> float:
    return outmin + (x - inmin) * (outmax - outmin) / (inmax - inmin)

def speed_from_mass(config: Config, mass: float) -> float:
    game_config = config.game
    return map(
        mass, 
        game_config.minimum_mass, game_config.maximum_mass, 
        game_config.maximum_speed, game_config.minimum_speed
    )

def create_glob(world: World, mass: int, position: Vector) -> Id:
    glob = world.entity()
    world.set(glob, Mass, mass)
    world.set(glob, Position, position)
    return glob

def move_globs(world: World, config: Config, delta_time: float):
    for entity, mass, position, move_direction in Query(world, Mass, Position, MoveDirection):
        speed = speed_from_mass(config, mass)
        velocity = Vector(move_direction.x * speed * delta_time, move_direction.y * speed * delta_time)
        position = Vector(position.x + velocity.x, position.y + velocity.y)
        world.set(entity, Position, position)

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
    _entity_map: Dict[str, Id]

    def __init__(self, socket: SocketServer, world: World, config: Config) -> None:
        self.world = world
        self.config = config
        self.socket = socket
        self._entity_map = {}

        half_width = config.game.width // 2
        half_height = config.game.height // 2
        food_mass = config.game.food_mass
        for _ in range(1, config.game.maximum_food):
            position = Vector(
                random.randint(-half_width, half_width), 
                random.randint(-half_height, half_height)
            )
            entity = create_glob(world, food_mass, position)
            world.add(entity, Food)

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

        glob = create_glob(world, self.config.game.starting_mass, Vector())
        world.add(glob, entity)
        world.set(glob, Parent, entity)
        world.set(glob, Velocity, Vector())
        world.set(glob, MoveDirection, Vector())

        print(f"* created entity: {entity} ({name})")

    def move(self, sid: str, direction: tuple[float, float]):
        entity = self._entity_map.get(sid, None)
        if entity == None:
            raise Exception
        
        world = self.world
        move_direction = Vector(*direction)
        move_direction = vector.normalize(move_direction)

        for glob_entity, _ in Query(world, entity):
            world.set(glob_entity, MoveDirection, move_direction)

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

            move_globs(world, config, delta_time)
            world_state = serialize_world(world, server_time)
            await socket.emit("snapshot", world_state)

            elapsed = time() - curr_time
            await sleep(max(0, tick_rate - elapsed))