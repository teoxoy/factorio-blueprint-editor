import Editor from './editor'
import Slider from '../controls/slider'
import Preview from './components/preview'
import Entity from '../factorio-data/entity'
import Textbox from '../controls/textbox'

/** Assembly Machines Editor */
export default class ChestEditor extends Editor {

    constructor(entity: Entity) {
        super(402, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Slider
        const slider: Slider = new Slider()
        slider.position.set(140, 94)
        this.addChild(slider)

        // Add Textbox
        const textbox: Textbox = new Textbox(60, '1', 6, '1234567890')
        textbox.position.set(320, 91)
        this.addChild(textbox)

        // Attach Events
        slider.on('changed', () => {
            textbox.text = slider.value.toString()
        })
        textbox.on('changed', () => {
            slider.value = +textbox.text
        })
    }
}
