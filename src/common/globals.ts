import { Blueprint } from '../factorio-data/blueprint'
import { ToolbarContainer } from '../panels/toolbar'
import { QuickbarContainer } from '../panels/quickbar'
import { BlueprintContainer } from '../containers/blueprint'
import { Book } from '../factorio-data/book'
import Dialog from '../controls/dialog'
import Entity from '../factorio-data/entity'

// tslint:disable:prefer-const

let hr = false

let app: PIXI.Application

let toolbarContainer: ToolbarContainer
let quickbarContainer: QuickbarContainer
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

const openDialogs: Dialog[] = []

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

let copyData: Entity

let renderOnly = false

const colors = {
    text: {
        normal: 0xFAFAFA,
        link: 0x03A9F4,
        accent: 0xFF8A65
    },
    controls : {
        button: {
            border: 1,
            background: { color: 0x646464, alpha: 1 },
            hover: { color: 0xB16925, alpha: 0.5 },
            active: { color: 0xB16925, alpha: 1 }
        },
        checkbox: {
            foreground: {color: 0xCCCCCC },
            background: {color: 0xCCCCCC, alpha: 0.5 },
            checkmark: {color: 0x000000, alpha: 1 },
            hover: { color: 0xB16925, alpha: 0.7 }
        },
        panel: {
            background: { color: 0x3A3A3A, alpha: 0.7, border: 2 }
        },
        slot: {
            hover: { color: 0xCCCCCC }
        },
        switch: {
            background: { color: 0x58585A, p0: 15, p1: 5, p2: -10, p3: -50 },
            hover: { color: 0xB16925, p0: 15, p1: 5, p2: -10, p3: -50 },
            line: { color: 0x646464, p0: -25, p1: -50, p2: 25, p3: 0 }
        },
        textbox: {
            foreground: { color: 0x000000 },
            background: { color: 0x646464, alpha: 1 },
            hover: { color: 0xCCCCCC, alpha: 0.5 },
            active: { color: 0xEEEEEE, alpha: 1 }
        },
        enable: {
            text: { color: 0xFAFAFA },
            hover: { color: 0xFFBA7A },
            active: { color: 0xFF9E44 }
        }
    },
    dialog: {
        background: { color: 0x3A3A3A, alpha: 0.7, border: 2 },
        line: { background: { color: 0x646464, alpha: 0.7, border: 1 } }
    },
    editor: {
        sprite: { background: { color: 0x646464, alpha: 0.7 } }
    },
    quickbar: {
        background: { color: 0x3A3A3A, alpha: 0.7, border: 2 }
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

const styles = {
    controls: {
        checkbox: new PIXI.TextStyle({
            fill: colors.controls.checkbox.foreground.color,
            fontFamily: [ fontFamily ],
            fontWeight: '100',
            fontSize: 14
        }),
        textbox: new PIXI.TextStyle({
            fill: colors.controls.textbox.foreground.color,
            fontFamily: [ fontFamily ],
            fontWeight: '500',
            fontSize: 14
        }),
        enable: {
            text: new PIXI.TextStyle({
                fill: colors.controls.enable.text.color,
                fontFamily: [ fontFamily ],
                fontWeight: '500',
                fontSize: 14
            }),
            hover: new PIXI.TextStyle({
                fill: colors.controls.enable.hover.color,
                fontFamily: [ fontFamily ],
                fontWeight: '500',
                fontSize: 14
            }),
            active: new PIXI.TextStyle({
                fill: colors.controls.enable.active.color,
                fontFamily: [ fontFamily ],
                fontWeight: '500',
                fontSize: 14
            })
        }
    },
    dialog: {
        title: new PIXI.TextStyle({
            fill: colors.text.normal,
            fontFamily: [ fontFamily ],
            fontWeight: '500',
            fontSize: 20
        }),
        label: new PIXI.TextStyle({
            fill: colors.text.normal,
            fontFamily: [ fontFamily ],
            fontWeight: '100',
            fontSize: 14
        })
    },
    icon: {
        amount: new PIXI.TextStyle({
            fill: colors.text.normal,
            fontFamily: [ fontFamily ],
            fontWeight: '500',
            fontSize: 13,
            stroke: 0x000000,
            strokeThickness: 2
        })
    }
}

export default {
    hr,
    renderOnly,
    copyData,
    openDialogs,
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
    moveSpeed,
    quickbarRows,
    loadingScreen,
    colors,
    fontFamily,
    styles
}
