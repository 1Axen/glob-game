import { Container, Graphics, Point } from "pixi.js"
import { component, tag } from "./libs/ecs"

export const Food = tag()
export const Player = tag()
export const LocalPlayer = tag()

export const Name = component<string>()
export const Mass = component<number>()
export const Shape = component<Container>()
export const Position = component<Point>()

export default {}