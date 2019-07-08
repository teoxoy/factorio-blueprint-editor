import * as PIXI from 'pixi.js'
import G from '../common/globals'
import F from '../controls/functions'

export abstract class PaintContainer extends PIXI.Container {
    icon: PIXI.DisplayObject
    private _blocked: boolean = false

    constructor(name: string) {
        super()

        this.name = name

        this.on('added', this.applyTint.bind(this))

        this.icon = F.CreateIcon(this.getItemName())
        this.icon.visible = false
        G.paintIconContainer.addChild(this.icon)
        this.updateIconPos = this.updateIconPos.bind(this)
        window.addEventListener('mousemove', this.updateIconPos)
        this.updateIconPos()
    }

    get blocked() {
        return this._blocked
    }

    set blocked(value: boolean) {
        this._blocked = value
        this.applyTint()
    }

    private applyTint() {
        const t = {
            r: this.blocked ? 1 : 0.4,
            g: this.blocked ? 0.4 : 1,
            b: 0.4,
            a: 1
        }
        this.children.forEach((s: PIXI.Sprite) => F.applyTint(s, t))
    }

    hide() {
        this.visible = false
        this.updateIconPos()
        this.icon.visible = true
    }

    show() {
        this.visible = true
        this.icon.visible = false
    }

    destroy() {
        this.emit('destroy')
        window.removeEventListener('mousemove', this.updateIconPos)
        this.icon.destroy()
        super.destroy()
    }

    // override
    abstract getItemName(): string

    // override
    abstract rotate(ccw?: boolean): void

    // override
    redraw() {}

    // override
    moveAtCursor() {}

    // override
    removeContainerUnder() {}

    // override
    placeEntityContainer() {}

    getGridPosition() {
        return {
            x: Math.round((this.x / 32) * 10) / 10,
            y: Math.round((this.y / 32) * 10) / 10
        }
    }

    setNewPosition(size: IPoint) {
        const mousePos = G.BPC.gridData

        if (size.x % 2 === 0) {
            const npx = mousePos.x - (mousePos.x % 16)
            this.x = npx + (npx % 32 === 0 ? 0 : 16)
        } else {
            this.x = mousePos.x - (mousePos.x % 32) + 16
        }

        if (size.y % 2 === 0) {
            const npy = mousePos.y - (mousePos.y % 16)
            this.y = npy + (npy % 32 === 0 ? 0 : 16)
        } else {
            this.y = mousePos.y - (mousePos.y % 32) + 16
        }
    }

    private updateIconPos() {
        const position = G.app.renderer.plugins.interaction.mouse.global
        this.icon.position.set(position.x + 16, position.y + 16)
    }
}
