import Editor from './editor'
import Preview from './components/preview'
import Modules from './components/modules'
import Entity from '../factorio-data/entity'

/** Beacon Editor */
export default class BeaconEditor extends Editor {

    constructor(entity: Entity) {
        super(402, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Modules
        this.addLabel(140, 56, 'Modules:')
        const modules: Modules = this.addModules(208, 45)
        modules.on('changed', () => preview.redraw())
    }
}
