import EventEmitter from 'eventemitter3'
import { Sprite, Texture } from 'pixi.js'
import { IBlueprint, IEntity, IPoint, ISchedule, SignalType } from '../types'
import G from '../common/globals'
import util from '../common/util'
import FD from './factorioData'
import { Entity } from './Entity'
import { WireConnections } from './WireConnections'
import { PositionGrid } from './PositionGrid'
import * as generators from './generators'
import { IVisualization } from './generators'
import { History } from './History'
import { Tile } from './Tile'

export interface IOilOutpostSettings extends Record<string, string | boolean | number> {
    DEBUG: boolean
    PUMPJACK_MODULE: string
    MIN_GAP_BETWEEN_UNDERGROUNDS: number
    BEACONS: boolean
    MIN_AFFECTED_ENTITIES: number
    BEACON_MODULE: string
}

const oilOutpostSettings: IOilOutpostSettings = {
    DEBUG: false,
    PUMPJACK_MODULE: 'productivity-module-3',
    MIN_GAP_BETWEEN_UNDERGROUNDS: 1,
    BEACONS: true,
    MIN_AFFECTED_ENTITIES: 1,
    BEACON_MODULE: 'speed-module-3',
}

// this is how it works in factorio but js doesn't support 64bit bitwise operations
//  uint64_t(developerVersion) |
// (uint64_t(minorVersion) << 16) |
// (uint64_t(majorVersion) << 32) |
// (uint64_t(mainVersion) << 48)
const getFactorioVersion = (main = 1, major = 1, minor = 41): number =>
    (minor << 16) + (major | (main << 16)) * 0xffffffff

class OurMap<K, V> extends Map<K, V> {
    public constructor(values?: V[], mapFn?: (value: V) => K) {
        if (values) {
            super(values.map(e => [mapFn(e), e]))
        } else {
            super()
        }
    }

    public isEmpty(): boolean {
        return this.size === 0
    }

    public valuesArray(): V[] {
        return [...this.values()]
    }

    public find(predicate: (value: V, key: K) => boolean): V {
        for (const [k, v] of this) {
            if (predicate(v, k)) return v
        }
        return undefined
    }

    public filter(predicate: (value: V, key: K) => boolean): V[] {
        const result: V[] = []
        for (const [k, v] of this) {
            if (predicate(v, k)) {
                result.push(v)
            }
        }
        return result
    }
}

interface IEntityData extends Omit<IEntity, 'entity_number'> {
    entity_number?: number
}

export interface BlueprintEvents {
    'create-entity': [entity: Entity]
    'remove-entity': []
    'create-tile': [tile: Tile]
}

/** Blueprint base class */
class Blueprint extends EventEmitter<BlueprintEvents> {
    public name = 'Blueprint'
    private readonly icons = new Map<1 | 2 | 3 | 4, string>()
    public readonly wireConnections = new WireConnections(this)
    public readonly entityPositionGrid = new PositionGrid(this)
    public readonly entities = new OurMap<number, Entity>()
    public readonly tiles = new OurMap<string, Tile>()
    public readonly history = new History()

    // unused blueprint properties
    private readonly description?: string
    private readonly schedules?: ISchedule[]
    private readonly absolute_snapping?: boolean
    private readonly snap_to_grid?: IPoint
    private readonly position_relative_to_grid?: IPoint

    private m_nextEntityNumber = 1

