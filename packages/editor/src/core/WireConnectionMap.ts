import { IConnection } from './WireConnections'

export class WireConnectionMap extends Map<string, IConnection> {
    private entNrToConnHash: Map<number, string[]> = new Map()

    public getEntityConnectionHashes(entityNumber: number): string[] {
        return this.entNrToConnHash.get(entityNumber) || []
    }

    public getEntityConnections(entityNumber: number): IConnection[] {
        return this.getEntityConnectionHashes(entityNumber).map(hash => this.get(hash))
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
