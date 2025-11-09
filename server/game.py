import socketio
from ecs import World, Id, Query, tag, component
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

# physics
Mass = component()
Position = component()
Velocity = component()
MoveDirection = component()

def create_glob(world: World, mass: int, position: Vector) -> Id:
    glob = world.entity()
    world.set(glob, Mass, mass)
    world.set(glob, Position, position)
    return glob

def move_globs(world: World, delta_time: float):
    for entity, mass, position, move_direction in Query(world, Mass, Position, MoveDirection):
        speed = mass
        velocity = Vector(move_direction.x * speed * delta_time, move_direction.y * speed * delta_time)
        position = Vector(position.x + velocity.x, position.y + velocity.y)
        world.set(entity, Position, position)

class GameInstance():
    world: World
    config: Config
    socket: SocketServer
    _entity_map: Dict[str, Id]

    def __init__(self, socket: SocketServer, world: World, config: Config) -> None:
        self.world = world
        self.config = config
        self.socket = socket

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

        glob = create_glob(world, 10, Vector())
        world.add(glob, entity)
        world.set(glob, Velocity, Vector())
        world.set(glob, MoveDirection, Vector())

        print(f"* created entity: {entity} ({name})")

    async def init_game_loop(self):
        world = self.world
        socket = self.socket

        last_time = time()
        tick_rate = (1.0 / 20.0)

        while True:
            curr_time = time()
            delta_time = curr_time - last_time
            last_time = curr_time

            move_globs(world, delta_time)

            elapsed = time() - curr_time
            await sleep(max(0, tick_rate - elapsed))