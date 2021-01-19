import { EventEmitter } from 'eventemitter3'
import FD from './factorioData'
import U from './generators/util'
import { Blueprint } from './Blueprint'
import { WireConnectionMap } from './WireConnectionMap'

const MAX_POLE_CONNECTION_COUNT = 5

export interface IConnection {
    color: string
    entityNumber1: number
    entityNumber2: number
    entitySide1: number
    entitySide2: number
}

export class WireConnections extends EventEmitter {
    private bp: Blueprint
    private readonly connections = new WireConnectionMap()

    public constructor(bp: Blueprint) {
        super()
        this.bp = bp
    }

    private static hash(conn: IConnection): string {
        const firstE = Math.min(conn.entityNumber1, conn.entityNumber2)
        const secondE = Math.max(conn.entityNumber1, conn.entityNumber2)
        const firstS = firstE === conn.entityNumber1 ? conn.entitySide1 : conn.entitySide2
        const secondS = secondE === conn.entityNumber2 ? conn.entitySide2 : conn.entitySide1
        return `${conn.color}-${firstE}-${secondE}-${firstS}-${secondS}`
    }

    public static deserialize(
        entityNumber: number,
        connections: BPS.IConnection,
        neighbours: number[]
    ): IConnection[] {
        const parsedConnections: IConnection[] = []

        const addConnSide = (side: string): void => {
            if (connections[side]) {
                // eslint-disable-next-line guard-for-in
                for (const color in connections[side]) {
                    const conn = connections[side] as BPS.IConnSide
                    for (const data of conn[color]) {
                        parsedConnections.push({
                            color,
                            entityNumber1: entityNumber,
                            entityNumber2: data.entity_id,
                            entitySide1: Number(side),
                            entitySide2: data.circuit_id || 1,
                        })
                    }
                }
            }
        }

        const addCopperConnSide = (side: string, color: string): void => {
            if (connections[side]) {
                // For some reason Cu0 and Cu1 are arrays but the switch can only have 1 copper connection
                const data = (connections[side] as BPS.IWireColor[])[0]
                parsedConnections.push({
                    color,
                    entityNumber1: entityNumber,
                    entityNumber2: data.entity_id,
                    entitySide1: Number(side.slice(2, 3)) + 1,
                    entitySide2: 1,
                })
            }
        }

        if (connections) {
            addConnSide('1')
            addConnSide('2')
            // power_switch only connections
            addCopperConnSide('Cu0', 'copper')
            addCopperConnSide('Cu1', 'copper')
        }

        if (neighbours) {
            for (const entNr of neighbours) {
                parsedConnections.push(WireConnections.toPoleConnection(entityNumber, entNr))
            }
        }

        return parsedConnections
    }

    public static serialize(
        entityNumber: number,
        connections: IConnection[],
        getType: (entityNumber: number) => string,
        entNrWhitelist?: Set<number>
    ): { connections: BPS.IConnection; neighbours: number[] } {
        const serialized: BPS.IConnection = {}
        const neighbours: number[] = []

        for (const connection of connections) {
            const isEntity1 = connection.entityNumber1 === entityNumber
            const side = isEntity1 ? connection.entitySide1 : connection.entitySide2
            const color = connection.color
            const otherEntNr = isEntity1 ? connection.entityNumber2 : connection.entityNumber1
            const otherEntSide = isEntity1 ? connection.entitySide2 : connection.entitySide1

            if (entNrWhitelist && !entNrWhitelist.has(otherEntNr)) continue

            if (color === 'copper' && getType(otherEntNr) === 'electric_pole') {
                if (getType(entityNumber) === 'electric_pole') {
                    neighbours.push(otherEntNr)
                } else if (getType(entityNumber) === 'power_switch') {
                    const SIDE = `Cu${side - 1}`
                    if (serialized[SIDE] === undefined) {
                        serialized[SIDE] = []
                    }
                    const c = serialized[SIDE] as BPS.IWireColor[]
                    c.push({
                        entity_id: otherEntNr,
                        wire_id: 0,
                    })
                }
            } else if (color === 'red' || color === 'green') {
                if (serialized[side] === undefined) {
                    serialized[side] = {}
                }
                const SIDE = serialized[side] as BPS.IConnSide
                if (SIDE[color] === undefined) {
                    SIDE[color] = []
                }
                SIDE[color].push({
                    entity_id: otherEntNr,
                    circuit_id: otherEntSide,
                })
            }
        }

        return {
            connections: Object.keys(serialized).length === 0 ? undefined : serialized,
            neighbours: neighbours.length === 0 ? undefined : neighbours,
        }
    }

