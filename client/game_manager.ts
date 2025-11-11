import { Socket } from "socket.io-client";
import { Id, World } from "./ecs";
import GameScene from "./game_scene";
import { Color, Point, Ticker } from "pixi.js";
import { LocalPlayer, Mass, Player, Position, Shape } from "./components";
import { server } from "../config.json"
import SyncedClock from "./synced_clock";

type GlobData = [number, number, [number, number], number]
type PlayerData = [string, string]
type WorldState = [number, PlayerData[], GlobData[]]

interface Snapshot {
    time: number,
    positions: Map<Id, Point>
}

const UPDATE_RATE = 1 / server.update_rate
const INTERP_RATIO = 2
const MAX_SNAPSHOTS = server.update_rate

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function random_color(): Color {
    return new Color({
        r: Math.random() * 255,
        g: Math.random() * 255,
        b: Math.random() * 255,
    })
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
    private socket: Socket
    private snapshots: Snapshot[]

    constructor(world: World, scene: GameScene, socket: Socket) {
        const clock = new SyncedClock()
        const snapshots: Snapshot[] = []

        this.clock = clock
        this.world = world
        this.scene = scene
        this.socket = socket
        this.snapshots = snapshots

        const entities_map: Map<number, Id> = new Map()
        const local_session_id = socket.id

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

                const player_data = players[glob[3]] || []
                const name = player_data[0]
                const session_id = player_data[1]

                var entity = entities_map.get(id)
                const point = new Point(position[0], position[1])

                if (entity == undefined) {
                    const color = session_id != undefined 
                        ? session_id_to_color(session_id) 
                        : random_color()
                    const shape = scene.glob(color, name)

                    entity = world.entity()
                    world.set(entity, Shape, shape)
                    world.set(entity, Position, point)

                    if (player_data != undefined) {
                        world.add(entity, Player)
                    }
                    
                    if (session_id == local_session_id) {
                        world.add(entity, LocalPlayer)
                    }
                    
                    entities_map.set(id, entity)
                    console.log("new entity(%d:%s:%s)", id, name, session_id)
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

        for (const [entity] of world.query(Player).with(Position)) {
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

    update(ticker: Ticker) {
        const scene = this.scene

        this.clock.advance(ticker.deltaMS / 1000)
        this.interpolate_positions()

        scene.update_globs(ticker)
        scene.update_camera()
    }
}