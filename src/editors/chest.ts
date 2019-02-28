import * as PIXI from 'pixi.js'
import G from '../common/globals'
import Slider from '../controls/slider'
import Entity from '../factorio-data/entity'
import Textbox from '../controls/textbox'
import Checkbox from '../controls/checkbox'
import Filters from './components/filters'
import Editor from './editor'

/** Assembly Machines Editor */
export default class ChestEditor extends Editor {
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

    constructor(entity: Entity) {
        super(446, entity.name === 'logistic_chest_requester' ? 190 : 171, entity)

        this.m_Amount = entity.name !== 'logistic_chest_storage'
        this.m_Filter = -1

        // Add Filters
        this.addLabel(140, 56, `Filter${this.m_Entity.filterSlots === 1 ? '' : 's'}:`)
        const filters: Filters = this.addFilters(208, 45, this.m_Amount)

        /** Remaining controls are not needed if amount shall not be shown */
        if (!this.m_Amount) {
            return
        }

        // Add Label
        const label: PIXI.Text = new PIXI.Text('Count:', G.styles.dialog.label)
        label.position.set(140, entity.name === 'logistic_chest_requester' ? 154 : 131)
        label.visible = false
        this.addChild(label)

        // Add Slider
        const slider: Slider = new Slider(10)
        slider.position.set(194, entity.name === 'logistic_chest_requester' ? 155 : 132)
        slider.visible = false
        this.addChild(slider)

        // Add Textbox
        const textbox: Textbox = new Textbox(60, '10', 6, '1234567890')
        textbox.position.set(374, entity.name === 'logistic_chest_requester' ? 153 : 129)
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
        this.m_Entity.on('filters', () => {
            if (this.m_Filter > -1) {
                slider.value = filters.getFilterCount(this.m_Filter)
            }
            if (slider.value === undefined) {
                label.visible = false
                slider.visible = false
                textbox.visible = false
            }
        })

        // For Requester Chest: Add Request from Buffer Chest for
        if (entity.name === 'logistic_chest_requester') {
            const checkbox: Checkbox = new Checkbox(this.m_Entity.requestFromBufferChest, 'Request from buffer chests')
            checkbox.position.set(208, 128)
            checkbox.on('changed', () => {
                this.m_Entity.requestFromBufferChest = checkbox.checked
            })
            this.m_Entity.on('requestFromBufferChest', () => {
                checkbox.checked = this.m_Entity.requestFromBufferChest
            })
            this.addChild(checkbox)
        }
    }
}
