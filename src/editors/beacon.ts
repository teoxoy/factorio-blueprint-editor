import Editor from './editor'
import Entity from '../factorio-data/entity'

/** Beacon Editor */
export default class BeaconEditor extends Editor {

    constructor(entity: Entity) {
        super(402, 171, entity)
    }
}
