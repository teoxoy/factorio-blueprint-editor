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
        case 'assembling-machine-1':
        case 'assembling-machine-2':
        case 'assembling-machine-3': {
            editor = new MachineEditor(entity)
            break
        }
        // Beacon
        case 'beacon': {
            editor = new BeaconEditor(entity)
            break
        }
        // Inserters
        case 'burner-inserter':
        case 'inserter':
        case 'long-handed-inserter':
        case 'fast-inserter':
        case 'bulk-inserter':
        case 'stack-inserter': {
            editor = new InserterEditor(entity)
            break
        }
        // Mining
        case 'electric-mining-drill': {
            editor = new MiningEditor(entity)
            break
        }
        // Splitters
        case 'splitter':
        case 'fast-splitter':
        case 'express-splitter': {
            editor = new SplitterEditor(entity)
            break
        }
        // Chests
        case 'buffer-chest':
        case 'requester-chest':
        case 'storage-chest': {
            editor = new ChestEditor(entity)
            break
        }
        // Temp
        case 'lab':
        case 'electric-furnace':
        case 'pumpjack':
        case 'oil-refinery':
        case 'chemical-plant':
        case 'centrifuge':
        case 'rocket-silo':
            editor = new TempEditor(entity)
            break
        // Train stop
        case 'train-stop':
            editor = new TrainStopEditor(entity)
            break
        default: {
            return undefined
        }
    }

    return editor
}
