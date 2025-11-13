import { Viewport } from "pixi-viewport";
import * as config from "../config.json"
import { autoDetectRenderer, Ticker } from "pixi.js";
import { io } from "socket.io-client";
import GameManager from "./game_manager";
import _ from "./components";
import { initDevtools } from '@pixi/devtools';
import Leaderboard from "./leaderboard";

const {width: world_width, height: world_height} = config.game

async function create_renderer() {
    const renderer = await autoDetectRenderer({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        resolution: window.devicePixelRatio,
        preference: "webgpu",
        backgroundColor: "#101010ff"
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
    const leaderboard = document.getElementById("status") as HTMLDivElement

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

    initDevtools({
        stage: viewport,
        renderer: renderer
    })

    const game_manager = new GameManager(viewport, socket, leaderboard)

    function on_death() {
        start_menu.style.visibility = "visible"
    }

    function on_disconnect() {
        ticker.stop()
        socket.close()
        game_area.style.visibility = "hidden"
        start_menu.style.visibility = "visible"
    }

    game_manager.on_death = on_death
    socket.on("disconnect", on_disconnect)
    socket.on("connect_error", on_disconnect)
    ticker.add((ticker) => {
        game_manager.update(ticker)
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