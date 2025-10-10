import { Container, FederatedPointerEvent } from 'pixi.js'
import EventEmitter from 'eventemitter3'
import G from '../../../common/globals'
import { Entity, EntityEvents } from '../../../core/Entity'
import { Slot } from '../../controls/Slot'
import F from '../../controls/functions'

/** Module Slots for Entity */
export class Modules extends Container<Slot<number>> {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    /** Field to hold data for module visualization */
    private readonly m_Modules: string[]

    public constructor(entity: Entity) {
        super()

        // Store entity data reference for later usage
        this.m_Entity = entity

        // Get modules from entity
        this.m_Modules = this.m_Entity.modules

        // Create slots for entity
        for (let slotIndex = 0; slotIndex < this.m_Modules.length; slotIndex++) {
            const slot = new Slot<number>()
            slot.position.set(slotIndex * 38, 0)
            slot.data = slotIndex
            slot.on('pointerdown', this.onSlotPointerDown, this)
            if (this.m_Modules[slotIndex] !== undefined) {
                slot.content = F.CreateIcon(this.m_Modules[slotIndex])
            }
            this.addChild(slot)
        }

        this.onEntityChange('modules', modules => {
            for (const [i, module] of modules.entries()) {
                this.m_Modules[i] = module
                this.updateContent(this.getChildAt(i), module)
            }
        })
    }

    private onEntityChange<T extends EventEmitter.EventNames<EntityEvents>>(
        event: T,
        fn: EventEmitter.EventListener<EntityEvents, T>
    ): void {
        this.m_Entity.on(event, fn)
        this.once('destroyed', () => this.m_Entity.off(event, fn))
    }

    /** Update Content Icon */
    private updateContent(slot: Slot<number>, module: string): void {
        if (module === undefined) {
            if (slot.content !== undefined) {
                slot.content = undefined
            }
        } else {
            slot.content = F.CreateIcon(module)
        }
        this.emit('changed')
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: FederatedPointerEvent): void {
        e.stopPropagation()
        const slot = e.target as Slot<number>
        const index = slot.data
        if (e.button === 0) {
            G.UI.createInventory('Select Module', this.m_Entity.acceptedModules, name => {
                this.m_Modules[index] = name
                this.m_Entity.modules = this.m_Modules
            })
        } else if (e.button === 2) {
            this.m_Modules[index] = undefined
            this.m_Entity.modules = this.m_Modules
        }
    }
}
