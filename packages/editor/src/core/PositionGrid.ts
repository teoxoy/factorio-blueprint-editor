import util from '../common/util'
import { IPoint } from '../types'
import FD, { getEntitySize } from './factorioData'
import { Blueprint } from './Blueprint'
import { Entity } from './Entity'
import { IConnectionPoint } from './WireConnections'

/** Anchor is in the middle */
interface IArea {
    x: number
    y: number
    w: number
    h: number
}

interface INeighbourData extends IPoint {
    relDir: number
    entity: Entity
}

/** Moves X and Y to top left corner from middle (anchor 0.5 0.5 => 0 0) */
const processArea = (area: IArea): IArea => ({
    ...area,
    x: Math.round(area.x - area.w / 2),
    y: Math.round(area.y - area.h / 2),
})

export class PositionGrid {
    private bp: Blueprint
    private grid: Map<string, number | number[]> = new Map()

    public constructor(bp: Blueprint) {
        this.bp = bp
    }

    private tileDataAction(
        area: IArea,
        fn: (key: string, cell: number | number[]) => boolean | void,
        returnEmptyCells = false
    ): void {
        const A = processArea(area)

        let stop = false
        for (let x = A.x, maxX = A.x + A.w; x < maxX; x++) {
            for (let y = A.y, maxY = A.y + A.h; y < maxY; y++) {
                const key = `${x},${y}`
                const cell = this.grid.get(key)
                if (cell || returnEmptyCells) {
                    stop = !!fn(key, cell)
                }
                if (stop) {
                    break
                }
            }
            if (stop) {
                break
            }
        }
    }

    public getEntityAtPosition(position: IPoint): Entity {
        const cell = this.grid.get(`${Math.floor(position.x)},${Math.floor(position.y)}`)
        if (cell) {
            if (typeof cell === 'number') {
                return this.bp.entities.get(cell)
            } else {
                return this.bp.entities.get(cell[cell.length - 1])
            }
        }
    }

    public getConnectionPointAtPosition(position: IPoint, color: string): IConnectionPoint {
        const entity = this.getEntityAtPosition(position)
        if (entity === undefined) return undefined
        const rel_position = util.sumprod(position, -1, entity.position)
        for (let side = 1; side <= 10; side++) {
            const bbox = entity.getWireConnectionBoundingBox(color, side)
            if (bbox === undefined) break // no more sides expected for that color
            const rel_bbox = bbox.map(b => util.sumprod(rel_position, -1, b))
            if (Object.values(rel_bbox[0]).some(v => v < 0)) continue
            if (Object.values(rel_bbox[1]).some(v => v > 0)) continue
            return {
                entityNumber: entity.entityNumber,
                entitySide: side,
            }
        }
    }

    public setTileData(entity: Entity, position: IPoint = entity.position): void {
        // if (entity.entityData.flags.includes('placeable-off-grid')) {
        //     return
        // }

        this.tileDataAction(
            {
                x: position.x,
                y: position.y,
                w: entity.size.x,
                h: entity.size.y,
            },
            (key, cell) => {
                if (cell) {
                    const entityNumbers = [
                        entity.entityNumber,
                        ...(typeof cell === 'number' ? [cell] : cell),
                    ]
                        // Sort entities by their size
                        .sort((a, b) => {
                            const sA = this.bp.entities.get(a).size
                            const sB = this.bp.entities.get(b).size
                            return sB.x * sB.y - sA.x * sA.y
                        })

                    this.grid.set(key, entityNumbers)
                } else {
                    this.grid.set(key, entity.entityNumber)
                }
            },
            true
        )
    }

