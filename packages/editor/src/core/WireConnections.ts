import { EventEmitter } from 'eventemitter3'
import { Blueprint } from './Blueprint'

export interface IConnection {
    color: string
    entityNumber1: number
    entityNumber2: number
    entitySide1: number
    entitySide2: number
}

const hashConn = (conn: IConnection): string => {
    const firstE = Math.min(conn.entityNumber1, conn.entityNumber2)
    const secondE = Math.max(conn.entityNumber1, conn.entityNumber2)
    const firstS = firstE === conn.entityNumber1 ? conn.entitySide1 : conn.entitySide2
    const secondS = secondE === conn.entityNumber2 ? conn.entitySide2 : conn.entitySide1
    return `${conn.color}-${firstE}-${secondE}-${firstS}-${secondS}`
}

const deserialize = (entityNumber: number, connections: BPS.IConnection): IConnection[] => {
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

    return parsedConnections
}

const serialize = (entityNumber: number, connections: IConnection[]): BPS.IConnection => {
    const serialized: BPS.IConnection = {}

    for (const connection of connections) {
        const isEntity1 = connection.entityNumber1 === entityNumber
        const side = isEntity1 ? connection.entitySide1 : connection.entitySide2
        const color = connection.color
        const otherEntNr = isEntity1 ? connection.entityNumber2 : connection.entityNumber1

        if (color === 'copper') {
            const SIDE = `Cu${side - 1}`
            if (serialized[SIDE] === undefined) {
                serialized[SIDE] = []
            }
            const c = serialized[SIDE] as BPS.IWireColor[]
            c.push({
                entity_id: otherEntNr,
            })
        } else {
            if (serialized[side] === undefined) {
                serialized[side] = {}
            }
            const SIDE = serialized[side] as BPS.IConnSide
            if (SIDE[color] === undefined) {
                SIDE[color] = []
            }
            SIDE[color].push({
                entity_id: otherEntNr,
            })
        }
    }

    return serialized
}

class ConnectionMap extends Map<string, IConnection> {
    private entNrToConnHash: Map<number, string[]> = new Map()

    public getEntityConnectionHashes(entityNumber: number): string[] {
        return this.entNrToConnHash.get(entityNumber) || []
    }

    public set(hash: string, connection: IConnection): this {
        const add = (entityNumber: number): void => {
            const conn = this.entNrToConnHash.get(entityNumber) || []
            this.entNrToConnHash.set(entityNumber, [...conn, hash])
        }
        add(connection.entityNumber1)
        if (connection.entityNumber1 !== connection.entityNumber2) {
            add(connection.entityNumber2)
        }

        return super.set(hash, connection)
    }

    public delete(hash: string): boolean {
        const connection = this.get(hash)
        const rem = (entityNumber: number): void => {
            const conn = this.entNrToConnHash.get(entityNumber).filter(h => h !== hash)
            if (conn.length > 0) {
                this.entNrToConnHash.set(entityNumber, conn)
            } else {
                this.entNrToConnHash.delete(entityNumber)
            }
        }
        rem(connection.entityNumber1)
        if (connection.entityNumber1 !== connection.entityNumber2) {
            rem(connection.entityNumber2)
        }

        return super.delete(hash)
    }
}

class WireConnections extends EventEmitter {
    private bp: Blueprint
    private readonly connections = new ConnectionMap()

    public constructor(bp: Blueprint) {
        super()
        this.bp = bp
    }

    public create(connection: IConnection): void {
        const hash = hashConn(connection)
        if (this.connections.has(hash)) return

        this.bp.history
            .updateMap(this.connections, hash, connection, 'Connect entities')
            .onDone(this.onCreateOrRemoveConnection.bind(this))
            .commit()
    }

    private remove(connection: IConnection): void {
        const hash = hashConn(connection)
        if (!this.connections.has(hash)) return

        this.bp.history
            .updateMap(this.connections, hash, undefined, 'Disconnect entities')
            .onDone(this.onCreateOrRemoveConnection.bind(this))
            .commit()
    }

    private onCreateOrRemoveConnection(newValue: IConnection, oldValue: IConnection): void {
        if (newValue) {
            this.emit('create', hashConn(newValue), newValue)
        } else if (oldValue) {
            this.emit('remove', hashConn(oldValue), oldValue)
        }
    }

    public get(hash: string): IConnection {
        return this.connections.get(hash)
    }

    public forEach(fn: (value: IConnection, key: string) => void): void {
        this.connections.forEach(fn)
    }

    public createEntityConnections(entityNumber: number, connections: BPS.IConnection): void {
        const conns = deserialize(entityNumber, connections)
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
        return this.getEntityConnectionHashes(entityNumber).reduce((acc: IConnection[], hash) => {
            acc.push(this.connections.get(hash))
            return acc
        }, [])
    }

    public serializeConnectionData(entityNumber: number): BPS.IConnection {
        const connections = this.getEntityConnections(entityNumber)
        if (
            connections.length === 0 ||
            this.bp.entities.get(entityNumber).type === 'electric_pole'
        ) {
            return
        }
        return serialize(entityNumber, connections)
    }
}

export { deserialize, serialize, WireConnections }
