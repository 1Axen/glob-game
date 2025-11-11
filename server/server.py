import socketio
import asyncio
import os
from libs.config import Config
from libs.ecs import World
from aiohttp import web
from router import route
from game import GameInstance

config = Config.from_file(os.path.join(os.path.dirname(__file__), "../config.json"))

async def main():
    sio = socketio.AsyncServer()
    app = web.Application()
    sio.attach(app)
    app.router.add_get(r"/{name:.*}", route)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, config.server.hostname, config.server.port)
    await site.start()

    world = World()
    game_instance = GameInstance(sio, world, config)

    @sio.event
    def connect(sid, environ):
        print(f"connect {sid}")
        game_instance.connect(sid, environ)

    @sio.event
    def disconnect(sid):
        print(f"disconnect {sid}")
        game_instance.disconnect(sid)

    @sio.event
    def respawn(sid, name):
        game_instance.respawn(sid, name)

    @sio.event
    def move(sid, direction):
        game_instance.move(sid, direction)

    await game_instance.init_game_loop()

if __name__ == "__main__":
    asyncio.run(main())

