import U from './util'

const POLE_TO_POLE_RADIUS = 9
const POLE_EFFECT_RADIUS = 3
const POLE_SIZE = 1

interface IPole extends IPoint {
    powerArea: IPoint[]
    poweredEntityAreas: IPoint[][]
    powerGiven: number
    distFromMidOfConsumers: number
}

interface IGroup extends IPoint {
    poles: (IPole | IPoint)[]
    lines: IPole[][]
}

/*
    How the algorithm works:

    1. form valid pole positions
        by searching away from the given entities (create a radius around the entity where a pole could spawn)
        and removing positions that are occupied by entities

    2. form possible pole array (data that will help with sorting the poles in the next stage)

    3. add poles one by one to the pole array
        prioritizing (most to least important):
            - nr of entities powered
            - distance from the average position of all powered entities
        and removing poles from the array that no longer have entities to power

    4. form lines between poles (DT)
        a line can only be formed if the 2 poles are within POLE_TO_POLE_RADIUS distance of each other

    5. form groups from the lines (group together poles that are connected by lines)

    6. add leftover poles (those that couldn't form lines with any other pole)
        each pole will form a group

    7. connect groups together (DT)
        each iteration, try to connect 2 groups together with one generated pole
        or at least add a new pole to one of the groups in the direction of another group

    DT = using delaunay triangulation to form lines between x (for optimization)
*/
export default function generatePoles(entities: { position: IPoint; size: number; power: boolean }[]) {
    const visualizations: { path: IPoint[]; size: number; alpha: number; color?: number }[] = []
    function addVisualization(path: IPoint[], size = 32, alpha = 1, color?: number) {
        visualizations.push({ path: path.map(p => ({ x: p.x + 0.5, y: p.y + 0.5 })), size, alpha, color })
    }

    const entityAreas = entities.map(e =>
        U.range(0, e.size * e.size).map(i => ({
            x: Math.floor(e.position.x) + ((i % e.size) - Math.floor(e.size / 2)),
            y: Math.floor(e.position.y) + (Math.floor(i / e.size) - Math.floor(e.size / 2)),
            power: e.power
        }))
    )

    const occupiedPositions = entityAreas
        .reduce((acc, val) => acc.concat(val), [])
        .map(U.hashPoint)
        .reduce((map, key) => map.set(key, true), new Map())

    // addVisualization(entityAreas.reduce((acc, val) => acc.concat(val), []))

    // GENERATE VALID POLE POSITIONS
    const validPolePositions = U.uniqPoints(
        entities
            .filter(e => e.power)
            .map(e => {
                const searchSize = e.size + POLE_SIZE * 2 + (POLE_EFFECT_RADIUS - 1) * 2
                return U.range(0, searchSize * searchSize).map(i => ({
                    x: Math.floor(e.position.x) + ((i % searchSize) - Math.floor(searchSize / 2)),
                    y: Math.floor(e.position.y) + (Math.floor(i / searchSize) - Math.floor(searchSize / 2))
                }))
            })
            .reduce((acc, val) => acc.concat(val), [])
    ).filter(p => occupiedPositions.get(U.hashPoint(p)) !== true)

    // addVisualization(validPolePositions)

    const pointToEntityArea = entityAreas
        .filter(area => area.every(p => p.power))
        .reduce((map, area) => {
            area.forEach(p => map.set(U.hashPoint(p), area))
            return map
        }, new Map())

    // GENERATE POSSIBLE POLES
    let possiblePoles: IPole[] = validPolePositions.map(mid => {
        const D = POLE_SIZE + POLE_EFFECT_RADIUS * 2
        const powerArea = U.range(0, D * D).map(i => ({
            x: mid.x + ((i % D) - Math.floor(D / 2)),
            y: mid.y + (Math.floor(i / D) - Math.floor(D / 2))
        }))

        const powerGiven = powerArea.reduce((acc, p) => {
            const area = pointToEntityArea.get(U.hashPoint(p))
            if (!area || acc.includes(area)) {
                return acc
            }
            return acc.concat([area])
        }, [])

        const midOfConsumers = powerGiven
            .map(p => p[4])
            .reduce(
                (m, p) => {
                    m.x += p.x
                    m.y += p.y
                    return m
                },
                { x: 0, y: 0 }
            )

        const distFromMidOfConsumers =
            Math.abs(midOfConsumers.x / powerGiven.length - mid.x) +
            Math.abs(midOfConsumers.y / powerGiven.length - mid.y)

        return {
            ...mid,
            powerArea,
            poweredEntityAreas: powerGiven,
            powerGiven: powerGiven.length,
            distFromMidOfConsumers
        }
    })

    const entAreaToPoles = possiblePoles.reduce((map, p) => {
        p.poweredEntityAreas.forEach(area => {
            const exists = map.get(area)
            if (exists) {
                exists.push(p)
            } else {
                map.set(area, [p])
            }
        })
        return map
    }, new Map())

    // GENERATE POLES
    const poles: IPole[] = []
    while (possiblePoles.length) {
        possiblePoles = possiblePoles
            .sort((a, b) => a.distFromMidOfConsumers - b.distFromMidOfConsumers)
            .sort((a, b) => b.powerGiven - a.powerGiven)

        const pole = possiblePoles.shift()
        poles.push(pole)

        const toRemove = pole.poweredEntityAreas.reduce((acc, area) => {
            const poles: IPole[] = entAreaToPoles.get(area)
            if (!poles) {
                return acc
            }

            poles.forEach(p => {
                p.poweredEntityAreas = p.poweredEntityAreas.filter(a => a !== area)
                p.powerGiven -= 1
            })

            return acc.concat(poles.filter(p => p.poweredEntityAreas.length === 0))
        }, [])

        possiblePoles = possiblePoles.filter(p => !toRemove.includes(p))
    }

    addVisualization(poles, 16, 1, 0x00bfff)

    // GENERATE LINES
    const lines = U.pointsToLines(poles).filter(l => U.pointInCircle(l[0], l[1], POLE_TO_POLE_RADIUS))

    // GENERATE GROUPS
    let groups: IGroup[] = []
    const addedPoles: IPole[] = []
    while (lines.length) {
        const l = lines.shift()
        const g1 = groups.find(g => g.poles.includes(l[0]))
        const g2 = groups.find(g => g.poles.includes(l[1]))

        if (!g1 && !g2) {
            groups.push({ poles: [...l], lines: [l], x: 0, y: 0 })
            addedPoles.push(...l)
            continue
        }
        if (g1 && !g2) {
            g1.poles.push(l[1])
            g1.lines.push(l)
            addedPoles.push(l[1])
            continue
        }
        if (!g1 && g2) {
            g2.poles.push(l[0])
            g2.lines.push(l)
            addedPoles.push(l[0])
            continue
        }
        if (g1 && g2 && g1 !== g2) {
            g1.poles = g1.poles.concat(g2.poles)
            g1.lines = g1.lines.concat(g2.lines)
            groups = groups.filter(g => g !== g2)
            continue
        }
    }

    // ADD LEFTOVER POLES
    groups = groups.concat(poles.filter(p => !addedPoles.includes(p)).map(p => ({ poles: [p], lines: [], x: 0, y: 0 })))

    poles.forEach(p => occupiedPositions.set(U.hashPoint(p), true))

    // groups
    //     .map(g => g.poles.reduce((acc, val) => acc.concat(val), []))
    //     .forEach(p => addVisualization(p, 32))

    const r2 = POLE_TO_POLE_RADIUS * 2 + 1
    const circleOffsets = U.range(0, r2 * r2)
        .map(i => ({
            x: (i % r2) - Math.floor(r2 / 2),
            y: Math.floor(i / r2) - Math.floor(r2 / 2)
        }))
        .filter(o => U.pointInCircle(o, { x: 0, y: 0 }, POLE_TO_POLE_RADIUS))

    // CONNECT GROUPS
    const connectionPoles: IPoint[] = []
    let finalGroup: IGroup
    while (groups.length) {
        groups.forEach(g => {
            g.x = g.poles.reduce((acc, e) => acc + e.x, 0) / g.poles.length
            g.y = g.poles.reduce((acc, e) => acc + e.y, 0) / g.poles.length
        })
        groups = groups.sort((a, b) => a.poles.length - b.poles.length)

        const groupsCopy = [...groups]
        const group = groups.shift()
        if (!groups.length) {
            finalGroup = group
            break
        }

        const DATA = U.pointsToLines(groupsCopy)
            .filter(l => l.includes(group))
            .map(l => l.find(g => g !== group))
            .map(otherGroup => {
                const shortestLine = U.pointsToLines([...group.poles, ...otherGroup.poles])
                    // filter out lines that are in the same group
                    .filter(
                        l =>
                            !(
                                (group.poles.includes(l[0]) && group.poles.includes(l[1])) ||
                                (otherGroup.poles.includes(l[0]) && otherGroup.poles.includes(l[1]))
                            )
                    )
                    .map(l => ({
                        poles: l,
                        dist: U.euclideanDistance(l[0], l[1])
                    }))
                    .sort((a, b) => a.dist - b.dist)[0]

                const g1pole = shortestLine.poles.find(p => group.poles.includes(p))
                const g2pole = shortestLine.poles.find(p => otherGroup.poles.includes(p))

                const betweenG1AndG2Poles = {
                    x: (g1pole.x + g2pole.x) / 2,
                    y: (g1pole.y + g2pole.y) / 2
                }

                return {
                    g1pole,
                    g2pole,
                    otherGroup,
                    dist: shortestLine.dist,
                    betweenG1AndG2Poles
                }
            })
            .sort((a, b) => a.dist - b.dist)[0]

        const newPolePos = circleOffsets
            .map(o => ({
                x: DATA.g1pole.x + o.x,
                y: DATA.g1pole.y + o.y
            }))
            .filter(p => occupiedPositions.get(U.hashPoint(p)) !== true)
            .sort((a, b) => {
                const point = DATA.dist > POLE_TO_POLE_RADIUS + 2 ? DATA.g2pole : DATA.betweenG1AndG2Poles
                return U.manhattenDistance(a, point) - U.manhattenDistance(b, point)
            })[0]

        connectionPoles.push(newPolePos)

        if (U.pointInCircle(newPolePos, DATA.g2pole, POLE_TO_POLE_RADIUS)) {
            DATA.otherGroup.poles.push(...group.poles, newPolePos)
        } else {
            group.poles.push(newPolePos)
            groups.push(group)
        }
    }

    addVisualization(connectionPoles, 16, 1, 0x8a2be2)

    const info = {
        totalPoles: finalGroup.poles.length
    }

    return {
        poles: finalGroup.poles.map(p => ({
            name: 'medium_electric_pole',
            position: { x: p.x + 0.5, y: p.y + 0.5 }
        })),
        info,
        visualizations
    }
}
