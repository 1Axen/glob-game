import { Viewport } from "pixi-viewport";
import { Point, Sprite } from "pixi.js";
import { World } from "./libs/ecs";
import { LocalPlayer, Shape } from "./components";

const MOVE_RADIUS = 64

function map(x: number, inmin: number, inmax: number, outmin: number, outmax: number) {
    return outmin + (x - inmin) * (outmax - outmin) / (inmax - inmin)
}

function clamp(x: number, min: number, max: number) {
    if (x > max) return max;
    if (x < min) return min;
    return x
}

export default class InputManager {
    private target: Point = new Point()
    private split_held: boolean = false
    private shoot_held: boolean = false

    constructor(world: World, viewport: Viewport) {
        viewport.on("pointerdown", () => {
            this.shoot_held = true
        })

        viewport.on("pointerup", () => {
            this.shoot_held = false
        })

        viewport.on("pointermove", (event) => {
            const world_point = viewport.toWorld(event.global)
            this.target = new Point(
                world_point.x - viewport.worldWidth / 2, 
                world_point.y - viewport.worldHeight / 2
            )
        })

        window.addEventListener("keydown", (event) => {
            if (event.key == " ") {
                this.split_held = true
            }
        })

        window.addEventListener("keyup", (event) => {
            if (event.key == " ") {
                this.split_held = true
            }
        })
    }

    should_shoot(): boolean {
        return this.shoot_held
    }

    should_split(): boolean {
        return this.split_held
    }

    target_point(): [number, number] {
        return [this.target.x, this.target.y]
    }
}