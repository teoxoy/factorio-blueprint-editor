const duplicate = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

const getRandomInt = (min: number, max: number): number => {
    const MIN = Math.ceil(min)
    const MAX = Math.floor(max)
    return Math.floor(Math.random() * (MAX - MIN)) + MIN
}

const getRandomItem = <T>(array: T[]): T => array[getRandomInt(0, array.length - 1)]

const rotatePointBasedOnDir = (p: IPoint | number[], dir: number): IPoint => {
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
const getRelativeDirection = (position: IPoint): 0 | 2 | 4 | 6 => {
    if (Math.abs(position.x) > Math.abs(position.y)) {
        return Math.sign(position.x) === 1 ? 2 : 6
    } else {
        return Math.sign(position.y) === 1 ? 4 : 0
    }
}

const transformConnectionPosition = (position: IPoint, direction: number): IPoint => {
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

const switchSizeBasedOnDirection = (
    size: {
        width: number
        height: number
    },
    direction: number
): IPoint => {
    if (size.width !== size.height && (direction === 2 || direction === 6)) {
        return { x: size.height, y: size.width }
    }
    return { x: size.width, y: size.height }
}

const intToDir = (i: number): 'north' | 'east' | 'south' | 'west' => {
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

const nearestPowerOf2 = (n: number): number => Math.pow(2, Math.ceil(Math.log2(n)))

const uniqueInArray = <T>(array: T[]): T[] => [...new Set(array)]

const equalArrays = <T>(array1: T[], array2: T[]): boolean =>
    array1 &&
    array2 &&
    array1.length === array2.length &&
    array1.sort().every((value, index) => value === array2.sort()[index])

const areObjectsEquivalent = <T extends Record<string, any>>(a: T, b: T): boolean => {
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

const timer = (
    name: string
): {
    stop: () => void
} => {
    const start = new Date()
    return {
        stop: () => {
            const end = new Date()
            const time = end.getTime() - start.getTime()
            console.log('Timer:', name, 'finished in', time, 'ms')
        },
    }
}

class Deferred {
    public resolve: () => void
    public promise: Promise<void>
    public constructor() {
        this.reset()
    }
    public reset(): void {
        this.promise = new Promise(r => {
            this.resolve = r
        })
    }
}

const objectHasOwnProperty = (obj: Record<string, unknown>, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(obj, key)

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
    timer,
    Deferred,
    objectHasOwnProperty,
}
