import C from '../controls/common'
import Editor from './editor'
import Preview from './components/preview'
import Filters from './components/filters'
import { IEntity } from '../interfaces/iBlueprintEditor'

/** Inserter Editor */
export default class InserterEditor extends Editor {

    constructor(entity: IEntity) {
        super(440, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Filters
        if (this.m_Entity.filterSlots > 0) {
            this.addLabel(140, 56, 'Filters:', C.styles.dialog.label)
            const filters: Filters = this.addFilters(208, 45)
            filters.on('changed', () => preview.redraw())
        }
    }
}