    public removeTileData(entity: Entity, position: IPoint = entity.position): void {
        this.tileDataAction(
            {
                x: position.x,
                y: position.y,
                w: entity.size.x,
                h: entity.size.y,
            },
            (key, cell) => {
                if (typeof cell === 'number') {
                    if (cell === entity.entityNumber) {
                        this.grid.delete(key)
                    }
                } else {
                    const res = cell.findIndex(v => v === entity.entityNumber)
                    if (res !== -1) {
                        if (cell.length === 1) {
                            this.grid.delete(key)
                        } else if (cell.length === 2) {
                            this.grid.set(
                                key,
                                cell.find((_, k) => k !== res)
                            )
                        } else {
                            this.grid.set(
                                key,
                                cell.filter((_, k) => k !== res)
                            )
                        }
                    }
                }
            }
        )
    }

    public canMoveTo(entity: Entity, newPosition: IPoint): boolean {
        this.removeTileData(entity)
        const spaceAvalible = this.isAreaAvailable(entity.name, newPosition, entity.direction)
        this.setTileData(entity)
        return spaceAvalible
    }

    public isAreaAvailable(name: string, pos: IPoint, direction = 0): boolean {
        const size = getEntitySize(FD.entities[name], direction)

        const straightRails: Entity[] = []
        let gate: Entity
        let curvedRail: Entity
        let signal: Entity
        let otherEntities = false

        const area = {
            x: pos.x,
            y: pos.y,
            w: size.x,
            h: size.y,
        }

        if (this.isAreaEmpty(area)) return true

        for (const entity of this.getEntitiesInArea(area)) {
            switch (entity.type) {
                case 'gate':
                    gate = entity
                    break
                case 'legacy-curved-rail':
                    curvedRail = entity
                    break
                case 'legacy-straight-rail':
                    if (!straightRails.includes(entity)) {
                        straightRails.push(entity)
                    }
                    break
                case 'rail-signal':
                case 'rail-chain-signal':
                    signal = entity
                    break
                default:
                    otherEntities = true
            }
        }

        const sameDirStrRails = straightRails.some(rail => rail.direction % 8 === direction % 8)

        if (
            (name === 'gate' &&
                straightRails.length === 1 &&
                straightRails[0].direction % 8 !== direction % 8 &&
                !gate) ||
            (name === 'legacy-straight-rail' &&
                gate &&
                gate.direction % 8 !== direction % 8 &&
                straightRails.length === 0 &&
                !otherEntities) ||
            (name === 'legacy-straight-rail' &&
                straightRails.length > 0 &&
                !sameDirStrRails &&
                !gate) ||
            (name === 'legacy-curved-rail' && straightRails.length > 0 && !gate) ||
            (name === 'legacy-straight-rail' && curvedRail) ||
            (name === 'legacy-curved-rail' && curvedRail && curvedRail.direction !== direction) ||
            // TODO: remove this when we add better rail support
            ((name === 'rail-signal' || name === 'rail-chain-signal') &&
                (curvedRail || straightRails.length > 0)) ||
            ((name === 'legacy-straight-rail' || name === 'legacy-curved-rail') && signal)
        ) {
            return true
        }

        return false
    }

    public checkFastReplaceableGroup(name: string, direction: number, pos: IPoint): Entity {
        const fd = FD.entities[name]
        const size = getEntitySize(fd, direction)
        const area = {
            x: pos.x,
            y: pos.y,
            w: size.x,
            h: size.y,
        }

        if (this.sharesCell(area)) return
        const entity = this.findInArea(
            area,
            entity =>
                entity.name !== name &&
                entity.entityData.fast_replaceable_group &&
                fd.fast_replaceable_group &&
                entity.entityData.fast_replaceable_group === fd.fast_replaceable_group
        )
        if (!entity || pos.x !== entity.position.x || pos.y !== entity.position.y) return
        return entity
    }

    public checkSameEntityAndDifferentDirection(
        name: string,
        direction: number,
        pos: IPoint
    ): Entity | undefined {
        if (name === 'legacy-straight-rail') return undefined

        const size = getEntitySize(FD.entities[name], direction)
        const area = {
            x: pos.x,
            y: pos.y,
            w: size.x,
            h: size.y,
        }

        if (this.sharesCell(area)) return undefined
        const entity = this.findInArea(area, entity => entity.name === name)

        if (
            !entity ||
            pos.x !== entity.position.x ||
            pos.y !== entity.position.y ||
            entity.direction === direction
        ) {
            return undefined
        }
        return entity
    }

