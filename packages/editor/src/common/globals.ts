import * as PIXI from 'pixi.js'
import Blueprint from '../factorio-data/blueprint'
import { BlueprintContainer } from '../containers/blueprint'
import UIContainer from '../UI/ui'

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
