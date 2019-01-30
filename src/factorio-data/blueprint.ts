import Entity from './entity'
import FD from 'factorio-data'
import { PositionGrid } from './positionGrid'
import Immutable from 'immutable'
import G from '../common/globals'
import { ConnectionsManager } from './connectionsManager'
import { EntityContainer } from '../containers/entity'
import generators from './generators'
import util from '../common/util'
import * as History from './history'

class EntityCollection extends Map<number, Entity> {

    find(predicate: (value: Entity, key: number) => boolean): Entity {
        this.forEach((v, k) => {
            if (predicate(v, k)) return v
        })
        return undefined
    }

    filter(predicate: (value: Entity, key: number) => boolean): Entity[] {
        const result: Entity[] = []
        this.forEach((v, k) => {
            if (predicate(v, k)) result.push(v)
        })
        return result
    }
}

/** Blueprint base class */
export default class Blueprint {

    name: string
    icons: any[]
    tiles: Immutable.Map<string, string>
    version: number
    connections: ConnectionsManager
    next_entity_number: number
    historyIndex: number
    history: IHistoryObject[]
    entityPositionGrid: PositionGrid
    rawEntities: EntityCollection

    constructor(data?: BPS.IBlueprint) {

        this.name = 'Blueprint'
        this.icons = []
        this.rawEntities = new EntityCollection()
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
                this.next_entity_number = this.rawEntities.size + 1
                this.rawEntities = new EntityCollection(data.entities
                    .map(ent => [ent.entity_number, new Entity(ent, this)] as [number, Entity]))

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
                const ec = new EntityContainer(this.entity(hist.entity_number))
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

        const entity: Entity = new Entity(entity_data as BPS.IEntity, this)
        History.updateMap(this.rawEntities, entity_number, entity, `Added entity: ${entity.type}`).type('add')

        this.entityPositionGrid.setTileData(entity_number)

        return entity_data.entity_number
    }

