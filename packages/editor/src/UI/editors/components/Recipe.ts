import * as PIXI from 'pixi.js'
import G from '../../../common/globals'
import { Entity } from '../../../core/Entity'
import { Slot } from '../../controls/Slot'
import F from '../../controls/functions'

/** Module Slots for Entity */
export class Recipe extends Slot {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    public constructor(entity: Entity) {
        super()

        this.m_Entity = entity
        this.updateContent(this.m_Entity.recipe)
        this.on('pointerdown', (e: PIXI.InteractionEvent) => this.onSlotPointerDown(e))

        this.onEntityChange('recipe', recipe => this.updateContent(recipe))
    }

    private onEntityChange(event: string, fn: (...args: any[]) => void): void {
        this.m_Entity.on(event, fn)
        this.once('destroy', () => this.m_Entity.off(event, fn))
    }

    public destroy(opts?: boolean | PIXI.IDestroyOptions): void {
        this.emit('destroy')
        super.destroy(opts)
    }

    /** Update Content Icon */
    private updateContent(recipe: string): void {
        if (recipe === undefined) {
            if (this.content !== undefined) {
                this.content = undefined
            }
        } else {
            this.content = F.CreateIcon(recipe)
        }
        this.emit('changed')
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: PIXI.InteractionEvent): void {
        e.stopPropagation()
        if (e.data.button === 0) {
            G.UI.createInventory('Select Recipe', this.m_Entity.acceptedRecipes, name => {
                this.m_Entity.recipe = name
            })
        } else if (e.data.button === 2) {
            this.m_Entity.recipe = undefined
        }
    }
}
