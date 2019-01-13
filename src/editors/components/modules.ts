import Slot from '../../controls/slot'
import { IEntity } from '../../interfaces/iBlueprintEditor'
import { InventoryContainer } from '../../panels/inventory'
import { EntityContainer } from '../../containers/entity'

/** Module Slots for Entity */
export default class Modules extends  PIXI.Container {

    /** Blueprint Editor Entity reference */
    private readonly m_Entity: IEntity

    /** Field to hold data for module visualization */
    private readonly m_Modules: string[]

    constructor(entity: IEntity) {
        super()

        // Store entity data reference for later usage
        this.m_Entity = entity

        // Get modules from entity
        this.m_Modules = new Array(this.m_Entity.entityData.module_specification.module_slots)
        const modules = this.m_Entity.modules
        if (modules !== undefined) {
            for (let slotIndex = 0; slotIndex < this.m_Modules.length; slotIndex++) {
                this.m_Modules[slotIndex] = modules.length > slotIndex && modules[slotIndex] !== undefined ? modules[slotIndex] : undefined
            }
        }

        // Create slots for entity
        for (let slotIndex = 0; slotIndex < this.m_Modules.length; slotIndex++) {
            const slot: Slot = new Slot()
            slot.position.set(slotIndex * 38, 0)
            slot.data = slotIndex
            slot.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => this.onSlotPointerDown(e))
            if (this.m_Modules[slotIndex] !== undefined) {
                slot.content = InventoryContainer.createIcon(this.m_Modules[slotIndex], false)
            }
            this.addChild(slot)
        }
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: PIXI.interaction.InteractionEvent) {
        e.stopPropagation()
        const slot: Slot = e.target as Slot
        const index: number = slot.data as number
        if (e.data.button === 0) {
            const inventory: InventoryContainer = new InventoryContainer('Select Module', this.m_Entity.acceptedModules, name => {
                inventory.close()
                this.m_Modules[index] = name
                this.m_Entity.modules = this.m_Modules
                EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
                slot.content = InventoryContainer.createIcon(name, false)
                this.emit('changed')
            })
            inventory.show()
        } else if (e.data.button === 2) {
            this.m_Modules[index] = undefined
            this.m_Entity.modules = this.m_Modules
            EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
            if (slot.content !== undefined) {
                slot.content.destroy()
            }
            this.emit('changed')
        }
    }
}
