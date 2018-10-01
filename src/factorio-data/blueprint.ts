import getEntity from './entity'
import factorioData from './factorioData'
import { PositionGrid } from './positionGrid'
import Immutable from 'immutable'
import G from '../globals'
import { ConnectionsManager } from './connectionsManager'
import { EntityContainer } from '../containers/entity'

export class Blueprint {

    name: string
    icons: any[]
    tiles: Immutable.Map<string, string>
    version: number
    connections: ConnectionsManager
    next_entity_number: number
    historyIndex: number
    history: IHistoryObject[]
    bp: Blueprint
    entityPositionGrid: PositionGrid
    rawEntities: Immutable.Map<number, any>

    constructor(data?: any) {
        this.name = 'Blueprint'
        this.icons = []
        this.rawEntities = Immutable.Map()
        this.tiles = Immutable.Map()
        this.version = undefined
        this.next_entity_number = 1

        if (data) {
            this.name = data.label
            this.version = data.version
            if (data.icons) data.icons.forEach((icon: any) => this.icons[icon.index - 1] = icon.signal.name)

            this.next_entity_number += data.entities.length
            this.rawEntities = this.rawEntities.withMutations(map => {
                for (const entity of data.entities) {
                    map.set(entity.entity_number, Immutable.fromJS(entity))
                }
            })

            // TODO: if entity has placeable-off-grid flag then take the next one
            const firstEntityTopLeft = this.firstEntity().topLeft()

            const offsetX = G.sizeBPContainer.width / 64 - (firstEntityTopLeft.x % 1 !== 0 ? -0.5 : 0)
            const offsetY = G.sizeBPContainer.height / 64 - (firstEntityTopLeft.y % 1 !== 0 ? -0.5 : 0)

            this.rawEntities = this.rawEntities.withMutations(map => {
                map.keySeq().forEach(k => map
                    .updateIn([k, 'position', 'x'], x => x + offsetX)
                    .updateIn([k, 'position', 'y'], y => y + offsetY)
                )
            })

            if (data.tiles) {
                this.tiles = this.tiles.withMutations(map =>
                    data.tiles.forEach((tile: any) =>
                        map.set(`${tile.position.x + offsetX + 0.5},${tile.position.y + offsetY + 0.5}`, tile.name)
                    )
                )
            }
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
        return getEntity(e, this)
    }

    firstEntity() {
        return getEntity(this.rawEntities.first(), this)
    }

    undo(
        pre: (hist: IHistoryObject) => void,
        post: (hist: IHistoryObject) => void
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
                if (this.entity(hist.entity_number).hasConnections) this.connections.undo()
        }
        post(hist)
    }

