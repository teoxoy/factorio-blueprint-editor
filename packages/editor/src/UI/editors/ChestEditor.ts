import * as PIXI from 'pixi.js'
import { Entity } from '../../core/Entity'
import { styles } from '../style'
import { Slider } from '../controls/Slider'
import { Textbox } from '../controls/Textbox'
import { Checkbox } from '../controls/Checkbox'
import { Filters } from './components/Filters'
import { Editor } from './Editor'

/** Assembly Machines Editor */
export class ChestEditor extends Editor {
    // logistic_chest_buffer
    // >> 12 Slots / Counts

    // logistic_chest_requester
    // >> 12 Slots / Counts / Request from Buffer

    // logistic_chest_storage
    // >> 1 Slot / No Count

    /** Field to determine whether amount shall be shown or not */
    private readonly m_Amount: boolean

    /** Field to store filter slot index for further usage with amount */
    private m_Filter: number

    public constructor(entity: Entity) {
        const rows = Math.ceil(entity.filterSlots / 6)
        const filterAreaHeight = rows * 38 + Math.min(0, rows - 1) * 2
        const requesterCheckboxHeight = entity.name === 'logistic_chest_requester' ? 23 + 6 : 0
        const countAreaHeight = entity.name === 'logistic_chest_storage' ? 0 : 23 + 6

        super(
            446,
            Math.max(171, 45 + filterAreaHeight + requesterCheckboxHeight + countAreaHeight + 12),
            entity
        )

        this.m_Amount = entity.name !== 'logistic_chest_storage'
        this.m_Filter = -1

        let yOffset = 45

        // Add Filters
        this.addLabel(140, 56, `Filter${this.m_Entity.filterSlots === 1 ? '' : 's'}:`)
        const filters: Filters = this.addFilters(208, yOffset, this.m_Amount)
        yOffset += filterAreaHeight

        /** Remaining controls are not needed if amount shall not be shown */
        if (!this.m_Amount) return

        // For Requester Chest: Add Request from Buffer Chest for
        if (entity.name === 'logistic_chest_requester') {
            const checkbox: Checkbox = new Checkbox(
                this.m_Entity.requestFromBufferChest,
                'Request from buffer chests'
            )
            yOffset += 6
            checkbox.position.set(208, yOffset)
            yOffset += 22
            checkbox.on('changed', () => {
                this.m_Entity.requestFromBufferChest = checkbox.checked
            })
            this.onEntityChange('requestFromBufferChest', () => {
                checkbox.checked = this.m_Entity.requestFromBufferChest
            })
            this.addChild(checkbox)
        }

        // Add Label
        const label: PIXI.Text = new PIXI.Text('Count:', styles.dialog.label)
        label.position.set(140, yOffset + 8)
        label.visible = false
        this.addChild(label)

        // Add Slider
        const slider: Slider = new Slider(10)
        slider.position.set(194, yOffset + 9)
        slider.visible = false
        this.addChild(slider)

        // Add Textbox
        const textbox: Textbox = new Textbox(60, '10', 6, '1234567890')
        textbox.position.set(374, yOffset + 6)
        textbox.visible = false
        this.addChild(textbox)

        // Attach Events
        filters.on('selected', (index: number, count: number) => {
            if (index < 0) {
                label.visible = false
                slider.visible = false
                textbox.visible = false
            } else {
                this.m_Filter = index
                slider.value = count

                label.visible = true
                slider.visible = true
                textbox.visible = true
            }
        })
        slider.on('changed', () => {
            if (slider.value !== 0) {
                if (slider.value !== undefined) {
                    textbox.text = slider.value.toString()
                }
                filters.updateFilter(this.m_Filter, slider.value)
            }
        })
        textbox.on('changed', () => {
            const value: number = textbox.text === '' ? 0 : +textbox.text
            slider.value = value
            filters.updateFilter(this.m_Filter, value)
        })
        this.onEntityChange('filters', () => {
            if (this.m_Filter > -1) {
                slider.value = filters.getFilterCount(this.m_Filter)
            }
            if (slider.value === undefined) {
                label.visible = false
                slider.visible = false
                textbox.visible = false
            }
        })
    }
}
