function duplicate(obj: any) {
    return JSON.parse(JSON.stringify(obj))
}

function set_shift(shift: any, tab: any) {
    tab.shift = shift
    if (tab.hr_version) {
        tab.hr_version.shift = shift
    }
    return tab
}

function add_to_shift(shift: any, tab: any) {
    const SHIFT = shift.constructor === Object ? [shift.x, shift.y] : shift

    tab.shift = tab.shift ? [SHIFT[0] + tab.shift[0], SHIFT[1] + tab.shift[1]] : SHIFT
    if (tab.hr_version) {
        tab.hr_version.shift = tab.hr_version.shift ?
            [SHIFT[0] + tab.hr_version.shift[0], SHIFT[1] + tab.hr_version.shift[1]] :
            SHIFT
    }
    return tab
}

function set_property(img: any, key: string, val: any) {
    img[key] = val
    if (img.hr_version) {
        img.hr_version[key] = val
    }
    return img
}

function set_property_using(img: any, key: any, key2: any, mult = 1) {
    if (key2) {
        img[key] = img[key2] * mult
        if (img.hr_version) {
            img.hr_version[key] = img.hr_version[key2] * mult
        }
    }
    return img
}

function duplicateAndSetPropertyUsing(img: any, key: any, key2: any, mult: number) {
    return set_property_using(this.duplicate(img), key, key2, mult)
}

function getRandomInt(min: number, max: number) {
    const MIN = Math.ceil(min)
    const MAX = Math.floor(max)
    return Math.floor(Math.random() * (MAX - MIN)) + MIN
}

function rotatePointBasedOnDir(p: IPoint | number[], dir: number) {
    const point: IPoint = {x: 0, y: 0}
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

function transformConnectionPosition(position: IPoint, direction: number) {
    const dir = Math.abs(position.x) > Math.abs(position.y) ?
        (Math.sign(position.x) === 1 ? 2 : 6) :
        (Math.sign(position.y) === 1 ? 4 : 0)
    switch (dir) {
        case 0: position.y += 1; break
        case 2: position.x -= 1; break
        case 4: position.y -= 1; break
        case 6: position.x += 1
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
        case 0: return 'north'
        case 2: return 'east'
        case 4: return 'south'
        case 6: return 'west'
    }
}

function nearestPowerOf2(n: number) {
    return Math.pow(2, Math.ceil(Math.log2(n)))
}

function uniqueInArray(array: any[]) {
    return [...new Set(array)]
}

function equalArrays(array1: any[], array2: any[]) {
    return array1 && array2 && array1.length === array2.length &&
        array1.sort().every((value, index) => value === array2.sort()[index])
}

function areObjectsEquivalent(a: { [key: string]: any }, b: { [key: string]: any }) {
    const aProps = Object.getOwnPropertyNames(a)
    const bProps = Object.getOwnPropertyNames(b)

    if (aProps.length !== bProps.length) return false

    for (const propName of aProps) if (a[propName] !== b[propName]) return false

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
    set_shift,
    set_property,
    set_property_using,
    add_to_shift,
    getRandomInt,
    duplicateAndSetPropertyUsing,
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
