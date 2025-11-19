import { Viewport } from "pixi-viewport"
import { BitmapText, Color, Container, Graphics, Point, Texture, Ticker, TilingSprite } from "pixi.js"
import { World } from "./libs/ecs"
import { LocalPlayer, Mass, Position, Shape } from "./components"
import { game } from "../config.json"

const EPSILON = 1E-2
const FONT_SIZE = 6

const BASE_RADIUS = mass_to_radius(1)
const STARTING_RADIUS = mass_to_radius(game.starting_mass)
const MASS_LERP_SPEED = 16

const VIRUS_COLOR = new Color("#00ff00")
const VIRUS_SPIKES = 48
const VIRUS_FILL_RADIUS = BASE_RADIUS - 0.5
const VIRUS_INNER_RADIUS = BASE_RADIUS - 0.5
const VIRUS_OUTER_RADIUS = BASE_RADIUS

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function mass_to_radius(mass: number): number {
    return game.base_radius + (mass * game.mass_radius_constant)
}

function multiply_brightness(color: Color, multiplier: number): Color {
    const [r, g, b] = color.toRgbArray()
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = (max - min)

    const value = (max * multiplier) * 100
    const saturation = (max == 0 ? 0 : delta / max) * 100
    
    var hue = 0
    if (delta != 0) {
        if (max == r) {
            hue = ((g - b) / delta) % 6
        }
        else if (max == g) {
            hue = ((b - r) / delta) + 2
        }
        else if (max == b) {
            hue = ((r - g) / delta) + 4
        }

        hue *= 60
    }

    return new Color({h: hue, s: saturation, v: value, a: 1})
}

function random_color(): Color {
    return new Color({
        r: Math.random() * 255,
        g: Math.random() * 255,
        b: Math.random() * 255,
    })
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
    if (context != null) {
        context.strokeStyle = color
        context.lineWidth = thickness

        context.beginPath()
        context.moveTo(0, 0)
        context.lineTo(size, 0)
        context.moveTo(0, 0)
        context.lineTo(0, size)
        context.stroke()
        context.closePath()
    }

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

    private draw_grid() {
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

    private glob(): [Container, Graphics] {
        const glob = new Container({
            width: BASE_RADIUS * 2,
            height: BASE_RADIUS * 2,
            pivot: new Point(BASE_RADIUS, BASE_RADIUS)
        })

        const graphics = new Graphics({
            width: BASE_RADIUS * 2,
            height: BASE_RADIUS * 2,
        })

        glob.addChild(graphics)
        this.container.addChild(glob)

        return [glob, graphics]
    }

    food_glob(): Container {
        const [container, graphics] = this.glob()

        graphics
            .circle(BASE_RADIUS, BASE_RADIUS, BASE_RADIUS)
            .fill(random_color())

        return container
    }

    virus_glob(): Container {
        const [container, graphics] = this.glob()
        const stroke_color = multiply_brightness(VIRUS_COLOR, 0.5)

        graphics
            .circle(VIRUS_OUTER_RADIUS, VIRUS_OUTER_RADIUS, VIRUS_FILL_RADIUS)
            .fill(VIRUS_COLOR)
            .beginPath()

        for (let i = 0; i <= VIRUS_SPIKES; i++) {
            const angle = (i / VIRUS_SPIKES) * (Math.PI * 2)
            const radius = (i % 2 == 0) ? VIRUS_OUTER_RADIUS : VIRUS_INNER_RADIUS

            const x = BASE_RADIUS + Math.cos(angle) * radius
            const y = BASE_RADIUS + Math.sin(angle) * radius

            if (i == 0) {
                graphics.moveTo(x, y)
            } else {
                graphics.lineTo(x, y)
            }
        }

        graphics
            .closePath()
            .stroke({width: 1.5, color: stroke_color});

        return container
    }

    player_glob(name: string, color: Color): Container {
        const [container, graphics] = this.glob()
        const stroke_color = multiply_brightness(color, 0.5)

        graphics
            .circle(BASE_RADIUS, BASE_RADIUS, BASE_RADIUS)
            .fill(color)
            .stroke({
                width: 1,
                color: stroke_color,
                alignment: 1
            })

        container.addChild(new BitmapText({
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

        return container
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
