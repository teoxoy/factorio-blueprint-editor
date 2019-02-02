import Entity from './entity'
import FD from 'factorio-data'
import { PositionGrid } from './positionGrid'
import G from '../common/globals'
import { ConnectionsManager } from './connectionsManager'
import { EntityContainer } from '../containers/entity'
import generators from './generators'
import util from '../common/util'
import * as History from './history'
import { EventEmitter } from 'events'

class EntityCollection extends Map<number, Entity> {

    constructor(entities?: Entity[]) {
        if (entities) {
            super(entities.map(e => [e.entity_number, e] as [number, Entity]))
        } else {
            super()
        }
    }

    isEmpty() {
        return this.size === 0
    }

    find(predicate: (value: Entity, key: number) => boolean): Entity {
        for (const [ k, v ] of this) {
            if (predicate(v, k)) return v
        }
        return undefined
    }

    filter(predicate: (value: Entity, key: number) => boolean): Entity[] {
        const result: Entity[] = []
        this.forEach((v, k) => {
            if (predicate(v, k)) result.push(v)
        })
        return result
    }

    getRawEntities() {
        return Array.from(this.values()).map(e => e.getRawData())
    }
}

interface IEntityData extends Omit<BPS.IEntity, 'entity_number'> {
    entity_number?: number
}

/** Blueprint base class */
export default class Blueprint extends EventEmitter {

    name: string
    icons: any[]
    tiles: Map<string, string>
    version: number
    connectionsManager: ConnectionsManager
    entityPositionGrid: PositionGrid
    entities: EntityCollection

    private m_next_entity_number = 1

    constructor(data?: BPS.IBlueprint) {
        super()

        this.name = 'Blueprint'
        this.icons = []
        this.version = 68722819072
        this.entities = new EntityCollection()
        this.tiles = new Map()
        this.entityPositionGrid = new PositionGrid(this)

        if (data) {
            this.name = data.label
            this.version = data.version
            if (data.icons) data.icons.forEach(icon => this.icons[icon.index - 1] = icon.signal.name)

            const offset = {
                x: G.sizeBPContainer.width / 64,
                y: G.sizeBPContainer.height / 64
            }

            if (data.tiles) {
                this.tiles = new Map(data.tiles.map(tile =>
                    [`${tile.position.x + offset.x + 0.5},${tile.position.y + offset.y + 0.5}`, tile.name] as [string, string]))
            }

            if (data.entities !== undefined) {
                this.m_next_entity_number += data.entities.length

                const firstEntity = data.entities
                    .find(e => !FD.entities[e.name].flags.includes('placeable_off_grid'))
                const firstEntityTopLeft = {
                    x: firstEntity.position.x - (FD.entities[firstEntity.name].size.width / 2),
                    y: firstEntity.position.y - (FD.entities[firstEntity.name].size.height / 2)
                }

                offset.x += (firstEntityTopLeft.x % 1 !== 0 ? 0.5 : 0)
                offset.y += (firstEntityTopLeft.y % 1 !== 0 ? 0.5 : 0)

                History.startTransaction()

                this.entities = new EntityCollection(data.entities.map(e => this.createEntity({
                    ...e,
                    position: {
                        x: e.position.x + offset.x,
                        y: e.position.y + offset.y
                    }
                })))

                History.commitTransaction()
            }
        }

        this.connectionsManager = new ConnectionsManager(this, [...this.entities.keys()])

        return this
    }

    createEntity(rawData: IEntityData) {
        const rawEntity = new Entity({
            ...rawData,
            entity_number: rawData.entity_number ? rawData.entity_number : this.next_entity_number
        }, this)

        History
            .updateMap(this.entities, rawEntity.entity_number, rawEntity, `Added entity: ${rawEntity.name}`)
            .type('add')
            .emit(this.onCreateOrRemoveEntity.bind(this))
            .commit()

        return rawEntity
    }

