import Editor from './editor'
import { IEntity } from '../interfaces/iBlueprintEditor'

/** Beacon Editor */
export default class BeaconEditor extends Editor {

    constructor(entity: IEntity) {
        super(402, 171, entity)
    }
}
