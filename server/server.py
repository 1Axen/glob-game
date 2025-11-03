import socketio
from aiohttp import web

from router import route

sio = socketio.AsyncServer()
app = web.Application()

if __name__ == "__main__":
    sio.attach(app)
    app.router.add_get(r"/{name:.*}", route)
    web.run_app(app)

