import Entity from '../factorio-data/entity'
import Editor from './editor'

/** Inserter Editor */
export default class InserterEditor extends Editor {
    constructor(entity: Entity) {
        super(446, 171, entity)

        // Add Filters
        if (this.m_Entity.filterSlots > 0) {
            this.addLabel(140, 56, `Filter${this.m_Entity.filterSlots === 1 ? '' : 's'}:`)
            this.addFilters(208, 45)
        }
    }
}
