import { Blueprint } from '../factorio-data/blueprint'
import { ToolbarContainer } from '../panels/toolbar'
import { QuickbarContainer } from '../panels/quickbar'
import { BlueprintContainer } from '../containers/blueprint'
import { EditEntityContainer } from '../panels/editEntity'
import { InventoryContainer } from '../panels/inventory'
import { Book } from '../factorio-data/book'
import Dialog from '../controls/dialog'

// tslint:disable:prefer-const

let hr = false

let app: PIXI.Application

let toolbarContainer: ToolbarContainer
let quickbarContainer: QuickbarContainer
let editEntityContainer: EditEntityContainer
let inventoryContainer: InventoryContainer
let BPC: BlueprintContainer

const loadingScreen = {
    el: document.getElementById('loadingScreen'),
    show() { this.el.classList.add('active') },
    hide() { this.el.classList.remove('active') }
}

const gridData = {
    x: 0,
    y: 0,
    x16: 0,
    y16: 0,
    _callbacks: [] as Array<() => void>,
    _lastMousePos: { x: 0, y: 0 },

    onUpdate(cb: () => void) {
        this._callbacks.push(cb)
    },
    get position() {
        return { x: this.x16 * 16, y: this.y16 * 16 }
    },
    calculateRotationOffset(position: IPoint) {
        return {
            x: (position.x / 16 - this.x16) === 0 ? 0.5 : -0.5,
            y: (position.y / 16 - this.y16) === 0 ? 0.5 : -0.5
        }
    },

    recalculate(BPC: BlueprintContainer) {
        this.update(this._lastMousePos.x, this._lastMousePos.y, BPC)
    },
    update(x: number, y: number, BPC: BlueprintContainer) {
        this._lastMousePos = { x, y }
        const mousePositionInBP = {
            x: Math.abs(BPC.position.x - x) / BPC.viewport.getCurrentScale(),
            y: Math.abs(BPC.position.y - y) / BPC.viewport.getCurrentScale()
        }
        const gridCoordsOfCursor16 = {
            x: (mousePositionInBP.x - mousePositionInBP.x % 16) / 16,
            y: (mousePositionInBP.y - mousePositionInBP.y % 16) / 16
        }
        if (gridCoordsOfCursor16.x !== this.x16 || gridCoordsOfCursor16.y !== this.y16) {
            this.x = Math.floor(gridCoordsOfCursor16.x / 2)
            this.y = Math.floor(gridCoordsOfCursor16.y / 2)
            this.x16 = gridCoordsOfCursor16.x
            this.y16 = gridCoordsOfCursor16.y
            this._callbacks.forEach((cb: any) => cb())
        }
    }
}

let railMoveOffset: IPoint = { x: 0, y: 0 }

let openedGUIWindow: InventoryContainer | EditEntityContainer | Dialog | undefined

let moveSpeed = 10
let quickbarRows = 2

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
let book: Book | undefined

const mouseStates = {
    NONE: 0,
    MOVING: 1,
    PAINTING: 2,
    PANNING: 3
}

let currentMouseState = mouseStates.NONE

const copyData = {
    recipe: '',
    modules: []
}

let renderOnly = false

const colors = {
    text: {
        normal: 0xFAFAFA,
        link: 0x03A9F4,
        accent: 0xFF8A65
    },
    button: {
        background: 0x646464,
        hover: 0xB16925,
        active: 0xB16925
    },
    slot: {
        background: 0x646464,
        hover: 0xCCCCCC
    },
    textbox: {
        background: 0x646464,
        foreground: 0x000000,
        hover: 0xCCCCCC,
        active: 0xEEEEEE
    },
    dialog: {
        background: 0x3A3A3A
    },
    pannel: {
        background: 0x3A3A3A,
        slot: 0x808080,
        button: {
            background: 0x646464,
            rollover: 0xCCCCCC,
            active: 0xB16925
        }
    },
    _darkTheme: true,
    _tintsToChange: [] as PIXI.Sprite[],
    pattern: 'checker',
    get darkTheme() {
        return this._darkTheme
    },
    set darkTheme(value: boolean) {
        this._darkTheme = value
        this._tintsToChange.forEach(s => s.tint = value ? 0x303030 : 0xC9C9C9)
    },
    addSpriteForAutomaticTintChange(sprite: PIXI.Sprite) {
        sprite.tint = this.darkTheme ? 0x303030 : 0xC9C9C9
        this._tintsToChange.push(sprite)
    }
}

const fontFamily = '\'Roboto\', sans-serif'

export default {
    hr,
    renderOnly,
    copyData,
    openedGUIWindow,
    inventoryContainer,
    editEntityContainer,
    BPC,
    app,
    toolbarContainer,
    quickbarContainer,
    bpArea,
    positionBPContainer,
    sizeBPContainer,
    gridData,
    railMoveOffset,
    bp,
    book,
    mouseStates,
    currentMouseState,
    colors,
    fontFamily,
    moveSpeed,
    quickbarRows,
    loadingScreen
}
