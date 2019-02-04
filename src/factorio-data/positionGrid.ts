import Blueprint from './blueprint'
import util from '../common/util'
import FD from 'factorio-data'
import Entity from './entity'

export class Area {
    y: number
    x: number
    height: number
    width: number

    constructor(data: any) {
        this.width = data.width || 1
        this.height = data.height || 1
        this.x = Math.round(data.x - this.width / 2)
        this.y = Math.round(data.y - this.height / 2)
    }
}

export class PositionGrid {

    static tileDataAction(
        grid: Map<string, number | number[]>,
        area: Area,
        fn: (key: string, cell: number | number[]) => boolean | void,
        returnEmptyCells = false
    ) {
        let stop = false
        for (let x = area.x, maxX = area.x + area.width; x < maxX; x++) {
            for (let y = area.y, maxY = area.y + area.height; y < maxY; y++) {
                const key = `${x},${y}`
                const cell = grid.get(key)
                if (cell || returnEmptyCells) stop = !!fn(key, cell)
                if (stop) break
            }
            if (stop) break
        }
    }

    bp: Blueprint
    grid: Map<string, number | number[]>

    constructor(bp: Blueprint, entity_numbers?: number[]) {
        this.bp = bp
        this.grid = new Map()

        // Set Bulk
        if (entity_numbers) {
            for (const entity_number of entity_numbers) {
                const entity = this.bp.entities.get(entity_number)
                if (!entity.entityData.flags.includes('placeable_off_grid')) {
                    PositionGrid.tileDataAction(this.grid, entity.getArea(), (key, cell) => {
                        if (cell) {
                            if (typeof cell === 'number') {
                                this.grid.set(key, [
                                    cell,
                                    entity_number
                                ])
                            } else {
                                this.grid.set(key, [...cell, entity_number])
                            }
                        } else {
                            this.grid.set(key, entity_number)
                        }
                    }, true)
                }
            }
        }
    }

    getAllPositions() {
        return [...this.grid.keys()].map(p => {
            const pS = p.split(',')
            return {x: Number(pS[0]), y: Number(pS[1])}
        })
    }

    getCellAtPosition(position: any): number {
        const POS = position instanceof Array ? {x: position[0], y: position[1]} : position
        const cell = this.grid.get(`${Math.floor(POS.x)},${Math.floor(POS.y)}`)
        if (cell) {
            if (typeof cell === 'number') return cell
            else return cell[0]
        }
    }

    setTileData(entity: Entity, position?: IPoint) {
        if (entity.entityData.flags.includes('placeable_off_grid')) return

        PositionGrid.tileDataAction(this.grid, entity.getArea(position), (key, cell) => {
            if (cell) {
                if (typeof cell === 'number') {
                    this.grid.set(key, [
                        entity.entity_number,
                        cell
                    ])
                } else {
                    this.grid.set(key, [...cell, entity.entity_number])
                }
            } else {
                this.grid.set(key, entity.entity_number)
            }
        }, true)
    }

    removeTileData(entity: Entity, position?: IPoint) {
        PositionGrid.tileDataAction(this.grid, entity.getArea(position), (key, cell) => {
            if (typeof cell === 'number') {
                if (cell === entity.entity_number) this.grid.delete(key)
            } else {
                const res = cell.findIndex(v => v === entity.entity_number)
                if (res !== -1) {
                    if (cell.length === 1) {
                        this.grid.delete(key)
                    } else if (cell.length === 2) {
                        this.grid.set(key, cell.find((_, k) => k !== res))
                    } else {
                        this.grid.set(key, cell.filter((_, k) => k !== res))
                    }
                }
            }
        })
    }

    canMoveTo(entity: Entity, newPosition: IPoint) {
        this.removeTileData(entity)
        const spaceAvalible = this.isAreaAvalible(entity.name, newPosition, entity.direction)
        this.setTileData(entity)
        return spaceAvalible
    }

    isAreaAvalible(name: string, pos: IPoint, direction = 0) {
        const size = util.switchSizeBasedOnDirection(FD.entities[name].size, direction)
        const area = new Area({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y
        })

        const allStrRailEnt: number[] = []
        let gateEnt: number
        let strRailEnt: number
        let curRailEnt: number
        let signal: number
        let otherEntities = false

        if (!this.foreachOverlap(area, cell => {
            switch (this.bp.entities.get(cell).name) {
                case 'gate': gateEnt = cell; break
                case 'curved_rail': curRailEnt = cell; break
                case 'straight_rail': allStrRailEnt.push(cell); strRailEnt = cell; break
                case 'rail_signal': signal = cell; break
                case 'rail_chain_signal': signal = cell; break
                default: otherEntities = true
            }
        })) return true

        let sameDirStrRails = false
        for (const k of allStrRailEnt) {
            if (this.bp.entities.get(k).direction === direction) {
                sameDirStrRails = true
                break
            }
        }

        if (
            (name === 'gate' && strRailEnt && allStrRailEnt.length === 1 && this.bp.entities.get(strRailEnt).direction !== direction && !gateEnt) ||
            (name === 'straight_rail' && gateEnt && !strRailEnt && this.bp.entities.get(gateEnt).direction !== direction && !otherEntities) ||
            (name === 'straight_rail' && strRailEnt && !sameDirStrRails && !gateEnt) ||
            (name === 'curved_rail' && strRailEnt && !gateEnt) ||
            (name === 'straight_rail' && curRailEnt) ||
            (name === 'curved_rail' && curRailEnt && this.bp.entities.get(curRailEnt).direction !== direction) ||
            // TODO: remove this when we add better rail support
            ((name === 'rail_signal' || name === 'rail_chain_signal') && (curRailEnt || strRailEnt)) ||
            ((name === 'straight_rail' || name === 'curved_rail') && signal)
        ) return true

        return false
    }

