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

function rotatePointBasedOnDir(p: any, dir: number) {
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

function switchSizeBasedOnDirection(defaultSize: { width: any; height: any }, direction: number) {
    if (defaultSize.width !== defaultSize.height && (direction === 2 || direction === 6)) {
        return { x: defaultSize.height, y: defaultSize.width }
    }
    return { x: defaultSize.width, y: defaultSize.height }
}

function findBPString(data: string) {
    const DATA = data.replace(/\s/g, '')

    if (DATA[0] === '0') return new Promise(resolve => resolve(DATA))

    // function isUrl(url: string) {
    //     try { return Boolean(new URL(url)) }
    //     catch (e) { return false }
    // }

    return new Promise(resolve => resolve(new URL(DATA))).then((url: URL) => {
        console.log(`Loading data from: ${url}`)
        const pathParts = url.pathname.slice(1).split('/')
        switch (url.hostname.split('.')[0]) {
            case 'pastebin':
            case 'hastebin':
                return fetchData(`${url.hostname}/raw/${pathParts[0]}`).then(r => r.text())
            case 'gist':
                return fetchData(`api.github.com/gists/${pathParts[1]}`).then(r =>
                    r.json().then(data => data.files[Object.keys(data.files)[0]].content)
                )
            case 'gitlab':
                return fetchData(`${url}/raw`).then(r => r.text())
            case 'factorioprints':
                return fetchData(`facorio-blueprints.firebaseio.com/blueprints/${pathParts[1]}.json`).then(r =>
                    r.json().then(data => data.blueprintString)
                )
            case 'docs':
                return fetchData(`${url.toString().replace('/edit', '')}/export?format=txt`).then(r => r.text())
            default:
                return fetchData(url.toString()).then(r => r.text())
        }
        // TODO: maybe add dropbox support https://www.dropbox.com/s/ID?raw=1
    })

    function fetchData(url: string) {
        return fetch('https://allorigins.me/get?method=raw&url=' + url).then(response => {
            if (response.ok) return response
            throw new Error('Network response was not ok.')
        })
    }
}

export default {
    findBPString,
    duplicate,
    set_shift,
    set_property,
    set_property_using,
    add_to_shift,
    getRandomInt,
    duplicateAndSetPropertyUsing,
    rotatePointBasedOnDir,
    transformConnectionPosition,
    switchSizeBasedOnDirection
}
