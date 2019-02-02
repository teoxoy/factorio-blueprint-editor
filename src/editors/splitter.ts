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
        inputCheckbox.on('changed', () =>
            this.m_Entity.splitterInputPriority = inputCheckbox.checked ? 'left' : undefined)

        inputLeft.on('changed', () =>
            this.m_Entity.splitterInputPriority = inputLeft.active ? 'left' : 'right')

        inputSwitch.on('changed', () =>
            this.m_Entity.splitterInputPriority = inputSwitch.value)

        inputRight.on('changed', () =>
            this.m_Entity.splitterInputPriority = inputRight.active ? 'right' : 'left')

        // Attach output events
        outputCheckbox.on('changed', () =>
            this.m_Entity.splitterOutputPriority = outputCheckbox.checked ? 'left' : undefined)

        outputLeft.on('changed', () =>
            this.m_Entity.splitterOutputPriority = outputLeft.active ? 'left' : 'right')

        outputSwitch.on('changed', () =>
            this.m_Entity.splitterOutputPriority = outputSwitch.value)

        outputRight.on('changed', () =>
            this.m_Entity.splitterOutputPriority = outputRight.active ? 'right' : 'left')

        this.m_Entity.on('splitterInputPriority', priority => {
            inputCheckbox.checked = priority !== undefined
            inputSwitch.value = priority
            inputLeft.active = priority === 'left'
            inputRight.active = priority === 'right'
        })

        this.m_Entity.on('splitterOutputPriority', priority => {
            outputCheckbox.checked = priority !== undefined
            outputSwitch.value = priority
            outputLeft.active = priority === 'left'
            outputRight.active = priority === 'right'
        })
    }
}
