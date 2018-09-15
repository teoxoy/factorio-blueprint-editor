import factorioData from './factorioData'
import { Tile } from './tile'
import { PositionGrid } from './positionGrid'
import Immutable from 'immutable'
import initEntity from './entity'
import G from '../globals'
import { ConnectionsManager } from './connectionsManager'
import { EntityContainer } from '../containers/entity'

export class Blueprint {

    name: string
    icons: any[]
    tiles: Tile[]
    tilePositionGrid: any
    version: number
    connections: ConnectionsManager
    next_entity_number: number
    historyIndex: number
    history: Array<{
        entity_number: number | number[];
        type: 'init' | 'add' | 'del' | 'mov' | 'upd';
        annotation: string;
        rawEntities: Immutable.Map<number, any>;
    }>
    bp: Blueprint
    entityPositionGrid: PositionGrid
    rawEntities: Immutable.Map<number, any>

    constructor(data?: any) {
        initEntity(this)
        this.name = 'Blueprint'
        this.icons = []
        this.rawEntities = Immutable.Map()
        this.tiles = []
        this.tilePositionGrid = {}
        this.version = undefined
        this.next_entity_number = 1

        if (data) {
            if (!data.tiles) data.tiles = []
            if (!data.icons) data.icons = []
            this.name = data.label
            this.version = data.version

            this.next_entity_number += data.entities.length
            this.rawEntities = this.rawEntities.withMutations(map => {
                for (const entity of data.entities) {
                    map.set(entity.entity_number, Immutable.fromJS(entity))
                    // this.entityPositionGrid.setTileData(entity.entity_number)
                }
            })

            data.tiles.forEach((tile: any) => {
                this.createTile(tile.name, tile.position)
            })

            this.icons = []
            data.icons.forEach((icon: any) => {
                this.icons[icon.index - 1] = icon.signal.name
            })

            this.setTileIds()

            // TODO: if entity has placeable-off-grid flag then take the next one
            const firstEntityTopLeft = this.firstEntity().topLeft()

            const offsetX = G.sizeBPContainer.width / 64 - (firstEntityTopLeft.x % 1 !== 0 ? -0.5 : 0)
            const offsetY = G.sizeBPContainer.height / 64 - (firstEntityTopLeft.y % 1 !== 0 ? -0.5 : 0)

            this.rawEntities = this.rawEntities.withMutations(map => {
                map.keySeq().forEach(k => {
                    // tslint:disable-next-line:no-parameter-reassignment
                    map.updateIn([k, 'position', 'x'], (x: number) => x += offsetX)
                    // tslint:disable-next-line:no-parameter-reassignment
                    map.updateIn([k, 'position', 'y'], (y: number) => y += offsetY)
                })
            })

            // tslint:disable-next-line:no-dynamic-delete
            this.tiles.forEach(tile => delete this.tilePositionGrid[`${tile.position.x},${tile.position.y}`])
            this.tiles.forEach(tile => {
                tile.position.x += offsetX
                tile.position.y += offsetY
                this.tilePositionGrid[`${tile.position.x},${tile.position.y}`] = tile
            })
        }

        this.entityPositionGrid = new PositionGrid(this, [...this.rawEntities.keys()])
        this.connections = new ConnectionsManager(this, [...this.rawEntities.keys()])

        this.historyIndex = 0
        this.history = [{
            entity_number: 0,
            type: 'init',
            annotation: '',
            rawEntities: this.rawEntities
        }]

        return this
    }

    entity(entity_number: number) {
        const e = this.rawEntities.get(entity_number)
        if (!e) return undefined
        return e.entity()
    }

    firstEntity() {
        return this.rawEntities.first().entity()
    }

    undo(
        pre: (hist: any) => void,
        post: (hist: any) => void
    ) {
        if (this.historyIndex === 0) return
        const hist = this.history[this.historyIndex--]

        switch (hist.type) {
            case 'add':
            case 'del':
            case 'mov':
                this.entityPositionGrid.undo()
        }

        pre(hist)
        this.rawEntities = this.history[this.historyIndex].rawEntities
        switch (hist.type) {
            case 'del':
                if (this.entity(hist.entity_number as number).hasConnections) this.connections.undo()
        }
        post(hist)
    }

