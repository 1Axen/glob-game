import { LocalPlayer, Mass, Player, Name } from "./components"
import { Id, World } from "./libs/ecs"

const DEFAULT_NAME = "An unnamed cell"
const LEADERBOARD_SIZE = 10

interface Entry {
    name: string,
    score: number,
    local_player: boolean,
}

export default class Leaderboard {
    private div: HTMLDivElement
    private world: World

    constructor(world: World, div: HTMLDivElement) {
        this.div = div
        this.world = world
    }

    refresh() {
        const world = this.world

        const score_map: Map<string, Entry> = new Map()
        for (const [entity, name, mass, session] of world.query(Name, Mass, Player)) {
            var entry: Entry | undefined = score_map.get(session)
            if (entry == undefined) {
                entry = {
                    name: name,
                    score: mass,
                    local_player: world.has(entity, LocalPlayer)
                }
                score_map.set(session, entry)
                continue
            }

            entry.score += mass
        }

        const entries: Entry[] = []
        for (const entry of score_map.values()) {
            entries.push(entry);
        }

        entries.sort((a, b) => {
            return b.score - a.score
        })
        
        var html = `<span class="title">Leaderboard</span>`
        for (var index = 0; index < LEADERBOARD_SIZE; index++) {
            const entry = entries[index]
            if (entry == undefined) {
                break
            }

            html += "<br/>"
            if (entry.local_player) {
                html += `<span class="me">`
            }

            html += `${index + 1}. ${entry.name}`

            if (entry.local_player) {
                html += `</span>`
            }
        }

        this.div.innerHTML = html
    }
}