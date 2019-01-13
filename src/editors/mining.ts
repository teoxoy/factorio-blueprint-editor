import Editor from './editor'
import { IEntity } from '../interfaces/iBlueprintEditor'

/** Electric Mining Drill Editor */
export default class MiningEditor extends Editor {

    constructor(entity: IEntity) {
        super(402, 171, entity)
    }
}
