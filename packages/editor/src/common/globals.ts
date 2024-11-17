import { Application } from '@pixi/app'
import { BaseTexture, Texture } from '@pixi/core'
import { Rectangle } from '@pixi/math'
import { Assets } from '@pixi/assets'
import { Blueprint } from '../core/Blueprint'
import { UIContainer } from '../UI/UIContainer'
import { BlueprintContainer } from '../containers/BlueprintContainer'

const hr = true
const debug = false

export interface ILogMessage {
    text: string
    type: 'success' | 'info' | 'warning' | 'error'
}

export type Logger = (msg: ILogMessage) => void

const logger: Logger = msg => {
    switch (msg.type) {
        case 'error':
            console.error(msg.text)
            break
        case 'warning':
            console.warn(msg.text)
            break
        case 'info':
            console.info(msg.text)
            break
        case 'success':
            console.log(msg.text)
            break
    }
}

let app: Application<HTMLCanvasElement>
let BPC: BlueprintContainer
let UI: UIContainer
let bp: Blueprint

const started = new Map<string, Promise<BaseTexture>>()
const textureCache = new Map<string, Texture>()

let count = 0
let T: number

function getBT(path: string): Promise<BaseTexture> {
    if (count === 0) {
        T = performance.now()
    }
    count += 1
    return Assets.load(path).then(bt => {
        count -= 1
        if (count <= 0) {
            console.log('done', performance.now() - T)
        }
        return bt
    })
}

function getTexture(path: string, x = 0, y = 0, w = 0, h = 0): Texture {
    const key = `${import.meta.env.VITE_DATA_PATH}/${path.replace('.png', '.basis')}`
    const KK = `${key}-${x}-${y}-${w}-${h}`
    let t = textureCache.get(KK)
    if (t) return t
    t = new Texture(Texture.EMPTY.baseTexture)
    textureCache.set(KK, t)
    let prom = started.get(key)
    if (!prom) {
        prom = getBT(key)
        started.set(key, prom)
    }
    prom.then(
        bt => {
            t.baseTexture = bt
            t.frame = new Rectangle(x, y, w || bt.width, h || bt.height)
        },
        err => console.error(err)
    )
    return t
}

export default {
    debug,
    hr,
    BPC,
    UI,
    app,
    bp,
    getTexture,
    logger,
}
