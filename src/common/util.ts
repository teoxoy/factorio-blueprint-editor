function duplicate<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
}

function getRandomInt(min: number, max: number) {
    const MIN = Math.ceil(min)
    const MAX = Math.floor(max)
    return Math.floor(Math.random() * (MAX - MIN)) + MIN
}

function getRandomItem<T>(array: T[]): T {
    return array[getRandomInt(0, array.length - 1)]
}

function rotatePointBasedOnDir(p: IPoint | number[], dir: number) {
    const point: IPoint = { x: 0, y: 0 }
    const nP = p instanceof Array ? { x: p[0], y: p[1] } : { ...p }
    switch (dir) {
        case 0:
            // x y
            point.x = nP.x
            point.y = nP.y
            break
        case 2:
            // -y x
            point.x = nP.y * -1
            point.y = nP.x
            break
        case 4:
            // -x -y
            point.x = nP.x * -1
            point.y = nP.y * -1
            break
        case 6:
            // y -x
            point.x = nP.y
            point.y = nP.x * -1
    }

    // if (retArray) return [point.x, point.y]
    return point
}

/** returns the direction of the point in relation to the origin at (0, 0) */
function getRelativeDirection(position: IPoint) {
    /* eslint-disable no-nested-ternary */
    return Math.abs(position.x) > Math.abs(position.y)
        ? Math.sign(position.x) === 1
            ? 2
            : 6
        : Math.sign(position.y) === 1
        ? 4
        : 0
    /* eslint-enable no-nested-ternary */
}

function transformConnectionPosition(position: IPoint, direction: number) {
    const dir = getRelativeDirection(position)
    switch (dir) {
        case 0:
            position.y += 1
            break
        case 2:
            position.x -= 1
            break
        case 4:
            position.y -= 1
            break
        case 6:
            position.x += 1
    }
    return rotatePointBasedOnDir(position, direction)
}

function switchSizeBasedOnDirection(defaultSize: { width: number; height: number }, direction: number) {
    if (defaultSize.width !== defaultSize.height && (direction === 2 || direction === 6)) {
        return { x: defaultSize.height, y: defaultSize.width }
    }
    return { x: defaultSize.width, y: defaultSize.height }
}

function intToDir(i: number) {
    switch (i) {
        case 0:
            return 'north'
        case 2:
            return 'east'
        case 4:
            return 'south'
        case 6:
            return 'west'
    }
}

function nearestPowerOf2(n: number) {
    return Math.pow(2, Math.ceil(Math.log2(n)))
}

function uniqueInArray<T>(array: T[]) {
    return [...new Set(array)]
}

function equalArrays<T>(array1: T[], array2: T[]) {
    return (
        array1 &&
        array2 &&
        array1.length === array2.length &&
        array1.sort().every((value, index) => value === array2.sort()[index])
    )
}

function areObjectsEquivalent(a: { [key: string]: unknown }, b: { [key: string]: unknown }) {
    const aProps = Object.getOwnPropertyNames(a)
    const bProps = Object.getOwnPropertyNames(b)

    if (aProps.length !== bProps.length) {
        return false
    }

    for (const propName of aProps) {
        if (a[propName] !== b[propName]) {
            return false
        }
    }

    return true
}

function timer(name: string) {
    const start = new Date()
    return {
        stop() {
            const end = new Date()
            const time = end.getTime() - start.getTime()
            console.log('Timer:', name, 'finished in', time, 'ms')
        }
    }
}

export default {
    duplicate,
    getRandomInt,
    getRandomItem,
    getRelativeDirection,
    rotatePointBasedOnDir,
    transformConnectionPosition,
    switchSizeBasedOnDirection,
    intToDir,
    nearestPowerOf2,
    uniqueInArray,
    equalArrays,
    areObjectsEquivalent,
    timer
}
