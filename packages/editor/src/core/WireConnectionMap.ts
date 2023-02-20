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
        add(connection.cps[0].entityNumber)
        if (connection.cps[0].entityNumber !== connection.cps[1].entityNumber) {
            add(connection.cps[1].entityNumber)
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
        rem(connection.cps[0].entityNumber)
        if (connection.cps[0].entityNumber !== connection.cps[1].entityNumber) {
            rem(connection.cps[1].entityNumber)
        }

        return super.delete(hash)
    }
}
