// This class contains interfaces to represent the data coming from package "factorio-data"
// The intent is to have a representation of that data to avoid type 'any'
// It would be good if this interface specification would come with package "factorio-data"

/** Factorio ModuleSpecification Meta Information from package "factorio-data" */
export interface IModuleSpecification {
    module_slots: number
}

/** Factorio Entity Meta Information from package "factorio-data" */
export interface IEntity {
    type: string
    name: string
    icon: string
    module_specification: IModuleSpecification
    crafting_categories: string[]
    filter_count: number
    /** @deprecated Use direct accessors instead */
    [key: string]: any
}

/** Factorio Normal Recipe Meta Information from package "factorio-data" */
export interface IRecipeNormal {
    energy_required?: number
    ingredients: any
    result_count?: number
}

/** Factorio Recipe Meta Information from package "factorio-data" */
export interface IRecipe {
    name: string
    normal?: IRecipeNormal
    energy_required: number
    ingredients: any
    result_count?: number
    /** @deprecated Use direct accessors instead */
    [key: string]: any
}

/** Factorio PlaceAsTile Meta Information from package "factorio-data" */
export interface IPlaceAsTile {
    result: string
    condition_size: number,
    condition: string[]
}

/** Factorio Item Meta Information from package "factorio-data" */
export interface IItem {
    type: string
    name: string
    icon: string
    place_result: string
    place_as_tile: IPlaceAsTile
    /** @deprecated Use direct accessors instead */
    [key: string]: any
}

/** Factorio Inventory Item Meta Information from package "factorio-data" */
export interface IInventoryItem {
    name: string
    icon: string
}

/** Factorio Inventory Subgroup Meta Information from package "factorio-data" */
export interface IInventorySubgroup {
    name: string
    items: IInventoryItem[]
}

/** Factorio Inventory Group Meta Information from package "factorio-data" */
export interface IInventoryGroup {
    name: string
    icon: string
    subgroups: IInventorySubgroup[]
}
