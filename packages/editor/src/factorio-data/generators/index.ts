import generatePipes from './pipe'
import generateBeacons from './beacon'
import generatePoles from './pole'

export interface IVisualization {
    path: IPoint[]
    size: number
    alpha: number
    color?: number
}

export default {
    generatePipes,
    generateBeacons,
    generatePoles
}
