import * as PIXI from 'pixi.js'
import { Blueprint } from '../core/Blueprint'
import { UIContainer } from '../UI/UIContainer'
import { BlueprintContainer } from '../containers/BlueprintContainer'
import { DynamicSpritesheet } from '../containers/DynamicSpritesheet'

const hr = true
const debug = false

let app: PIXI.Application
let BPC: BlueprintContainer
let UI: UIContainer
let bp: Blueprint
/** general purpose dynamic spritesheet */
const sheet = new DynamicSpritesheet()
/** tiles only dynamic spritesheet */
const sheet2 = new DynamicSpritesheet({
    extrude: true,
    alpha: false,
})

export default {
    debug,
    hr,
    BPC,
    UI,
    app,
    bp,
    sheet,
    sheet2,
}
