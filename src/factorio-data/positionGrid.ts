import { Blueprint } from './blueprint'
import util from '../util'
import factorioData from './factorioData'
import Immutable from 'immutable'

export class Area {
    y: number
    x: number
    height: number
    width: number

    constructor(data: any, posIsCenter?: boolean) {
        this.width = data.width || 1
        this.height = data.height || 1
        if (posIsCenter) {
            this.x = Math.round(data.x - this.width / 2)
            this.y = Math.round(data.y - this.height / 2)
        } else {
            this.x = Math.floor(data.x)
            this.y = Math.floor(data.y)
        }
    }
}

export class PositionGrid {

    static tileDataAction(
        grid: Immutable.Map<string, number | Immutable.List<number>>,
        area: Area,
        fn: (key: string, cell: number | Immutable.List<number>) => boolean | void,
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
    grid: Immutable.Map<string, number | Immutable.List<number>>
    historyIndex: number
    history: Array<Immutable.Map<string, number | Immutable.List<number>>>

    constructor(bp: Blueprint, entity_numbers?: number[]) {
        this.bp = bp
        this.grid = Immutable.Map()

        // Set Bulk
        if (entity_numbers) {
            this.grid = this.grid.withMutations(map => {
                for (const entity_number of entity_numbers) {
                    const entity = this.bp.entity(entity_number)
                    if (!entity.entityData.flags.includes('placeable_off_grid')) {
                        PositionGrid.tileDataAction(map, entity.getArea(), (key, cell) => {
                            if (cell) {
                                if (typeof cell === 'number') {
                                    map.set(key, Immutable.List([
                                        cell,
                                        entity_number
                                    ]))
                                } else {
                                    map.setIn([key, cell.size], entity_number)
                                }
                            } else {
                                map.set(key, entity_number)
                            }
                        }, true)
                    }
                }
            })
        }

        this.history = [this.grid]
        this.historyIndex = 0
    }

    undo() {
        if (this.historyIndex === 0) return
        this.grid = this.history[--this.historyIndex]
    }

    redo() {
        if (this.historyIndex === this.history.length - 1) return
        this.grid = this.history[++this.historyIndex]
    }

    operation(fn: (grid: Immutable.Map<string, number | Immutable.List<number>>) => Immutable.Map<any, any>, pushToHistory = true) {
        this.grid = fn(this.grid)
        if (pushToHistory) {
            if (this.historyIndex < this.history.length) {
                this.history = this.history.slice(0, this.historyIndex + 1)
            }
            this.history.push(this.grid)
            this.historyIndex++
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
            else return cell.first()
        }
    }

    setTileData(entity_number: number) {
        const entity = this.bp.entity(entity_number)
        if (entity.entityData.flags.includes('placeable_off_grid')) return
        this.operation(grid => grid.withMutations(map => {
            PositionGrid.tileDataAction(map, entity.getArea(), (key, cell) => {
                if (cell) {
                    if (typeof cell === 'number') {
                        map.set(key, Immutable.List([
                            cell,
                            entity_number
                        ]))
                    } else {
                        map.setIn([key, cell.size], entity_number)
                    }
                } else {
                    map.set(key, entity_number)
                }
            }, true)
        }))
    }

    removeTileData(entity_number: number, pushToHistory?: boolean) {
        this.operation(grid => grid.withMutations(map => {
            PositionGrid.tileDataAction(map, this.bp.entity(entity_number).getArea(), (key, cell) => {
                if (typeof cell === 'number') {
                    if (cell === entity_number) map.delete(key)
                } else {
                    const res = cell.findIndex(v => {
                        if (v === entity_number) return true
                    })
                    if (res !== -1) {
                        if (map.get(key).count() === 1) {
                            map.delete(key)
                        } else {
                            map.deleteIn([key, res])
                            if (map.get(key).count() === 1) map.set(key, map.get(key).first())
                        }
                    }
                }
            })
        }), pushToHistory)
    }

    checkNoOverlap(name: string, direction: number, pos: IPoint) {
        const fd = factorioData.getEntity(name)
        const size = util.switchSizeBasedOnDirection(fd.size, direction)
        const area = new Area({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y
        }, true)

        const allStrRailEnt: number[] = []
        let gateEnt: number
        let strRailEnt: number
        let curRailEnt: number
        let otherEntities = false

        if (!this.foreachOverlap(area, cell => {
            switch (this.bp.entity(cell).name) {
                case 'gate': gateEnt = cell; break
                case 'curved_rail': curRailEnt = cell; break
                case 'straight_rail': allStrRailEnt.push(cell); strRailEnt = cell; break
                default: otherEntities = true
            }
        })) return true

        let sameDirStrRails = false
        for (const k of allStrRailEnt) {
            if (this.bp.entity(k).direction === direction) {
                sameDirStrRails = true
                break
            }
        }

        if (
            (name === 'gate' && strRailEnt && allStrRailEnt.length === 1 && this.bp.entity(strRailEnt).direction !== direction && !gateEnt) ||
            (name === 'straight_rail' && gateEnt && !strRailEnt && this.bp.entity(gateEnt).direction !== direction && !otherEntities) ||
            (name === 'straight_rail' && strRailEnt && !sameDirStrRails && !gateEnt) ||
            (name === 'curved_rail' && strRailEnt && !gateEnt) ||
            (name === 'straight_rail' && curRailEnt) ||
            (name === 'curved_rail' && curRailEnt && this.bp.entity(curRailEnt).direction !== direction)
        ) return true

        return false
    }

    checkFastReplaceableGroup(name: string, direction: number, pos: IPoint) {
        const fd = factorioData.getEntity(name)
        const size = util.switchSizeBasedOnDirection(fd.size, direction)
        const area = new Area({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y
        }, true)

        if (this.sharesCell(area)) return false
        const ent = this.getFirstFromArea(area, cell => {
            const ent = this.bp.entity(cell)
            if (ent.name !== name &&
                ent.entityData.fast_replaceable_group &&
                fd.fast_replaceable_group &&
                ent.entityData.fast_replaceable_group ===
                fd.fast_replaceable_group
            ) return cell
        })
        if (!ent || pos.x !== this.bp.entity(ent).position.x ||
            pos.y !== this.bp.entity(ent).position.y) return false
        return ent
    }

    checkSameEntityAndDifferentDirection(name: string, direction: number, pos: IPoint) {
        if (name === 'straight_rail') return false
        const fd = factorioData.getEntity(name)
        const size = util.switchSizeBasedOnDirection(fd.size, direction)
        const area = new Area({
            x: pos.x,
            y: pos.y,
            width: size.x,
            height: size.y
        }, true)

        if (this.sharesCell(area)) return false
        const ent = this.getFirstFromArea(area, cell => {
            if (this.bp.entity(cell).name === name) return cell
        })

        if (!ent) return false
        const e = this.bp.entity(ent)
        if (pos.x !== e.position.x || pos.y !== e.position.y || e.direction === direction) return false
        return ent
    }

    findEntityWithSameNameAndDirection(name: string, direction: number, pos: IPoint, searchDirection: number, maxDistance: number) {
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
                const entity = this.bp.entity(cell)
                if (entity.name === name) {
                    if (entity.direction === direction) return cell
                    if ((entity.direction + 4) % 8 === direction) return false
                }
            }
        }

