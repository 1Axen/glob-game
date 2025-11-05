import { Application, Container, Texture, TextureUvs, TilingSprite } from "pixi.js"



function create_container(app: Application): Container {
    const container = new Container()
    app.stage.addChild(container)

    container.x = app.screen.width / 2
    container.y = app.screen.height / 2
    container.pivot.x = container.width / 2
    container.pivot.y = container.height / 2

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

export default class Renderer {
    app: Application
    food_container: Container
    glob_container: Container

    constructor(app: Application) {
        this.app = app

        const food_container = create_container(app)
        const glob_container = create_container(app)

        food_container.zIndex = 2
        glob_container.zIndex = 3

        this.food_container = food_container
        this.glob_container = glob_container

        const grid_texture = create_grid_texture(32, 1, "black")
        const grid_sprite = new TilingSprite({
           texture: grid_texture,
           width: app.screen.width,
           height: app.screen.height 
        })

        grid_sprite.tileScale.set(1 / window.devicePixelRatio)
        app.stage.addChild(grid_sprite)
    }
}