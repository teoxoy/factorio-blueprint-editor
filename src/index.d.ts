declare module '*.json' {
    const content: any
    export default content
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
