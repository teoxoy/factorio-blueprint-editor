import { EventEmitter } from 'eventemitter3'
import G from '../common/globals'
import { EditorMode } from './BlueprintContainer'

export class GridData extends EventEmitter {
    private _x = 0
    private _y = 0
    private _x16 = 0
    private _y16 = 0
    private _x32 = 0
    private _y32 = 0

    private lastMousePosX = 0
    private lastMousePosY = 0

    public constructor() {
        super()
        document.addEventListener('mousemove', e => this.update(e.clientX, e.clientY))
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

    public recalculate(): void {
        this.update(this.lastMousePosX, this.lastMousePosY)
    }

    private update(mouseX: number, mouseY: number): void {
        this.lastMousePosX = mouseX
        this.lastMousePosY = mouseY

        const oldX = this._x
        const oldY = this._y
        this._x = Math.floor((mouseX - G.BPC.position.x) / G.BPC.getViewportScale())
        this._y = Math.floor((mouseY - G.BPC.position.y) / G.BPC.getViewportScale())

        const oldX16 = this._x16
        const oldY16 = this._y16
        this._x16 = Math.floor(this._x / 16)
        this._y16 = Math.floor(this._y / 16)

        const oldX32 = this._x32
        const oldY32 = this._y32
        this._x32 = Math.floor(this._x / 32)
        this._y32 = Math.floor(this._y / 32)

        if (G.BPC.mode === EditorMode.PAN) {
            return
        }

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
