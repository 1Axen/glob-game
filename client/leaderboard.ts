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

        const score_map: Map<Id, number> = new Map()
        for (const [entity, mass] of world.query(Mass).with(Player)) {
            const score = score_map.get(entity) || 0
            score_map.set(entity, score + mass)
        }

        const entries: Entry[] = []
        for (const [entity, score] of score_map.entries()) {
            var name = world.get(entity, Name)
            if (name == undefined || name === "") {
                name = DEFAULT_NAME
            }

            entries.push({
                name,
                score,
                local_player: world.has(entity, LocalPlayer)
            })
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