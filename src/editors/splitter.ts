import Editor from './editor'
import Preview from './components/preview'
import Filters from './components/filters'
import { IEntity } from '../interfaces/iBlueprintEditor'

/** Splitter Editor */
export default class SplitterEditor extends Editor {

    constructor(entity: IEntity) {
        super(503, 176, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Filters
        if (this.m_Entity.filterSlots > 0) {
            this.addLabel(140, 56, 'Filter:')
            const filters: Filters = this.addFilters(208, 45)
            filters.on('changed', () => preview.redraw())
        }
    }
}
