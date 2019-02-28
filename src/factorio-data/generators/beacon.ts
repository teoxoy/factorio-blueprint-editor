import U from './util'

let MIN_AFFECTED_ENTITIES = 1

const BEACON_EFFECT_RADIUS = 3
const BEACON_SIZE = 3

interface IBeacon extends IPoint {
    collisionArea: IPoint[]
    effectsGiven: number
    avgDistToEntities: number
    nrOfOverlaps: number
}

/*
    How the algorithm works:

    1. form valid beacon positions
        by searching away from the given entities (create a radius around the entity where a beacon could spawn)
        and removing positions that are occupied by entities

    2. form possible beacon areas
        by going trough all valid beacon positions and picking all 3x3 areas

    3. form possible beacon array (data that will help with sorting the beacons in the next stage)

    4. add beacons one by one to the beacon array
        prioritizing (most to least important):
            - nr of affected entities
            - if (nr of affected entities == 1)
                - then: farthest beacons from entity
                - else: least nr of overlaps (least nr of possible beacons that could spawn on the area of the current beacon)
        and removing beacons from the array that occupied the same area as the added beacon
*/
export default function generateBeacons(
    entities: { position: IPoint; size: number; effect: boolean }[],
    minAffectedEntities = MIN_AFFECTED_ENTITIES
) {
    MIN_AFFECTED_ENTITIES = minAffectedEntities

    const visualizations: { path: IPoint[]; size: number; alpha: number; color?: number }[] = []
    function addVisualization(path: IPoint[], size = 32, alpha = 1, color?: number) {
        visualizations.push({ path: path.map(p => ({ x: p.x + 0.5, y: p.y + 0.5 })), size, alpha, color })
    }

    const entityAreas = entities.map(e =>
        U.range(0, e.size * e.size).map(i => ({
            x: Math.floor(e.position.x) + ((i % e.size) - Math.floor(e.size / 2)),
            y: Math.floor(e.position.y) + (Math.floor(i / e.size) - Math.floor(e.size / 2)),
            effect: e.effect
        }))
    )

    const occupiedPositions = entityAreas
        .reduce((acc, val) => acc.concat(val), [])
        .map(U.hashPoint)
        .reduce((map, key) => map.set(key, true), new Map())

    // GENERATE VALID BEACON POSITIONS
    const validBeaconPositions = U.uniqPoints(
        entities
            .filter(e => e.effect)
            .map(e => {
                const searchSize = e.size + BEACON_SIZE * 2 + (BEACON_EFFECT_RADIUS - 1) * 2
                return U.range(0, searchSize * searchSize).map(i => ({
                    x: Math.floor(e.position.x) + ((i % searchSize) - Math.floor(searchSize / 2)),
                    y: Math.floor(e.position.y) + (Math.floor(i / searchSize) - Math.floor(searchSize / 2))
                }))
            })
            .reduce((acc, val) => acc.concat(val), [])
    ).filter(p => occupiedPositions.get(U.hashPoint(p)) !== true)

    const grid = validBeaconPositions.reduce((map, p) => map.set(U.hashPoint(p), true), new Map())

    // GENERATE POSSIBLE BEACON AREAS
    const possibleBeaconAreas = validBeaconPositions
        .map(coord =>
            U.range(0, BEACON_SIZE * BEACON_SIZE)
                .map(i => ({
                    x: coord.x + (i % BEACON_SIZE),
                    y: coord.y + Math.floor(i / BEACON_SIZE)
                }))
                .filter(p => grid.get(U.hashPoint(p)))
        )
        .filter(arr => arr.length === BEACON_SIZE * BEACON_SIZE)

    const pointToBeaconCount = possibleBeaconAreas
        .reduce((acc, val) => acc.concat(val), [])
        .map(U.hashPoint)
        .reduce((map, key) => {
            const C = map.get(key)
            if (!C) {
                return map.set(key, 1)
            }
            return map.set(key, C + 1)
        }, new Map<string, number>())

    const pointToEntityArea = entityAreas
        .filter(area => area.every(p => p.effect))
        .reduce((map, area) => {
            area.forEach(p => map.set(U.hashPoint(p), area))
            return map
        }, new Map())

    // GENERATE POSSIBLE BEACONS
    let possibleBeacons: IBeacon[] = possibleBeaconAreas
        .map(collisionArea => {
            const mid = collisionArea[4]

            const D = BEACON_SIZE + BEACON_EFFECT_RADIUS * 2
            const effectsGiven = U.range(0, D * D)
                .map(i => ({
                    x: mid.x + ((i % D) - Math.floor(D / 2)),
                    y: mid.y + (Math.floor(i / D) - Math.floor(D / 2))
                }))
                .reduce((acc, p) => {
                    const area = pointToEntityArea.get(U.hashPoint(p))
                    if (!area || acc.includes(area)) {
                        return acc
                    }
                    return acc.concat([area])
                }, [])

            const avgDistToEntities =
                effectsGiven
                    .map(p => p[4])
                    .map(p => U.manhattenDistance(p, mid))
                    .reduce((acc, distance) => acc + distance, 0) / effectsGiven.length

            const nrOfOverlaps = collisionArea
                .map(p => pointToBeaconCount.get(U.hashPoint(p)))
                .reduce((acc, v) => acc + v, 0)

            return {
                ...mid,
                collisionArea,
                effectsGiven: effectsGiven.length,
                avgDistToEntities,
                nrOfOverlaps
            }
        })
        .filter(c => c.effectsGiven >= MIN_AFFECTED_ENTITIES)

    // addVisualization(U.uniqPoints(possibleBeacons.map(c => c.collisionArea).reduce((acc, val) => acc.concat(val), [])))

    const pointToBeacons = possibleBeacons.reduce((map, b) => {
        b.collisionArea.forEach(p => {
            const P = map.get(U.hashPoint(p))
            if (P) {
                P.push(b)
            } else {
                map.set(U.hashPoint(p), [b])
            }
        })
        return map
    }, new Map())

    // GENERATE BEACONS
    const beacons = []
    while (possibleBeacons.length) {
        possibleBeacons = possibleBeacons
            .sort((a, b) => {
                if (a.effectsGiven === 1 || b.effectsGiven === 1) {
                    return b.avgDistToEntities - a.avgDistToEntities
                }
                return a.nrOfOverlaps - b.nrOfOverlaps
            })
            .sort((a, b) => b.effectsGiven - a.effectsGiven)

        const beacon = possibleBeacons.shift()
        beacons.push(beacon)

        const toRemove: IBeacon[] = beacon.collisionArea.reduce((acc, p) => {
            const beacons: IBeacon[] = pointToBeacons.get(U.hashPoint(p))
            if (!beacons) {
                return acc
            }
            return acc.concat(beacons.filter(b => !acc.includes(b)))
        }, [])

        possibleBeacons = possibleBeacons.filter(b => !toRemove.includes(b))
    }

    addVisualization(beacons, 16, 1, 0x800000)

    const info = {
        totalBeacons: beacons.length,
        effectsGiven: beacons.reduce((acc, b) => acc + b.effectsGiven, 0)
    }

    return {
        beacons: beacons.map(b => ({
            name: 'beacon',
            position: { x: b.x + 0.5, y: b.y + 0.5 }
        })),
        info,
        visualizations
    }
}