    removeEntity(entity: Entity) {
        History.startTransaction(`Deleted entity: ${entity.name}`)

        entity.removeConnectionsToOtherEntities()

        History
            .updateMap(this.entities, entity.entity_number, undefined, undefined, true)
            .type('del')
            .emit(this.onCreateOrRemoveEntity.bind(this))

        History.commitTransaction()
    }

    onCreateOrRemoveEntity(newValue: Entity, oldValue: Entity) {
        if (newValue === undefined) {
            this.entityPositionGrid.removeTileData(oldValue)
            G.BPC.wiresContainer.remove(oldValue.entity_number)
            oldValue.destroy()
        } else {
            this.entityPositionGrid.setTileData(newValue)

            if (newValue.hasConnections) {
                newValue.connectedEntities
                    .map(entNr => EntityContainer.mappings.get(entNr))
                    .filter(ec => ec)
                    .forEach(ec => ec.redraw())
            }

            this.emit('create', newValue)
        }
    }

    get next_entity_number() {
        return this.m_next_entity_number++
    }

    // undo() {
    //     if (!History.canUndo()) return
    //     const hist = History.getUndoPreview()

    //     // switch (hist.type) {
    //     //     case 'add':
    //     //     case 'del':
    //     //     case 'mov':
    //     //         this.entityPositionGrid.undo()
    //     // }

    //     // this.pre(hist, 'add')

    //     History.undo()

    //     // switch (hist.type) {
    //     //     case 'del':
    //     //         if (this.entities.get(hist.entity_number).hasConnections) this.connections.undo()
    //     // }
    //     // this.post(hist, 'del')
    // }

    // redo() {
    //     if (!History.canRedo()) return
    //     const hist = History.getRedoPreview()

    //     // switch (hist.type) {
    //     //     case 'add':
    //     //     case 'del':
    //     //     case 'mov':
    //     //         this.entityPositionGrid.redo()
    //     // }

    //     // this.pre(hist, 'del')

    //     const entity = this.entities.get(hist.entity_number)
    //     // switch (hist.type) {
    //     //     case 'del':
    //     //         if (entity.hasConnections) this.connections.redo()
    //     // }

    //     History.redo()

    //     // TODO: Refactor this somehow
    //     // if (hist.type === 'del' && entity.hasConnections && entity.connectedEntities) {
    //     //     for (const entNr of entity.connectedEntities) {
    //     //         EntityContainer.mappings.get(entNr).redraw()
    //     //     }
    //     // }

    //     // this.post(hist, 'add')
    // }

    // redrawEntityAndSurroundingEntities(entnr: number) {
    //     const e = EntityContainer.mappings.get(entnr)
    //     e.redraw()
    //     e.redrawSurroundingEntities()
    // }

    // pre(hist: History.IHistoryData, addDel: string) {
    //     switch (hist.type) {
    //         case 'mov':
    //         case addDel:
    //             const e = EntityContainer.mappings.get(hist.entity_number)
    //             if (e === undefined) return
    //             e.redrawSurroundingEntities()
    //             if (hist.type === addDel) {
    //                 G.BPC.wiresContainer.remove(hist.entity_number)
    //                 e.destroy()
    //             }
    //             if (hist.type === 'mov') G.BPC.wiresContainer.update(hist.entity_number)
    //     }
    // }

    // post(hist: History.IHistoryData, addDel: string) {
    //     switch (hist.type) {
    //         case 'mov':
    //             this.redrawEntityAndSurroundingEntities(hist.entity_number)
    //             const entity = G.bp.entities.get(hist.entity_number)
    //             const e = EntityContainer.mappings.get(hist.entity_number)
    //             e.position.set(
    //                 entity.position.x * 32,
    //                 entity.position.y * 32
    //             )
    //             e.updateVisualStuff()
    //             break
    //         case 'upd':
    //             if (hist.other_entity) {
    //                 this.redrawEntityAndSurroundingEntities(hist.entity_number)
    //                 this.redrawEntityAndSurroundingEntities(hist.other_entity)
    //             } else {
    //                 const e = EntityContainer.mappings.get(hist.entity_number)
    //                 e.redrawEntityInfo()
    //                 this.redrawEntityAndSurroundingEntities(hist.entity_number)
    //                 G.BPC.wiresContainer.update(hist.entity_number)
    //             }
    //             break
    //         case addDel:
    //             const ec = new EntityContainer(this.entities.get(hist.entity_number))
    //             ec.redrawSurroundingEntities()
    //             G.BPC.wiresContainer.update(hist.entity_number)
    //     }

