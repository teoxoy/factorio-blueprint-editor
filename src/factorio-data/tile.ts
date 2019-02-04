import EventEmitter from 'eventemitter3'

export default class Tile extends EventEmitter {
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
