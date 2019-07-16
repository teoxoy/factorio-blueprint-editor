import FD from 'factorio-data'
import EventEmitter from 'eventemitter3'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import util from '../common/util'
import Entity from './entity'
import { WireConnections } from './wireConnections'
import { PositionGrid } from './positionGrid'
import generators from './generators'
import History from './history'
import Tile from './tile'

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

    valuesArray() {
        return [...this.values()]
    }

    find(predicate: (value: V, key: K) => boolean): V {
        for (const [k, v] of this) {
            if (predicate(v, k)) {
                return v
            }
        }
        return undefined
    }

    filter(predicate: (value: V, key: K) => boolean): V[] {
        const result: V[] = []
        this.forEach((v, k) => {
            if (predicate(v, k)) {
                result.push(v)
            }
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
    icons: string[]
    wireConnections: WireConnections
    entityPositionGrid: PositionGrid
    entities: OurMap<number, Entity>
    tiles: OurMap<string, Tile>
    history: History

    private m_nextEntityNumber = 1

    constructor(data?: BPS.IBlueprint) {
        super()

        this.name = 'Blueprint'
        this.icons = []
        this.entities = new OurMap()
        this.tiles = new OurMap()
        this.wireConnections = new WireConnections(this)
        this.entityPositionGrid = new PositionGrid(this)
        this.history = new History()

        if (data) {
            this.name = data.label
            if (data.icons) {
                data.icons.forEach(icon => {
                    this.icons[icon.index - 1] = icon.signal.name
                })
            }

            const offset = {
                x: G.sizeBPContainer.width / 64,
                y: G.sizeBPContainer.height / 64
            }

            if (data.tiles) {
                this.tiles = new OurMap(
                    data.tiles.map(
                        tile =>
                            new Tile(tile.name, {
                                x: tile.position.x + offset.x + 0.5,
                                y: tile.position.y + offset.y + 0.5
                            })
                    ),
                    t => t.hash
                )
            }

            if (data.entities !== undefined) {
                this.m_nextEntityNumber += data.entities.length

                const firstEntity = data.entities.find(e => !FD.entities[e.name].flags.includes('placeable_off_grid'))
                const firstEntitySize = util.rotatePointBasedOnDir(
                    [FD.entities[firstEntity.name].size.width / 2, FD.entities[firstEntity.name].size.height / 2],
                    firstEntity.direction
                )

                offset.x += (firstEntity.position.x - firstEntitySize.x) % 1
                offset.y += (firstEntity.position.y - firstEntitySize.y) % 1

                this.history.startTransaction()

                data.entities.forEach(e => {
                    this.wireConnections.createEntityConnections(e.entity_number, e.connections)
                })

                this.entities = new OurMap(
                    data.entities.map(e => {
                        // remove connections from obj - connections are handled by wireConnections
                        delete e.connections
                        return this.createEntity({
                            ...e,
                            position: {
                                x: e.position.x + offset.x,
                                y: e.position.y + offset.y
                            }
                        })
                    }),
                    e => e.entityNumber
                )

                this.history.commitTransaction()
            }
        }

        // makes initial entities non undoable and resets the history if the user cleared the editor
        this.history.reset()
        this.history.logging = G.debug

        return this
    }

    createEntity(rawData: IEntityData) {
        const rawEntity = new Entity(
            {
                ...rawData,
                entity_number: rawData.entity_number ? rawData.entity_number : this.nextEntityNumber
            },
            this
        )

        this.history
            .updateMap(this.entities, rawEntity.entityNumber, rawEntity, 'Create entity')
            .onDone(this.onCreateOrRemoveEntity.bind(this))
            .commit()

        return rawEntity
    }

    removeEntity(entity: Entity) {
        this.history.startTransaction('Remove entity')

        this.wireConnections.removeEntityConnections(entity.entityNumber)

        this.history
            .updateMap(this.entities, entity.entityNumber, undefined, 'Remove entity')
            .onDone(this.onCreateOrRemoveEntity.bind(this))
            .commit()

        this.history.commitTransaction()
    }

    fastReplaceEntity(entity: Entity, name: string, direction: number) {
        this.history.startTransaction('Fast replace entity')

        this.removeEntity(entity)

        // TODO: keep wire connections
        this.createEntity({
            name,
            direction,
            position: entity.position
        }).pasteSettings(entity)

        this.history.commitTransaction()
    }

    onCreateOrRemoveEntity(newValue: Entity, oldValue: Entity) {
        if (newValue) {
            this.entityPositionGrid.setTileData(newValue)
            this.emit('create-entity', newValue)
        } else if (oldValue) {
            this.entityPositionGrid.removeTileData(oldValue)
            oldValue.destroy()
            this.emit('remove-entity')
        }
    }

    createTiles(name: string, positions: IPoint[]) {
        this.history.startTransaction('Create tiles')

        positions.forEach(p => {
            const tile = new Tile(name, p)
            this.history
                .updateMap(this.tiles, tile.hash, tile, 'Create tile')
                .onDone(this.onCreateOrRemoveTile.bind(this))
                .commit()
        })

        this.history.commitTransaction()
    }

    removeTiles(positions: IPoint[]) {
        this.history.startTransaction('Remove tiles')

        positions
            .map(p => this.tiles.get(`${p.x},${p.y}`))
            .filter(tile => !!tile)
            .forEach(tile => {
                this.history
                    .updateMap(this.tiles, tile.hash, undefined, 'Remove tile')
                    .onDone(this.onCreateOrRemoveTile.bind(this))
                    .commit()
            })

        this.history.commitTransaction()
    }

    onCreateOrRemoveTile(newValue: Tile, oldValue: Tile) {
        if (oldValue) {
            oldValue.destroy()
        }

        if (newValue) {
            this.emit('create-tile', newValue)
        }
    }

    get nextEntityNumber() {
        const nr = this.m_nextEntityNumber
        this.m_nextEntityNumber += 1
        return nr
    }

    getFirstRail() {
        return this.entities.find(e => e.name === 'straight_rail' /* || e.name === 'curved_rail' */)
    }

    isEmpty() {
        return this.entities.isEmpty() && this.tiles.isEmpty()
    }

    // Get corner/center positions
    getPosition(
        f: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight',
        xcomp: (i: number, j: number) => number,
        ycomp: (i: number, j: number) => number
    ): IPoint {
        if (this.isEmpty()) {
            return { x: 0, y: 0 }
        }

        const positions = [
            ...[...this.entities.keys()].map(k => this.entities.get(k)[f]()),
            ...[...this.tiles.keys()]
                .map(k => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }))
                .map(p => tileCorners(p)[f])
        ]

        return {
            x: positions.map(p => p.x).reduce((p, v) => xcomp(p, v), positions[0].x),
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
    topLeft() {
        return this.getPosition('topLeft', Math.min, Math.min)
    }
    topRight() {
        return this.getPosition('topRight', Math.max, Math.min)
    }
    bottomLeft() {
        return this.getPosition('bottomLeft', Math.min, Math.max)
    }
    bottomRight() {
        return this.getPosition('bottomRight', Math.max, Math.max)
    }

    generatePipes() {
        const DEBUG = G.oilOutpostSettings.DEBUG
        const PUMPJACK_MODULE = G.oilOutpostSettings.PUMPJACK_MODULE
        const MIN_GAP_BETWEEN_UNDERGROUNDS = G.oilOutpostSettings.MIN_GAP_BETWEEN_UNDERGROUNDS
        const MIN_AFFECTED_ENTITIES = G.oilOutpostSettings.MIN_AFFECTED_ENTITIES
        const BEACON_MODULE = G.oilOutpostSettings.BEACON_MODULE
        const BEACONS = G.oilOutpostSettings.BEACONS && BEACON_MODULE !== 'none'

        const pumpjacks = this.entities
            .filter(v => v.name === 'pumpjack')
            .map(p => ({ entity_number: p.entityNumber, name: p.name, position: p.position }))

        if (pumpjacks.length < 2 || pumpjacks.length > 200) {
            return 'There should be between 2 and 200 pumpjacks in the blueprint area!'
        }

        if (pumpjacks.length !== this.entities.size) {
            return 'Blueprint area should only contain pumpjacks!'
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

        this.history.logging = false
        this.history.startTransaction('Generate Oil Outpost')

        GP.pipes.forEach(pipe => this.createEntity(pipe))
        if (BEACONS) {
            GB.beacons.forEach(beacon => this.createEntity({ ...beacon, items: { [BEACON_MODULE]: 2 } }))
        }
        GPO.poles.forEach(pole => this.createEntity(pole))

        GP.pumpjacksToRotate.forEach(p => {
            const entity = this.entities.get(p.entity_number)
            entity.direction = p.direction
            if (PUMPJACK_MODULE !== 'none') {
                entity.modules = [PUMPJACK_MODULE, PUMPJACK_MODULE]
            }
        })

        this.history.commitTransaction()
        this.history.logging = true

        if (!DEBUG) {
            return
        }

        // TODO: make a container special for debugging purposes
        G.BPC.wiresContainer.removeChildren()

        const timePerVis = 1000
        ;[GP.visualizations, BEACONS ? GB.visualizations : [], GPO.visualizations]
            .filter(vis => vis.length)
            .forEach((vis, i) => {
                vis.forEach((v, j, arr) => {
                    setTimeout(() => {
                        const tint = v.color ? v.color : 0xffffff * Math.random()
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
                            }, k * (timePerVis / arr.length / v.path.length))
                        })
                    }, j * (timePerVis / arr.length) + i * timePerVis)
                })
            })
    }

    /** behaves like in Factorio 0.17.14 */
    generateIcons() {
        /** returns [iconName, count][] */
        function getIconPairs(tilesOrEntities: (Tile | Entity)[], getItemName: (name: string) => string) {
            return [
                ...tilesOrEntities.reduce((map, tileOrEntity) => {
                    const itemName = getItemName(tileOrEntity.name)
                    return map.set(itemName, map.has(itemName) ? map.get(itemName) + 1 : 0)
                }, new Map<string, number>())
            ]
        }

        if (!this.entities.isEmpty()) {
            const getSize = (name: string) => FD.entities[name].size.width * FD.entities[name].size.height
            const getItemScore = (item: [string, number]) => getSize(item[0]) * item[1]

            const iconPairs = getIconPairs(this.entities.valuesArray(), Entity.getItemName).sort(
                (a, b) => getItemScore(b) - getItemScore(a)
            )

            this.icons[0] = iconPairs[0][0]
            if (
                iconPairs[1] &&
                getSize(iconPairs[1][0]) > 1 &&
                getItemScore(iconPairs[1]) * 2.5 > getItemScore(iconPairs[0])
            ) {
                this.icons[1] = iconPairs[1][0]
            }
        } else if (!this.tiles.isEmpty()) {
            const iconPairs = getIconPairs(this.tiles.valuesArray(), Tile.getItemName).sort((a, b) => b[1] - a[1])

            this.icons[0] = iconPairs[0][0]
        }
    }

    getEntitiesForExport(): BPS.IEntity[] {
        const entityInfo = this.entities.valuesArray().map(e => e.getRawData())
        let entitiesJSON = JSON.stringify(entityInfo)

        // Tag changed ids with !
        let ID = 1
        entityInfo.forEach(e => {
            entitiesJSON = entitiesJSON.replace(
                new RegExp(`"(entity_number|entity_id)":${e.entity_number}([,}])`, 'g'),
                (_, c, c2) => `"${c}":!${ID}${c2}`
            )
            ID += 1
        })

        // Remove tag and sort
        return JSON.parse(
            entitiesJSON.replace(/"(entity_number|entity_id)":![0-9]+?[,}]/g, s => s.replace('!', ''))
        ).sort((a: BPS.IEntity, b: BPS.IEntity) => a.entity_number - b.entity_number)
    }

    toObject() {
        if (!this.icons.length) {
            this.generateIcons()
        }
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
        const tileInfo = [...this.tiles].map(([k, v]) => ({
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
                    case 'virtual_signal':
                        return 'virtual'
                    case 'fluid':
                        return 'fluid'
                    default:
                        return 'item'
                }
            }
        })
        return {
            blueprint: {
                icons: iconData,
                entities: this.entities.isEmpty() ? undefined : entityInfo,
                tiles: this.tiles.isEmpty() ? undefined : tileInfo,
                item: 'blueprint',
                version: G.getFactorioVersion(),
                label: this.name
            }
        }
    }
}
