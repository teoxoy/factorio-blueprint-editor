import { Application, Texture, Assets, Renderer } from 'pixi.js'
import { Blueprint } from '../core/Blueprint'
import { UIContainer } from '../UI/UIContainer'
import { BlueprintContainer } from '../containers/BlueprintContainer'
import { ActionRegistry } from '../actions'

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

let app: Application<Renderer<HTMLCanvasElement>>
let BPC: BlueprintContainer
let UI: UIContainer
let bp: Blueprint
let actions: ActionRegistry

const started = new Map<string, Promise<Texture>>()
const textureCache = new Map<string, Texture>()

let count = 0
let T: number

function getBT(path: string): Promise<Texture> {
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
    const key = `/data/${path.replace('.png', '.basis')}`
    const KK = `${key}-${x}-${y}-${w}-${h}`
    let t = textureCache.get(KK)
    if (t) return t
    t = new Texture({ source: Texture.EMPTY.source, dynamic: true })
    t.noFrame = false
    textureCache.set(KK, t)
    let prom = started.get(key)
    if (!prom) {
        prom = getBT(key)
        started.set(key, prom)
    }
    prom.then(
        bt => {
            t.source = bt.source
            t.frame.x = x
            t.frame.y = y
            t.frame.width = w || bt.width
            t.frame.height = h || bt.height
            t.update()
            t.dynamic = false
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
    actions,
    getTexture,
    logger,
}
