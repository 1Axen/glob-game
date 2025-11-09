import socketio
import asyncio
import os
from config import Config
from aiohttp import web

from game import sio, game_loop
from router import route

config = Config.from_file(os.path.join(os.path.dirname(__file__), "../config.json"))

async def main():
    app = web.Application()
    sio.attach(app)
    app.router.add_get(r"/{name:.*}", route)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()

    await game_loop()

if __name__ == "__main__":
    asyncio.run(main())

