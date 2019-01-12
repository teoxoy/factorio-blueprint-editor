import C from '../controls/common'
import Dialog from '../controls/dialog'
import Preview from './components/preview'
import Recipe from './components/recipe'
import Modules from './components/modules'
import { IEntity } from '../interfaces/iBlueprintEditor'

/** Editor */
export default class Editor extends Dialog {

    /** Blueprint Editor Entity reference */
    protected readonly m_Entity: IEntity

    /**
     * Base Constructor for Editors
     *
     * @param width - Width of the Editor Dialog
     * @param height - Height of the Editor Dialog
     * @param entity - Reference to Entity Data
     */
    constructor(width: number, height: number, entity: IEntity) {
        super(width, height)

        this.m_Entity = entity

        // Add Title
        this.addLabel(12, 10, Editor.capitalize(this.m_Entity.name), C.styles.dialog.title)
    }

    /**
     * Add Label to Editor
     * @description Defined in Base Editor class so extensions can use it when they need to
     * @param x - Horizontal position of Label from top left corner
     * @param y - Vertical position of Label from top left corner
     * @param text - Text for Label
     * @param style - Style of Label
     */
    protected addLabel(x: number = 140, y: number = 56, text: string = 'Recipe:', style: PIXI.TextStyle = C.styles.dialog.label): PIXI.Text {
        const label: PIXI.Text = new PIXI.Text(text, style)
        label.position.set(x, y)
        this.addChild(label)

        // Return component in case extension wants to use it
        return label
    }

    /**
     * Add Preview Control to Editor
     * @description Defined in Base Editor class so extensions can use it when they need to
     * @param x - Horizontal position of Preview from top left corner
     * @param y - Vertical position of Preview from top left corner
     */
    protected addPreview(x: number = 12, y: number = 45): Preview {
        const preview: Preview = new Preview(this.m_Entity, 114)
        preview.position.set(x, y)
        this.addChild(preview)

        // Return component in case extension wants to use it
        return preview
    }

    /**
     * Add Recipe Slot to Editor
     * @description Defined in Base Editor class so extensions can use it when they need to
     * @param x - Horizontal position of Recipe Slot from top left corner
     * @param y - Vertical position of Recipe Slot from top left corner
     */
    protected addRecipe(x: number = 208, y: number = 45): Recipe {
        const recipe: Recipe = new Recipe(this.m_Entity)
        recipe.position.set(x, y)
        this.addChild(recipe)

        // Return component in case extension wants to use it
        return recipe
    }

    /**
     * Add Module Slots to Editor
     * @description Defined in Base Editor class so extensions can use it when they need to
     * @param x - Horizontal position of Module Slots from top left corner
     * @param y - Vertical position of Module Slots from top left corner
     */
    protected addModules(x: number = 208, y: number = 83): Modules {
        const modules: Modules = new Modules(this.m_Entity)
        modules.position.set(x, y)
        this.addChild(modules)

        // Return component in case extension wants to use it
        return modules
    }
}