    //     // console.log(`${addDel === 'del' ? 'Undo' : 'Redo'} ${hist.entity_number} ${hist.annotation}`)
    //     G.BPC.updateOverlay()
    //     G.BPC.updateViewportCulling()
    // }

    getFirstRail() {
        return this.entities.find(e => e.name === 'straight_rail' /* || e.name === 'curved_rail' */)
    }

    createTile(name: string, position: IPoint) {
        this.tiles.set(`${position.x},${position.y}`, name)
    }

    removeTile(position: IPoint) {
        this.tiles.delete(`${position.x},${position.y}`)
    }

    isEmpty() {
        return this.entities.isEmpty() && this.tiles.size === 0
    }

    // Get corner/center positions
    getPosition(f: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', xcomp: any, ycomp: any) {
        if (this.isEmpty()) return { x: 0, y: 0 }

        const positions = [
            ...[...this.entities.keys()]
                .map(k => this.entities.get(k)[f]()),
            ...[...this.tiles.keys()]
                .map(k => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }))
                .map(p => tileCorners(p)[f])
        ]

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

        const pumpjacks = this.entities.filter(v => v.name === 'pumpjack')
            .map(p => ({ entity_number: p.entity_number, name: p.name, position: p.position }))

        if (pumpjacks.length < 2 || pumpjacks.length > 200) {
            console.error('There should be between 2 and 200 pumpjacks in the BP Area!')
            return
        }

        if (pumpjacks.length !== this.entities.size) {
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

        History.startTransaction('Generated Oil Outpost!')

        GP.pipes.forEach(pipe => this.createEntity(pipe))
        if (BEACONS) GB.beacons.forEach(beacon => this.createEntity({ ...beacon, items: { [BEACON_MODULE]: 2 } }))
        GPO.poles.forEach(pole => this.createEntity(pole))

        GP.pumpjacksToRotate.forEach(p => {
            const entity = this.entities.get(p.entity_number)
            entity.direction = p.direction
            if (PUMPJACK_MODULE) entity.modules = [PUMPJACK_MODULE, PUMPJACK_MODULE]
        })

        History.commitTransaction()

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
        if (!this.entities.isEmpty()) {
            const entities: Map<string, number> = new Map()

            for (const i of [...this.entities.keys()]) {
                const name = this.entities.get(i).name

                const value = entities.get(name)
                entities.set(name, value ? (value + 1) : 0)
            }

            const sortedEntities = [...entities.entries()].sort((a, b) => a[1] - b[1])

            this.icons[0] = sortedEntities[0][0]
            if (sortedEntities.length > 1) this.icons[1] = sortedEntities[1][0]
        } else {
            const tileName = Array.from(Array.from(this.tiles)
                .reduce((map, [_, tile]) => map.set(tile, map.has(tile) ? (map.get(tile) + 1) : 0), new Map()))
                .sort((a, b) => b[1] - a[1])[0][0]

            this.icons[0] = FD.tiles[tileName].minable.result
        }
    }

    getEntitiesForExport() {
        const entityInfo = this.entities.getRawEntities()
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
        const tileInfo = Array.from(this.tiles)
            .map(([k, v]) => ({
                position: {
                    x: Number(k.split(',')[0]) - Math.floor(center.x) - 0.5,
                    y: Number(k.split(',')[1]) - Math.floor(center.y) - 0.5
                },
                name: v
            }))
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
                entities: this.entities.isEmpty() ? undefined : entityInfo,
                tiles: this.tiles.size === 0 ? undefined : tileInfo,
                item: 'blueprint',
                version: this.version,
                label: this.name
            }
        }
    }
}