    redo(
        pre: (hist: any) => void,
        post: (hist: any) => void
    ) {
        if (this.historyIndex === this.history.length - 1) return
        const hist = this.history[++this.historyIndex]

        switch (hist.type) {
            case 'add':
            case 'del':
            case 'mov':
                this.entityPositionGrid.redo()
        }

        pre(hist)

        const entity = this.entity(hist.entity_number as number)
        switch (hist.type) {
            case 'del':
                if (entity.hasConnections) this.connections.redo()
        }

        this.rawEntities = hist.rawEntities

        // TODO: Refactor this somehow
        if (hist.type === 'del' && entity.hasConnections && entity.connectedEntities) {
            for (const entNr of entity.connectedEntities) {
                EntityContainer.mappings.get(entNr).redraw()
            }
        }

        post(hist)
    }

    operation(
        entity_number: number | number[],
        annotation: string,
        fn: (entities: Immutable.Map<number, any>) => Immutable.Map<any, any>,
        type: 'add' | 'del' | 'mov' | 'upd' = 'upd',
        pushToHistory = true
    ) {
        console.log(`${entity_number} - ${annotation}`)
        this.rawEntities = fn(this.rawEntities)

        if (pushToHistory) {
            if (this.historyIndex < this.history.length) {
                this.history = this.history.slice(0, this.historyIndex + 1)
            }
            this.history.push({
                entity_number,
                type,
                annotation,
                rawEntities: this.rawEntities
            })
            this.historyIndex++
        }
    }

    createEntity(name: string, position: IPoint, direction: number, directionType?: string) {
        if (!this.entityPositionGrid.checkNoOverlap(name, direction, position)) return false
        const entity_number = this.next_entity_number++
        const data = {
            entity_number,
            name,
            position,
            direction
        }
        if (directionType) data.type = directionType
        this.operation(entity_number, 'Added new entity',
            entities => entities.set(entity_number, Immutable.fromJS(data)),
            'add'
        )

        this.entityPositionGrid.setTileData(entity_number)

        return data.entity_number
    }

    removeEntity(entity_number: number, redrawCb?: (entity_number: number) => void) {
        this.entityPositionGrid.removeTileData(entity_number)
        let entitiesToModify: any[] = []
        if (this.entity(entity_number).hasConnections) {
            entitiesToModify = this.connections.removeConnectionData(entity_number)
        }
        this.operation(entity_number, 'Deleted entity',
            entities => entities.withMutations(map => {

                for (const i in entitiesToModify) {
                    const entity_number = entitiesToModify[i].entity_number
                    const side = entitiesToModify[i].side
                    const color = entitiesToModify[i].color
                    const index = entitiesToModify[i].index

                    const connections = this.entity(entity_number).connections
                    const a = connections.size === 1
                    const b = connections[side].size === 1
                    const c = connections[side][color].size === 1
                    if (a && b && c) {
                        map.removeIn([entity_number, 'connections'])
                    } else if (b && c) {
                        map.removeIn([entity_number, 'connections', side])
                    } else if (c) {
                        map.removeIn([entity_number, 'connections', side, color])
                    } else {
                        map.removeIn([entity_number, 'connections', side, color, index])
                    }
                }

                map.delete(entity_number)
            }),
            'del'
        )
        for (const i in entitiesToModify) {
            redrawCb(entitiesToModify[i].entity_number)
        }
    }

    getFirstRail() {
        const fR = this.rawEntities.find(v => v.get('name') === 'straight_rail' || v.get('name') === 'curved_rail')
        return fR ? fR.toJS() : undefined
    }

    // placeBlueprint(bp, position, direction = 0, allowOverlap) { // direction is 0, 1, 2, or 3
    //     const entitiesCreated = []
    //     bp.entities.forEach(ent => {
    //         const data = ent.getData()

    //         data.direction += direction * 2
    //         data.direction %= 8

    //         if (direction === 3) data.position = { x: data.position.y, y: -data.position.x }
    //         else if (direction === 2) data.position = { x: -data.position.x, y: -data.position.y }
    //         else if (direction === 1) data.position = { x: -data.position.y, y: data.position.x }

    //         data.position.x += position.x
    //         data.position.y += position.y

    //         entitiesCreated.push(this.createEntityWithData(data, allowOverlap, true, true))
    //     })

    //     entitiesCreated.forEach(e => {
    //         e.place(this.entitiesCreated)
    //     })

    //     bp.tiles.forEach(tile => {
    //         const data = tile.getData()

