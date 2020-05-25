import FD from 'factorio-data'
import EventEmitter from 'eventemitter3'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import util from '../common/util'
import { Entity } from './Entity'
import { WireConnections } from './WireConnections'
import { PositionGrid } from './PositionGrid'
import * as generators from './generators'
import { IVisualization } from './generators'
import { History } from './History'
import { Tile } from './Tile'

interface IOilOutpostSettings extends Record<string, string | boolean | number> {
    DEBUG: boolean
    PUMPJACK_MODULE: string
    MIN_GAP_BETWEEN_UNDERGROUNDS: number
    BEACONS: boolean
    MIN_AFFECTED_ENTITIES: number
    BEACON_MODULE: string
}

const oilOutpostSettings: IOilOutpostSettings = {
    DEBUG: false,
    PUMPJACK_MODULE: 'productivity_module_3',
    MIN_GAP_BETWEEN_UNDERGROUNDS: 1,
    BEACONS: true,
    MIN_AFFECTED_ENTITIES: 1,
    BEACON_MODULE: 'speed_module_3'
}

// this is how it works in factorio but js doesn't support 64bit bitwise operations
//  uint64_t(developerVersion) |
// (uint64_t(minorVersion) << 16) |
// (uint64_t(majorVersion) << 32) |
// (uint64_t(mainVersion) << 48)
const getFactorioVersion = (main = 0, major = 17, minor = 14): number =>
    (minor << 16) + (major | (main << 16)) * 0xffffffff

class OurMap<K, V> extends Map<K, V> {
    public constructor(values?: V[], mapFn?: (value: V) => K) {
        if (values) {
            super(values.map(e => [mapFn(e), e] as [K, V]))
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
            if (predicate(v, k)) {
                return v
            }
        }
        return undefined
    }

