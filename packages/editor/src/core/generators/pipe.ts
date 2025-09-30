import PF from 'pathfinding'
import { IPoint } from '../../types'
import U from './util'
import { IVisualization } from './index'

// FD.entities.pumpjack.output_fluid_box.pipe_connections[0].positions
// define this here so we don't have to import FD
const PUMPJACK_PLUGS = [
    { x: 1, y: -2 },
    { x: 2, y: -1 },
    { x: -1, y: 2 },
    { x: -2, y: 1 },
]

// if there are groups that couldn't get connected, try x more times - every try increase maxTurns
const MAX_TRIES = 3

let MIN_GAP_BETWEEN_UNDERGROUNDS = 1
const MAX_GAP_BETWEEN_UNDERGROUNDS = 9

const GRID_MARGIN = 2

interface IPlug extends IPoint {
    dir: number
}

interface ILine {
    endpoints: IPumpjack[]
    connections: {
        plugs: IPlug[]
        path: IPoint[]
        distance: number
    }[]
    avgDistance: number
}

interface IPumpjack extends IPoint {
    entity_number: number
    plugs: IPlug[]
    plug?: IPlug
    dir?: number
}

interface IGroup extends IPoint {
    entities: IPumpjack[]
    paths: IPoint[][]
}

/*
    How the algorithm works:

    1. form lines between pumpjacks (DT)
        a line can only be formed if the 2 pumpjacks have a way of connecting in a straight line

    2. form groups from the lines
        prioritizing (most to least important):
            - group building (line contains an already added pumpjack)
            - how close a line is to the middle
            - line connections (the nr of ways the 2 pumpjacks in a line can be connected)
            - average distance of line connections

    3. connect groups together (DT)
        prioritizing groups with least nr of paths

    4. add leftover pumpjacks (those that couldn't form lines with any other pumpjack) to the group

    5. generate pipes and underground pipes

    DT = using delaunay triangulation to form lines between x (for optimization)
*/
function generatePipes(
    pumpjacks: { entity_number: number; position: IPoint }[],
    minGapBetweenUndergrounds = MIN_GAP_BETWEEN_UNDERGROUNDS
): {
    pumpjacksToRotate: {
        entity_number: number
        direction: number
    }[]
    pipes: {
        name: string
        position: IPoint
        direction: number
    }[]
    info: {
        nrOfPipes: number
        nrOfUPipes: number
        nrOfPipesReplacedByUPipes: number
    }
    visualizations: IVisualization[]
} {
    MIN_GAP_BETWEEN_UNDERGROUNDS = minGapBetweenUndergrounds

    const visualizations: IVisualization[] = []
    function addVisualization(path: IPoint[], size = 32, alpha = 1, color?: number): void {
        visualizations.push({ path: path.map(localToGlobal), size, alpha, color })
    }

    const globalCoords = pumpjacks
        .map(e => [Math.floor(e.position.x), Math.floor(e.position.y)])
        .flatMap(pos =>
            U.range(0, 9)
                .map(i => [(i % 3) - 1, Math.floor(i / 3) - 1])
                .map<IPoint>(offset => ({
                    x: pos[0] + offset[0],
                    y: pos[1] + offset[1],
                }))
        )

    const minX = globalCoords.reduce((pV, cV) => Math.min(pV, cV.x), Infinity)
    const minY = globalCoords.reduce((pV, cV) => Math.min(pV, cV.y), Infinity)
    const maxX = globalCoords.reduce((pV, cV) => Math.max(pV, cV.x), -Infinity) + 1
    const maxY = globalCoords.reduce((pV, cV) => Math.max(pV, cV.y), -Infinity) + 1
    const middle = { x: (maxX - minX) / 2, y: (maxY - minY) / 2 }

    const isPumpjackAtPos = new Set(globalCoords.map(globalToLocal).map(U.hashPoint))

    const grid = U.range(0, maxY - minY + GRID_MARGIN * 2).map(y =>
        U.range(0, maxX - minX + GRID_MARGIN * 2).map(x =>
            isPumpjackAtPos.has(`${x},${y}`) ? 1 : 0
        )
    )

    const dataset = pumpjacks
        .map<IPumpjack>(e => {
            const pos = globalToLocal(e.position)
            const plugs = PUMPJACK_PLUGS.map((o, i) => ({
                dir: i * 2,
                x: pos.x + o.x,
                y: pos.y + o.y,
            })).filter(p => !isPumpjackAtPos.has(U.hashPoint(p)))

            return { entity_number: e.entity_number, x: pos.x, y: pos.y, plugs }
        })
        .filter(e => e.plugs.length)

    // GENERATE LINES
    let LINES: ILine[] = U.pointsToLines(dataset)
        .map(line => {
            const conn = line[0].plugs
                .flatMap(p => line[1].plugs.map(p2 => [p, p2]))
                .filter(l => l[0].x === l[1].x || l[0].y === l[1].y)
                .map(l => ({ ...generatePathFromLine(l), plugs: l }))
                // check for other pumpjack collision
                .filter(l => l.path.every(p => !grid[p.y][p.x]))

            return {
                endpoints: line,
                connections: conn,
                avgDistance: conn.reduce((acc, val) => acc + val.distance, 0) / conn.length,
            }
        })
        .filter(l => l.connections.length !== 0)
    // .filter(l => l.avgDistance < 12)

    // GENERATE GROUPS
    let groups: IGroup[] = []
    const addedPumpjacks: IPumpjack[] = []
    while (LINES.length) {
        LINES = LINES.sort((a, b) => a.avgDistance - b.avgDistance)
            .sort((a, b) => a.connections.length - b.connections.length)
            .sort((a, b) => {
                const A =
                    U.manhattenDistance(a.endpoints[0], middle) +
                    U.manhattenDistance(a.endpoints[1], middle)
                const B =
                    U.manhattenDistance(b.endpoints[0], middle) +
                    U.manhattenDistance(b.endpoints[1], middle)
                return B - A
            })
            // promote group building
            .sort((a, b) => {
                const lineContainsAnAddedPumpjack = (ent: ILine): boolean =>
                    !!addedPumpjacks.find(
                        e =>
                            ent.endpoints
                                .map(endP => endP.entity_number)
                                .includes(e.entity_number) &&
                            !!ent.connections.find(t =>
                                t.plugs.map(endP => endP.dir).includes(e.plug.dir)
                            )
                    )

                if (lineContainsAnAddedPumpjack(a)) return -10
                if (lineContainsAnAddedPumpjack(b)) return 10
                return 0
            })

        const l = LINES.shift()
        const addedEnt1 = addedPumpjacks.find(e => e.entity_number === l.endpoints[0].entity_number)
        const addedEnt2 = addedPumpjacks.find(e => e.entity_number === l.endpoints[1].entity_number)

        l.connections
            // sort outside edges by how close they are to the middle
            .sort(
                (a, b) =>
                    U.manhattenDistance(a.plugs[0], middle) -
                    U.manhattenDistance(b.plugs[0], middle)
            )
            .sort((a, b) => a.distance - b.distance)

        for (const t of l.connections) {
            const entities = [
                { ...l.endpoints[0], plug: t.plugs[0] },
                { ...l.endpoints[1], plug: t.plugs[1] },
            ]
            if (!addedEnt1 && !addedEnt2) {
                groups.push({ entities, paths: [t.path], x: 0, y: 0 })
                addedPumpjacks.push(...entities)
                break
            }
            if (!addedEnt1 && addedEnt2 && addedEnt2.plug.dir === t.plugs[1].dir) {
                const g = groups.find(g => g.entities.includes(addedEnt2))
                g.entities.push(entities[0])
                g.paths.push(t.path)
                addedPumpjacks.push(entities[0])
                break
            }
            if (!addedEnt2 && addedEnt1 && addedEnt1.plug.dir === t.plugs[0].dir) {
                const g = groups.find(g => g.entities.includes(addedEnt1))
                g.entities.push(entities[1])
                g.paths.push(t.path)
                addedPumpjacks.push(entities[1])
                break
            }
        }
    }

    // if no LINES were generated, add 2 pumpjacks to a group here
    // this will only happen when only a few pumpjacks need to be connected
    if (groups.length === 0) {
        const line = U.pointsToLines(dataset)
            .map(line => {
                const conn = line[0].plugs
                    .flatMap(p => line[1].plugs.map(p2 => [p, p2]))
                    .map(l => {
                        const path = new PF.BreadthFirstFinder()
                            .findPath(l[0].x, l[0].y, l[1].x, l[1].y, new PF.Grid(grid))
                            .map(U.arrayToPoint)
                        return {
                            path,
                            distance: path.length,
                            plugs: l,
                        }
                    })
                    .sort((a, b) => a.distance - b.distance)[0]

                return {
                    endpoints: line.map((p, i) => ({ ...p, plug: conn.plugs[i] })),
                    conn,
                }
            })
            .sort((a, b) => a.conn.distance - b.conn.distance)[0]

        groups.push({
            entities: line.endpoints,
            paths: [line.conn.path],
            x: 0,
            y: 0,
        })
    }

    groups.map(g => g.paths.flat()).forEach(p => addVisualization(p, 32, 0.5))

    // CONNECT GROUPS
    let tries = MAX_TRIES
    let aloneGroups: IGroup[] = []
    let finalGroup: IGroup
    while (groups.length) {
        for (const g of groups) {
            g.x = g.entities.reduce((acc, e) => acc + e.x, 0) / g.entities.length
            g.y = g.entities.reduce((acc, e) => acc + e.y, 0) / g.entities.length
        }
        groups = groups.sort(
            (a, b) =>
                a.paths.reduce((acc, p) => acc + p.length, 0) -
                b.paths.reduce((acc, p) => acc + p.length, 0)
        )

        const groupsCopy = [...groups]
        const group = groups.shift()
        if (!groups.length) {
            if (aloneGroups.length && tries) {
                groups.push(...aloneGroups, group)
                aloneGroups = []
                tries -= 1
                continue
            }
            finalGroup = group
            break
        }

        const conn = getPathBetweenGroups(
            grid,
            U.pointsToLines(groupsCopy)
                .filter(l => l.includes(group))
                .map(l => l.find(g => g !== group)),
            group,
            2 + MAX_TRIES - tries
        )

        if (conn) {
            conn.toGroup.entities.push(...group.entities)
            conn.toGroup.paths.push(...group.paths, conn.path)
        } else {
            aloneGroups.push(group)
            continue
        }

        addVisualization(conn.path, 16, 0.5)
    }

    // ADD LEFTOVER PUMPJACKS TO GROUP
    const leftoverPumpjacks = dataset
        .filter(ent => !addedPumpjacks.find(e => e.entity_number === ent.entity_number))
        .sort((a, b) => U.manhattenDistance(a, middle) - U.manhattenDistance(b, middle))

    while (leftoverPumpjacks.length) {
        const ent = leftoverPumpjacks.shift()

        const conn = getPathBetweenGroups(
            grid,
            // Fake some group data - getPathBetweenGroups only cares about group.paths
            ent.plugs.map(p => ({
                x: 0,
                y: 0,
                paths: [[{ x: p.x, y: p.y }]],
                entities: [{ x: 0, y: 0, entity_number: 0, plugs: [p], plug: p }],
            })),
            finalGroup
        )

        finalGroup.entities.push({ ...ent, plug: conn.toGroup.entities[0].plug })
        finalGroup.paths.push(conn.path)

        addVisualization(conn.path, 8, 0.5)
    }

    let pipePositions = U.uniqPoints(finalGroup.paths.flat())

    // GENERATE ALL INTERSECTION POINTS (WILL INCLUDE ALL PUMPJACKS PLUGS TOO)
    const intersectionPositions = U.uniqPoints(
        finalGroup.paths.flatMap(p =>
            PF.Util.compressPath(p.map(U.pointToArray)).map(U.arrayToPoint)
        )
    )
    // addVisualization(intersectionPositions)

    // GENERATE ALL VALID POSITIONS (THAT COINCIDE WITH PLUGS) WHERE AN UNDERGROUND PIPE CAN SPAWN
    const validCoordsForUPipes = finalGroup.entities
        .map(e => e.plug)
        // filter out overlapping plugs
        .sort((a, b) => (a.x - b.x ? a.x - b.x : a.y - b.y))
        .filter(
            (v, i, arr) =>
                (i === 0 || !(v.x === arr[i - 1].x && v.y === arr[i - 1].y)) &&
                (i === arr.length - 1 || !(v.x === arr[i + 1].x && v.y === arr[i + 1].y))
        )
        // return true if there are no pipes to the left and right of the plug
        .filter(plug => {
            return [2, 6]
                .map(dir => posFromDir(plug, dir))
                .every(pos => !pipePositions.find(U.equalPoints(pos)))

            function posFromDir(plug: IPlug, dir: number): IPoint {
                switch ((plug.dir + dir) % 8) {
                    case 0:
                        return { x: plug.x, y: plug.y - 1 }
                    case 2:
                        return { x: plug.x + 1, y: plug.y }
                    case 4:
                        return { x: plug.x, y: plug.y + 1 }
                    case 6:
                        return { x: plug.x - 1, y: plug.y }
                }
            }
        })
    // addVisualization(validStraightPipeEnds)

    // GENERATE ALL STRAIGHT PATHS
    const straightPaths = finalGroup.paths
        // not length - 4 because one of the ends might be in validStraightPipeEnds
        .filter(p => p.length - 3 >= MIN_GAP_BETWEEN_UNDERGROUNDS)
        .flatMap(p =>
            p
                // find intersections in path
                .filter(pos => intersectionPositions.find(U.equalPoints(pos)))
                // map intersections in path to indexes on the path
                .map(iPos => p.findIndex(U.equalPoints(iPos)))
                // transform indexes array into pairs of indexes
                .flatMap((_, i, arr) => (i === 0 ? [] : [[arr[i - 1], arr[i]]]))
                // map pairs of indexes to the corresponding part of path
                .map(pair => p.slice(pair[0], pair[1] + 1))
        )
        // remove ends of pipes if they are not in validStraightPipeEnds
        .map(path =>
            path.filter((pos, i, arr) => {
                if (i > 0 && i < arr.length - 1) return true
                return validCoordsForUPipes.find(U.equalPoints(pos))
            })
        )
        .filter(p => p.length - 2 >= MIN_GAP_BETWEEN_UNDERGROUNDS)

    // GENERATE UNDERGROUND PIPE DATA
    const undergroundPipes = straightPaths
        .flatMap(path => {
            const HOR = path[0].y === path[1].y
            const PATH = path.sort((a, b) => (HOR ? a.x - b.x : a.y - b.y))

            // if path is longer than MAX_GAP_BETWEEN_UNDERGROUNDS + 2 then generate inbetween underground pipes
            const segments = Math.ceil(PATH.length / (MAX_GAP_BETWEEN_UNDERGROUNDS + 2))
            const segmentLength = PATH.length / segments

            return U.range(0, segments)
                .map(i => ({
                    start: Math.floor(segmentLength * i),
                    end: Math.floor(segmentLength * (i + 1)) - 1,
                }))
                .flatMap<IPlug>(segment => [
                    { ...PATH[segment.start], dir: HOR ? 6 : 0 },
                    { ...PATH[segment.end], dir: HOR ? 2 : 4 },
                ])
        })
        .map(localToGlobal)

    const straightPathsCoords = straightPaths.flat()
    // addVisualization(straightPathsCoords)

    // GENERATE PIPE DATA
    pipePositions = pipePositions
        .filter(coord => !straightPathsCoords.find(U.equalPoints(coord)))
        .map(localToGlobal)

    const pumpjacksToRotate = finalGroup.entities.map(e => ({
        entity_number: e.entity_number,
        direction: e.plug.dir,
    }))

    // UNIFY PIPE DATA
    const pipes = [
        ...pipePositions.map(pos => ({ name: 'pipe', position: pos, direction: 0 })),
        ...undergroundPipes.map(e => ({
            name: 'pipe-to-ground',
            position: { x: e.x, y: e.y },
            direction: e.dir,
        })),
    ]

    const info = {
        nrOfPipes: pipePositions.length,
        nrOfUPipes: undergroundPipes.length,
        nrOfPipesReplacedByUPipes: straightPathsCoords.length,
    }

    return {
        pumpjacksToRotate,
        pipes,
        info,
        visualizations,
    }

    function globalToLocal<T extends IPoint>(point: T): T {
        return {
            ...point,
            x: Math.floor(point.x) - minX + GRID_MARGIN,
            y: Math.floor(point.y) - minY + GRID_MARGIN,
        }
    }

    function localToGlobal<T extends IPoint>(point: T): T {
        return {
            ...point,
            x: point.x + minX - GRID_MARGIN + 0.5,
            y: point.y + minY - GRID_MARGIN + 0.5,
        }
    }
}

