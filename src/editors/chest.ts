import Editor from './editor'
import Preview from './components/preview'
import Filters from './components/filters'
import Slider from '../controls/slider'
import Entity from '../factorio-data/entity'
import Textbox from '../controls/textbox'

/** Assembly Machines Editor */
export default class ChestEditor extends Editor {

    // logistic_chest_buffer
    // >> 12 Slots / Counts

    // logistic_chest_requester
    // >> 12 Slots / Counts / Request from Buffer

    // logistic_chest_storage
    // >> 1 Slot / No Count

    constructor(entity: Entity) {
        super(446, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Filters
        if (this.m_Entity.filterSlots > 0) {
            this.addLabel(140, 56, `Filter${(this.m_Entity.filterSlots === 1 ? '' : 's')}:`)
            const filters: Filters = this.addFilters(208, 45, true)
            filters.on('changed', () => preview.redraw())
        }

        /* Comment out the following for check-in

        this.addLabel(140, 131, 'Count:')

        // Add Slider
        const slider: Slider = new Slider(10)
        slider.position.set(194, 132)
        this.addChild(slider)

        // Add Textbox
        const textbox: Textbox = new Textbox(60, '10', 6, '1234567890')
        textbox.position.set(374, 129)
        this.addChild(textbox)

        // Attach Events
        slider.on('changed', () => {
            if (slider.value !== 0) textbox.text = slider.value.toString()
        })
        textbox.on('changed', () => {
            slider.value = textbox.text === '' ? 0 : +textbox.text
        })
        */
    }
}
