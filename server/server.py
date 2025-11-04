import socketio
import asyncio
from aiohttp import web

from router import route

async def main():
    app = web.Application()
    sio.attach(app)
    app.router.add_get(r"/{name:.*}", route)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()

if __name__ == "__main__":
    asyncio.run(main())

