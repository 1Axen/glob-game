import os
from aiohttp import web

SERVER_DIRECTORY = os.path.abspath(os.path.dirname(__file__))
PUBLIC_DIRECTORY = os.path.join(SERVER_DIRECTORY, "../public")

CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".css": "text/css",
    ".html": "text/html",
    ".js": "application/javascript"
}

async def route(request: web.Request):
    path = request.match_info.get("name", "index.html")
    if path == "":
        path = "index.html"

    file_path = os.path.join(PUBLIC_DIRECTORY, path)

    try:
        contents = open(file_path, mode="b+r").read()
    except:
        return web.Response(status=404)
    
    extension = os.path.splitext(file_path)[1]
    content_type = CONTENT_TYPES.get(extension, "text/html")
    
    return web.Response(body=contents,content_type=content_type)

