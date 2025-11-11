import { Viewport } from "pixi-viewport"
import { BitmapText, Color, Container, Graphics, Point, Texture, Ticker, TilingSprite } from "pixi.js"
import { World } from "./libs/ecs"
import { LocalPlayer, Mass, Position, Shape } from "./components"
import { game } from "../config.json"

const EPSILON = 1E-2
const FONT_SIZE = 14
const BASE_MASS = game.minimum_mass
const BASE_RADIUS = game.mass_radius_constant

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function create_container(viewport: Viewport): Container {
    const {worldWidth: world_width, worldHeight: world_height} = viewport
    const container = new Container({
        width: world_width,
        height: world_height,
        zIndex: 1
    })

    viewport.addChild(container)
    return container
}

function create_grid_texture(size: number, thickness: number, color: string) {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext("2d")
    context.strokeStyle = color
    context.lineWidth = thickness

    context.beginPath()
    context.moveTo(0, 0)
    context.lineTo(size, 0)
    context.moveTo(0, 0)
    context.lineTo(0, size)
    context.stroke()
    context.closePath()

    return Texture.from(canvas)
}

export default class GameScene {
    private world: World
    private viewport: Viewport
    private container: Container

    constructor(world: World, viewport: Viewport) {
        this.world = world
        this.viewport = viewport
        this.container = create_container(viewport)
        this.draw_grid()
    }

    draw_grid() {
        const viewport = this.viewport
        const texture = create_grid_texture(32, 1, "#6d6d6d")
        const sprite = new TilingSprite({
           texture: texture,
           x: -viewport.worldWidth / 2,
           y: -viewport.worldHeight / 2,
           width: viewport.worldWidth * 2,
           height: viewport.worldHeight * 2
        })

        sprite.zIndex = 0
        sprite.tileScale.set(1 / window.devicePixelRatio)
        viewport.addChild(sprite)
    }

    glob(color: Color, name?: string): Container {
        const glob = new Container({
            width: BASE_RADIUS,
            height: BASE_RADIUS,
            pivot: new Point(BASE_RADIUS / 2, BASE_RADIUS / 2)
        })

        glob.addChild(new Graphics({
            width: BASE_RADIUS,
            height: BASE_RADIUS,
        }).circle(BASE_RADIUS / 2, BASE_RADIUS / 2, BASE_RADIUS).fill(color))

        if (name != undefined) {
            glob.addChild(new BitmapText({
                x: BASE_RADIUS / 2,
                y: BASE_RADIUS / 2,
                text: name,
                style: {
                    fill: "#ffffff",
                    stroke: "#000000",
                    fontSize: FONT_SIZE,
                },
                anchor: 0.5,
            }))
        }
        
        this.container.addChild(glob)
        return glob
    }

    update_globs(delta_time: number) {
        const world = this.world
        const viewport = this.viewport
        const {worldWidth: world_width, worldHeight: world_height} = viewport

        const mass_fraction = Math.min(1, 16 * delta_time)
        for (const [_, mass, position, shape] of world.query(Mass, Position, Shape)) {
            const curr_scale = shape.scale.x
            const target_scale = (mass / BASE_MASS)
            var new_scale = lerp(curr_scale, target_scale, mass_fraction)
            if (Math.abs(target_scale - new_scale) < EPSILON) {
                new_scale = target_scale
            }

            shape.scale.set(new_scale)
            shape.position.set(position.x + (world_width / 2), position.y + (world_height / 2))
            shape.zIndex = mass + 10
        }
    }

    update_camera() {
        const world = this.world
        const viewport = this.viewport

        var max_x = -Infinity
        var min_x = Infinity
        var max_y = -Infinity
        var min_y = Infinity

        for (const [_, shape] of world.query(Shape, LocalPlayer)) {
            const half_width = shape.width / 2
            const half_height = shape.height / 2

            min_x = Math.min(shape.x - half_width, min_x)
            min_y = Math.min(shape.y - half_height, min_y)
            max_x = Math.max(shape.x + half_width, max_x)
            max_y = Math.max(shape.y + half_height, max_y)
        }

        if (min_x == Infinity) {
            viewport.moveCenter(viewport.screenWidth / 2, viewport.screenHeight / 2)
            return
        }

        viewport.moveCenter((max_x + min_x) / 2, (max_y + min_y) / 2)
    }
}
