import * as PIXI from 'pixi.js'
import Slot from '../../controls/slot'
import { InventoryContainer } from '../../panels/inventory'
import Entity from '../../factorio-data/entity'
import F from '../../controls/functions'

/** Module Slots for Entity */
export default class Modules extends PIXI.Container {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    /** Field to hold data for module visualization */
    private readonly m_Modules: string[]

    constructor(entity: Entity) {
        super()

        // Store entity data reference for later usage
        this.m_Entity = entity

        // Get modules from entity
        this.m_Modules = new Array(this.m_Entity.moduleSlots)
        const modules = this.m_Entity.modules
        if (modules !== undefined) {
            for (let slotIndex = 0; slotIndex < this.m_Modules.length; slotIndex++) {
                this.m_Modules[slotIndex] =
                    modules.length > slotIndex && modules[slotIndex] !== undefined ? modules[slotIndex] : undefined
            }
        }

        // Create slots for entity
        for (let slotIndex = 0; slotIndex < this.m_Modules.length; slotIndex++) {
            const slot: Slot = new Slot()
            slot.position.set(slotIndex * 38, 0)
            slot.data = slotIndex
            slot.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => this.onSlotPointerDown(e))
            if (this.m_Modules[slotIndex] !== undefined) {
                slot.content = F.CreateIcon(this.m_Modules[slotIndex], false)
            }
            this.addChild(slot)
        }

        this.m_Entity.on('modules', modules =>
            [...modules, ...Array(this.m_Entity.moduleSlots - modules.length).fill(undefined)].forEach(
                (m: string, i: number) => {
                    this.m_Modules[i] = m
                    this.updateContent(this.getChildAt(i) as Slot, m)
                }
            )
        )
    }

    /** Update Content Icon */
    private updateContent(slot: Slot, module: string) {
        if (module === undefined) {
            if (slot.content !== undefined) {
                slot.content = undefined
            }
        } else {
            slot.content = F.CreateIcon(module, false)
        }
        this.emit('changed')
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: PIXI.interaction.InteractionEvent) {
        e.stopPropagation()
        const slot: Slot = e.target as Slot
        const index: number = slot.data as number
        if (e.data.button === 0) {
            new InventoryContainer('Select Module', this.m_Entity.acceptedModules, name => {
                this.m_Modules[index] = name
                this.m_Entity.modules = this.m_Modules
            }).show()
        } else if (e.data.button === 2) {
            this.m_Modules[index] = undefined
            this.m_Entity.modules = this.m_Modules
        }
    }
}
