import G from '../common/globals'
import Editor from './editor'
import Preview from './components/preview'
import Filters from './components/filters'
import Checkbox from '../controls/checkbox'
import Enable from '../controls/enable'
import Switch from '../controls/switch'
import { IEntity } from '../interfaces/iBlueprintEditor'
import { EntityContainer } from '../containers/entity'

/** Splitter Editor */
export default class SplitterEditor extends Editor {

    /** Reference to preview */
    private readonly m_Preview: Preview

    constructor(entity: IEntity) {
        super(504, 176, entity)

        const input: string = this.m_Entity.splitterInputPriority
        const output: string = this.m_Entity.splitterOutputPriority

        // Add Preview
        this.m_Preview = this.addPreview()

        // Add Input Priority
        const inputLeft: Enable = new Enable(input === 'left', 'Left')
        inputLeft.position.set(280, 52)
        this.addChild(inputLeft)

        const inputSwitch: Switch = new Switch(['left', 'right'], input)
        inputSwitch.position.set(316, 52)
        this.addChild(inputSwitch)

        const inputRight: Enable = new Enable(input === 'right', 'Right')
        inputRight.position.set(364, 52)
        this.addChild(inputRight)

        const inputCheckbox: Checkbox = new Checkbox(input !== undefined, 'Input priority:')
        inputCheckbox.position.set(136, 52)
        this.addChild(inputCheckbox)

        // Add Output Priority
        const outputLeft: Enable = new Enable(input === 'left', 'Left')
        outputLeft.position.set(280, 88)
        this.addChild(outputLeft)

        const outputSwitch: Switch = new Switch(['left', 'right'], output)
        outputSwitch.position.set(316, 88)
        this.addChild(outputSwitch)

        const outputRight: Enable = new Enable(input === 'right', 'Right')
        outputRight.position.set(364, 88)
        this.addChild(outputRight)

        const outputCheckbox: Checkbox = new Checkbox(output !== undefined, 'Output priority:')
        outputCheckbox.position.set(136, 88)
        this.addChild(outputCheckbox)

        // Add Filters
        this.addLabel(412, 88, 'Filter:', G.styles.controls.checkbox)
        const filter: Filters = this.addFilters(456, 80)
        filter.position.set(456, 76)

        // Attach input events
        inputCheckbox.on('changed', () => {
            if (inputCheckbox.checked) {
                inputLeft.active = true
                inputSwitch.value = 'left'
                inputRight.active = false
                this.m_Entity.splitterInputPriority = 'left'
            } else {
                inputLeft.active = false
                inputSwitch.value = undefined
                inputRight.active = false
                this.m_Entity.splitterInputPriority = undefined
            }
            this.redrawElements()
        })
        inputLeft.on('changed', () => {
            if (inputLeft.active) {
                inputCheckbox.checked = true
                inputSwitch.value = 'left'
                inputRight.active = false
                this.redrawElements()
            }
        })
        inputSwitch.on('changed', () => {
            if (inputSwitch.value === 'left') {
                inputCheckbox.checked = true
                inputLeft.active = true
                inputRight.active = false
                this.m_Entity.splitterInputPriority = 'left'
            } else if (inputSwitch.value === 'right') {
                inputCheckbox.checked = true
                inputLeft.active = false
                inputRight.active = true
                this.m_Entity.splitterInputPriority = 'right'
            }
            this.redrawElements()
        })
        inputRight.on('changed', () => {
            if (inputRight.active) {
                inputCheckbox.checked = true
                inputLeft.active = false
                inputSwitch.value = 'right'
                this.redrawElements()
            }
        })

        // Attach output events
        outputCheckbox.on('changed', () => {
            if (outputCheckbox.checked) {
                outputLeft.active = true
                outputSwitch.value = 'left'
                outputRight.active = false
                this.m_Entity.splitterOutputPriority = 'left'
            } else {
                outputLeft.active = false
                outputSwitch.value = undefined
                outputRight.active = false
                filter.clearSlot()
                this.m_Entity.splitterOutputPriority = undefined
            }
            this.redrawElements()
        })
        outputLeft.on('changed', () => {
            if (outputLeft.active) {
                outputCheckbox.checked = true
                outputSwitch.value = 'left'
                outputRight.active = false
                this.redrawElements()
            }
        })
        outputSwitch.on('changed', () => {
            if (outputSwitch.value === 'left') {
                outputCheckbox.checked = true
                outputLeft.active = true
                outputRight.active = false
                this.m_Entity.splitterOutputPriority = 'left'
            } else if (outputSwitch.value === 'right') {
                outputCheckbox.checked = true
                outputLeft.active = false
                outputRight.active = true
                this.m_Entity.splitterOutputPriority = 'right'
            }
            this.redrawElements()
        })
        outputRight.on('changed', () => {
            if (outputRight.active) {
                outputCheckbox.checked = true
                outputLeft.active = false
                outputSwitch.value = 'right'
                this.redrawElements()
            }
        })
        filter.on('changed', (filled: boolean) => {
            if (filled) {
                if (!outputCheckbox.checked) {
                    outputCheckbox.checked = true
                    outputLeft.active = true
                    outputSwitch.value = 'left'
                    this.redrawElements()
                }
            } else {
                this.redrawElements()
            }
        })
    }

    /** Kick off redraw of all relevant elements */
    private redrawElements() {
        EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
        this.m_Preview.redraw()
    }
}
