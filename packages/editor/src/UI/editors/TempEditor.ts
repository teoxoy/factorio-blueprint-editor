import { Entity } from '../../core/Entity'
import { Editor } from './Editor'

export class TempEditor extends Editor {
    public constructor(entity: Entity) {
        super(402, 171, entity)

        let i = 0
        if (
            entity.acceptedRecipes.length > 0 &&
            !(entity.name === 'electric-furnace' || entity.name === 'rocket-silo')
        ) {
            this.addLabel(140, 56, 'Recipe:')
            this.addRecipe(208, 45)
            i += 38
        }

        if (entity.moduleSlots !== 0) {
            this.addLabel(140, 56 + i, 'Modules:')
            this.addModules(208, 45 + i)
        }
    }
}
