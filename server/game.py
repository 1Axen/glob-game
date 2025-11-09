import socketio
from ecs import World, Id, Query, tag, component
import vector
from time import time
from asyncio import sleep
from typing import Dict

Vector = vector.Vector

sio = socketio.AsyncServer()
world = World()

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

SID_ENTITY_MAP: Dict[str, Id] = {}

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
    world.set(entity, Position, Vector(0, 0))
    world.set(entity, MoveDirection, Vector(0, 1))
    world.set(entity, Session, sid)
    SID_ENTITY_MAP[sid] = entity

    print(f"-> created entity: {entity} ({name})")

def move_players(delta_time: float):
    for entity, mass, position, move_direction in Query(world, [Mass, Position, MoveDirection]):
        speed = mass
        velocity = Vector(move_direction.x * speed * delta_time, move_direction.y * speed * delta_time)
        position = Vector(position.x + velocity.x, position.y + velocity.y)
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