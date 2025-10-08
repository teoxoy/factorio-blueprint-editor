import EventEmitter from 'eventemitter3'
import { Entity, EntityEvents } from '../../core/Entity'
import { Dialog } from '../controls/Dialog'
import { Preview } from './components/Preview'
import { Recipe } from './components/Recipe'
import { Modules } from './components/Modules'
import { Filters } from './components/Filters'

/** Editor */
export abstract class Editor extends Dialog {
    /** Blueprint Editor Entity reference */
    protected readonly m_Entity: Entity

    /** Reference to preview container */
    protected readonly m_Preview: Preview

    /**
     * Base Constructor for Editors
     *
     * @param width - Width of the Editor Dialog
     * @param height - Height of the Editor Dialog
     * @param entity - Reference to Entity Data
     */
    public constructor(width: number, height: number, entity: Entity) {
        super(width, height, entity.entityData.localised_name as string)

        // Store reference to entity for later use
        this.m_Entity = entity

        // Create preview container
        this.m_Preview = new Preview(this.m_Entity, 114)
        this.m_Preview.position.set(12, 45)
        this.addChild(this.m_Preview)

        // Close on entity destroy
        this.m_Entity.once('destroy', () => this.close())
    }

    /**
     * Add Recipe Slot to Editor
     * @description Defined in Base Editor class so extensions can use it when they need to
     * @param x - Horizontal position of Recipe Slot from top left corner
     * @param y - Vertical position of Recipe Slot from top left corner
     */
    protected addRecipe(x = 208, y = 45): Recipe {
        const recipe = new Recipe(this.m_Entity)
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
    protected addModules(x = 208, y = 83): Modules {
        const modules = new Modules(this.m_Entity)
        modules.position.set(x, y)
        this.addChild(modules)

        // Return component in case extension wants to use it
        return modules
    }

    /**
     * Add Filter Slots to Editor
     * @description Defined in Base Editor class so extensions can use it when they need to
     * @param x - Horizontal position of Filter Slots from top left corner
     * @param y - Vertical position of Filter Slots from top left corner
     * @param counts - Shall filter counts be shown
     */
    protected addFilters(x = 208, y = 83, amount = false): Filters {
        const filters = new Filters(this.m_Entity, amount)
        filters.position.set(x, y)
        this.addChild(filters)

        // Return component in case extension wants to use it
        return filters
    }

    protected onEntityChange<T extends EventEmitter.EventNames<EntityEvents>>(
        event: T,
        fn: EventEmitter.EventListener<EntityEvents, T>
    ): void {
        this.m_Entity.on(event, fn)
        this.once('destroyed', () => this.m_Entity.off(event, fn))
    }
}
