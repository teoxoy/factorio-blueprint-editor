import { EventEmitter } from 'eventemitter3'
import { EditorMode, BlueprintContainer } from './BlueprintContainer'

export class GridData extends EventEmitter {
    private readonly bpc: BlueprintContainer

    private _x = 0
    private _y = 0
    private _x16 = 0
    private _y16 = 0
    private _x32 = 0
    private _y32 = 0

    private lastMousePosX = 0
    private lastMousePosY = 0

    public constructor(bpc: BlueprintContainer) {
        super()
        this.bpc = bpc

        const onMouseMove = (e: MouseEvent): void => this.update(e.clientX, e.clientY)
        document.addEventListener('mousemove', onMouseMove)
        this.on('destroy', () => document.removeEventListener('mousemove', onMouseMove))
    }

    /** mouse x */
    public get x(): number {
        return this._x
    }
    /** mouse y */
    public get y(): number {
        return this._y
    }
    /** mouse x in 16 pixel size grid */
    public get x16(): number {
        return this._x16
    }
    /** mouse y in 16 pixel size grid */
    public get y16(): number {
        return this._y16
    }
    /** mouse x in 32 pixel size grid */
    public get x32(): number {
        return this._x32
    }
    /** mouse y in 32 pixel size grid */
    public get y32(): number {
        return this._y32
    }

    public destroy(): void {
        this.emit('destroy')
    }

    public recalculate(): void {
        this.update(this.lastMousePosX, this.lastMousePosY)
    }

    private update(mouseX: number, mouseY: number): void {
        if (!this.bpc) return

        this.lastMousePosX = mouseX
        this.lastMousePosY = mouseY

        const oldX = this._x
        const oldY = this._y
        const [X, Y] = this.bpc.toWorld(mouseX, mouseY)
        this._x = Math.floor(X)
        this._y = Math.floor(Y)

        const oldX16 = this._x16
        const oldY16 = this._y16
        this._x16 = Math.floor(this._x / 16)
        this._y16 = Math.floor(this._y / 16)

        const oldX32 = this._x32
        const oldY32 = this._y32
        this._x32 = Math.floor(this._x / 32)
        this._y32 = Math.floor(this._y / 32)

        if (this.bpc.mode === EditorMode.PAN) return

        // emit update when mouse changes tile whithin the 1 pixel size grid
        if (!(oldX === this._x && oldY === this._y)) {
            this.emit('update', this._x, this._y)
        }
        // emit update16 when mouse changes tile whithin the 16 pixel size grid
        if (!(oldX16 === this._x16 && oldY16 === this._y16)) {
            this.emit('update16', this._x16, this._y16)
        }
        // emit update32 when mouse changes tile whithin the 32 pixel size grid
        if (!(oldX32 === this._x32 && oldY32 === this._y32)) {
            this.emit('update32', this._x32, this._y32)
        }
    }
}
