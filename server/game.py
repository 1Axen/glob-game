import socketio
from ecs import World, Query, EntityId
from time import time
from asyncio import sleep
from typing import List, Dict, NamedTuple

class Vector2(NamedTuple):
    x: float
    y: float

sio = socketio.AsyncServer()
world = World()

# types
Food = world.component()
Session = world.component()

# metadata
Name = world.component()

# physics
Mass = world.component()
Position = world.component()
MoveDirection = world.component()

SID_ENTITY_MAP: Dict[str, EntityId] = {}

@sio.event
def connect(sid, environ):
    print(f"connect: {sid}")

@sio.event
def disconnect(sid):
    print("disconnect:", sid)
    entity = SID_ENTITY_MAP.get(sid)
    if entity == None:
        return
    
    world.delete(entity)
    print(f"-> deleted entity: {entity}")    

@sio.event
def respawn(sid, name: str):
    existing = SID_ENTITY_MAP.pop(sid, None)
    if existing != None:
        world.delete(existing)

    entity = world.entity()
    world.set(entity, Name, name)
    world.set(entity, Mass, 10)
    world.set(entity, Position, Vector2(0, 0))
    world.set(entity, MoveDirection, Vector2(0, 1))
    world.set(entity, Session, sid)
    SID_ENTITY_MAP[sid] = entity

    print(f"-> created entity: {entity} ({name})")

def move_players(delta_time: float):
    for entity, mass, position, move_direction in Query(world, [Mass, Position, MoveDirection]):
        speed = mass
        velocity = Vector2(move_direction.x * speed * delta_time, move_direction.y * speed * delta_time)
        position = Vector2(position.x + velocity.x, position.y + velocity.y)
        world.set(entity, Position, position)

async def game_loop():
    last_time = time()
    tick_rate = (1.0 / 20.0)

    while True:
        curr_time = time()
        delta_time = curr_time - last_time
        last_time = curr_time

        move_players(delta_time)

        elapsed = time() - curr_time
        await sleep(max(0, tick_rate - elapsed))