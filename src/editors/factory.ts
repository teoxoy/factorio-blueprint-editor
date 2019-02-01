import Editor from './editor'
import BeaconEditor from './beacon'
import InserterEditor from './inserter'
import MachineEditor from './machine'
import MiningEditor from './mining'
import SplitterEditor from './splitter'
import ChestEditor from './chest'
import Entity from '../factorio-data/entity'

/**
 * Factory Function for creating Editor based on Entity Number
 *
 * @description This function is needed externally of the Editor class as otherwise there will
 * be a raise condition where the MachineEditor cannot be created due to teh Editor not being
 * available yet. This can be solved in the future with lazy loading classes with Import(). Once
 * lazy loading is available, this function can move into the Editor class
 *
 * @param entityNumber - Entity Number for which to create Editor for
 */
export function createEditor(entity: Entity): Editor {
    let editor: Editor
    switch (entity.name) {
        // Assembly Machines
        case 'assembling_machine_1':
        case 'assembling_machine_2':
        case 'assembling_machine_3': {
            editor = new MachineEditor(entity)
            break
        }
        // Beacon
        case 'beacon': {
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
        // Chests
        case 'logistic_chest_buffer':
        case 'logistic_chest_requester':
        case 'logistic_chest_storage': {
            editor = new ChestEditor(entity)
            break
        }
        default: {
            return undefined
        }
    }

    return editor
}