    private static toPoleConnection(entityNumber1: number, entityNumber2: number): IConnection {
        return {
            color: 'copper',
            entityNumber1,
            entityNumber2,
            entitySide1: 1,
            entitySide2: 1,
        }
    }

    public create(connection: IConnection): void {
        const hash = WireConnections.hash(connection)
        if (this.connections.has(hash)) return

        this.bp.history
            .updateMap(this.connections, hash, connection, 'Connect entities')
            .onDone(this.onCreateOrRemoveConnection.bind(this))
            .commit()
    }

    private remove(connection: IConnection): void {
        const hash = WireConnections.hash(connection)
        if (!this.connections.has(hash)) return

        this.bp.history
            .updateMap(this.connections, hash, undefined, 'Disconnect entities')
            .onDone(this.onCreateOrRemoveConnection.bind(this))
            .commit()
    }

    private onCreateOrRemoveConnection(newValue: IConnection, oldValue: IConnection): void {
        if (newValue) {
            this.emit('create', WireConnections.hash(newValue), newValue)
        } else if (oldValue) {
            this.emit('remove', WireConnections.hash(oldValue), oldValue)
        }
    }

    public get(hash: string): IConnection {
        return this.connections.get(hash)
    }

    public forEach(fn: (value: IConnection, key: string) => void): void {
        this.connections.forEach(fn)
    }

    public createEntityConnections(
        entityNumber: number,
        connections: BPS.IConnection,
        neighbours: number[]
    ): void {
        const conns = WireConnections.deserialize(entityNumber, connections, neighbours)
        for (const conn of conns) {
            this.create(conn)
        }
    }

    public removeEntityConnections(entityNumber: number): void {
        const conns = this.getEntityConnections(entityNumber)
        for (const conn of conns) {
            this.remove(conn)
        }
    }

    public getEntityConnectionHashes(entityNumber: number): string[] {
        return this.connections.getEntityConnectionHashes(entityNumber)
    }

    public getEntityConnections(entityNumber: number): IConnection[] {
        return this.connections.getEntityConnections(entityNumber)
    }

    public serializeConnectionData(
        entityNumber: number,
        entNrWhitelist?: Set<number>
    ): { connections: BPS.IConnection; neighbours: number[] } {
        const connections = this.getEntityConnections(entityNumber)
        return WireConnections.serialize(
            entityNumber,
            connections,
            entityNumber => this.bp.entities.get(entityNumber).type,
            entNrWhitelist
        )
    }

    public connectPowerPole(entityNumber: number): void {
        const entity = this.bp.entities.get(entityNumber)
        const areaSize = (entity.maxWireDistance + 1) * 2

        const poles = this.bp.entityPositionGrid
            .getEntitiesInArea({
                x: entity.position.x,
                y: entity.position.y,
                w: areaSize,
                h: areaSize,
            })
            .filter(
                e =>
                    e !== entity &&
                    e.type === 'electric_pole' &&
                    this.getEntityConnections(e.entityNumber).filter(c => c.color === 'copper')
                        .length < MAX_POLE_CONNECTION_COUNT &&
                    U.pointInCircle(
                        e.position,
                        entity.position,
                        Math.min(e.maxWireDistance, entity.maxWireDistance)
                    )
            )
            .sort(
                (a, b) =>
                    U.manhattenDistance(a.position, entity.position) -
                    U.manhattenDistance(b.position, entity.position)
            )

        let counter = MAX_POLE_CONNECTION_COUNT
        const blacklist = new Set<number>()
        for (const pole of poles) {
            if (counter === 0) break
            if (blacklist.has(pole.entityNumber)) continue
            counter -= 1

            blacklist.add(pole.entityNumber)
            for (const connection of this.getEntityConnections(pole.entityNumber)) {
                if (connection.color === 'copper') {
                    const otherEntNr =
                        pole.entityNumber === connection.entityNumber1
                            ? connection.entityNumber2
                            : connection.entityNumber1
                    blacklist.add(otherEntNr)
                }
            }

            this.create(WireConnections.toPoleConnection(entity.entityNumber, pole.entityNumber))
        }
    }

