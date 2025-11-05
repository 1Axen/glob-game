import * as config from "../config.json"
import { Application, Ticker } from "pixi.js";
import Renderer from "./renderer";
import { io } from "socket.io-client";

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
    const start_menu = document.getElementById("startMenu") as HTMLElement

    const app = new Application()
    await app.init({ 
        width: config.game.width,
        height: config.game.height,
        background: "#ffffff",
        autoStart: false,
        sharedTicker: false,
        resolution: Math.max(1, window.devicePixelRatio)
    })

    game_area.appendChild(app.canvas)
    
    const socket = await io()
    const ticker = app.ticker
    const renderer = new Renderer(app)

    function disconnect() {
        ticker.stop()
        socket.close()
        game_area.style.visibility = "visible"
        start_menu.style.visibility = "hidden"
    }

    socket.on("disconnect", disconnect)
    socket.on("connect_error", disconnect)

    setup_menu(async (username: string) => {
        if (ticker.started) {
            return
        } 

        ticker.start()
        start_menu.style.visibility = "hidden"

        await socket.emit("respawn", username)
        game_area.style.visibility = "visible"
    })

    ticker.add((ticker) => {
        
    })
}