    public constructor(data?: Partial<IBlueprint>) {
        super()

        if (data) {
            if (data.label) {
                this.name = data.label
            }

            if (data.icons) {
                for (const icon of data.icons) {
                    this.icons.set(icon.index, icon.signal.name)
                }
            }

            const offset = getOffset(data)

            if (data.tiles) {
                this.tiles = new OurMap(
                    data.tiles.map(
                        tile =>
                            new Tile(
                                tile.name,
                                Math.floor(tile.position.x + offset.x) + 0.5,
                                Math.floor(tile.position.y + offset.y) + 0.5
                            )
                    ),
                    t => t.hash
                )
            }

            if (data.entities !== undefined) {
                const ENTITIES = this.processRawEntities(data.entities)

                this.m_nextEntityNumber += ENTITIES.length

                // Approximate position of placeable_off_grid entities (i.e. landmines)
                for (const e of ENTITIES) {
                    if (!FD.entities[e.name].flags.includes('placeable-off-grid')) continue

                    const size = util.rotatePointBasedOnDir(
                        [FD.entities[e.name].size.width / 2, FD.entities[e.name].size.height / 2],
                        e.direction || 0
                    )
                    // Take the offset into account for accurate positioning
                    e.position.x = Math.round(e.position.x + offset.x - size.x) + size.x - offset.x
                    e.position.y = Math.round(e.position.y + offset.y - size.y) + size.y - offset.y
                }

                this.history.startTransaction()

                for (const e of ENTITIES) {
                    this.wireConnections.createEntityConnections(
                        e.entity_number,
                        e.connections,
                        e.neighbours
                    )
                }

                this.entities = new OurMap(
                    ENTITIES.map(e => {
                        // remove connections from obj - connections are handled by wireConnections
                        delete e.connections
                        delete e.neighbours
                        return this.createEntity({
                            ...e,
                            position: util.sumprod(e.position, offset),
                        })
                    }),
                    e => e.entityNumber
                )

                if (data.version < getFactorioVersion(1, 1, 11)) {
                    this.wireConnections.generatePowerPoleWires()
                }

                this.history.commitTransaction()
            }

            this.description = data.description
            this.schedules = data.schedules
            this.absolute_snapping = data['absolute-snapping']
            this.snap_to_grid = data['snap-to-grid']
            this.position_relative_to_grid = data['position-relative-to-grid']
        }

        // makes initial entities non undoable and resets the history if the user cleared the editor
        this.history.reset()
        this.history.logging = G.debug

        return this
    }

    public createEntity(rawData: IEntityData, connectPowerPole = false): Entity {
        const rawEntity = new Entity(
            {
                ...rawData,
                entity_number: rawData.entity_number
                    ? rawData.entity_number
                    : this.nextEntityNumber,
            },
            this
        )

        this.history
            .updateMap(this.entities, rawEntity.entityNumber, rawEntity, 'Create entity')
            .onDone(this.onCreateOrRemoveEntity.bind(this))
            .commit()

        if (connectPowerPole) this.wireConnections.connectPowerPole(rawEntity.entityNumber)

        return rawEntity
    }

    public removeEntity(entity: Entity): void {
        this.history.startTransaction('Remove entity')

        this.wireConnections.removeEntityConnections(entity.entityNumber)

        this.history
            .updateMap(this.entities, entity.entityNumber, undefined, 'Remove entity')
            .onDone(this.onCreateOrRemoveEntity.bind(this))
            .commit()

        this.history.commitTransaction()
    }

    public removeEntities(entities: Entity[]): void {
        this.history.startTransaction('Remove entities')
        for (const e of entities) {
            this.removeEntity(e)
        }
        this.history.commitTransaction()
    }

    public fastReplaceEntity(name: string, direction: number, position: IPoint): boolean {
        const entity = this.entityPositionGrid.checkFastReplaceableGroup(name, direction, position)

        if (!entity) return false

        this.history.startTransaction('Fast replace entity')

        const connections = this.wireConnections.getEntityConnections(entity.entityNumber)

        this.removeEntity(entity)

        this.createEntity({
            name,
            direction,
            position: entity.position,
            entity_number: entity.entityNumber,
        }).pasteSettings(entity)

        for (const conn of connections) {
            this.wireConnections.create(conn)
        }

        this.history.commitTransaction()

        return true
    }

    private onCreateOrRemoveEntity(newValue: Entity, oldValue: Entity): void {
        if (newValue) {
            this.entityPositionGrid.setTileData(newValue)
            this.emit('create-entity', newValue)
        } else if (oldValue) {
            this.entityPositionGrid.removeTileData(oldValue)
            oldValue.destroy()
            this.emit('remove-entity')
        }
    }

    public createTiles(name: string, positions: IPoint[]): void {
        this.history.startTransaction('Create tiles')

        for (const p of positions) {
            const tile = new Tile(name, p.x, p.y)
            this.history
                .updateMap(this.tiles, tile.hash, tile, 'Create tile')
                .onDone(this.onCreateOrRemoveTile.bind(this))
                .commit()
        }

        this.history.commitTransaction()
    }

