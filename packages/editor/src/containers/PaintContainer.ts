import * as PIXI from 'pixi.js'
import G from '../common/globals'
import F from '../UI/controls/functions'
import { BlueprintContainer } from './BlueprintContainer'

export abstract class PaintContainer extends PIXI.Container {
    protected readonly bpc: BlueprintContainer
    private readonly icon: PIXI.DisplayObject
    private _blocked = false
    private tint = {
        r: 0.4,
        g: 1,
        b: 0.4,
        a: 1,
    }

    protected constructor(bpc: BlueprintContainer, name: string) {
        super()
        this.bpc = bpc
        this.name = name

        this.on('childAdded', (s: PIXI.Sprite) => F.applyTint(s, this.tint))

        this.icon = F.CreateIcon(this.getItemName())
        G.UI.addPaintIcon(this.icon)
        window.addEventListener('mousemove', this.updateIconPos)
        this.show()
    }

    protected get blocked(): boolean {
        return this._blocked
    }

    protected set blocked(value: boolean) {
        this._blocked = value
        this.tint.r = this.blocked ? 1 : 0.4
        this.tint.g = this.blocked ? 0.4 : 1
        for (const s of this.children) {
            F.applyTint(s as PIXI.Sprite, this.tint)
        }
    }

    public hide(): void {
        this.visible = false
        this.updateIconPos()
        this.icon.visible = true
    }

    public show(): void {
        this.visible = true
        this.icon.visible = false
    }

    public destroy(): void {
        this.emit('destroy')
        window.removeEventListener('mousemove', this.updateIconPos)
        this.icon.destroy()
        super.destroy()
    }

    protected getGridPosition(): IPoint {
        return {
            x: Math.round((this.x / 32) * 10) / 10,
            y: Math.round((this.y / 32) * 10) / 10,
        }
    }

    protected setNewPosition(size: IPoint): void {
        if (size.x % 2 === 0) {
            const npx = this.bpc.gridData.x16 * 16
            this.x = npx + (npx % 32 === 0 ? 0 : 16)
        } else {
            this.x = this.bpc.gridData.x32 * 32 + 16
        }

        if (size.y % 2 === 0) {
            const npy = this.bpc.gridData.y16 * 16
            this.y = npy + (npy % 32 === 0 ? 0 : 16)
        } else {
            this.y = this.bpc.gridData.y32 * 32 + 16
        }
    }

    private readonly updateIconPos = (): void => {
        const im = G.app.renderer.plugins.interaction as PIXI.InteractionManager
        const position = im.mouse.global
        this.icon.position.set(position.x + 16, position.y + 16)
    }

    // override
    public abstract getItemName(): string

    // override
    public abstract rotate(ccw?: boolean): void

    // override
    protected abstract redraw(): void

    // override
    public abstract moveAtCursor(): void

    // override
    public abstract removeContainerUnder(): void

    // override
    public abstract placeEntityContainer(): void
}
