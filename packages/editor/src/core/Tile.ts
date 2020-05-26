import EventEmitter from 'eventemitter3'
import FD from 'factorio-data'

export class Tile extends EventEmitter {
    private readonly _name: string
    private readonly _x: number
    private readonly _y: number

    public constructor(name: string, x: number, y: number) {
        super()

        this._name = name
        this._x = x
        this._y = y
    }

    public static getItemName(name: string): string {
        if (name === 'landfill') {
            return 'landfill'
        }
        return FD.tiles[name].minable.result
    }

    public get name(): string {
        return this._name
    }

    public get x(): number {
        return this._x
    }

    public get y(): number {
        return this._y
    }

    public get hash(): string {
        return `${this._x},${this._y}`
    }

    public destroy(): void {
        this.emit('destroy')
        this.removeAllListeners()
    }
}
