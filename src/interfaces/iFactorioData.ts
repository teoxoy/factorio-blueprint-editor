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
    /** @deprecated Use direct accessors instead */
    [key: string]: any
}

/** Factorio Recipe Meta Information from package "factorio-data" */
export interface IRecipe {
    type: string
    name: string
}

/** Factorio Item Meta Information from package "factorio-data" */
export interface IItem {
    type: string
    name: string
}
