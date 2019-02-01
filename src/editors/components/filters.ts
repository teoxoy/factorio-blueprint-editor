import Slot from '../../controls/slot'
import { InventoryContainer } from '../../panels/inventory'
import Entity from '../../factorio-data/entity'

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

    /* Blueprint Logist Chests
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

    /** Field to indicate whether counts can shall be shown (Used for 2 chests) */
    private readonly m_Amount: boolean

    /** Field to hold data for module visualization */
    private m_Filters: IFilter[]

    constructor(entity: Entity, amount: boolean = false) {
        super()

        // Store entity data reference for later usage
        this.m_Entity = entity
        this.m_Amount = amount

        // Get filters from entity
        this.m_UpdateFilters()

        // Create slots for entity
        for (let slotIndex = 0; slotIndex < this.m_Filters.length; slotIndex++) {
            const slot: Slot = new Slot()
            slot.position.set((slotIndex % 6) * 38, Math.floor(slotIndex / 6) * 38)
            slot.data = slotIndex
            slot.on('pointerdown', this.onSlotPointerDown)
            this.addChild(slot)
        }
        this.m_UpdateSlots()

        // Listen to filter changes on entity
        this.m_Entity.on('filters', () => {
            this.m_UpdateFilters()
            this.m_UpdateSlots()
        })
    }

    /** Clear currently set filter */
    public clearSlot(index: number = 0) {
        this.m_Filters[index].name = undefined
        this.m_Entity.filters = this.m_Filters
        this.emit('changed', false)
    }

    /** Update local filters array */
    private m_UpdateFilters() {
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
    }

    /** Update slot icons */
    private m_UpdateSlots(index?: number) {
        for (const slot of this.children) {
            if (!(slot instanceof Slot)) continue

            const slotIndex: number = slot.data as number
            const slotFilter: IFilter = this.m_Filters[slotIndex]

            if (slotFilter.name === undefined) {
                if (slot.content !== undefined) {
                    slot.content = undefined
                }
            } else {
                if (slot.content === undefined || slot.name !== slotFilter.name) {
                    if (this.m_Amount) {
                        slot.content = new PIXI.Container()
                        InventoryContainer.createIconWithAmount(slot.content as PIXI.Container, -16, -16, slotFilter.name, slotFilter.count)
                    } else {
                        slot.content = InventoryContainer.createIcon(slotFilter.name, false)
                    }
                    slot.name = slotFilter.name
                }
            }
        }
    }

    /** Slot pointer down event handler */
    private readonly onSlotPointerDown = (e: PIXI.interaction.InteractionEvent) => {
        e.stopPropagation()
        const slot: Slot = e.target as Slot
        const index: number = slot.data as number
        if (e.data.button === 0) {
            const inventory: InventoryContainer = new InventoryContainer('Set the Filter', this.m_Entity.acceptedFilters, name => {
                inventory.close()
                this.m_Filters[index].name = name
                this.m_Entity.filters = this.m_Filters
                this.emit('changed', true)
            })
            inventory.show()
        } else if (e.data.button === 2) {
            this.clearSlot(index)
        }
    }
}
