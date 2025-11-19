import { Socket } from "socket.io-client";
import { Id, World } from "./libs/ecs";
import GameScene from "./game_scene";
import { Color, Container, Point, Ticker } from "pixi.js";
import { LocalPlayer, Mass, Name, Player, Position, Shape } from "./components";
import { server } from "../config.json"
import SyncedClock from "./libs/synced_clock";
import { Viewport } from "pixi-viewport";
import InputManager from "./input_manager"
import Leaderboard from "./leaderboard";

type GlobData = [number, number, [number, number], number]
type PlayerData = [string, string]
type WorldState = [number, PlayerData[], GlobData[]]

interface Snapshot {
    time: number,
    positions: Map<Id, Point>
}

const UPDATE_RATE = 1 / server.update_rate
const INTERP_RATIO = 1
const MAX_SNAPSHOTS = server.update_rate

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function session_id_to_color(session_id: string): Color {
    let hash = 0
    for (let index = 0; index < session_id.length; index++) {
        hash = session_id.charCodeAt(index) + ((hash << 5) - hash)
    }

    return new Color({
        r: hash & 0xff, 
        g: (hash >> 8) & 0xff, 
        b: (hash >> 16) & 0xff
    })
}

export default class GameManager {
    private world: World
    private clock: SyncedClock
    private scene: GameScene
    private input: InputManager
    private socket: Socket
    private leaderboard: Leaderboard
    private snapshots: Snapshot[]

    private split_debounce: number = 0
    private shoot_debounce: number = 0
    private last_target_point: [number, number] = [0, 0]

    on_death: () => void
    private was_alive: boolean = false

    constructor(viewport: Viewport, socket: Socket, leaderboard_div: HTMLDivElement) {
        const world = new World()

        this.world = world
        this.socket = socket
        this.clock = new SyncedClock()
        this.scene = new GameScene(world, viewport)
        this.input = new InputManager(viewport)
        this.leaderboard = new Leaderboard(world,leaderboard_div)
        this.snapshots = []
        this.on_death = () => {}

        this.setup_snapshot_receive()
    }

    private setup_snapshot_receive() {
        const scene = this.scene
        const clock = this.clock
        const world = this.world
        const socket = this.socket
        const snapshots = this.snapshots
        
        const entities_map: Map<number, Id> = new Map()
        socket.on("snapshot", (state_json: string) => {
            const state = JSON.parse(state_json) as WorldState
            const server_time = state[0]
            const players = state[1]

            clock.sync(server_time)

            const snapshot: Snapshot = {
                time: server_time,
                positions: new Map()
            }

            {
                const length = snapshots.push(snapshot)
                if (length > MAX_SNAPSHOTS) {
                    snapshots.shift()
                }
            }

            const stale_entities = new Map(entities_map)
            for (const glob of state[2].values()) {
                const id = glob[0]
                const mass = glob[1]
                const position = glob[2]

                // -1: food
                // else: player
                const player_index = glob[3]
                const player_data = players[player_index]


                var entity = entities_map.get(id)
                const point = new Point(position[0], position[1])

                if (entity == undefined) {
                    entity = world.entity()

                    var shape: Container
                    if (player_data != undefined) {
                        const name = player_data[0]
                        const session_id = player_data[1]

                        world.set(entity, Name, name)
                        world.set(entity, Player, session_id)
                        shape = scene.player_glob(name, session_id_to_color(session_id))

                        if (session_id == socket.id) {
                            world.add(entity, LocalPlayer)
                        }
                    }
                    else {
                        shape = scene.food_glob()
                    }

                    world.set(entity, Shape, shape)
                    world.set(entity, Position, point)
                    
                    entities_map.set(id, entity)
                    console.log("new entity(%d:%d:%s)", id, player_index, world.has(entity, LocalPlayer) ? "local" : "remote")
                }

                world.set(entity, Mass, mass)
                stale_entities.delete(id)
                snapshot.positions.set(entity, point)
            }

            for (const [id, entity] of stale_entities) {
                const shape = world.get(entity, Shape)
                if (shape != undefined) {
                    shape.destroy(true)
                }

                world.delete(entity)
                entities_map.delete(id)
            }

            this.leaderboard.refresh()
        })
    }

    private interpolate_positions() {
        const clock = this.clock
        const world = this.world
        const snapshots = this.snapshots

        const server_time = clock.time()
        const render_time = server_time - (UPDATE_RATE + (UPDATE_RATE * INTERP_RATIO))

        var after = snapshots[1]
        var before = snapshots[0]
        
        for (var index = 0; index < snapshots.length; index += 1) {
            const snapshot = snapshots[index]
            if (snapshot == undefined) {
                break
            }

            if (snapshot.time > render_time) {
                after = snapshot
                before = snapshots[index - 1] || snapshot
                break
            }
        }

        if (after == undefined || before == undefined) {
            return
        }

        const after_time = after.time
        const before_time = before.time
        const fraction = (render_time - before_time) / (after_time - before_time)

        const after_positions = after.positions
        const before_positions = before.positions

        for (const [entity] of world.query(Position)) {
            const after_position = after_positions.get(entity)
            const before_position = before_positions.get(entity)
            if (after_position == undefined || before_position == undefined) {
                continue
            }

            const position = new Point(
                lerp(before_position.x, after_position.x, fraction),
                lerp(before_position.y, after_position.y, fraction)
            )

            world.set(entity, Position, position)
        }
    }

    private replicate_target_point() {
        const target_point = this.input.target_point()
        if (
            this.last_target_point[0] === target_point[0] 
            && this.last_target_point[1] == target_point[1] 
        ) {
            return
        }

        this.last_target_point = target_point
        this.socket.emit("move", target_point)
    }

    private try_split(delta_time: number) {
        const debounce = this.split_debounce
        if (debounce > 0) {
            this.split_debounce = Math.max(0, debounce - delta_time)
            return
        }

        if (!this.input.should_split()) {
            return
        }

        this.split_debounce = 0.1
        this.socket.emit("split", this.input.target_point())
    }

    private try_shoot(delta_time: number) {
        const debounce = this.shoot_debounce
        if (debounce > 0) {
            this.shoot_debounce = Math.max(0, debounce - delta_time)
            return
        }

        if (!this.input.should_shoot()) {
            return
        }

        this.shoot_debounce = 0.1
        this.socket.emit("shoot", this.input.target_point())
    }

    private check_for_death() {
        var is_alive = false
        for (const [_] of this.world.query(LocalPlayer)) {
            is_alive = true
        }

        if (is_alive == false && this.was_alive == true) {
            this.on_death()
        }

        this.was_alive = is_alive
    }

    update(ticker: Ticker) {
        const scene = this.scene
        const delta_time = ticker.deltaMS / 1000

        this.clock.advance(delta_time)
        this.interpolate_positions()
        this.replicate_target_point()
        this.try_shoot(delta_time)
        this.try_split(delta_time)
        this.check_for_death()

        scene.update_globs(delta_time)
        scene.update_camera(delta_time)
    }
}