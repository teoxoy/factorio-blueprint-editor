import EventEmitter from 'eventemitter3'
import FD from 'factorio-data'

export default class Tile extends EventEmitter {
    static getItemName(name: string) {
        if (name === 'landfill') {
            return 'landfill'
        }
        return FD.tiles[name].minable.result
    }

    name: string
    position: IPoint

    constructor(name: string, position: IPoint) {
        super()

        this.name = name
        this.position = position
    }

    get hash() {
        return `${this.position.x},${this.position.y}`
    }

    destroy() {
        this.emit('destroy')
        this.removeAllListeners()
    }
}