        return false
    }

    sharesCell(area: Area) {
        let output = false
        PositionGrid.tileDataAction(this.grid, area, (_, cell) => {
            if (Immutable.List.isList(cell)) {
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
                for (const v of cell.values()) {
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
            if (Immutable.List.isList(cell)) {
                for (const v of cell.values()) {
                    const o = fn(v)
                    if (o !== undefined) out = o
                }
            } else {
                const o = fn(cell as number)
                if (o !== undefined) out = o
            }
            output.push(out)
        }, returnEmptyCells)
        return output.length === 0 ? false : output
    }

    getSurroundingEntities(
        area: Area,
        fn: (cell: number, relDir: number, x: number, y: number) => any,
        direction?: number
    ) {
        const coordinates = []

        for (let i = 0; i < area.width; i++) {
            coordinates.push([0, area.x + i, area.y - 1])
            coordinates.push([4, area.x + i, area.y + area.height])
        }
        for (let i = 0; i < area.height; i++) {
            coordinates.push([2, area.x + area.width, area.y + i])
            coordinates.push([6, area.x - 1, area.y + i])
        }

        let output: any[] = [false, false, false, false]
        for (const coordinate of coordinates) {
            const cell = this.grid.get(`${coordinate[1]},${coordinate[2]}`)
            const relDir = coordinate[0] / 2
            if (cell) {
                if (typeof cell === 'number') {
                    const o = fn(cell as number, coordinate[0], coordinate[1], coordinate[2])
                    if (o !== undefined) output[relDir] = o
                } else {
                    for (const v of cell.values()) {
                        const o = fn(v, coordinate[0], coordinate[1], coordinate[2])
                        if (o !== undefined) output[relDir] = o
                    }
                }
            }
        }

        if (direction) output = [...output, ...output].splice(direction / 2, 4)
        return output
    }
}