    redo(
        pre: (hist: IHistoryObject) => void,
        post: (hist: IHistoryObject) => void
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

        const entity = this.entity(hist.entity_number)
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
        entity_number: number,
        annotation: string,
        fn: (entities: Immutable.Map<number, any>) => Immutable.Map<any, any>,
        type: 'add' | 'del' | 'mov' | 'upd' = 'upd',
        pushToHistory = true,
        other_entity?: number
    ) {
        console.log(`${entity_number} - ${annotation}`)
        this.rawEntities = fn(this.rawEntities)

        if (pushToHistory) {
            if (this.historyIndex < this.history.length) {
                this.history = this.history.slice(0, this.historyIndex + 1)
            }
            this.history.push({
                entity_number,
                other_entity,
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
            direction,
            type: directionType
        }
        if (!directionType) delete data.type
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

    createTile(name: string, position: IPoint) {
        this.tiles = this.tiles.set(`${position.x},${position.y}`, name)
    }

    removeTile(position: IPoint) {
        this.tiles = this.tiles.remove(`${position.x},${position.y}`)
    }

    isEmpty() {
        return this.rawEntities.isEmpty() && this.tiles.isEmpty()
    }

    // Get corner/center positions
    getPosition(f: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', xcomp: any, ycomp: any) {
        if (this.isEmpty()) return { x: 0, y: 0 }

        const positions =
            [...this.rawEntities.keys()]
                .map(k => this.entity(k)[f]()).concat(
            [...this.tiles.keys()]
                .map(k => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }))
                .map(p => tileCorners(p)[f]))

        return {
            // tslint:disable-next-line:no-unnecessary-callback-wrapper
            x: positions.map(p => p.x).reduce((p, v) => xcomp(p, v), positions[0].x),
            // tslint:disable-next-line:no-unnecessary-callback-wrapper
            y: positions.map(p => p.y).reduce((p, v) => ycomp(p, v), positions[0].y)
        }

        function tileCorners(position: IPoint) {
            return {
                topLeft: { x: position.x - 0.5, y: position.y - 0.5 },
                topRight: { x: position.x + 0.5, y: position.y - 0.5 },
                bottomLeft: { x: position.x - 0.5, y: position.y + 0.5 },
                bottomRight: { x: position.x + 0.5, y: position.y + 0.5 }
            }
        }
    }

    center() {
        return {
            x: Math.floor((this.topLeft().x + this.topRight().x) / 2) + 0.5,
            y: Math.floor((this.topLeft().y + this.bottomLeft().y) / 2) + 0.5
        }
    }
    topLeft() { return this.getPosition('topLeft', Math.min, Math.min) }
    topRight() { return this.getPosition('topRight', Math.max, Math.min) }
    bottomLeft() { return this.getPosition('bottomLeft', Math.min, Math.max) }
    bottomRight() { return this.getPosition('bottomRight', Math.max, Math.max) }

    generateIcons() {
        // TODO: make this behave more like in Factorio
        if (!this.rawEntities.isEmpty()) {
            const entities: Map<string, number> = new Map()

            for (const i of [...this.rawEntities.keys()]) {
                const name = this.entity(i).name

                const value = entities.get(name)
                entities.set(name, value ? (value + 1) : 0)
            }

            const sortedEntities = [...entities.entries()].sort((a, b) => a[1] - b[1])

            this.icons[0] = sortedEntities[0][0]
            if (sortedEntities.length > 1) this.icons[1] = sortedEntities[1][0]
        } else {
            this.icons[0] = factorioData.getTile(
                [...Immutable.Seq(this.tiles)
                    .reduce((acc, tile) =>
                        acc.set(tile, acc.has(tile) ? (acc.get(tile) + 1) : 0)
                    , new Map() as Map<string, number>).entries()]
                .sort((a, b) => b[1] - a[1])[0][0]
            ).minable.result
        }
    }

    getEntitiesForExport() {
        const entityInfo = this.rawEntities.valueSeq().toJS()
        let entitiesJSON = JSON.stringify(entityInfo)

        // Tag changed ids with !
        let ID = 0
        entityInfo.forEach(e => {
            entitiesJSON = entitiesJSON.replace(new RegExp(`"(entity_number|entity_id)":${e.entity_number},`, 'g'), (_, c) => `"${c}":!${ID},`)
            ID++
        })

        // Remove tag and sort
        return JSON.parse(
            entitiesJSON.replace(/"(entity_number|entity_id)":\![0-9]+?,/g, s => s.replace('!', ''))
        )
        .sort((a: any, b: any) => a.entity_number - b.entity_number)
    }

    toObject() {
        if (!this.icons.length) this.generateIcons()
        const entityInfo = this.getEntitiesForExport()
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
        const tileInfo = this.tiles.map((v, k) => ({
            position: { x: Number(k.split(',')[0]) - center.x - 0.5, y: Number(k.split(',')[1]) - center.y - 0.5 },
            name: v
        })).valueSeq().toArray()
        const iconData = this.icons.map((icon, i) => (
            { signal: { type: factorioData.getItemTypeForBp(icon), name: icon }, index: i + 1 }
        ))
        return {
            blueprint: {
                icons: iconData,
                entities: this.rawEntities.isEmpty() ? undefined : entityInfo,
                tiles: this.tiles.isEmpty() ? undefined : tileInfo,
                item: 'blueprint',
                version: this.version || 0,
                label: this.name
            }
        }
    }
}
