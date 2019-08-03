import G from '~/common/globals'
import Entity from '~/factorio-data/entity'
import Slot from '../../controls/slot'
import F from '../../controls/functions'

/** Module Slots for Entity */
export default class Recipe extends Slot {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    public constructor(entity: Entity) {
        super()

        this.m_Entity = entity
        this.updateContent(this.m_Entity.recipe)
        this.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => this.onSlotPointerDown(e))

        this.m_Entity.on('recipe', recipe => this.updateContent(recipe))
    }

    /** Update Content Icon */
    private updateContent(recipe: string): void {
        if (recipe === undefined) {
            if (this.content !== undefined) {
                this.content = undefined
            }
        } else {
            this.content = F.CreateIcon(recipe, false)
        }
        this.emit('changed')
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: PIXI.interaction.InteractionEvent): void {
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
