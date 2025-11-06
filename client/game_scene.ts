import { Viewport } from "pixi-viewport"
import { Application, Container, Texture, TextureUvs, TilingSprite, View } from "pixi.js"

function create_container(viewport: Viewport, zindex: number): Container {
    const {worldWidth: world_width, worldHeight: world_height} = viewport
    const container = new Container({
        width: world_width,
        height: world_height,
        x: world_width / 2,
        y: world_height / 2,
    })

    container.zIndex = zindex
    container.pivot.x = container.width / 2
    container.pivot.y = container.height / 2

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
    viewport: Viewport
    food_container: Container
    glob_container: Container

    constructor(viewport: Viewport) {
        this.viewport = viewport

        const food_container = create_container(viewport, 2)
        const glob_container = create_container(viewport, 3)

        this.food_container = food_container
        this.glob_container = glob_container

        this.draw_grid()
    }

    draw_grid() {
        const viewport = this.viewport
        const texture = create_grid_texture(32, 1, "#6d6d6d")
        const sprite = new TilingSprite({
           texture: texture,
           width: viewport.worldWidth,
           height: viewport.worldHeight
        })

        sprite.tileScale.set(1 / window.devicePixelRatio)
        viewport.addChild(sprite)
    }
}