function generatePathFromLine(l: IPoint[]): {
    path: IPoint[]
    distance: number
} {
    const dX = Math.abs(l[0].x - l[1].x)
    const dY = Math.abs(l[0].y - l[1].y)
    const minX = Math.min(l[0].x, l[1].x)
    const minY = Math.min(l[0].y, l[1].y)
    const path = dX
        ? U.range(0, dX + 1).map<IPoint>(i => ({ x: i + minX, y: l[0].y }))
        : U.range(0, dY + 1).map<IPoint>(i => ({ x: l[0].x, y: i + minY }))

    return {
        path,
        distance: dX + dY,
    }
}

/** Returns the shortest path between the given group and one group from the given array */
function getPathBetweenGroups(
    grid: number[][],
    GROUPS: IGroup[],
    group: IGroup,
    maxTurns = 2
): {
    path: IPoint[]
    toGroup: IGroup
} {
    const ret = GROUPS.map(g => connect2Groups(grid, g, group, maxTurns))
        .filter(p => p.lines.length)
        .sort((a, b) => a.minDistance - b.minDistance)[0]
    if (!ret) return
    return {
        toGroup: ret.firstGroup,
        path: ret.lines[0].path,
    }

    function connect2Groups(
        grid: number[][],
        g0: IGroup,
        g1: IGroup,
        maxTurns = 2
    ): {
        lines: {
            endpoints: IPoint[]
            turns: number
            path: IPoint[]
            distance: number
        }[]
        minDistance: number
        firstGroup: IGroup
    } {
        const path0 = g0.paths.flat()
        const path1 = g1.paths.flat()

        const lines = path0
            .flatMap(coord =>
                path1.filter(p => p.x === coord.x || p.y === coord.y).map(found => [found, coord])
            )
            .map(l => ({ ...generatePathFromLine(l), endpoints: l, turns: 0 }))
            // check for other pumpjack collision
            .filter(l => l.path.every(p => !grid[p.y][p.x]))

        // if (!lines.length || (lines[0] && lines[0].distance > 7)) {
        // optimization for spread out pumpjacks
        const PATH1 =
            path0.length === 1
                ? path1
                      .sort(
                          (a, b) =>
                              U.manhattenDistance(a, path0[0]) - U.manhattenDistance(b, path0[0])
                      )
                      .slice(0, 20)
                : path1

        const L = U.pointsToLines([...path0, ...PATH1])
            // filter out lines that are in the same group
            .filter(
                l =>
                    !(
                        (path0.includes(l[0]) && path0.includes(l[1])) ||
                        (path1.includes(l[0]) && path1.includes(l[1]))
                    )
            )
            .sort((a, b) => U.manhattenDistance(a[0], a[1]) - U.manhattenDistance(b[0], b[1]))
            .slice(0, 5)
            .map(l => {
                const path = new PF.BreadthFirstFinder().findPath(
                    l[0].x,
                    l[0].y,
                    l[1].x,
                    l[1].y,
                    new PF.Grid(grid)
                )

                return {
                    endpoints: l,
                    distance: path.length,
                    path: path.map(U.arrayToPoint),
                    turns: PF.Util.compressPath(path).length - 2,
                }
            })
            // .filter(l => l.distance > 9)
            .filter(l => l.turns > 0 && l.turns <= maxTurns)
            .sort((a, b) => a.turns - b.turns)

        lines.push(...L)
        // }

        return {
            lines: lines.sort((a, b) => a.distance - b.distance),
            minDistance: lines.reduce((acc, l) => Math.min(acc, l.distance), Infinity),
            firstGroup: g0,
        }
    }
}

export { generatePipes }
