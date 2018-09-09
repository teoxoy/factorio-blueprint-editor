import { Blueprint } from './blueprint'
import Immutable from 'immutable'

export class ConnectionsManager {

    bp: Blueprint
    connections: Immutable.Map<string, Immutable.List<Immutable.Map<
        'color' | 'circuit_id' | 'entity_number_1' | 'entity_number_2' | 'entity_side_1' | 'entity_side_2'
    , string | number | undefined>>>
    historyIndex: number
    history: Array<Immutable.Map<string, Immutable.List<Immutable.Map<
        'color' | 'circuit_id' | 'entity_number_1' | 'entity_number_2' | 'entity_side_1' | 'entity_side_2'
    , string | number | undefined>>>>

    constructor(bp: Blueprint, entity_numbers?: number[]) {
        this.bp = bp
        this.connections = Immutable.Map()

        // Set Bulk
        if (entity_numbers) {
            this.connections = this.connections.withMutations(map => {
                const connections = new Map()
                for (const entity_number of entity_numbers) {
                    const entity = this.bp.entity(entity_number)
                    if (entity.hasConnections) connections.set(entity_number, entity.connections)
                }
                connections.forEach((conn, k) => {
                    const added: any = []
                    for (const side in conn) {
                        for (const color in conn[side]) {
                            for (const c of conn[side][color]) {
                                if (!map.has(`${(c as any).entity_id}-${k}`)) {
                                    let side2: string
                                    const conn2 = connections.get((c as any).entity_id)
                                    let found = false
                                    for (side2 in conn2) {
                                        for (const color2 in conn2[side2]) {
                                            for (const c2 of conn2[side2][color2]) {
                                                if (color === color2 && (c2 as any).entity_id === k && !added.find((addedConn: any) =>
                                                    addedConn.color === color &&
                                                    addedConn.entity_number_2 === (c as any).entity_id &&
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
                                    const key = `${k}-${(c as any).entity_id}`
                                    if (!map.has(key)) map.set(key, Immutable.List())
                                    map.set(key, map.get(key).push(Immutable.fromJS({
                                        color,
                                        circuit_id: (c as any).circuit_id,
                                        entity_number_1: k,
                                        entity_number_2: (c as any).entity_id,
                                        entity_side_1: Number(side),
                                        entity_side_2: Number(side2)
                                    })))

                                    added.push({
                                        color,
                                        entity_number_2: (c as any).entity_id,
                                        entity_side_2: Number(side2)
                                    })
                                }
                            }
                        }
                    }
                })
            })
        }

        this.history = [this.connections]
        this.historyIndex = 0
    }

    undo() {
        if (this.historyIndex === 0) return
        this.connections = this.history[--this.historyIndex]
    }

    redo() {
        if (this.historyIndex === this.history.length - 1) return
        this.connections = this.history[++this.historyIndex]
    }

    operation(
        fn: (connections: Immutable.Map<string, Immutable.List<Immutable.Map<
            'color' | 'circuit_id' | 'entity_number_1' | 'entity_number_2' | 'entity_side_1' | 'entity_side_2'
        , string | number | undefined>>>) => Immutable.Map<any, any>
    ) {
        this.connections = fn(this.connections)
        if (this.historyIndex < this.history.length) {
            this.history = this.history.slice(0, this.historyIndex + 1)
        }
        this.history.push(this.connections)
        this.historyIndex++
    }

    removeConnectionData(entity_number: number) {
        const entitiesToModify: Array<{
            entity_number: number;
            side: string;
            color: string;
            index: number;
        }> = []
        this.operation(connections => connections.withMutations(map => {
            map.forEach((v, k) => {
                const isE1 = Number(k.split('-')[0]) === entity_number
                const isE2 = Number(k.split('-')[1]) === entity_number
                if (isE1 || isE2) {
                    v.forEach(conn => {
                        const entNr2 = (isE1 ? conn.get('entity_number_2') : conn.get('entity_number_1')) as number
                        const conn2 = this.bp.entity(entNr2).connections
                        for (const side in conn2) {
                            for (const color in conn2[side]) {
                                for (const i in conn2[side][color]) {
                                    if (entity_number === conn2[side][color][i].entity_id &&
                                        Number(side) === (isE1 ? conn.get('entity_side_2') : conn.get('entity_side_1')) &&
                                        color === conn.get('color')
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
                        map.deleteIn([k, map.get(k).indexOf(conn)])
                    })
                }
                if (map.get(k).size === 0) map.delete(k)
            })
        }))
        return entitiesToModify
    }
}