    public removeTiles(positions: IPoint[]): void {
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

    private onCreateOrRemoveTile(newValue: Tile, oldValue: Tile): void {
        if (oldValue) {
            oldValue.destroy()
        }

        if (newValue) {
            this.emit('create-tile', newValue)
        }
    }

    private get nextEntityNumber(): number {
        const nr = this.m_nextEntityNumber
        this.m_nextEntityNumber += 1
        return nr
    }

    public getFirstRailRelatedEntityPos(): IPoint | undefined {
        for (const [, e] of this.entities) {
            if (e.name === 'legacy-straight-rail') return e.position
            if (e.name === 'train-stop') return e.position
            if (e.name === 'legacy-curved-rail') return { x: e.position.x - 1, y: e.position.y - 1 }
        }
        return undefined
    }

    public isEmpty(): boolean {
        return this.entities.isEmpty() && this.tiles.isEmpty()
    }

    private getCenter(): IPoint {
        if (this.isEmpty()) return { x: 0, y: 0 }

        const data = [
            ...this.entities
                .valuesArray()
                .map(e => ({ x: e.position.x, y: e.position.y, w: e.size.x, h: e.size.y })),
            ...this.tiles.valuesArray().map(t => ({ x: t.x, y: t.y, w: 1, h: 1 })),
        ]

        const minX = data.reduce((min, d) => Math.min(min, d.x - d.w / 2), Infinity)
        const minY = data.reduce((min, d) => Math.min(min, d.y - d.h / 2), Infinity)
        const maxX = data.reduce((max, d) => Math.max(max, d.x + d.w / 2), -Infinity)
        const maxY = data.reduce((max, d) => Math.max(max, d.y + d.h / 2), -Infinity)

        return {
            x: Math.round((minX + maxX) / 2),
            y: Math.round((minY + maxY) / 2),
        }
    }

    public generatePipes(): string {
        const {
            DEBUG,
            PUMPJACK_MODULE,
            MIN_GAP_BETWEEN_UNDERGROUNDS,
            MIN_AFFECTED_ENTITIES,
            BEACON_MODULE,
            BEACONS,
        } = oilOutpostSettings

        const pumpjacks = this.entities
            .filter(v => v.name === 'pumpjack')
            .map(p => ({ entity_number: p.entityNumber, name: p.name, position: p.position }))

        if (pumpjacks.length < 2 || pumpjacks.length > 200) {
            return 'There should be between 2 and 200 pumpjacks in the blueprint area!'
        }

        if (pumpjacks.length !== this.entities.size) {
            return 'Blueprint area should only contain pumpjacks!'
        }

        const visualizations: IVisualization[][] = []

        console.log('Generating pipes...')

        const T = util.timer('Total generation')

        // Generate pipes
        const GPT = util.timer('Pipe generation')

        // I wrapped generatePipes into a Web Worker but for some reason it sometimes takes x2 time to run the function
        // Usualy when there are more than 100 pumpjacks the function will block the main thread
        // which is not great but the user should wait for the generated entities anyway
        const GP = generators.generatePipes(pumpjacks, MIN_GAP_BETWEEN_UNDERGROUNDS)
        visualizations.push(GP.visualizations)

        console.log('Pipes:', GP.info.nrOfPipes)
        console.log('Underground Pipes:', GP.info.nrOfUPipes)
        console.log('Pipes replaced by underground pipes:', GP.info.nrOfPipesReplacedByUPipes)
        console.log(
            'Ratio (pipes replaced/underground pipes):',
            GP.info.nrOfPipesReplacedByUPipes / GP.info.nrOfUPipes
        )
        GPT.stop()

        // Generate beacons
        let beacons: {
            name: string
            position: IPoint
        }[] = []
        if (BEACONS) {
            const GBT = util.timer('Beacon generation')

            const entitiesForBeaconGen = [
                ...pumpjacks.map(p => ({ ...p, size: 3, effect: true })),
                ...GP.pipes.map(p => ({ ...p, size: 1, effect: false })),
            ]

            const GB = generators.generateBeacons(entitiesForBeaconGen, MIN_AFFECTED_ENTITIES)
            beacons = GB.beacons
            visualizations.push(GB.visualizations)

            if (BEACONS) {
                console.log('Beacons:', GB.info.totalBeacons)
                console.log('Effects given by beacons:', GB.info.effectsGiven)
            }

            GBT.stop()
        }

        // Generate poles
        const GPOT = util.timer('Pole generation')

        const entitiesForPoleGen = [
            ...pumpjacks.map(p => ({ ...p, size: 3, power: true })),
            ...GP.pipes.map(p => ({ ...p, size: 1, power: false })),
            ...beacons.map(p => ({ ...p, size: 3, power: true })),
        ]

        const GPO = generators.generatePoles(entitiesForPoleGen)
        visualizations.push(GPO.visualizations)

        console.log('Power Poles:', GPO.info.totalPoles)
        GPOT.stop()

        T.stop()

        // Apply Changes
        this.history.logging = false
        this.history.startTransaction('Generate Oil Outpost')

        for (const pipe of GP.pipes) {
            this.createEntity(pipe)
        }
        for (const beacon of beacons) {
            this.createEntity({
                ...beacon,
                items: { [BEACON_MODULE]: FD.entities.beacon.module_specification.module_slots },
            })
        }
        for (const pole of GPO.poles) {
            this.createEntity(pole)
        }

        this.wireConnections.generatePowerPoleWires()

        for (const p of GP.pumpjacksToRotate) {
            const entity = this.entities.get(p.entity_number)
            entity.direction = p.direction
            if (PUMPJACK_MODULE !== 'none') {
                entity.modules = new Array(entity.moduleSlots).fill(PUMPJACK_MODULE)
            }
        }

        this.history.commitTransaction()
        this.history.logging = true

        // Create visualizations
        if (!DEBUG) return

        // TODO: make a container special for debugging purposes
        G.BPC.wiresContainer.removeChildren()

        const timePerVis = 1000
        visualizations
            .filter(vis => vis.length)
            .forEach((vis, i) => {
                vis.forEach((v, j, arr) => {
                    setTimeout(
                        () => {
                            const tint = v.color ? v.color : 0xffffff * Math.random()
                            v.path.forEach((p, k) => {
                                setTimeout(
                                    () => {
                                        const s = new Sprite(Texture.WHITE)
                                        s.tint = tint
                                        s.anchor.set(0.5)
                                        s.alpha = v.alpha
                                        s.width = v.size
                                        s.height = v.size
                                        s.position.set(p.x * 32, p.y * 32)
                                        G.BPC.wiresContainer.addChild(s)
                                    },
                                    k * (timePerVis / arr.length / v.path.length)
                                )
                            })
                        },
                        j * (timePerVis / arr.length) + i * timePerVis
                    )
                })
            })
    }

    /** behaves like in Factorio 0.17.14 */
    private generateIcons(): void {
        /** returns [iconName, count][] */
        const getIconPairs = (
            tilesOrEntities: (Tile | Entity)[],
            getItemName: (name: string) => string
        ): [string, number][] => [
            ...tilesOrEntities.reduce<Map<string, number>>((map, tileOrEntity) => {
                const itemName = getItemName(tileOrEntity.name)
                return map.set(itemName, map.has(itemName) ? map.get(itemName) + 1 : 0)
            }, new Map()),
        ]

        if (!this.entities.isEmpty()) {
            const getSize = (name: string): number => {
                const entity = FD.entities[FD.items[name].place_result]
                return entity.size.width * entity.size.height
            }
            const getItemScore = (item: [string, number]): number => getSize(item[0]) * item[1]

            const iconPairs = getIconPairs(this.entities.valuesArray(), Entity.getItemName).sort(
                (a, b) => getItemScore(b) - getItemScore(a)
            )

            this.icons.set(1, iconPairs[0][0])
            if (
                iconPairs[1] &&
                getSize(iconPairs[1][0]) > 1 &&
                getItemScore(iconPairs[1]) * 2.5 > getItemScore(iconPairs[0])
            ) {
                this.icons.set(2, iconPairs[1][0])
            }
        } else if (!this.tiles.isEmpty()) {
            const iconPairs = getIconPairs(this.tiles.valuesArray(), Tile.getItemName).sort(
                (a, b) => b[1] - a[1]
            )

            this.icons.set(1, iconPairs[0][0])
        }
    }

    /** Transforms sparse entity numbers into consecutive ones */
    private processRawEntities(entities: IEntity[]): IEntity[] {
        const oldToNewID = new Map(
            new Array(entities.length).fill(0).map((_, i) => [entities[i].entity_number, i + 1])
        )

        return entities.map(e => {
            e.entity_number = oldToNewID.get(e.entity_number)

            if (e.connections) {
                for (const side in e.connections) {
                    if (util.objectHasOwnProperty(e.connections, side)) {
                        const SIDE = e.connections[side]
                        if (Array.isArray(SIDE)) {
                            for (const c of SIDE) {
                                c.entity_id = oldToNewID.get(c.entity_id)
                            }
                        } else {
                            for (const color in SIDE) {
                                if (util.objectHasOwnProperty(SIDE, color)) {
                                    for (const c of SIDE[color]) {
                                        c.entity_id = oldToNewID.get(c.entity_id)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (e.neighbours) {
                for (let i = 0; i < e.neighbours.length; i++) {
                    e.neighbours[i] = oldToNewID.get(e.neighbours[i])
                }
            }

            return e
        })
    }

    public serialize(): IBlueprint {
        if (!this.icons.size) {
            this.generateIcons()
        }
        const entityInfo = this.processRawEntities(
            this.entities.valuesArray().map(e => e.serialize())
        )
        const center = this.getCenter()
        const firstRailPos = this.getFirstRailRelatedEntityPos()

        if (firstRailPos) {
            if ((firstRailPos.x - center.x) % 2 === 0) {
                center.x += 1
            }
            if ((firstRailPos.y - center.y) % 2 === 0) {
                center.y += 1
            }
        }

        for (const e of entityInfo) {
            e.position.x -= center.x
            e.position.y -= center.y
        }
        const tileInfo = this.tiles.valuesArray().map(tile => ({
            position: {
                x: Math.floor(tile.x) - Math.floor(center.x),
                y: Math.floor(tile.y) - Math.floor(center.y),
            },
            name: tile.name,
        }))
        const iconData = [...this.icons.entries()].map(([index, icon]) => {
            const getItemTypeForBp = (name: string): SignalType => {
                if (FD.signals[name]) return 'virtual'
                if (FD.fluids[name]) return 'fluid'
                return 'item'
            }

            return {
                signal: { type: getItemTypeForBp(icon), name: icon },
                index,
            }
        })
        return {
            icons: iconData,
            entities: this.entities.isEmpty() ? undefined : entityInfo,
            tiles: this.tiles.isEmpty() ? undefined : tileInfo,
            item: 'blueprint',
            version: getFactorioVersion(),
            label: this.name,
            description: this.description,
            schedules: this.schedules,
            'absolute-snapping': this.absolute_snapping,
            'snap-to-grid': this.snap_to_grid,
            'position-relative-to-grid': this.position_relative_to_grid,
        }
    }
}

function getOffset(data?: Partial<IBlueprint>): IPoint {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    const comp = (x: number, y: number, w: number, h: number): void => {
        minX = Math.min(minX, x - w / 2)
        minY = Math.min(minY, y - h / 2)
        maxX = Math.max(maxX, x + w / 2)
        maxY = Math.max(maxY, y + h / 2)
    }

    if (data.entities) {
        for (const entity of data.entities) {
            if (FD.entities[entity.name].flags.includes('placeable-off-grid')) continue

            const size = util.switchSizeBasedOnDirection(
                FD.entities[entity.name].size,
                entity.direction
            )
            comp(entity.position.x, entity.position.y, size.x, size.y)
        }
    } else if (data.tiles) {
        for (const tile of data.tiles) {
            comp(tile.position.x + 0.5, tile.position.y + 0.5, 1, 1)
        }
    }

    if (minX === Infinity) {
        return { x: 0, y: 0 }
    }

    // The offset takes into account that the center of the blueprint might be shifted
    return {
        x: -Math.floor((minX + maxX) / 2) + (minX % 1),
        y: -Math.floor((minY + maxY) / 2) + (minY % 1),
    }
}

export { Blueprint, oilOutpostSettings, getFactorioVersion }
