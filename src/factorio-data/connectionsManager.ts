import Blueprint from './blueprint'

export class ConnectionsManager {

    bp: Blueprint
    connections: Map<string, IConnection[]>

    constructor(bp: Blueprint, entity_numbers?: number[]) {
        this.bp = bp
        this.connections = new Map()

        // Set Bulk
        if (entity_numbers) {
            const connections = new Map()
            for (const entity_number of entity_numbers) {
                const entity = this.bp.entities.get(entity_number)
                if (entity.hasConnections) connections.set(entity_number, entity.connections)
            }
            connections.forEach((conn, k) => {
                const added: any = []
                for (const side in conn) {
                    for (const color in conn[side]) {
                        for (const c of conn[side][color]) {
                            if (!this.connections.has(`${c.entity_id}-${k}`)) {
                                let side2: string
                                const conn2 = connections.get(c.entity_id)
                                let found = false
                                for (side2 in conn2) {
                                    for (const color2 in conn2[side2]) {
                                        for (const c2 of conn2[side2][color2]) {
                                            if (color === color2 && c2.entity_id === k && !added.find((addedConn: any) =>
                                                addedConn.color === color &&
                                                addedConn.entity_number_2 === c.entity_id &&
                                                addedConn.entity_side_2 === Number(side2))
                                            ) {
                                                found = true
                                                break
                                            }
                                        }
                                        if (found) break
                                    }
                                    if (found) break
                                }
                                const key = `${k}-${c.entity_id}`
                                if (!this.connections.has(key)) this.connections.set(key, [])
                                this.connections.set(key, this.connections.get(key).concat([{
                                    color,
                                    circuit_id: c.circuit_id,
                                    entity_number_1: k,
                                    entity_number_2: c.entity_id,
                                    entity_side_1: Number(side),
                                    entity_side_2: Number(side2)
                                }]))

                                added.push({
                                    color,
                                    entity_number_2: c.entity_id,
                                    entity_side_2: Number(side2)
                                })
                            }
                        }
                    }
                }
            })
        }
    }

    removeConnectionData(entity_number: number) {
        const entitiesToModify: Array<{
            entity_number: number;
            side: string;
            color: string;
            index: number;
        }> = []

        this.connections.forEach((v, k) => {
            const isE1 = Number(k.split('-')[0]) === entity_number
            const isE2 = Number(k.split('-')[1]) === entity_number
            if (isE1 || isE2) {
                v.forEach(conn => {
                    const entNr2 = isE1 ? conn.entity_number_2 : conn.entity_number_1
                    const conn2 = this.bp.entities.get(entNr2).connections
                    for (const side in conn2) {
                        for (const color in conn2[side]) {
                            for (const i in conn2[side][color]) {
                                if (entity_number === conn2[side][color][i].entity_id &&
                                    Number(side) === (isE1 ? conn.entity_side_2 : conn.entity_side_1) &&
                                    color === conn.color
                                ) {
                                    entitiesToModify.push({
                                        entity_number: entNr2,
                                        side,
                                        color,
                                        index: Number(i)
                                    })
                                }
                            }
                        }
                    }
                    this.connections.set(k, this.connections.get(k).filter(c => c !== conn))
                })
            }
            if (this.connections.get(k).length === 0) this.connections.delete(k)
        })

        return entitiesToModify
    }
}
