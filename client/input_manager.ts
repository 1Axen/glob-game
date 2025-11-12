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
    private world: World
    private sprite: Sprite
    private viewport: Viewport

    private pointer_held: boolean = false
    private pointer_location: Point = new Point()

    constructor(world: World, viewport: Viewport) {
        const sprite = new Sprite({
            alpha: 1,
            x: -viewport.worldWidth / 2,
            y: -viewport.worldHeight / 2,
            width: viewport.worldWidth * 2,
            height: viewport.worldHeight * 2,
            eventMode: "static",
            zIndex: 999
        })

        sprite.on("pointerdown", () => {
            this.pointer_held = true
        })

        sprite.on("pointerup", () => {
            this.pointer_held = false
        })

        sprite.on("pointermove", (event) => {
            this.pointer_location = new Point(event.x, event.y)
        })

        viewport.addChild(sprite)

        this.world = world
        this.sprite = sprite
        this.viewport = viewport
    }

    should_shoot(): boolean {
        return this.pointer_held
    }

    move_direction(): [number, number] {
        var max_x = -Infinity
        var min_x = Infinity
        var max_y = -Infinity
        var min_y = Infinity

        for (const [_, shape] of this.world.query(Shape).with(LocalPlayer)) {
            const half_width = shape.width / 2
            const half_height = shape.height / 2

            min_x = Math.min(shape.x - half_width, min_x)
            min_y = Math.min(shape.y - half_height, min_y)
            max_x = Math.max(shape.x + half_width, max_x)
            max_y = Math.max(shape.y + half_height, max_y)
        }

        if (max_x == -Infinity) {
            return [0, 0]
        } 

        const radius = MOVE_RADIUS + (Math.max(max_x - min_x, max_y - min_y) / 2)
        const center_x = this.viewport.screenWidth / 2
        const center_y = this.viewport.screenHeight / 2
        const pointer_location = this.pointer_location

        return [
            clamp(map(pointer_location.x, center_x - radius, center_x + radius, -1, 1), -1, 1),
            clamp(map(pointer_location.y, center_y - radius, center_y + radius, -1, 1), -1, 1)
        ]
    }
}