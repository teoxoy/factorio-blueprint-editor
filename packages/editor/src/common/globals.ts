import * as PIXI from 'pixi.js'
import { Blueprint } from '../core/Blueprint'
import { UIContainer } from '../UI/UIContainer'
import { BlueprintContainer } from '../containers/BlueprintContainer'

const hr = true
const debug = false

let app: PIXI.Application
let BPC: BlueprintContainer
let UI: UIContainer
let bp: Blueprint

const started = new Map<string, Promise<PIXI.BaseTexture>>()
const textureCache = new Map<string, PIXI.Texture>()

let count = 0
let T: number

function getBT(path: string): Promise<PIXI.BaseTexture> {
    if (count === 0) {
        T = performance.now()
    }
    count += 1
    return new Promise((resolve, reject) => {
        const l = new PIXI.Loader()
        l.add(path, path).load((_, res) => {
            if (res[path].error) {
                reject(res[path].error)
            } else {
                resolve(PIXI.utils.BaseTextureCache[path])
            }
            count -= 1
            if (count <= 0) {
                console.log('done', performance.now() - T)
            }
        })
    })
}

function getTexture(path: string, x = 0, y = 0, w = 0, h = 0): PIXI.Texture {
    const key = `${STATIC_URL}${path.replace('.png', '.basis')}`
    const KK = `${key}-${x}-${y}-${w}-${h}`
    let t = textureCache.get(KK)
    if (t) return t
    t = new PIXI.Texture(PIXI.Texture.EMPTY.baseTexture)
    textureCache.set(KK, t)
    let prom = started.get(key)
    if (!prom) {
        prom = getBT(key)
        started.set(key, prom)
    }
    prom.then(
        bt => {
            t.baseTexture = bt
            t.frame = new PIXI.Rectangle(x, y, w || bt.width, h || bt.height)
        },
        err => console.error(err)
    )
    return t
}

const STATIC_URL = 'data/'

export default {
    STATIC_URL,
    debug,
    hr,
    BPC,
    UI,
    app,
    bp,
    getTexture,
}