    removeEntity(entity_number: number, redrawCb?: (entity_number: number) => void) {
        this.entityPositionGrid.removeTileData(entity_number)

        const entity: Entity = this.entity(entity_number)
        const entitiesToModify = entity.hasConnections ? this.connections.removeConnectionData(entity_number) : []

        History.startTransaction(`Deleted entity: ${entity.type}`)
        History.updateMap(this.rawEntities, entity_number, undefined, undefined, true).type('del')
        for (const entityToModify of entitiesToModify) {
            const connections = this.entity(entityToModify.entity_number).connections
            const a = connections.size === 1
            const b = connections[entityToModify.side].size === 1
            const c = connections[entityToModify.side][entityToModify.color].size === 1
            if (a && b && c) {
                History.updateValue(this.entity(entity_number),
                    ['connections'], undefined, undefined, true)
            } else if (b && c) {
                History.updateValue(this.entity(entity_number),
                    ['connections', entityToModify.side], undefined, undefined, true)
            } else if (c) {
                History.updateValue(this.entity(entity_number),
                    ['connections', entityToModify.side, entityToModify.color], undefined, undefined, true)
            } else {
                History.updateValue(this.entity(entity_number),
                    ['connections', entityToModify.side, entityToModify.color, entityToModify.index.toString()], undefined, undefined, true)
            }
        }
        History.commitTransaction()

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

    generatePipes() {
        const DEBUG = G.oilOutpostSettings.DEBUG
        const PUMPJACK_MODULE = G.oilOutpostSettings.PUMPJACK_MODULE
        const MIN_GAP_BETWEEN_UNDERGROUNDS = G.oilOutpostSettings.MIN_GAP_BETWEEN_UNDERGROUNDS
        const BEACONS = G.oilOutpostSettings.BEACONS
        const MIN_AFFECTED_ENTITIES = G.oilOutpostSettings.MIN_AFFECTED_ENTITIES
        const BEACON_MODULE = G.oilOutpostSettings.BEACON_MODULE
        let lastGeneratedEntNrs = G.oilOutpostSettings.lastGeneratedEntNrs

        const pumpjacks = this.rawEntities.filter(v => v.name === 'pumpjack')
            .map(p => ({ entity_number: p.entity_number, name: p.name, position: p.position }))

        if (pumpjacks.length < 2 || pumpjacks.length > 200) {
            console.error('There should be between 2 and 200 pumpjacks in the BP Area!')
            return
        }

        if (pumpjacks.length !== this.rawEntities.filter((_, k) => !lastGeneratedEntNrs.includes(k)).length) {
            console.error('BP Area should only contain pumpjacks!')
            return
        }

        console.log('Generating pipes...')

        const T = util.timer('Total generation')

        const GPT = util.timer('Pipe generation')

        // I wrapped generatePipes into a Web Worker but for some reason it sometimes takes x2 time to run the function
        // Usualy when there are more than 100 pumpjacks the function will block the main thread
        // which is not great but the user should wait for the generated entities anyway
        const GP = generators.generatePipes(pumpjacks, MIN_GAP_BETWEEN_UNDERGROUNDS)

        console.log('Pipes:', GP.info.nrOfPipes)
        console.log('Underground Pipes:', GP.info.nrOfUPipes)
        console.log('Pipes replaced by underground pipes:', GP.info.nrOfPipesReplacedByUPipes)
        console.log('Ratio (pipes replaced/underground pipes):', GP.info.nrOfPipesReplacedByUPipes / GP.info.nrOfUPipes)
        GPT.stop()

        const GBT = util.timer('Beacon generation')

        const entitiesForBeaconGen = [
            ...pumpjacks.map(p => ({ ...p, size: 3, effect: true })),
            ...GP.pipes.map(p => ({ ...p, size: 1, effect: false }))
        ]

        const GB = BEACONS ? generators.generateBeacons(entitiesForBeaconGen, MIN_AFFECTED_ENTITIES) : undefined

        if (BEACONS) {
            console.log('Beacons:', GB.info.totalBeacons)
            console.log('Effects given by beacons:', GB.info.effectsGiven)
        }
        GBT.stop()

        const GPOT = util.timer('Pole generation')

        const entitiesForPoleGen = [
            ...pumpjacks.map(p => ({ ...p, size: 3, power: true })),
            ...GP.pipes.map(p => ({ ...p, size: 1, power: false })),
            ...(BEACONS ? GB.beacons.map(p => ({ ...p, size: 3, power: true })) : [])
        ]

        const GPO = generators.generatePoles(entitiesForPoleGen)

        console.log('Power Poles:', GPO.info.totalPoles)
        GPOT.stop()

        T.stop()

        // TODO: Find out why undo doesn't work on this
        // TEST BP: http://localhost:8080/?source=https://pastebin.com/3ca6a50V
        History.startTransaction('Generated Oil Outpost!')

        GP.pumpjacksToRotate.forEach(p => {
            History.updateValue(this.entity(p.entity_number), ['direction'], p.direction)
            if (PUMPJACK_MODULE) {
                History.updateValue(this.entity(p.entity_number), ['items'], {})
                History.updateValue(this.entity(p.entity_number), ['items', PUMPJACK_MODULE], 2)
            }
        })

        if (lastGeneratedEntNrs) {
            lastGeneratedEntNrs.forEach(entNr => {
                if (this.rawEntities.has(entNr)) {
                    History.updateMap(this.rawEntities, entNr, undefined, undefined, true).type('del')
                    this.entityPositionGrid.removeTileData(entNr)
                    EntityContainer.mappings.get(entNr).destroy()
                }
            })
        }
        lastGeneratedEntNrs = []

        GP.pipes.forEach(pipe => {
            const entity_number = this.next_entity_number++
            History.updateMap(this.rawEntities, entity_number, new Entity({ entity_number, ...pipe }, this)).type('add')
            lastGeneratedEntNrs.push(entity_number)
        })

        if (BEACONS) {
            GB.beacons.forEach(beacon => {
                const entity_number = this.next_entity_number++
                History.updateMap(this.rawEntities, entity_number,
                    new Entity({ entity_number, ...beacon, items: { [BEACON_MODULE]: 2 } }, this)).type('add')
                lastGeneratedEntNrs.push(entity_number)
            })
        }

        GPO.poles.forEach(pole => {
            const entity_number = this.next_entity_number++
            History.updateMap(this.rawEntities, entity_number, new Entity({ entity_number, ...pole }, this)).type('add')
            lastGeneratedEntNrs.push(entity_number)
        })

        History.commitTransaction()

        GP.pumpjacksToRotate.forEach(p => {
            const eC = EntityContainer.mappings.get(p.entity_number)
            eC.redraw()
            eC.redrawEntityInfo()
        })

        G.oilOutpostSettings.lastGeneratedEntNrs = lastGeneratedEntNrs

        lastGeneratedEntNrs.forEach(id => this.entityPositionGrid.setTileData(id))
        lastGeneratedEntNrs.forEach(id => G.BPC.entities.addChild(new EntityContainer(this.entity(id), false)))
        G.BPC.sortEntities()
        G.BPC.wiresContainer.updatePassiveWires()

        if (!DEBUG) return

        // TODO: make a container special for debugging purposes
        G.BPC.wiresContainer.children = []

        const timePerVis = 1000
            ;
        [
            GP.visualizations,
            BEACONS ? GB.visualizations : [],
            GPO.visualizations
        ]
            .filter(vis => vis.length)
            .forEach((vis, i) => {
                vis.forEach((v, j, arr) => {
                    setTimeout(() => {
                        const tint = v.color ? v.color : 0xFFFFFF * Math.random()
                        v.path.forEach((p, k) => {
                            setTimeout(() => {
                                const s = new PIXI.Sprite(PIXI.Texture.WHITE)
                                s.tint = tint
                                s.anchor.set(0.5)
                                s.alpha = v.alpha
                                s.width = v.size
                                s.height = v.size
                                s.position.set(p.x * 32, p.y * 32)
                                G.BPC.wiresContainer.addChild(s)
                            }, k * ((timePerVis / arr.length) / v.path.length))
                        })
                    }, j * (timePerVis / arr.length) + i * timePerVis)
                })
            })

    }

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
                        acc.set(tile, acc.has(tile) ? (acc.get(tile) + 1) : 0),
                        new Map() as Map<string, number>)
                    .entries()
                ]
                    .sort((a, b) => b[1] - a[1])[0][0]
            ).minable.result
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
