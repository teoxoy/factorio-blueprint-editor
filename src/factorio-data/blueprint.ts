import Entity from './entity'
import FD from 'factorio-data'
import { PositionGrid } from './positionGrid'
import Immutable from 'immutable'
import G from '../common/globals'
import { ConnectionsManager } from './connectionsManager'
import { EntityContainer } from '../containers/entity'
import * as History from './history'

//TODO: Check if the following prototype is actually needed
Map.prototype.find = function(this: Map<K, V>, predicate: (value: V, key: K) => boolean): V {

    this.forEach((v, k) => {
        if (predicate(v, k)) return v
    })

    return undefined
}

export class Blueprint {

    name: string
    icons: any[]
    tiles: Immutable.Map<string, string>
    version: number
    connections: ConnectionsManager
    next_entity_number: number
    historyIndex: number
    history: IHistoryObject[]
    entityPositionGrid: PositionGrid
    rawEntities: Map<number, Entity>

    constructor(data?: any) {

        this.name = 'Blueprint'
        this.icons = []
        this.rawEntities = new Map()
        this.tiles = Immutable.Map()
        this.version = undefined
        this.next_entity_number = 1

        if (data) {
            this.name = data.label
            this.version = data.version
            if (data.icons) data.icons.forEach((icon: any) => this.icons[icon.index - 1] = icon.signal.name)

            const offset = {
                x: G.sizeBPContainer.width / 64,
                y: G.sizeBPContainer.height / 64
            }

            if (data.tiles) {
                this.tiles = this.tiles.withMutations(map =>
                    data.tiles.forEach((tile: any) =>
                        map.set(`${tile.position.x + offset.x + 0.5},${tile.position.y + offset.y + 0.5}`, tile.name)
                    )
                )
            }

            if (data.entities !== undefined) {
                this.next_entity_number = this.rawEntities.size
                this.rawEntities = new Map<number, Entity>(data.entities.map(v => [v.entity_number, new Entity(v, this)] as [number, Entity]))

                // TODO: if entity has placeable-off-grid flag then take the next one
                const firstEntityTopLeft = this.rawEntities.values().next().value.topLeft()
                offset.x += (firstEntityTopLeft.x % 1 !== 0 ? 0.5 : 0)
                offset.y += (firstEntityTopLeft.y % 1 !== 0 ? 0.5 : 0)

                this.rawEntities.forEach((v, k, m) => {
                    v.position.x += offset.x
                    v.position.y += offset.y
                })
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
        return this.rawEntities.has(entity_number) ? this.rawEntities.get(entity_number) : undefined
    }

    undo() {
        if (!History.canUndo()) return
        const hist = History.getUndoPreview()

        switch (hist.type) {
            case 'add':
            case 'del':
            case 'mov':
                this.entityPositionGrid.undo()
        }

        this.pre(hist, 'add')

        History.undo()

        switch (hist.type) {
            case 'del':
                if (this.entity(hist.entity_number).hasConnections) this.connections.undo()
        }
        this.post(hist, 'del')
    }

    redo() {
        if (!History.canRedo()) return
        const hist = History.getRedoPreview()

        switch (hist.type) {
            case 'add':
            case 'del':
            case 'mov':
                this.entityPositionGrid.redo()
        }

        this.pre(hist, 'del')

        const entity = this.entity(hist.entity_number)
        switch (hist.type) {
            case 'del':
                if (entity.hasConnections) this.connections.redo()
        }

        History.redo()

        // TODO: Refactor this somehow
        if (hist.type === 'del' && entity.hasConnections && entity.connectedEntities) {
            for (const entNr of entity.connectedEntities) {
                EntityContainer.mappings.get(entNr).redraw()
            }
        }

        this.post(hist, 'add')
    }

    redrawEntityAndSurroundingEntities(entnr: number) {
        const e = EntityContainer.mappings.get(entnr)
        e.redraw()
        e.redrawSurroundingEntities()
    }

    pre(hist: History.IHistoryData, addDel: string) {
        switch (hist.type) {
            case 'mov':
            case addDel:
                const e = EntityContainer.mappings.get(hist.entity_number)
                if (e === undefined) return
                e.redrawSurroundingEntities()
                if (hist.type === addDel) {
                    G.BPC.wiresContainer.remove(hist.entity_number)
                    e.destroy()
                }
                if (hist.type === 'mov') G.BPC.wiresContainer.update(hist.entity_number)
        }
    }

    post(hist: History.IHistoryData, addDel: string) {
        switch (hist.type) {
            case 'mov':
                this.redrawEntityAndSurroundingEntities(hist.entity_number)
                const entity = G.bp.entity(hist.entity_number)
                const e = EntityContainer.mappings.get(hist.entity_number)
                e.position.set(
                    entity.position.x * 32,
                    entity.position.y * 32
                )
                e.updateVisualStuff()
                break
            case 'upd':
                if (hist.other_entity) {
                    this.redrawEntityAndSurroundingEntities(hist.entity_number)
                    this.redrawEntityAndSurroundingEntities(hist.other_entity)
                } else {
                    const e = EntityContainer.mappings.get(hist.entity_number)
                    e.redrawEntityInfo()
                    this.redrawEntityAndSurroundingEntities(hist.entity_number)
                    G.BPC.wiresContainer.update(hist.entity_number)
                    // TODO: Improve this together with callback from entity (if entity changes or it is destroyed, also close the editor)
                    /*
                    if (G.editEntityContainer.visible) {
                        if (G.inventoryContainer.visible) G.inventoryContainer.close()
                        G.editEntityContainer.create(hist.entity_number)
                    }
                    */
                }
                break
            case addDel:
                const ec = new EntityContainer(hist.entity_number)
                G.BPC.entities.addChild(ec)
                ec.redrawSurroundingEntities()
                G.BPC.wiresContainer.update(hist.entity_number)
        }

        // console.log(`${addDel === 'del' ? 'Undo' : 'Redo'} ${hist.entity_number} ${hist.annotation}`)
        G.BPC.updateOverlay()
        G.BPC.updateViewportCulling()
    }

    operation(
        entity_number: number,
        annotation: string,
        fn: (entities: Immutable.Map<number, any>) => Immutable.Map<any, any>,
        type: 'add' | 'del' | 'mov' | 'upd' = 'upd',
        pushToHistory = true,
        other_entity?: number
    ) {
        // console.log(`${entity_number} - ${annotation}`)
        // this.rawEntities = fn(this.rawEntities)

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

        if (!this.entityPositionGrid.checkNoOverlap(name, direction, position)) {
            return false
        }

        const entity_number = this.next_entity_number++
        const entity_data = {
            entity_number,
            name,
            position,
            direction,
            type: directionType
        }

        if (directionType === undefined) delete entity_data.type

        const entity: Entity = new Entity(entity_data, this)
        History.updateMap(this.rawEntities, entity_number, entity, 'Added new entity', { entity_number, type: 'add' })

        this.entityPositionGrid.setTileData(entity_number)

        return entity_data.entity_number
    }

    removeEntity(entity_number: number, redrawCb?: (entity_number: number) => void) {
        this.entityPositionGrid.removeTileData(entity_number)

        const entitiesToModify = this.entity(entity_number).hasConnections ? this.connections.removeConnectionData(entity_number) : []

        const link: number = History.updateMap(this.rawEntities, entity_number, undefined, 'Deleted entity', { entity_number, type: 'del' }, true)

        for (const entityToModify of entitiesToModify) {
            const connections = this.entity(entityToModify.entity_number).connections
            const a = connections.size === 1
            const b = connections[entityToModify.side].size === 1
            const c = connections[entityToModify.side][entityToModify.color].size === 1
            if (a && b && c) {
                History.updateValue(this.entity(entity_number), [ 'connections' ],
                                    undefined, undefined, { entity_number: entityToModify.entity_number, type: 'upd' }, true, link)
            } else if (b && c) {
                History.updateValue(this.entity(entity_number), [ 'connections' , entityToModify.side ],
                                    undefined, undefined, { entity_number: entityToModify.entity_number, type: 'upd' }, true, link)
            } else if (c) {
                History.updateValue(this.entity(entity_number), [ 'connections' , entityToModify.side , entityToModify.color],
                                    undefined, undefined, { entity_number: entityToModify.entity_number, type: 'upd' }, true, link)
            } else {
                History.updateValue(this.entity(entity_number), [ 'connections' , entityToModify.side , entityToModify.color , entityToModify.index],
                                    undefined, undefined, { entity_number: entityToModify.entity_number, type: 'upd' }, true, link)
            }
        }
        for (const entityToModify of entitiesToModify) {
            redrawCb(entityToModify.entity_number)
        }
    }

    getFirstRail() {
        const fR = this.rawEntities.find(v => v.name === 'straight_rail' || v.name === 'curved_rail')
        return fR ? fR.toJS() : undefined
    }

    createTile(name: string, position: IPoint) {
        this.tiles = this.tiles.set(`${position.x},${position.y}`, name)
    }

    removeTile(position: IPoint) {
        this.tiles = this.tiles.remove(`${position.x},${position.y}`)
    }

    isEmpty() {
        return (this.rawEntities.size === undefined || this.rawEntities.size === 0) && this.tiles.isEmpty()
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
            this.icons[0] = FD.tiles[
                [...Immutable.Seq(this.tiles)
                    .reduce((acc, tile) =>
                        acc.set(tile, acc.has(tile) ? (acc.get(tile) + 1) : 0)
                        , new Map() as Map<string, number>).entries()]
                    .sort((a, b) => b[1] - a[1])[0][0]
            ].minable.result
        }
    }

    getEntitiesForExport() {
        const entityInfo = this.rawEntities.valueSeq().toJS()
        let entitiesJSON = JSON.stringify(entityInfo)

        // Tag changed ids with !
        let ID = 1
        entityInfo.forEach(e => {
            entitiesJSON = entitiesJSON.replace(
                new RegExp(`"(entity_number|entity_id)":${e.entity_number}([,}])`, 'g'),
                (_, c, c2) => `"${c}":!${ID}${c2}`
            )
            ID++
        })

        // Remove tag and sort
        return JSON.parse(entitiesJSON.replace(
            /"(entity_number|entity_id)":\![0-9]+?[,}]/g,
            s => s.replace('!', '')
        ))
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
            position: {
                x: Number(k.split(',')[0]) - Math.floor(center.x) - 0.5,
                y: Number(k.split(',')[1]) - Math.floor(center.y) - 0.5
            },
            name: v
        })).valueSeq().toArray()
        const iconData = this.icons.map((icon, i) => {
            return { signal: { type: getItemTypeForBp(icon), name: icon }, index: i + 1 }

            function getItemTypeForBp(name: string) {
                switch (FD.items[name].type) {
                    case 'virtual_signal': return 'virtual'
                    case 'fluid': return 'fluid'
                    default: return 'item'
                }
            }
        })
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
