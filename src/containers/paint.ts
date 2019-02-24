import G from '../common/globals'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import { InventoryContainer } from '../panels/inventory'
import * as PIXI from 'pixi.js'

export abstract class PaintContainer extends PIXI.Container {

    filter: AdjustmentFilter
    icon: PIXI.DisplayObject

    constructor(name: string, position: IPoint) {
        super()

        this.name = name
        this.position.set(position.x, position.y)

        this.filter = new AdjustmentFilter({ red: 0.4, green: 1, blue: 0.4 })
        this.filters = [this.filter]

        this.icon = InventoryContainer.createIcon(this.getItemName())
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
    getItemName(): string {
        return
    }

    // override
    rotate(ccw?: boolean) {
        return
    }

    // override
    redraw() {
        return
    }

    // override
    moveAtCursor() {
        return
    }

    // override
    removeContainerUnder() {
        return
    }

    // override
    placeEntityContainer() {
        return
    }

    private updateIconPos() {
        const position = G.app.renderer.plugins.interaction.mouse.global
        this.icon.position.set(position.x + 16, position.y + 16)
    }
}
