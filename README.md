# glob-game

Agar.io clone written in python and javascript

## Features

* Server written in python using aiohttp and socketio
* Client written in typescript using pixi.js, pixi-viewport and socketio
* Archetype ECS implementation on both sides, supports queries and tag storage

## Setup

##### Note: the commands below assume a UNIX compliant bash shell

Clone the repository and move into it

```sh
git clone https://github.com/1Axen/glob-game.git
cd glob-game
```

Install the necessary packages

```sh
npm install
pip install aiohttp
pip install python-socketio
```

Run the server

```sh
npm run start
```

Start a session in your browser of choice at
<a>http://localhost:8080</a>