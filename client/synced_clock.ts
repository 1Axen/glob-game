const MAX_OFFSET = 50 / 1000

export default class SyncedClock {
    private offset: number = 0
    private local_time: number = 0

    time(): number {
        return this.local_time - this.offset
    }

    sync(remote_server_time: number) {
        const old_offset = this.offset
        const new_offset = this.local_time - remote_server_time

        const offset_delta = Math.abs(old_offset - new_offset)
        if (offset_delta > MAX_OFFSET) {
            this.offset = new_offset
        }
    }

    advance(delta_time: number) {
        this.local_time += delta_time
    }
}