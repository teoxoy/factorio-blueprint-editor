import C from '../controls/common'
import Editor from './editor'
import Preview from './components/preview'
import Recipe from './components/recipe'
import Modules from './components/modules'
import { IEntity } from '../interfaces/iBlueprintEditor'

/** Assembly Machines Editor */
export default class MachineEditor extends Editor {

    constructor(entity: IEntity) {
        super(402, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Recipe
        this.addLabel(140, 56, 'Recipe:', C.styles.dialog.label)
        const recipe: Recipe = this.addRecipe(208, 45)
        recipe.on('changed', () => preview.redraw())

        // Add Modules
        this.addLabel(140, 94, 'Modules:', C.styles.dialog.label)
        const modules: Modules = this.addModules(208, 83)
        modules.on('changed', () => preview.redraw())
    }
}
