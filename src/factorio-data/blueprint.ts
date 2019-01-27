import getEntity from './entity'
import factorioData from './factorioData'
import { PositionGrid } from './positionGrid'
import Immutable from 'immutable'
import G from '../common/globals'
import { ConnectionsManager } from './connectionsManager'
import { EntityContainer } from '../containers/entity'
import generators from './generators'
import util from '../common/util'

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

            if (data.entities) {
                this.next_entity_number += data.entities.length

                this.rawEntities = this.rawEntities.withMutations(map => {
                    for (const entity of data.entities) {
                        map.set(entity.entity_number, Immutable.fromJS(entity))
                    }
                })

                // TODO: if entity has placeable-off-grid flag then take the next one
                const firstEntityTopLeft = this.firstEntity().topLeft()
                offset.x += (firstEntityTopLeft.x % 1 !== 0 ? 0.5 : 0)
                offset.y += (firstEntityTopLeft.y % 1 !== 0 ? 0.5 : 0)

                this.rawEntities = this.rawEntities.withMutations(map => {
                    map.keySeq().forEach(k => map
                        .updateIn([k, 'position', 'x'], x => x + offset.x)
                        .updateIn([k, 'position', 'y'], y => y + offset.y)
                    )
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

    generatePipes() {
        const DEBUG = G.oilOutpostSettings.DEBUG
        const PUMPJACK_MODULE = G.oilOutpostSettings.PUMPJACK_MODULE
        const MIN_GAP_BETWEEN_UNDERGROUNDS = G.oilOutpostSettings.MIN_GAP_BETWEEN_UNDERGROUNDS
        const BEACONS = G.oilOutpostSettings.BEACONS
        const MIN_AFFECTED_ENTITIES = G.oilOutpostSettings.MIN_AFFECTED_ENTITIES
        const BEACON_MODULE = G.oilOutpostSettings.BEACON_MODULE
        let lastGeneratedEntNrs = G.oilOutpostSettings.lastGeneratedEntNrs

        const pumpjacks = this.rawEntities
            .valueSeq()
            .filter(e => e.get('name') === 'pumpjack')
            .toJS()

        if (pumpjacks.length < 2 || pumpjacks.length > 200) {
            console.error('There should be between 2 and 200 pumpjacks in the BP Area!')
            return
        }

        if (pumpjacks.length !== this.rawEntities.filter((_, k) => !lastGeneratedEntNrs.includes(k)).count()) {
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

        this.operation(0, 'Generated Pipes!',
            entities => entities.withMutations(map => {
                GP.pumpjacksToRotate.forEach(p => {
                    map.setIn([p.entity_number, 'direction'], p.direction)
                    if (PUMPJACK_MODULE) {
                        map.deleteIn([p.entity_number, 'items'])
                        map.setIn([p.entity_number, 'items', PUMPJACK_MODULE], 2)
                    }
                })

                if (lastGeneratedEntNrs) {
                    lastGeneratedEntNrs.forEach(id => {
                        if (map.has(id)) {
                            map.delete(id)
                            this.entityPositionGrid.removeTileData(id)
                            EntityContainer.mappings.get(id).destroy()
                        }
                    })
                }
                lastGeneratedEntNrs = []

                GP.pipes.forEach(pipe => {
                    const entity_number = this.next_entity_number++
                    map.set(entity_number, Immutable.fromJS({ entity_number, ...pipe }))
                    lastGeneratedEntNrs.push(entity_number)
                })

                if (BEACONS) {
                    GB.beacons.forEach(beacon => {
                        const entity_number = this.next_entity_number++
                        map.set(entity_number, Immutable.fromJS({ entity_number, ...beacon, items: { [BEACON_MODULE]: 2 } }))
                        lastGeneratedEntNrs.push(entity_number)
                    })
                }

                GPO.poles.forEach(pole => {
                    const entity_number = this.next_entity_number++
                    map.set(entity_number, Immutable.fromJS({ entity_number, ...pole }))
                    lastGeneratedEntNrs.push(entity_number)
                })
            }),
            'upd',
            false
        )

        GP.pumpjacksToRotate.forEach(p => {
            const eC = EntityContainer.mappings.get(p.entity_number)
            eC.redraw()
            eC.redrawEntityInfo()
        })

        G.oilOutpostSettings.lastGeneratedEntNrs = lastGeneratedEntNrs

        lastGeneratedEntNrs.forEach(id => this.entityPositionGrid.setTileData(id))
        lastGeneratedEntNrs.forEach(id => G.BPC.entities.addChild(new EntityContainer(id, false)))
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
            this.icons[0] = factorioData.getTile(
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
