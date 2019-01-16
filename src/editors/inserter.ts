import Editor from './editor'
import Preview from './components/preview'
import Filters from './components/filters'
import Entity from '../factorio-data/entity'

/** Inserter Editor */
export default class InserterEditor extends Editor {

    constructor(entity: Entity) {
        super(440, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Filters
        if (this.m_Entity.filterSlots > 0) {
            this.addLabel(140, 56, `Filter${(this.m_Entity.filterSlots === 1 ? '' : 's')}:`)
            const filters: Filters = this.addFilters(208, 45)
            filters.on('changed', () => preview.redraw())
        }
    }
}
