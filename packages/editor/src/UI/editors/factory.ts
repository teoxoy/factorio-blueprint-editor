import { Entity } from '../../core/Entity'
import { Editor } from './Editor'
import { BeaconEditor } from './BeaconEditor'
import { InserterEditor } from './InserterEditor'
import { MachineEditor } from './MachineEditor'
import { MiningEditor } from './MiningEditor'
import { SplitterEditor } from './SplitterEditor'
import { ChestEditor } from './ChestEditor'
import { TempEditor } from './TempEditor'
import { TrainStopEditor } from './TrainStopEditor'

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
        case 'burner_inserter':
        case 'inserter':
        case 'long_handed_inserter':
        case 'fast_inserter':
        case 'bulk_inserter':
        case 'stack_inserter': {
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
        case 'buffer_chest':
        case 'requester_chest':
        case 'storage_chest': {
            editor = new ChestEditor(entity)
            break
        }
        // Temp
        case 'lab':
        case 'electric_furnace':
        case 'pumpjack':
        case 'oil_refinery':
        case 'chemical_plant':
        case 'centrifuge':
        case 'rocket_silo':
            editor = new TempEditor(entity)
            break
        // Train stop
        case 'train_stop':
            editor = new TrainStopEditor(entity)
            break
        default: {
            return undefined
        }
    }

    return editor
}
