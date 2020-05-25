import * as PIXI from 'pixi.js'
import Blueprint from '../core/Blueprint'
import { BlueprintContainer } from '../containers/BlueprintContainer'
import UIContainer from '../UI/UIContainer'

const hr = false
const debug = false

let app: PIXI.Application
let BPC: BlueprintContainer
let UI: UIContainer
let bp: Blueprint

export default {
    debug,
    hr,
    BPC,
    UI,
    app,
    bp
}
