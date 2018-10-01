declare module '*.png'
declare module '*.json' {
    const content: any
    export default content
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
