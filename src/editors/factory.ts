import G from '../globals'
import Editor from './editor'
import BeaconEditor from './beacon'
import InserterEditor from './inserter'
import MiningEditor from './mining'
import SplitterEditor from './splitter'

/**
 * Factory Function for creating Editor based on Entity Number
 * @param entityNumber - Entity Number for which to create Editor for
 */
export function createEditor(entityNumber: number): Editor {
    const entity = G.bp.entity(entityNumber)

    let editor: Editor
    switch (entity.name) {
        // Beacon
        case 'beacon' : {
            editor = new BeaconEditor(entity)
            break
        }
        // Inserters
        case 'inserter':
        case 'fast_inserter':
        case 'long_handed_inserter':
        case 'filter_inserter':
        case 'stack_inserter':
        case 'stack_filter_inserter': {
            editor = new InserterEditor(entity)
            break
        }
        // Mining
        case 'electric_mining_drill': {
            editor = new MiningEditor(entity)
            break
        }
        // Splitters
        case 'splitter':
        case 'fast_splitter':
        case 'express_splitter': {
            editor = new SplitterEditor(entity)
            break
        }
        default: {
            return undefined
        }
    }

    if (editor !== undefined) {
        G.app.stage.addChild(editor)
        editor.show()
    }

    return editor
}
