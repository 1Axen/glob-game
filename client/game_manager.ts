import { Socket } from "socket.io-client";
import { Id, World } from "./ecs";
import GameScene from "./game_scene";
import { Ticker } from "pixi.js";

export default class GameManager {
    world: World
    scene: GameScene

    constructor(world: World, scene: GameScene, socket: Socket) {

    }

    update(ticker: Ticker) {
        
    }
}