import { Viewport } from "pixi-viewport"
import { BitmapText, Color, Container, Graphics, Point, Texture, Ticker, TilingSprite } from "pixi.js"
import { World } from "./libs/ecs"
import { LocalPlayer, Mass, Position, Shape } from "./components"
import { game } from "../config.json"

const EPSILON = 1E-2
const FONT_SIZE = 6

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function mass_to_radius(mass: number): number {
    return game.base_radius + (mass * game.mass_radius_constant)
}

const BASE_RADIUS = mass_to_radius(1)
const STARTING_RADIUS = mass_to_radius(game.starting_mass)
const MASS_LERP_SPEED = 16

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
    private zoom: number = 1
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
            width: BASE_RADIUS * 2,
            height: BASE_RADIUS * 2,
            pivot: new Point(BASE_RADIUS, BASE_RADIUS)
        })

        glob.addChild(new Graphics({
            width: BASE_RADIUS * 2,
            height: BASE_RADIUS * 2,
        }).circle(BASE_RADIUS, BASE_RADIUS, BASE_RADIUS).fill(color))

        if (name != undefined) {
            glob.addChild(new BitmapText({
                x: BASE_RADIUS,
                y: BASE_RADIUS,
                text: name,
                style: {
                    fill: "#ffffff",
                    stroke: {color: "#000000", width: 1},
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

        const mass_fraction = Math.min(1, MASS_LERP_SPEED * delta_time)
        for (const [_, mass, position, shape] of world.query(Mass, Position, Shape)) {
            const curr_radius = shape.width / 2
            const target_radius = mass_to_radius(mass)
            var new_radius = lerp(curr_radius, target_radius, mass_fraction)
            if (Math.abs(target_radius - new_radius) < EPSILON) {
                new_radius = target_radius
            }

            shape.width = new_radius * 2
            shape.height = new_radius * 2
            shape.position.set(position.x + (world_width / 2), position.y + (world_height / 2))
            shape.zIndex = mass + 10
        }
    }

    update_camera(delta_time: number) {
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

        const width = (max_x - min_x)
        const height = (max_y - min_y)
        const radius = Math.max(width / 2, height / 2)

        const curr_zoom = this.zoom
        const target_zoom = Math.min(1, (STARTING_RADIUS / radius) ^ 4)
        const fraction = (MASS_LERP_SPEED * delta_time)

        this.zoom = lerp(curr_zoom, target_zoom, fraction)
        viewport.setZoom(this.zoom)
        viewport.moveCenter((max_x + min_x) / 2, (max_y + min_y) / 2)
    }
}
