import G from '../common/globals'
import Editor from './editor'
import Preview from './components/preview'
import Filters from './components/filters'
import Checkbox from '../controls/checkbox'
import { IEntity } from '../interfaces/iBlueprintEditor'
import { EntityContainer } from '../containers/entity'

// TODO: Add switch for selecting left/right on priorities

/** Splitter Editor */
export default class SplitterEditor extends Editor {

    constructor(entity: IEntity) {
        super(504, 176, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Filters
        if (this.m_Entity.filterSlots > 0) {
            this.addLabel(412, 92, 'Filter:', G.styles.controls.checkbox)
            const filters: Filters = this.addFilters(456, 80)
            filters.on('changed', () => preview.redraw())
        }

        const inputCheckbox: Checkbox = new Checkbox(this.m_Entity.splitterInputPriority !== undefined, 'Input priority:')
        inputCheckbox.position.set(136, 52)
        inputCheckbox.on('changed', () => {
            this.m_Entity.splitterInputPriority = inputCheckbox.checked ? 'left' : undefined
            EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
            preview.redraw()
        })
        this.addChild(inputCheckbox)

        const outputCheckbox: Checkbox = new Checkbox(this.m_Entity.splitterOutputPriority !== undefined, 'Output priority:')
        outputCheckbox.position.set(136, 88)
        outputCheckbox.on('changed', () => {
            this.m_Entity.splitterOutputPriority = outputCheckbox.checked ? 'left' : undefined
            EntityContainer.mappings.get(this.m_Entity.entity_number).redrawEntityInfo()
            preview.redraw()
        })
        this.addChild(outputCheckbox)
    }
}
