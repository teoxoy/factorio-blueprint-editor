import { Blueprint } from './factorio-data/blueprint'
import { ToolbarContainer } from './containers/toolbar'
import { BlueprintContainer } from './containers/blueprint'
import { EditEntityContainer } from './containers/editEntity'
import { InventoryContainer } from './containers/inventory'

// tslint:disable:prefer-const

let app: PIXI.Application

let toolbarContainer: ToolbarContainer
let editEntityContainer: EditEntityContainer
let inventoryContainer: InventoryContainer
let BPC: BlueprintContainer

let gridCoordsOfCursor: IPoint = { x: 0, y: 0 }
let gridCoords16: IPoint = { x: 0, y: 0 }
let railMoveOffset: IPoint = { x: 0, y: 0 }

let openedGUIWindow: InventoryContainer | EditEntityContainer | undefined

const positionBPContainer = {
    x: 0,
    y: 32
}

const bpArea = {
    width: 400,
    height: 400
}

const sizeBPContainer = {
    width: bpArea.width * 32,
    height: bpArea.height * 32
}

let bp: Blueprint

const mouseStates = {
    NONE: 0,
    MOVING: 1,
    PAINTING: 2,
    PANNING: 3
}

const keyboard = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false
}

let currentMouseState = mouseStates.NONE

const copyData = {
    recipe: '',
    modules: []
}

let renderOnly = false

const UIColors = {
    primary: 0x303030,
    secondary: 0x181818,
    text: 0xFAFAFA,
    link: 0x03A9F4,
    accent: 0xFF8A65,
    background: 0x3A3A3A,
    slot: 0x9E9E9E
}

const fontFamily = '\'Roboto\', sans-serif'

export default {
    renderOnly,
    copyData,
    openedGUIWindow,
    inventoryContainer,
    editEntityContainer,
    BPC,
    app,
    keyboard,
    toolbarContainer,
    bpArea,
    positionBPContainer,
    sizeBPContainer,
    gridCoordsOfCursor,
    railMoveOffset,
    gridCoords16,
    bp,
    mouseStates,
    currentMouseState,
    UIColors,
    fontFamily
}
