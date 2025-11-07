import { Viewport } from "pixi-viewport";
import * as config from "../config.json"
import { Application, autoDetectRenderer, Ticker, WebGPURenderer } from "pixi.js";
import { io } from "socket.io-client";
import GameScene from "./game_scene";

const {width: world_width, height: world_height} = config.game

async function create_renderer() {
    const renderer = await autoDetectRenderer({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        resolution: window.devicePixelRatio,
        preference: "webgpu",
        backgroundColor: "#F2F3F4"
    })

    const canvas = renderer.canvas
    canvas.style.position = "fixed"
    canvas.style.width = "100vw"
    canvas.style.height = "100vh"
    canvas.style.top = "0"
    canvas.style.left = "0"
    canvas.style.zIndex = "1"

    return renderer
}

function is_valid_username(username: string) {
    const pattern = /^\w*$/;
    return pattern.exec(username) !== null;
}

function setup_menu(on_start: (username: string) => void) {
    const start_button = document.getElementById("startButton") as HTMLButtonElement
    const username_input = document.getElementById("usernameInput") as HTMLInputElement
    const username_error_text = document.querySelector("#startMenu .input-error") as HTMLTextAreaElement

    start_button.onclick = function() {
        var username = username_input.value
        if (!is_valid_username(username)) {
            username_error_text.style.opacity = "1"
            return
        }

        username_error_text.style.opacity = "0"
        on_start(username)
    }

    username_input.addEventListener("keypress", function(e) {
        var key = e.key
        if (key == "Enter") {
            var username = username_input.value
            username_error_text.style.opacity = !is_valid_username(username) ? "1" : "0"
        }
    })
}

window.onload = async function() {
    const game_area = document.getElementById("gameArea") as HTMLElement
    const start_menu = document.getElementById("startMenuBackground") as HTMLElement

    const socket = await io()
    const ticker = new Ticker()
    const renderer = await create_renderer()
    game_area.appendChild(renderer.canvas)

    const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: world_width,
        worldHeight: world_height,
        events: renderer.events
    })
    viewport.moveCenter(world_width / 2, world_height / 2)

    const game_scene = new GameScene(viewport)

    function disconnect() {
        ticker.stop()
        socket.close()
        game_area.style.visibility = "visible"
        start_menu.style.visibility = "hidden"
    }

    socket.on("disconnect", disconnect)
    socket.on("connect_error", disconnect)
    ticker.add((ticker) => {
        renderer.render(viewport)
    })

    window.addEventListener("resize", () => {
        renderer.resize(window.innerWidth, window.innerHeight)
        viewport.resize(window.innerWidth, window.innerHeight)
    })

    ticker.start()
    setup_menu(async (username: string) => {
        start_menu.style.visibility = "hidden"
        await socket.emit("respawn", username)
        game_area.style.visibility = "visible"
    })
}