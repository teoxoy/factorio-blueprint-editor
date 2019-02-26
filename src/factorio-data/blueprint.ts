import Entity from './entity'
import FD from 'factorio-data'
import { PositionGrid } from './positionGrid'
import G from '../common/globals'
import generators from './generators'
import util from '../common/util'
import * as History from './history'
import EventEmitter from 'eventemitter3'
import Tile from './tile'
import * as PIXI from 'pixi.js'

class OurMap<K, V> extends Map<K, V> {

    constructor(values?: V[], mapFn?: (value: V) => K) {
        if (values) {
            super(values.map(e => [mapFn(e), e] as [K, V]))
        } else {
            super()
        }
    }

    isEmpty() {
        return this.size === 0
    }

    find(predicate: (value: V, key: K) => boolean): V {
        for (const [ k, v ] of this) {
            if (predicate(v, k)) return v
        }
        return undefined
    }

    filter(predicate: (value: V, key: K) => boolean): V[] {
        const result: V[] = []
        this.forEach((v, k) => {
            if (predicate(v, k)) result.push(v)
        })
        return result
    }
}

interface IEntityData extends Omit<BPS.IEntity, 'entity_number'> {
    entity_number?: number
}

/** Blueprint base class */
export default class Blueprint extends EventEmitter {

    name: string
    icons: any[]
    version: number
    entityPositionGrid: PositionGrid
    entities: OurMap<number, Entity>
    tiles: OurMap<string, Tile>

    private m_next_entity_number = 1

    constructor(data?: BPS.IBlueprint) {
        super()

        this.name = 'Blueprint'
        this.icons = []
        this.version = 68722819072
        this.entities = new OurMap()
        this.tiles = new OurMap()
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
                this.tiles = new OurMap(
                    data.tiles.map(tile =>
                        new Tile(tile.name, { x: tile.position.x + offset.x + 0.5, y: tile.position.y + offset.y + 0.5 })),
                    t => t.hash
                )
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

                this.entities = new OurMap(
                    data.entities.map(e => this.createEntity({
                        ...e,
                        position: {
                            x: e.position.x + offset.x,
                            y: e.position.y + offset.y
                        }
                    })),
                    e => e.entity_number
                )

                History.commitTransaction()
            }
        }

        // makes initial entities non undoable and resets the history if the user cleared the editor
        History.reset()

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

        entity.removeAllConnections()

        History
            .updateMap(this.entities, entity.entity_number, undefined, undefined, true)
            .type('del')
            .emit(this.onCreateOrRemoveEntity.bind(this))

        History.commitTransaction()
    }

    onCreateOrRemoveEntity(newValue: Entity, oldValue: Entity) {
        if (newValue === undefined) {
            this.entityPositionGrid.removeTileData(oldValue)
            oldValue.destroy()
            this.emit('destroy')
        } else {
            this.entityPositionGrid.setTileData(newValue)
            this.emit('create', newValue)
        }
    }

    createTiles(name: string, positions: IPoint[]) {
        History.startTransaction(`Added tiles: ${name}`)

        positions.forEach(p => {
            const existingTile = this.tiles.get(`${p.x},${p.y}`)

            if (existingTile && existingTile.name !== name) {
                History
                    .updateMap(this.tiles, existingTile.hash, undefined, undefined, true)
                    .type('del')
                    .emit(this.onCreateOrRemoveTile.bind(this))
            }

            if (!existingTile || (existingTile && existingTile.name !== name)) {
                const tile = new Tile(name, p)

                // TODO: fix the error here, it's because tiles don't have an entity number
                // maybe change the History to accept a function or a variable that will be used as an identifier for logging
                History
                    .updateMap(this.tiles, tile.hash, tile)
                    .type('add')
                    .emit(this.onCreateOrRemoveTile.bind(this))
            }
        })

        History.commitTransaction()
    }

    removeTiles(positions: IPoint[]) {
        History.startTransaction(`Deleted tiles`)

        positions.forEach(p => {
            const tile = this.tiles.get(`${p.x},${p.y}`)
            if (tile) {
                History
                    .updateMap(this.tiles, tile.hash, undefined, undefined, true)
                    .type('del')
                    .emit(this.onCreateOrRemoveTile.bind(this))
            }
        })

        History.commitTransaction()
    }

    onCreateOrRemoveTile(newValue: Tile, oldValue: Tile) {
        if (newValue === undefined) {
            oldValue.destroy()
        } else {
            this.emit('create_t', newValue)
        }
    }

    get next_entity_number() {
        return this.m_next_entity_number++
    }

    getFirstRail() {
        return this.entities.find(e => e.name === 'straight_rail' /* || e.name === 'curved_rail' */)
    }

    isEmpty() {
        return this.entities.isEmpty() && this.tiles.isEmpty()
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
        const MIN_AFFECTED_ENTITIES = G.oilOutpostSettings.MIN_AFFECTED_ENTITIES
        const BEACON_MODULE = G.oilOutpostSettings.BEACON_MODULE
        const BEACONS = G.oilOutpostSettings.BEACONS && BEACON_MODULE !== 'none'

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
            if (PUMPJACK_MODULE !== 'none') entity.modules = [PUMPJACK_MODULE, PUMPJACK_MODULE]
        })

        History.commitTransaction()

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
            const iconNames = Array.from(Array.from(this.entities)
                .reduce((map, [_, entity]) => {
                    // minable result is the icon name
                    const itemName = FD.entities[entity.name].minable.result
                    return map.set(itemName, map.has(itemName) ? (map.get(itemName) + 1) : 0)
                }, new Map()))
                .sort((a, b) => b[1] - a[1])
                .map(kv => kv[0])

            this.icons[0] = iconNames[0]
            if (iconNames.length > 1) this.icons[1] = iconNames[1]
        } else {
            this.icons[0] = Array.from(Array.from(this.tiles)
                .reduce((map, [_, tile]) => {
                    // minable result is the icon name
                    const itemName = FD.tiles[tile.name].minable.result
                    return map.set(itemName, map.has(itemName) ? (map.get(itemName) + 1) : 0)
                }, new Map()))
                .sort((a, b) => b[1] - a[1])[0][0]
        }
    }

    getEntitiesForExport() {
        const entityInfo = Array.from(this.entities.values()).map(e => e.getRawData())
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
                name: v.name
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
                tiles: this.tiles.isEmpty() ? undefined : tileInfo,
                item: 'blueprint',
                version: this.version,
                label: this.name
            }
        }
    }
}
