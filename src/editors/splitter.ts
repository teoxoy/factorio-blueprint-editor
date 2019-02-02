import G from '../common/globals'
import Editor from './editor'
import Entity from '../factorio-data/entity'
import Filters from './components/filters'
import Checkbox from '../controls/checkbox'
import Enable from '../controls/enable'
import Switch from '../controls/switch'

/** Splitter Editor */
export default class SplitterEditor extends Editor {

    constructor(entity: Entity) {
        super(504, 176, entity)

        const input: string = this.m_Entity.splitterInputPriority
        const output: string = this.m_Entity.splitterOutputPriority

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
        const outputLeft: Enable = new Enable(output === 'left', 'Left')
        outputLeft.position.set(280, 88)
        this.addChild(outputLeft)

        const outputSwitch: Switch = new Switch(['left', 'right'], output)
        outputSwitch.position.set(316, 88)
        this.addChild(outputSwitch)

        const outputRight: Enable = new Enable(output === 'right', 'Right')
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
                if (this.m_Entity.splitterInputPriority === undefined) this.m_Entity.splitterInputPriority = 'left'
            } else {
                this.m_Entity.splitterInputPriority = undefined
            }
        })
        inputLeft.on('changed', () => {
            if (inputLeft.active) {
                this.m_Entity.splitterInputPriority = 'left'
            }
        })
        inputSwitch.on('changed', () => {
            this.m_Entity.splitterInputPriority = inputSwitch.value
        })
        inputRight.on('changed', () => {
            if (inputRight.active) {
                this.m_Entity.splitterInputPriority = 'right'
            }
        })

        // Attach output events
        outputCheckbox.on('changed', () => {
            if (outputCheckbox.checked) {
                if (this.m_Entity.splitterOutputPriority === undefined) this.m_Entity.splitterOutputPriority = 'left'
            } else {
                this.m_Entity.splitterOutputPriority = undefined
            }
        })
        outputLeft.on('changed', () => {
            if (outputLeft.active) {
                this.m_Entity.splitterOutputPriority = 'left'
            }
        })
        outputSwitch.on('changed', () => {
            this.m_Entity.splitterOutputPriority = outputSwitch.value
        })
        outputRight.on('changed', () => {
            if (outputRight.active) {
                this.m_Entity.splitterOutputPriority = 'right'
            }
        })
        filter.on('changed', (filled: boolean) => {
            if (filled) {
                if (!outputCheckbox.checked) {
                    this.m_Entity.splitterOutputPriority = 'left'
                }
                this.redrawEntity()
            } else {
                this.redrawEntity()
            }
        })

        this.m_Entity.on('splitterInputPriority', () => {
            switch (this.m_Entity.splitterInputPriority) {
                case 'left':
                    inputCheckbox.checked = true
                    inputLeft.active = true
                    inputSwitch.value = 'left'
                    inputRight.active = false
                    break
                case 'right':
                    inputCheckbox.checked = true
                    inputLeft.active = false
                    inputSwitch.value = 'right'
                    inputRight.active = true
                    break
                default:
                    inputCheckbox.checked = false
                    inputLeft.active = false
                    inputSwitch.value = undefined
                    inputRight.active = false
            }
            this.redrawEntity()
        })

        this.m_Entity.on('splitterOutputPriority', () => {
            switch (this.m_Entity.splitterOutputPriority) {
                case 'left':
                    outputCheckbox.checked = true
                    outputLeft.active = true
                    outputSwitch.value = 'left'
                    outputRight.active = false
                    break
                case 'right':
                    outputCheckbox.checked = true
                    outputLeft.active = false
                    outputSwitch.value = 'right'
                    outputRight.active = true
                    break
                default:
                    outputCheckbox.checked = false
                    outputLeft.active = false
                    outputSwitch.value = undefined
                    outputRight.active = false
                    filter.clearSlot(0)
            }
            this.redrawEntity()
        })
    }
}
