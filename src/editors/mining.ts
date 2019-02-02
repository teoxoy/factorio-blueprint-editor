import Editor from './editor'
import Entity from '../factorio-data/entity'

/** Electric Mining Drill Editor */
export default class MiningEditor extends Editor {

    constructor(entity: Entity) {
        super(402, 171, entity)

        // Add Modules
        this.addLabel(140, 56, 'Modules:')
        this.addModules(208, 45)
    }
}