    public generatePowerPoleWires(): void {
        interface IPole extends IPoint {
            entityNumber: number
            name: string
        }

        const poles: IPole[] = this.bp.entities
            .filter(e => e.type === 'electric_pole')
            .map(e => ({
                entityNumber: e.entityNumber,
                name: e.name,
                x: e.position.x,
                y: e.position.y,
            }))

        if (poles.length < 2) return

        const poleSetsTriangles = U.pointsToTriangles(poles).map(tri =>
            tri
                .flatMap<[IPole, IPole]>((_, i, arr) => {
                    if (i === arr.length - 1) return [[arr[0], arr[i]]]
                    return [[arr[i], arr[i + 1]]]
                })
                .filter(([pole0, pole1]) =>
                    U.pointInCircle(
                        pole0,
                        pole1,
                        Math.min(
                            FD.entities[pole0.name].maximum_wire_distance,
                            FD.entities[pole1.name].maximum_wire_distance
                        )
                    )
                )
        )

        const poleSets = poleSetsTriangles
            .flat()
            .sort((a, b) => {
                const minPos = (l: IPole[]): number =>
                    Math.min(l[0].x, l[1].x) + Math.min(l[0].y, l[1].y)
                return minPos(a) - minPos(b)
            })
            .sort((a, b) => U.manhattenDistance(a[0], a[1]) - U.manhattenDistance(b[0], b[1]))

        const hashPoleSet = ([pole0, pole1]: [IPole, IPole]): string => {
            const min = Math.min(pole0.entityNumber, pole1.entityNumber)
            const max = Math.max(pole0.entityNumber, pole1.entityNumber)
            return `${min}-${max}`
        }

        const hashedTriangles = poleSetsTriangles
            .filter(lines => lines.length === 3)
            .map(lines => lines.map(hashPoleSet))

        const finalPoleSets: IPole[][] = []
        const addedMap: Set<string> = new Set()

        while (poleSets.length) {
            const poleSet = poleSets.shift()
            const hash = hashPoleSet(poleSet)

            const formsATriangle = hashedTriangles
                .filter(tri => tri.includes(hash))
                .map(tri => tri.filter(h => h !== hash))
                .map(oLines => oLines.every(h => addedMap.has(h)))
                .reduce((acc, bool) => acc || bool, false)

            if (!formsATriangle) {
                finalPoleSets.push(poleSet)
                addedMap.add(hash)
            }
        }

        for (const poleSet of finalPoleSets) {
            this.create(
                WireConnections.toPoleConnection(poleSet[0].entityNumber, poleSet[1].entityNumber)
            )
        }
    }

    public getPowerPoleDirection(entityNumber: number): number {
        const connections = this.getEntityConnections(entityNumber).map(conn =>
            entityNumber === conn.entityNumber1 ? conn.entityNumber2 : conn.entityNumber1
        )
        if (connections.length === 0) return 0

        const points = connections
            .map(entNr => this.bp.entities.get(entNr))
            .filter(e => !!e)
            .map(ent => ent.position)

        if (points.length === 0) return 0

        return getPowerPoleRotation(this.bp.entities.get(entityNumber).position, points)

        function getPowerPoleRotation(centre: IPoint, points: IPoint[]): number {
            const sectorSum = points
                .map(p =>
                    U.getAngle(0, 0, p.x - centre.x, (p.y - centre.y) * -1 /* invert Y axis */)
                )
                .map(angleToSector)
                .reduce((acc, sec) => acc + sec, 0)

            return Math.floor(sectorSum / points.length) * 2

            function angleToSector(angle: number): 0 | 1 | 2 | 3 {
                const cwAngle = 360 - angle
                const sectorAngle = 360 / 8
                const offset = sectorAngle * 1.5
                let newAngle = cwAngle - offset
                if (Math.sign(newAngle) === -1) {
                    newAngle = 360 + newAngle
                }
                const sector = Math.floor(newAngle / sectorAngle)
                return (sector % 4) as 0 | 1 | 2 | 3
            }
        }
    }
}
