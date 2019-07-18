import EventEmitter from 'eventemitter3'
import FD from 'factorio-data'

export default class Tile extends EventEmitter {
    public static getItemName(name: string) {
        if (name === 'landfill') {
            return 'landfill'
        }
        return FD.tiles[name].minable.result
    }

    private readonly _name: string
    private readonly _x: number
    private readonly _y: number

    public constructor(name: string, x: number, y: number) {
        super()

        this._name = name
        this._x = x
        this._y = y
    }

    public get name() {
        return this._name
    }

    public get x() {
        return this._x
    }

    public get y() {
        return this._y
    }

    public get hash() {
        return `${this._x},${this._y}`
    }

    public destroy() {
        this.emit('destroy')
        this.removeAllListeners()
    }
}
