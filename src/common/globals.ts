import * as PIXI from 'pixi.js'
import Blueprint from '../factorio-data/blueprint'
import { ToolbarContainer } from '../panels/toolbar'
import { QuickbarContainer } from '../panels/quickbar'
import { BlueprintContainer } from '../containers/blueprint'
import { Book } from '../factorio-data/book'

const quality = {
    hr: true,
    compressed: true
}

let app: PIXI.Application

let toolbarContainer: ToolbarContainer
let quickbarContainer: QuickbarContainer
let dialogsContainer: PIXI.Container
let paintIconContainer: PIXI.Container
let BPC: BlueprintContainer

const loadingScreen = {
    el: document.getElementById('loadingScreen'),
    show() {
        this.el.classList.add('active')
    },
    hide() {
        this.el.classList.remove('active')
    }
}

let railMoveOffset: IPoint = { x: 0, y: 0 }

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
let book: Book

const mouseStates = {
    NONE: 0,
    PAINTING: 1,
    PANNING: 2
}

let currentMouseState = mouseStates.NONE

let renderOnly = false

const colors = {
    text: {
        normal: 0xfafafa,
        link: 0x03a9f4,
        accent: 0xff8a65
    },
    controls: {
        button: {
            border: 1,
            background: { color: 0x646464, alpha: 1 },
            hover: { color: 0xb16925, alpha: 0.5 },
            active: { color: 0xb16925, alpha: 1 }
        },
        checkbox: {
            foreground: { color: 0xcccccc },
            background: { color: 0xcccccc, alpha: 0.5 },
            checkmark: { color: 0x000000, alpha: 1 },
            hover: { color: 0xb16925, alpha: 0.7 }
        },
        enable: {
            text: { color: 0xfafafa },
            hover: { color: 0xffba7a },
            active: { color: 0xff9e44 }
        },
        panel: {
            background: { color: 0x3a3a3a, alpha: 0.7, border: 2 }
        },
        slider: {
            slidebar: { color: 0xe2e2e2, p0: -95, p1: -80, p2: -10, p3: 0 },
            button: { color: 0x58585a, p0: 15, p1: 5, p2: -10, p3: -50 },
            hover: { color: 0xb16925, p0: 15, p1: 5, p2: -10, p3: -50 },
            value: { color: 0xb16925, p0: 15, p1: 5, p2: -10, p3: -50 }
        },
        slot: {
            hover: { color: 0xcccccc }
        },
        switch: {
            background: { color: 0x58585a, p0: 15, p1: 5, p2: -10, p3: -50 },
            hover: { color: 0xb16925, p0: 15, p1: 5, p2: -10, p3: -50 },
            line: { color: 0x646464, p0: -25, p1: -50, p2: 25, p3: 0 }
        },
        textbox: {
            foreground: { color: 0x000000 },
            background: { color: 0xe2e2e2, alpha: 1 },
            active: { color: 0xeeeeee, alpha: 1 }
        }
    },
    dialog: {
        background: { color: 0x3a3a3a, alpha: 0.7, border: 2 },
        line: { background: { color: 0x646464, alpha: 0.7, border: 1 } }
    },
    editor: {
        sprite: { background: { color: 0x646464, alpha: 0.7 } }
    },
    quickbar: {
        background: { color: 0x3a3a3a, alpha: 0.7, border: 2 }
    },

    _darkTheme: true,
    _tintsToChange: [] as PIXI.Sprite[],
    pattern: 'checker' as 'checker' | 'grid',
    get darkTheme() {
        return this._darkTheme
    },
    set darkTheme(value: boolean) {
        this._darkTheme = value
        this._tintsToChange.forEach((s: PIXI.Sprite) => {
            s.tint = value ? 0x303030 : 0xc9c9c9
        })
    },
    addSpriteForAutomaticTintChange(sprite: PIXI.Sprite) {
        sprite.tint = this.darkTheme ? 0x303030 : 0xc9c9c9
        this._tintsToChange.push(sprite)
    }
}

const fontFamily = "'Roboto', sans-serif"

const styles = {
    controls: {
        checkbox: new PIXI.TextStyle({
            fill: colors.controls.checkbox.foreground.color,
            fontFamily: [fontFamily],
            fontWeight: '300',
            fontSize: 14
        }),
        enable: {
            text: new PIXI.TextStyle({
                fill: colors.controls.enable.text.color,
                fontFamily: [fontFamily],
                fontWeight: '500',
                fontSize: 14
            }),
            hover: new PIXI.TextStyle({
                fill: colors.controls.enable.hover.color,
                fontFamily: [fontFamily],
                fontWeight: '500',
                fontSize: 14
            }),
            active: new PIXI.TextStyle({
                fill: colors.controls.enable.active.color,
                fontFamily: [fontFamily],
                fontWeight: '500',
                fontSize: 14
            })
        },
        textbox: new PIXI.TextStyle({
            fill: colors.controls.textbox.foreground.color,
            fontFamily: [fontFamily],
            fontWeight: '500',
            fontSize: 14
        })
    },
    dialog: {
        title: new PIXI.TextStyle({
            fill: colors.text.normal,
            fontFamily: [fontFamily],
            fontWeight: '500',
            fontSize: 20
        }),
        label: new PIXI.TextStyle({
            fill: colors.text.normal,
            fontFamily: [fontFamily],
            fontWeight: '300',
            fontSize: 14
        })
    },
    icon: {
        amount: new PIXI.TextStyle({
            fill: colors.text.normal,
            fontFamily: [fontFamily],
            fontWeight: '500',
            fontSize: 13,
            stroke: 0x000000,
            strokeThickness: 2
        })
    }
}

let oilOutpostSettings = {
    DEBUG: false,
    PUMPJACK_MODULE: 'productivity_module_3',
    MIN_GAP_BETWEEN_UNDERGROUNDS: 1,
    BEACONS: true,
    MIN_AFFECTED_ENTITIES: 1,
    BEACON_MODULE: 'speed_module_3'
}

export default {
    quality,
    renderOnly,
    BPC,
    app,
    toolbarContainer,
    quickbarContainer,
    dialogsContainer,
    paintIconContainer,
    bpArea,
    positionBPContainer,
    sizeBPContainer,
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
    styles,
    oilOutpostSettings
}
