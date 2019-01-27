declare module '*.png' {
    const path: string
    export default path
}

declare module '*.json' {
    const content: any
    export default content
}

declare interface Map {
    find<V, K>(predicate: (value: V, key: K) => boolean): V
}

interface NodeModule {
    hot: any
}

interface Navigator {
    clipboard: {
        writeText?: (s: string) => Promise<void>
        readText?: () => Promise<string>
    }
}

interface Window {
    doorbellOptions: {
        tags?: string
        id: string
        appKey: string
        windowLoaded?: boolean
        onShow?: () => void
        onHide?: () => void
        onInitialized?: () => void
    }
}

interface IPoint {
    x: number
    y: number
}

interface IEntityData {
    hr: boolean
    dir: number

    bp: Blueprint
    position: IPoint
    hasConnections: boolean

    assemblerPipeDirection: string
    dirType: string
    operator: string
    assemblerCraftsWithFluid: boolean
    trainStopColor: { r: number; g: number; b: number; a: number}
    chemicalPlantDontConnectOutput: boolean
}

interface IHistoryObject {
    entity_number: number
    other_entity?: number
    type: 'init' | 'add' | 'del' | 'mov' | 'upd'
    annotation: string
    rawEntities: Immutable.Map<number, any>
}

interface IFilter {
    /** Slot index (1 based ... not 0 like arrays) */
    index: number
    /** Name of entity to be filtered */
    name: string
    /** If stacking is allowed, how many shall be stacked */
    count?: number
}
