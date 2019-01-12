// This class contains temporary interfaces to represent 'entity.ts'. The intent is to avoid type 'any'
// At some point these interface may go way again depending on if and how 'entity.ts' is changed.

import * as iFD from './iFactorioData'

/** Blueprint Editor Point (x,y) information */
// TODO: Check if this could be combined with 'index.d.ts'
// >> Unfortunately 'index.d.ts' cannot be imported
export interface IPoint {
    x: number,
    y: number
}

/** Blueprint Editor Entity Data */
export interface IEntity {
    entity_number: number,
    name: string

    type: string
    entityData: iFD.IEntity
    recipeData: iFD.IRecipe
    itemData: iFD.IItem
    size: IPoint

    position: IPoint
    direction: number

    /** Recipes this entity can accept */
    acceptedRecipes: string[]
    /** Current set recipe of entity */
    recipe: string

    /** Modules this entity can accept */
    acceptedModules: string[]
    /** Currently set modules of entity */
    modules: string[]
}