    checkFastReplaceableGroup(name: string, direction: number, pos: IPoint) {
        const fd = FD.entities[name]
        const size = util.switchSizeBasedOnDirection(fd.size, direction)
        const area = new Area({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y
        })

        if (this.sharesCell(area)) return false
        const ent = this.getFirstFromArea(area, cell => {
            const ent = this.bp.entities.get(cell)
            if (ent.name !== name &&
                ent.entityData.fast_replaceable_group &&
                fd.fast_replaceable_group &&
                ent.entityData.fast_replaceable_group ===
                fd.fast_replaceable_group
            ) return cell
        })
        if (!ent || pos.x !== this.bp.entities.get(ent).position.x ||
            pos.y !== this.bp.entities.get(ent).position.y) return false
        return ent
    }

    checkSameEntityAndDifferentDirection(name: string, direction: number, pos: IPoint) {
        if (name === 'straight_rail') return false
        const fd = FD.entities[name]
        const size = util.switchSizeBasedOnDirection(fd.size, direction)
        const area = new Area({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y
        })

        if (this.sharesCell(area)) return false
        const ent = this.getFirstFromArea(area, cell => {
            if (this.bp.entities.get(cell).name === name) return cell
        })

        if (!ent) return false
        const e = this.bp.entities.get(ent)
        if (pos.x !== e.position.x || pos.y !== e.position.y || e.direction === direction) return false
        return ent
    }

    getOpposingEntity(name: string, direction: number, pos: IPoint, searchDirection: number, maxDistance: number): number {
        const position = {
            x: Math.floor(pos.x),
            y: Math.floor(pos.y)
        }
        const horizontal = searchDirection % 4 !== 0
        const sign = searchDirection === 0 || searchDirection === 6 ? -1 : 1

        for (let i = 1; i <= maxDistance; i++) {
            const cell = this.grid.get(
                `${position.x + (horizontal ? i * sign : 0)},${position.y + (!horizontal ? i * sign : 0)}`
            )
            if (typeof cell === 'number') {
                const entity = this.bp.entities.get(cell)
                if (entity.name === name) {
                    if (entity.direction === direction) return cell
                    if ((entity.direction + 4) % 8 === direction) return undefined
                }
            }
        }

        return undefined
    }

    sharesCell(area: Area) {
        let output = false
        PositionGrid.tileDataAction(this.grid, area, (_, cell) => {
            if (typeof cell !== 'number') {
                output = true
                return true
            }
        })
        return output
    }

    getFirstFromArea(area: Area, fn: (cell: number) => number): false | number {
        let output: boolean | number = false
        PositionGrid.tileDataAction(this.grid, area, (_, cell) => {
            if (typeof cell === 'number') {
                output = fn(cell)
                if (output) return true
            } else {
                for (const v of cell) {
                    output = fn(v)
                    if (output) return true
                }
            }
        })
        return output
    }

    foreachOverlap(area: Area, fn: (cell: number) => any, returnEmptyCells?: boolean) {
        const output: boolean[] = []
        PositionGrid.tileDataAction(this.grid, area, (_, cell) => {
            let out = false
            if (typeof cell !== 'number') {
                for (const v of cell) {
                    const o = fn(v)
                    if (o !== undefined) out = o
                }
            } else {
                const o = fn(cell)
                if (o !== undefined) out = o
            }
            output.push(out)
        }, returnEmptyCells)
        return output.length === 0 ? false : output
    }

    getSurroundingEntities(area: Area): Entity[] {
        const coordinates = []

        for (let i = 0; i < area.width; i++) {
            coordinates.push([area.x + i, area.y - 1])
            coordinates.push([area.x + i, area.y + area.height])
        }
        for (let i = 0; i < area.height; i++) {
            coordinates.push([area.x + area.width, area.y + i])
            coordinates.push([area.x - 1, area.y + i])
        }

        return util.uniqueInArray(coordinates
            .reduce((acc, coord) => {
                const cell = this.grid.get(`${coord[0]},${coord[1]}`)
                if (!cell) return acc
                if (typeof cell === 'number') acc.push(cell)
                else acc.push(...cell)
                return acc
            }, []))
            .map(entNr => this.bp.entities.get(entNr))
    }

    getNeighbourData(point: IPoint) {
        return [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 }
        ].map((o, i) => {
            const x = Math.floor(point.x) + o.x
            const y = Math.floor(point.y) + o.y
            const cell = this.grid.get(`${x},${y}`)
            const entity = cell
                ? (this.bp.entities.get(typeof cell === 'number' ? cell : cell[0]))
                : undefined
            return { x, y, relDir: i * 2, entity }
        })
    }
}