    public getOpposingEntity(
        name: string,
        direction: number,
        position: IPoint,
        searchDirection: number,
        maxDistance: number
    ): number | undefined {
        const horizontal = searchDirection % 4 !== 0
        const sign = searchDirection === 0 || searchDirection === 6 ? -1 : 1

        for (let i = 1; i <= maxDistance; i++) {
            const X = Math.floor(position.x) + (horizontal ? i * sign : 0)
            const Y = Math.floor(position.y) + (horizontal ? 0 : i * sign)
            const cell = this.grid.get(`${X},${Y}`)

            if (typeof cell === 'number') {
                const entity = this.bp.entities.get(cell)
                if (entity.name === name) {
                    if (entity.direction === direction) return cell
                    if ((entity.direction + 8) % 16 === direction) return undefined
                }
            }
        }

        return undefined
    }

    /** Returns true if any of the cells in the area are an array */
    public sharesCell(area: IArea): boolean {
        let hasArrayCell = false
        this.tileDataAction(area, (_, cell) => {
            if (typeof cell !== 'number') {
                hasArrayCell = true
                return true
            }
        })
        return hasArrayCell
    }

    public isAreaEmpty(area: IArea): boolean {
        let empty = true
        this.tileDataAction(area, () => {
            empty = false
            return true
        })
        return empty
    }

    public findInArea(area: IArea, fn: (entity: Entity) => boolean): Entity {
        let entity: Entity
        this.tileDataAction(area, (_, cell) => {
            if (typeof cell === 'number') {
                const ent = this.bp.entities.get(cell)
                if (fn(ent)) {
                    entity = ent
                    return true
                }
            } else {
                for (const v of cell) {
                    const ent = this.bp.entities.get(v)
                    if (fn(ent)) {
                        entity = ent
                        return true
                    }
                }
            }
        })
        return entity
    }

    /** Returns all entities in the area */
    public getEntitiesInArea(area: IArea): Entity[] {
        const entities = new Set<Entity>()
        this.tileDataAction(area, (_, cell) => {
            if (typeof cell === 'number') {
                entities.add(this.bp.entities.get(cell))
            } else {
                for (const v of cell) {
                    entities.add(this.bp.entities.get(v))
                }
            }
        })
        return [...entities]
    }

    public getSurroundingEntities(area: IArea): Entity[] {
        const A = processArea(area)

        const coordinates = []

        for (let i = 0; i < A.w; i++) {
            coordinates.push([A.x + i, A.y - 1])
            coordinates.push([A.x + i, A.y + A.h])
        }
        for (let i = 0; i < A.h; i++) {
            coordinates.push([A.x + A.w, A.y + i])
            coordinates.push([A.x - 1, A.y + i])
        }

        // Corners
        coordinates.push([A.x - 1, A.y - 1])
        coordinates.push([A.x - 1, A.y + A.h])
        coordinates.push([A.x + A.w, A.y - 1])
        coordinates.push([A.x + A.w, A.y + A.h])

        return util
            .uniqueInArray(
                coordinates.reduce<number[]>((acc, coord) => {
                    const cell = this.grid.get(`${coord[0]},${coord[1]}`)
                    if (!cell) return acc
                    if (typeof cell === 'number') {
                        acc.push(cell)
                    } else {
                        acc.push(...cell)
                    }
                    return acc
                }, [])
            )
            .map(entNr => this.bp.entities.get(entNr))
    }

    public getNeighbourData(point: IPoint): INeighbourData[] {
        return [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
        ].map((o, i) => {
            const x = Math.floor(point.x) + o.x
            const y = Math.floor(point.y) + o.y
            const cell = this.grid.get(`${x},${y}`)
            const entity = cell
                ? this.bp.entities.get(typeof cell === 'number' ? cell : cell[cell.length - 1])
                : undefined
            return { x, y, relDir: i * 4, entity }
        })
    }
}
