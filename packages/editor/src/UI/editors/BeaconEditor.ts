import { Entity } from '../../core/Entity'
import { Editor } from './Editor'

/** Beacon Editor */
export class BeaconEditor extends Editor {
    public constructor(entity: Entity) {
        super(402, 171, entity)

        // Add Modules
        this.addLabel(140, 56, 'Modules:')
        this.addModules(208, 45)
    }
}
