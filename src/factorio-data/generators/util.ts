import Delaunator from 'delaunator'

// TODO: maybe merge this file with the main util file

const hashPoint = (p: IPoint) => `${p.x},${p.y}`

const equalPoints = <T extends IPoint>(a: T) => (b: T) => a.x === b.x && a.y === b.y

/** Returns unique points from points array */
const uniqPoints = <T extends IPoint>(list: T[]): T[] =>
    list
        .sort((a, b) => a.x - b.x ? a.x - b.x : a.y - b.y)
        .filter((v, i, arr) => i === 0 || !(v.x === arr[i - 1].x && v.y === arr[i - 1].y))
    // About 10x slower:
    // uniqWith((a, b) => equalPoints(a)(b), list)

const arrayToPoint = (array: number[]): IPoint => ({ x: array[0], y: array[1] })

const pointToArray = (point: IPoint): number[] => [point.x, point.y]

const manhattenDistance = (p0: IPoint, p1: IPoint) =>
    Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y)

const euclideanDistance = (p0: IPoint, p1: IPoint) =>
    Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2))

const pointInCircle = (point: IPoint, origin: IPoint, r: number) =>
    Math.pow(origin.x - point.x, 2) + Math.pow(origin.y - point.y, 2) <= r * r

const range = (from: number, to: number) =>
    [...Array(to - from).keys()].map(i => from + i)

export default {
    hashPoint,
    equalPoints,
    uniqPoints,
    arrayToPoint,
    pointToArray,
    manhattenDistance,
    euclideanDistance,
    pointInCircle,
    pointsToLines,
    pointsToTriangles,
    range,
    getAngle,
    getReflectedPoint,
    point: findSide
}

// https://stackoverflow.com/a/38024982
/** Returns the angle (0-360) anticlockwise from the horizontal for a point on a circle */
function getAngle(cX: number, cY: number, pX: number, pY: number) {
    const x = pX - cX
    const y = pY - cY
    if (x === 0 && y === 0) return 0
    const angle = Math.acos(x / Math.sqrt(x * x + y * y)) * 180 / Math.PI
    if (y < 0) return 360 - angle
    return angle
}

function getReflectedPoint(p: IPoint, lp0: IPoint, lp1: IPoint) {
    // get m and b from 2 points (y = xm + b)
    const m = (lp0.y - lp1.y) / (lp0.x - lp1.x)
    const b = lp0.y - lp0.x * m

    const d = (p.x + (p.y - b) * m) / (1 + m ** 2)
    return {
        x: 2 * d - p.x,
        y: 2 * d * m - p.y + 2 * b
    }
}

/** Returns 0 if p is on the line, +1 on one side and -1 on the other side. */
function findSide(p: IPoint, lp0: IPoint, lp1: IPoint) {
    return Math.sign((lp1.x - lp0.x) * (p.y - lp0.y) - (lp1.y - lp0.y) * (p.x - lp0.x))
}

/** Creates lines between points based on delaunay triangulation */
function pointsToLines<T extends IPoint>(nodes: T[]): T[][] {
    const filteredNodes = uniqPoints(nodes)

    if (filteredNodes.length === 1) return [[filteredNodes[0], filteredNodes[0]]]
    if (filteredNodes.length === 2) return [filteredNodes]

    // Check that nodes are not collinear
    let lastSlope = 0
    for (let i = 0; i < filteredNodes.length; i++) {
        if (i === filteredNodes.length - 1) {
            return filteredNodes.reduce((pV, _, i, arr) => {
                if (i === 0) return pV
                return pV.concat([[arr[i - 1], arr[i]]])
            }, [] as T[][])
        }
        const node = filteredNodes[i]
        const next = filteredNodes[i + 1]
        const dX = Math.abs(node.x - next.x)
        const dY = Math.abs(node.y - next.y)
        if (i === 0) lastSlope = dY / dX
        else if (lastSlope !== dY / dX) break
    }

    const delaunay = Delaunator.from(filteredNodes.map(pointToArray))

    // Return lines from delaunay data
    return delaunay.triangles
        .reduce((pV, _, i, arr) => {
            if (i <= delaunay.halfedges[i]) return pV
            const p = filteredNodes[arr[i]]
            const q = filteredNodes[arr[(i % 3 === 2) ? i - 2 : i + 1]]
            return pV.concat([[p, q]])
        }, [] as T[][])
}

/**
 * Creates triangles between points based on delaunay triangulation
 *
 * If triangles can not be formed, it's going to return lines
 */
function pointsToTriangles<T extends IPoint>(nodes: T[]): T[][] {
    const filteredNodes = uniqPoints(nodes)

    if (filteredNodes.length === 1) return [[filteredNodes[0], filteredNodes[0]]]
    if (filteredNodes.length === 2) return [filteredNodes]

    // Check that nodes are not collinear
    let lastSlope = 0
    for (let i = 0; i < filteredNodes.length; i++) {
        if (i === filteredNodes.length - 1) {
            return filteredNodes.reduce((pV, _, i, arr) => {
                if (i === 0) return pV
                return pV.concat([[arr[i - 1], arr[i]]])
            }, [] as T[][])
        }
        const node = filteredNodes[i]
        const next = filteredNodes[i + 1]
        const dX = Math.abs(node.x - next.x)
        const dY = Math.abs(node.y - next.y)
        if (i === 0) lastSlope = dY / dX
        else if (lastSlope !== dY / dX) break
    }

    const delaunay = Delaunator.from(filteredNodes.map(pointToArray))

    // Return triangles from delaunay data
    return range(0, delaunay.triangles.length / 3)
        .map(t => [3 * t, 3 * t + 1, 3 * t + 2]
            .map(e => filteredNodes[delaunay.triangles[e]]))
}
