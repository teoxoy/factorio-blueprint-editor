import Entity from '~/factorio-data/entity'
import Editor from './editor'

/** Beacon Editor */
export default class BeaconEditor extends Editor {
    public constructor(entity: Entity) {
        super(402, 171, entity)

        // Add Modules
        this.addLabel(140, 56, 'Modules:')
        this.addModules(208, 45)
    }
}
