import Slot from '../../controls/slot'
import { InventoryContainer } from '../../panels/inventory'
import { EntityContainer } from '../../containers/entity'
import Entity from '../../factorio-data/entity'

// TODO: Integrate showing stack size of slots for requester and buffer chest
// TODO: Include modules filter settings in copye paste
// TODO: Show splitter filter in editor preview << will only be shown when input and output priorty is set

/** Module Slots for Entity */
export default class Filters extends  PIXI.Container {

    /* Blueprint Splitters
    ########################
    entity_number: 1
    filter: "assembling_machine_2"
    input_priority: "right"
    name: "express_splitter"
    output_priority: "left"
    position: { x: -0.5, y: 0 }
    // Filter Slots: 1
    // Filter Count: N/A
    */

    /* Blueprint Filter Inserters
    ########################
    entity_number: 1
    filters: Array(2)
        0: {index: 1, name: "long_handed_inserter"}
        1: {index: 2, name: "inserter"}
    name: "filter_inserter"
    override_stack_size: 3
    position: {x: -1, y: 0}
    // Filter Slots: 5
    // Filter Count: N/A >> Does not need to be written
    ########################
    entity_number: 2
    filters: Array(1)
        0: {index: 1, name: "express_transport_belt"}
    length: 1
    name: "stack_filter_inserter"
    override_stack_size: 10
    position: {x: 0, y: 0}
    // Filter Slots: 1
    // Filter Count: N/A >> Does not need to be written
    */

    /* Blueprint Logist  Chests
    ########################
    entity_number: 2
    name: "logistic_chest_storage"
    position: {x: 0, y: 0}
    request_filters: Array(1)
        0: {index: 1, name: "assembling_machine_2", count: 0}
    // Filter Slots: 1
    // Filter Count: N/A >> Needs to be written as 0
    ########################
    entity_number: 4
    name: "logistic_chest_requester"
    position: {x: 0, y: 2}
    request_filters: Array(1)
        0: {index: 1, name: "logistic_chest_storage", count: 50}
    request_from_buffers: true
    // Filter Slots: 12
    // Filter Count: Stack Size
    ########################
    entity_number: 5
    name: "logistic_chest_buffer"
    position: {x: 0, y: 1}
    request_filters: Array(2)
        0: {index: 1, name: "assembling_machine_2", count: 50}
        1: {index: 2, name: "assembling_machine_3", count: 10}
    // Filter Slots: 12
    // Filter Count: Stack Size
    */

    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    /** Field to hold data for module visualization */
    private readonly m_Filters: IFilter[]

    constructor(entity: Entity) {
        super()

        // Store entity data reference for later usage
        this.m_Entity = entity

        // Get filters from entity
        const slots: number = this.m_Entity.filterSlots
        if (slots > 0) {
            this.m_Filters = new Array(slots)
            const filters = this.m_Entity.filters
            if (filters !== undefined) {
                for (const item of filters) {
                    this.m_Filters[item.index - 1] = item
                }
            }
            for (let slotIndex = 0; slotIndex < slots; slotIndex++) {
                this.m_Filters[slotIndex] =
                    this.m_Filters[slotIndex] === undefined ?
                    { index: slotIndex + 1, name: undefined } :
                    this.m_Filters[slotIndex]
            }
        }

        // Create slots for entity
        for (let slotIndex = 0; slotIndex < this.m_Filters.length; slotIndex++) {
            const slot: Slot = new Slot()
            slot.position.set(slotIndex * 38, 0)
            slot.data = slotIndex
            slot.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => this.onSlotPointerDown(e))
            if (this.m_Filters[slotIndex].name !== undefined) {
                slot.content = InventoryContainer.createIcon(this.m_Filters[slotIndex].name, false)
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
            const inventory: InventoryContainer = new InventoryContainer('Set the Filter', this.m_Entity.acceptedFilters, name => {
                inventory.close()
                this.m_Filters[index].name = name
                this.m_Entity.filters = this.m_Filters
                EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
                slot.content = InventoryContainer.createIcon(name, false)
                this.emit('changed')
            })
            inventory.show()
        } else if (e.data.button === 2) {
            this.m_Filters[index].name = undefined
            this.m_Entity.filters = this.m_Filters
            EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
            if (slot.content !== undefined) {
                slot.content.destroy()
            }
            this.emit('changed')
        }
    }
}
