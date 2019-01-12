import Slot from '../../controls/slot'
import { IEntity } from '../../interfaces/iBlueprintEditor'
import { InventoryContainer } from '../../panels/inventory'
import { EntityContainer } from '../../containers/entity'

/** Module Slots for Entity */
export default class Recipe extends Slot {

    /** Blueprint Editor Entity reference */
    private readonly m_Entity: IEntity

    constructor(entity: IEntity) {
        super()

        this.m_Entity = entity
        this.updateContent(this.m_Entity.recipe)
        this.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => this.onSlotPointerDown(e))
    }

    /** Update Content Icon */
    private updateContent(recipe: string) {
        if (recipe === undefined) {
            if (this.content !== undefined) {
                this.content.destroy()
            }
        } else {
            this.content = InventoryContainer.createIcon(recipe, false)
        }
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: PIXI.interaction.InteractionEvent) {
        e.stopPropagation()
        if (e.data.button === 0) {
            const inventory: InventoryContainer = new InventoryContainer('Select Recipe', this.m_Entity.acceptedRecipes, name => {
                inventory.close()
                EntityContainer.mappings.get(this.m_Entity.entity_number).changeRecipe(name)
                this.updateContent(name)
            })
            inventory.show()
        } else if (e.data.button === 2) {
            // TODO: Move the check whether the recipe is empty or not should in done in 'entity.ts'
            // >> Once there the blueprint needs to update based on teh change in 'entity.ts' instead of
            //    this component updating the blueprint and then the blueprint the 'entity.ts'
            if (this.m_Entity.recipe !== undefined) {
                EntityContainer.mappings.get(this.m_Entity.entity_number).changeRecipe(undefined)
                this.updateContent(undefined)
            }
        }
    }
}
