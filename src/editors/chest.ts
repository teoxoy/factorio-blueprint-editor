import Editor from './editor'
import Slider from '../controls/slider'
import Preview from './components/preview'
import Recipe from './components/recipe'
import Entity from '../factorio-data/entity'

/** Assembly Machines Editor */
export default class ChestEditor extends Editor {

    constructor(entity: Entity) {
        super(402, 171, entity)

        // Add Preview
        const preview: Preview = this.addPreview()

        // Add Slider
        const slider: Slider = new Slider()
        slider.position.set(140, 94)
        this.addChild(slider)

        // Add Recipe
        this.addLabel(140, 56, 'Recipe:')
        const recipe: Recipe = this.addRecipe(208, 45)
        recipe.on('changed', () => preview.redraw())
    }
}
