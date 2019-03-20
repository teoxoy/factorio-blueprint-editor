import { AdjustmentFilter } from '@pixi/filter-adjustment'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import F from '../controls/functions'

export abstract class PaintContainer extends PIXI.Container {
    filter: AdjustmentFilter
    icon: PIXI.DisplayObject

    constructor(name: string) {
        super()

        this.name = name

        this.filter = new AdjustmentFilter({ red: 0.4, green: 1, blue: 0.4 })
        this.filters = [this.filter]

        this.icon = F.CreateIcon(this.getItemName())
        this.icon.visible = false
        G.paintIconContainer.addChild(this.icon)
        this.updateIconPos = this.updateIconPos.bind(this)
        window.addEventListener('mousemove', this.updateIconPos)
        this.updateIconPos()
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
        const mousePos = G.BPC.gridData.mousePositionInBPC

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