    public filter(predicate: (value: V, key: K) => boolean): V[] {
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
export class Blueprint extends EventEmitter {
    public name = 'Blueprint'
    private readonly icons: string[] = []
    public readonly wireConnections = new WireConnections(this)
    public readonly entityPositionGrid = new PositionGrid(this)
    public readonly entities = new OurMap<number, Entity>()
    public readonly tiles = new OurMap<string, Tile>()
    public readonly history = new History()

    private m_nextEntityNumber = 1

    public constructor(data?: Partial<BPS.IBlueprint>) {
        super()

        if (data) {
            if (data.label) {
                this.name = data.label
            }

            if (data.icons) {
                data.icons.forEach(icon => {
                    this.icons[icon.index - 1] = icon.signal.name
                })
            }

            const positionData = [
                ...(data.entities || [])
                    .filter(e => !FD.entities[e.name].flags.includes('placeable_off_grid'))
                    .map(entity => {
                        const size = util.switchSizeBasedOnDirection(FD.entities[entity.name].size, entity.direction)
                        return { x: entity.position.x, y: entity.position.y, w: size.x, h: size.y }
                    }),
                ...(data.tiles || []).map(tile => ({
                    x: tile.position.x + 0.5,
                    y: tile.position.y + 0.5,
                    w: 1,
                    h: 1
                }))
            ]
            const minX = positionData.reduce((min, d) => Math.min(min, d.x - d.w / 2), Infinity)
            const minY = positionData.reduce((min, d) => Math.min(min, d.y - d.h / 2), Infinity)
            const maxX = positionData.reduce((max, d) => Math.max(max, d.x + d.w / 2), -Infinity)
            const maxY = positionData.reduce((max, d) => Math.max(max, d.y + d.h / 2), -Infinity)
            // The offset takes into account that the center of the blueprint might be shifted
            const offset = {
                x: -Math.floor((minX + maxX) / 2) + (minX % 1),
                y: -Math.floor((minY + maxY) / 2) + (minY % 1)
            }

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
                ENTITIES.filter(e => FD.entities[e.name].flags.includes('placeable_off_grid')).forEach(e => {
                    const size = util.rotatePointBasedOnDir(
                        [FD.entities[e.name].size.width / 2, FD.entities[e.name].size.height / 2],
                        e.direction || 0
                    )
                    // Take the offset into account for accurate positioning
                    e.position.x = Math.round(e.position.x + offset.x - size.x) + size.x - offset.x
                    e.position.y = Math.round(e.position.y + offset.y - size.y) + size.y - offset.y
                })

                this.history.startTransaction()

                ENTITIES.forEach(e => {
                    this.wireConnections.createEntityConnections(e.entity_number, e.connections)
                })

                this.entities = new OurMap(
                    ENTITIES.map(e => {
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

    public createEntity(rawData: IEntityData): Entity {
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
        entities.forEach(e => this.removeEntity(e))
        this.history.commitTransaction()
    }

    public fastReplaceEntity(entity: Entity, name: string, direction: number): void {
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

        positions.forEach(p => {
            const tile = new Tile(name, p.x, p.y)
            this.history
                .updateMap(this.tiles, tile.hash, tile, 'Create tile')
                .onDone(this.onCreateOrRemoveTile.bind(this))
                .commit()
        })

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

    public getFirstRailRelatedEntity(): Entity {
        return this.entities.find(
            e => e.name === 'straight_rail' /* || e.name === 'curved_rail' */ || e.name === 'train_stop'
        )
    }

    public isEmpty(): boolean {
        return this.entities.isEmpty() && this.tiles.isEmpty()
    }

    private getCenter(): IPoint {
        if (this.isEmpty()) {
            return { x: 0, y: 0 }
        }

        const data = [
            ...this.entities.valuesArray().map(e => ({ x: e.position.x, y: e.position.y, w: e.size.x, h: e.size.y })),
            ...this.tiles.valuesArray().map(t => ({ x: t.x, y: t.y, w: 1, h: 1 }))
        ]

        const minX = data.reduce((min, d) => Math.min(min, d.x - d.w / 2), Infinity)
        const minY = data.reduce((min, d) => Math.min(min, d.y - d.h / 2), Infinity)
        const maxX = data.reduce((max, d) => Math.max(max, d.x + d.w / 2), -Infinity)
        const maxY = data.reduce((max, d) => Math.max(max, d.y + d.h / 2), -Infinity)

        return {
            x: Math.floor((minX + maxX) / 2) + 0.5,
            y: Math.floor((minY + maxY) / 2) + 0.5
        }
    }

    public generatePipes(): string {
        const {
            DEBUG,
            PUMPJACK_MODULE,
            MIN_GAP_BETWEEN_UNDERGROUNDS,
            MIN_AFFECTED_ENTITIES,
            BEACON_MODULE,
            BEACONS
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
        console.log('Ratio (pipes replaced/underground pipes):', GP.info.nrOfPipesReplacedByUPipes / GP.info.nrOfUPipes)
        GPT.stop()

        // Generate beacons
        let beacons: {
            name: string
            position: IPoint
        }[] = []
        if (BEACONS && BEACON_MODULE !== 'none') {
            const GBT = util.timer('Beacon generation')

            const entitiesForBeaconGen = [
                ...pumpjacks.map(p => ({ ...p, size: 3, effect: true })),
                ...GP.pipes.map(p => ({ ...p, size: 1, effect: false }))
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
            ...beacons.map(p => ({ ...p, size: 3, power: true }))
        ]

        const GPO = generators.generatePoles(entitiesForPoleGen)
        visualizations.push(GPO.visualizations)

        console.log('Power Poles:', GPO.info.totalPoles)
        GPOT.stop()

        T.stop()

        // Apply Changes
        this.history.logging = false
        this.history.startTransaction('Generate Oil Outpost')

        GP.pipes.forEach(pipe => this.createEntity(pipe))
        beacons.forEach(beacon =>
            this.createEntity({
                ...beacon,
                items: { [BEACON_MODULE]: FD.entities.beacon.module_specification.module_slots }
            })
        )
        GPO.poles.forEach(pole => this.createEntity(pole))

        GP.pumpjacksToRotate.forEach(p => {
            const entity = this.entities.get(p.entity_number)
            entity.direction = p.direction
            if (PUMPJACK_MODULE !== 'none') {
                entity.modules = new Array(entity.moduleSlots).fill(PUMPJACK_MODULE)
            }
        })

        this.history.commitTransaction()
        this.history.logging = true

        // Create visualizations
        if (!DEBUG) {
            return
        }

        // TODO: make a container special for debugging purposes
        G.BPC.wiresContainer.removeChildren()

        const timePerVis = 1000
        visualizations
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
    private generateIcons(): void {
        /** returns [iconName, count][] */
        const getIconPairs = (
            tilesOrEntities: (Tile | Entity)[],
            getItemName: (name: string) => string
        ): [string, number][] => [
            ...tilesOrEntities.reduce((map, tileOrEntity) => {
                const itemName = getItemName(tileOrEntity.name)
                return map.set(itemName, map.has(itemName) ? map.get(itemName) + 1 : 0)
            }, new Map<string, number>())
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

    /** Transforms sparse entity numbers into consecutive ones */
    private processRawEntities(entities: BPS.IEntity[]): BPS.IEntity[] {
        const oldToNewID = new Map(new Array(entities.length).fill(0).map((_, i) => [entities[i].entity_number, i + 1]))

        return entities.map(e => {
            e.entity_number = oldToNewID.get(e.entity_number)

            if (e.connections) {
                for (const side in e.connections) {
                    if (util.objectHasOwnProperty(e.connections, side)) {
                        const SIDE = e.connections[side] as BPS.IConnSide | BPS.IWireColor[]
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
            return e
        })
    }

    public serialize(): BPS.IBlueprint {
        if (!this.icons.length) {
            this.generateIcons()
        }
        const entityInfo = this.processRawEntities(this.entities.valuesArray().map(e => e.serialize()))
        const center = this.getCenter()
        const fR = this.getFirstRailRelatedEntity()
        if (fR) {
            center.x += (fR.position.x - center.x) % 2
            center.y += (fR.position.y - center.y) % 2
        }
        for (const e of entityInfo) {
            e.position.x -= center.x
            e.position.y -= center.y
        }
        const tileInfo = this.tiles.valuesArray().map(tile => ({
            position: {
                x: Math.floor(tile.x) - Math.floor(center.x),
                y: Math.floor(tile.y) - Math.floor(center.y)
            },
            name: tile.name
        }))
        const iconData = this.icons.map((icon, i) => {
            const getItemTypeForBp = (name: string): 'virtual' | 'fluid' | 'item' => {
                switch (FD.items[name].type) {
                    case 'virtual_signal':
                        return 'virtual'
                    case 'fluid':
                        return 'fluid'
                    default:
                        return 'item'
                }
            }

            return {
                signal: { type: getItemTypeForBp(icon), name: icon } as BPS.ISignal,
                index: (i + 1) as 1 | 2 | 3 | 4
            }
        })
        return {
            icons: iconData,
            entities: this.entities.isEmpty() ? undefined : entityInfo,
            tiles: this.tiles.isEmpty() ? undefined : tileInfo,
            item: 'blueprint',
            version: getFactorioVersion(),
            label: this.name
        }
    }
}

export { oilOutpostSettings, getFactorioVersion, IOilOutpostSettings }
