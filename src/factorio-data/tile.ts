import { Blueprint } from './blueprint'

export class Tile {

    id: number
    bp: any
    name: any
    position: any

    constructor(data: any, bp: Blueprint) {
        this.id = -1
        this.bp = bp
        this.name = data.name
        if (!data.position || data.position.x === undefined || data.position.y === undefined) {
            throw new Error(`Invalid position provided: ${data.position}`)
        }
        this.position = data.position
    }

    remove() {
        return this.bp.removeTile(this)
    }

    getData() {
        return {
            name: this.name,
            position: this.position
        }
    }
}
