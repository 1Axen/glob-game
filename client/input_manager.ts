import { Viewport } from "pixi-viewport";
import { Container, Sprite } from "pixi.js";

function map(x: number, inmin: number, inmax: number, outmin: number, outmax: number) {
    return outmin + (x - inmin) * (outmax - outmin) / (inmax - inmin)
}

export default class InputManager {
    private container: Container

    constructor(viewport: Viewport) {
        const container = new Container({
            zIndex: 999
        })
        const sprite = new Sprite({
            alpha: 1,
            width: viewport.worldWidth,
            height: viewport.worldHeight,
            eventMode: "static",
        })

        sprite.on("pointermove", (event) => {
            const {x, y} = event
            const {screenWidth: screen_width, screenHeight: screen_height} = viewport
        })

        container.addChild(sprite)
        viewport.addChild(container)
    }
}