    //         if (direction === 3) data.position = { x: data.position.y, y: -data.position.x }
    //         else if (direction === 2) data.position = { x: -data.position.x, y: -data.position.y }
    //         else if (direction === 1) data.position = { x: -data.position.y, y: data.position.x }

    //         data.position.x += position.x
    //         data.position.y += position.y

    //         this.createTileWithData(data)
    //     })

    //     return this
    // }

    // createEntityWithData(data: any, allowOverlap: boolean, noPlace: boolean) {
    //     const ent = new Entity(data, this)
    //     if (allowOverlap || this.entityPositionGrid.checkNoOverlap(ent)) {
    //         if (!noPlace) ent.place(this.entities)
    //         this.entities.push(ent)
    //         return ent
    //     } else {
    //         // const otherEnt = ent.getOverlap(this.entityPositionGrid)
    //         // throw new Error('Entity ' + data.name + ' overlaps ' + otherEnt.name +
    //         // ' entity (' + data.position.x + ', ' + data.position.y + ')')
    //     }
    // }

    createTile(name: string, position: IPoint) {
        return this.createTileWithData({ name, position })
    }

    createTileWithData(data: any) {
        const tile = new Tile(data, this)
        const key = `${data.position.x},${data.position.y}`
        if (this.tilePositionGrid[key]) this.removeTile(this.tilePositionGrid[key])

        this.tilePositionGrid[key] = tile
        this.tiles.push(tile)
        return tile
    }

    removeTile(tile: Tile) {
        if (!tile) return false
        else {
            const index = this.tiles.indexOf(tile)
            if (index === -1) return tile
            this.tiles.splice(index, 1)
            return tile
        }
    }

    setTileIds() {
        this.tiles.forEach((tile, i) => {
            tile.id = i + 1
        })
        return this
    }

    // Get corner/center positions
    getPosition(f: string, xcomp: any, ycomp: any) {
        if (!this.rawEntities.size) return { x: 0, y: 0 }
        return {
            x: [...this.rawEntities.keys()].reduce(
                (best: number, ent: any) => xcomp(best, this.entity(ent)[f]().x),
                this.firstEntity()[f]().x
            ),
            y: [...this.rawEntities.keys()].reduce(
                (best: number, ent: any) => ycomp(best, this.entity(ent)[f]().y),
                this.firstEntity()[f]().y
            )
        }
    }

    center() {
        return {
            x: (this.topLeft().x + this.topRight().x) / 2,
            y: (this.topLeft().y + this.bottomLeft().y) / 2
        }
    }
    topLeft() { return this.getPosition('topLeft', Math.min, Math.min) }
    topRight() { return this.getPosition('topRight', Math.max, Math.min) }
    bottomLeft() { return this.getPosition('bottomLeft', Math.min, Math.max) }
    bottomRight() { return this.getPosition('bottomRight', Math.max, Math.max) }

    generateIcons() {
        // TODO: make this behave more like in Factorio
        const entities: Map<string, number> = new Map()

        for (const i of [...this.rawEntities.keys()]) {
            const name = this.entity(i).name

            const value = entities.get(name)
            entities.set(name, value ? (value + 1) : 0)
        }

        const sortedEntities = [...entities.entries()].sort((a, b) => a[1] - b[1])

        this.icons[0] = sortedEntities[0][0]
        if (sortedEntities.length > 1) this.icons[1] = sortedEntities[1][0]
    }

    toObject() {
        this.setTileIds()
        if (!this.icons.length) this.generateIcons()
        const entityInfo = this.rawEntities.valueSeq().toJS()
        const center = this.center()
        const fR = this.getFirstRail()
        if (fR) {
            center.x += (fR.position.x - center.x) % 2
            center.y += (fR.position.y - center.y) % 2
        }
        for (const e of entityInfo) {
            e.position.x -= center.x
            e.position.y -= center.y
        }
        const tileInfo = this.tiles.map(tile => tile.getData())
        for (const t of tileInfo) {
            t.position.x -= center.x
            t.position.y -= center.y
        }
        const iconData = this.icons.map((icon, i) => (
            { signal: { type: factorioData.getItemTypeForBp(icon), name: icon }, index: i + 1 }
        ))
        return {
            blueprint: {
                icons: iconData,
                entities: this.rawEntities.size ? entityInfo : undefined,
                tiles: this.tiles.length ? tileInfo : undefined,
                item: 'blueprint',
                version: this.version || 0,
                label: this.name
            }
        }
    }
}
