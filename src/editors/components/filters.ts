import FD from 'factorio-data'
import * as PIXI from 'pixi.js'
import Slot from '../../controls/slot'
import Entity from '../../factorio-data/entity'
import { InventoryContainer } from '../../panels/inventory'
import F from '../../controls/functions'

/** Module Slots for Entity */
export default class Filters extends PIXI.Container {
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

    /** Field to indicate whether counts shall be shown (Used for 2 chests) */
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

    /**
     * Update filter count
     * @param index - Index of filter
     * @param count - New count
     */
    public updateFilter(index: number, count: number) {
        if (this.m_Filters[index].count === count) {
            return
        }
        this.m_Filters[index].count = count
        this.m_Entity.filters = this.m_Filters
        this.m_UpdateSlots()
    }

    /**
     * Return filter count of specific filter
     * @param index Index of filter
     */
    public getFilterCount(index: number) {
        return this.m_Filters[index].count
    }

    /** Update local filters array */
    private m_UpdateFilters() {
        const slots: number = this.m_Entity.filterSlots
        if (slots > 0) {
            this.m_Filters = new Array(slots)
            const filters = this.m_Entity.filters
            if (filters !== undefined) {
                for (const item of filters) {
                    this.m_Filters[item.index - 1] = { index: item.index, name: item.name, count: item.count }
                }
            }
            for (let slotIndex = 0; slotIndex < slots; slotIndex++) {
                this.m_Filters[slotIndex] =
                    this.m_Filters[slotIndex] === undefined
                        ? { index: slotIndex + 1, name: undefined }
                        : this.m_Filters[slotIndex]
            }
        }
    }

    /** Update slot icons */
    private m_UpdateSlots() {
        for (const slot of this.children) {
            if (!(slot instanceof Slot)) {
                continue
            }

            const slotIndex: number = slot.data as number
            const slotFilter: IFilter = this.m_Filters[slotIndex]

            if (slotFilter.name === undefined) {
                if (slot.content !== undefined) {
                    slot.content = undefined
                }
            } else {
                if (slot.content === undefined || slot.name !== slotFilter.name || this.m_Amount) {
                    if (this.m_Amount) {
                        if (slot.content !== undefined) {
                            const text = slot.children[1] as PIXI.Text
                            if (text.text !== slotFilter.count.toString()) {
                                slot.content = undefined
                            }
                        }
                        slot.content = new PIXI.Container()
                        F.CreateIconWithAmount(
                            slot.content as PIXI.Container,
                            -16,
                            -16,
                            slotFilter.name,
                            slotFilter.count
                        )
                    } else {
                        slot.content = F.CreateIcon(slotFilter.name, false)
                    }
                    slot.name = slotFilter.name
                }
            }
        }

        this.emit('changed')
    }

    /** Slot pointer down event handler */
    private readonly onSlotPointerDown = (e: PIXI.interaction.InteractionEvent) => {
        e.stopPropagation()
        const slot: Slot = e.target as Slot
        const index: number = slot.data as number
        if (e.data.button === 0) {
            if (!this.m_Amount || this.m_Filters[index].name === undefined) {
                new InventoryContainer('Select Filter', this.m_Entity.acceptedFilters, name => {
                    this.m_Filters[index].name = name
                    if (this.m_Amount) {
                        this.m_Filters[index].count = FD.items[name].stack_size
                    }
                    this.m_Entity.filters = this.m_Filters

                    if (this.m_Amount) {
                        this.emit('selected', index, this.m_Filters[index].count)
                    }
                }).show()
            } else {
                if (this.m_Amount) {
                    this.emit('selected', index, this.m_Filters[index].count)
                }
            }
        } else if (e.data.button === 2) {
            this.m_Filters[index].name = undefined
            this.m_Entity.filters = this.m_Filters
            if (this.m_Amount) {
                this.emit('selected', -1, 0)
            }
        }
    }
}
