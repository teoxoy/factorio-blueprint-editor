import keyboardJS from 'keyboardjs'

class Action {
    readonly defaultKeyCombo: string

    private m_active = true
    private m_keyCombo: string
    private handlers: {
        press(e?: keyboardJS.KeyEvent): void
        release(e?: keyboardJS.KeyEvent): void
    }[] = []

    constructor(defaultKeyCombo: string) {
        this.defaultKeyCombo = defaultKeyCombo
        this.m_keyCombo = defaultKeyCombo
    }

    private get active() {
        return this.m_active
    }

    private set active(value: boolean) {
        if (value) {
            this.handlers.forEach(h => keyboardJS.bind(this.keyCombo, h.press, h.release))
        } else {
            this.handlers.forEach(h => keyboardJS.unbind(this.keyCombo, h.press, h.release))
        }
        this.m_active = value
    }

    get keyCombo() {
        return this.m_keyCombo
    }

    set keyCombo(value: string) {
        if (!this.active && value.length !== 0) {
            this.active = true
        }

        if (value.length === 0) {
            this.active = false
        } else {
            this.handlers.forEach(h => {
                keyboardJS.unbind(this.keyCombo, h.press, h.release)
                keyboardJS.bind(value, h.press, h.release)
            })
        }

        this.m_keyCombo = value
    }

    get usesDefaultKeyCombo() {
        return this.keyCombo === this.defaultKeyCombo
    }

    resetKeyCombo() {
        this.keyCombo = this.defaultKeyCombo
    }

    bind(pressHandler?: (e: keyboardJS.KeyEvent) => void, releaseHandler?: (e: keyboardJS.KeyEvent) => void) {
        // Wrap pressHandler to preventDefault
        const PRESSED = pressHandler
            ? (e: keyboardJS.KeyEvent) => {
                  if (e && e.preventDefault) {
                      e.preventDefault()
                  }
                  pressHandler(e)
              }
            : undefined

        if (this.active) {
            keyboardJS.bind(this.keyCombo, PRESSED, releaseHandler)
        }
        this.handlers.push({
            press: PRESSED,
            release: releaseHandler
        })
    }

    unbind() {
        this.handlers.forEach(h => keyboardJS.unbind(this.keyCombo, h.press, h.release))
        this.handlers = []
    }

    call() {
        this.handlers.forEach(h => h.press())
    }
}

class ToggleAction extends Action {
    pressed = false

    constructor(defaultKeyCombo: string) {
        super(defaultKeyCombo)
        this.bind(
            () => {
                this.pressed = true
            },
            () => {
                this.pressed = false
            }
        )
    }
}

const canvasEl = document.getElementById('editor') as HTMLCanvasElement

// Bind the events on the canvas
keyboardJS.watch(canvasEl)

// keyboardJS.watch will bind keydown and keyup events on the canvas but
// keydown and keyup will only fire if the canvas is focused
canvasEl.addEventListener('mouseover', () => canvasEl.focus())
canvasEl.addEventListener('blur', () => {
    keyboardJS.releaseAllKeys()
})

// Set the general application keyboard context
// Needed to have seperate context's for input controls (i.e. Textbox)
keyboardJS.setContext('app')

const actions = {
    clear: new Action('shift+n'),
    focus: new Action('f'),
    takePicture: new Action('shift+s'),
    undo: new Action('modifier+z'),
    redo: new Action('modifier+y'),
    info: new Action('i'),
    pan: new Action('lclick'),
    zoomIn: new Action('wheelNeg'),
    zoomOut: new Action('wheelPos'),
    moveEntityUp: new Action('up'),
    moveEntityLeft: new Action('left'),
    moveEntityDown: new Action('down'),
    moveEntityRight: new Action('right'),
    generateOilOutpost: new Action('g'),

    moveUp: new ToggleAction('w'),
    moveLeft: new ToggleAction('a'),
    moveDown: new ToggleAction('s'),
    moveRight: new ToggleAction('d'),

    inventory: new Action('e'),
    build: new ToggleAction('lclick'),
    mine: new ToggleAction('rclick'),
    copyEntitySettings: new Action('shift+rclick'),
    pasteEntitySettings: new ToggleAction('shift+lclick'),
    openEntityGUI: new Action('lclick'),
    showInfo: new Action('alt'),
    pipette: new Action('q'),
    rotate: new Action('r'),
    reverseRotate: new Action('shift+r'),
    closeWindow: new Action('esc'),

    increaseTileBuildingArea: new Action(']'),
    decreaseTileBuildingArea: new Action('['),

    quickbar1: new Action('1'),
    quickbar2: new Action('2'),
    quickbar3: new Action('3'),
    quickbar4: new Action('4'),
    quickbar5: new Action('5'),
    quickbar6: new Action('shift+1'),
    quickbar7: new Action('shift+2'),
    quickbar8: new Action('shift+3'),
    quickbar9: new Action('shift+4'),
    quickbar10: new Action('shift+5'),
    changeActiveQuickbar: new Action('x'),

    copyBPString: {
        bind: (pressHandler?: (e: ClipboardEvent) => void) => {
            document.addEventListener('copy', (e: ClipboardEvent) => {
                if (document.activeElement !== canvasEl) {
                    return
                }
                e.preventDefault()
                pressHandler(e)
            })
        }
    },

    pasteBPString: {
        bind: (pressHandler?: (e: ClipboardEvent) => void) => {
            document.addEventListener('paste', (e: ClipboardEvent) => {
                if (document.activeElement !== canvasEl) {
                    return
                }
                e.preventDefault()
                pressHandler(e)
            })
        }
    },

    forEachAction(cb: (action: Action, actionName: string) => void) {
        for (const actionName in this) {
            if (this[actionName] instanceof Action) {
                cb(this[actionName], actionName)
            }
        }
    },

    // Hack for plugging the mouse into keyboardJS
    attachEventsToContainer(stage: PIXI.Container) {
        stage.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => keyboardJS.pressKey(e.data.button + 300, e))

        stage.on('pointerup', (e: PIXI.interaction.InteractionEvent) => keyboardJS.releaseKey(e.data.button + 300, e))

        stage.on('pointerupoutside', (e: PIXI.interaction.InteractionEvent) =>
            keyboardJS.releaseKey(e.data.button + 300, e)
        )
    }
}

canvasEl.addEventListener('wheel', e => {
    e.preventDefault()
    keyboardJS.pressKey(Math.sign(-e.deltaY) === 1 ? 303 : 304, e)
    keyboardJS.releaseKey(Math.sign(-e.deltaY) === 1 ? 303 : 304, e)
})

// Hack for plugging the mouse into keyboardJS
keyboardJS._locale.bindKeyCode(300, ['lclick'])
keyboardJS._locale.bindKeyCode(301, ['mclick'])
keyboardJS._locale.bindKeyCode(302, ['rclick'])
keyboardJS._locale.bindKeyCode(303, ['wheelNeg'])
keyboardJS._locale.bindKeyCode(304, ['wheelPos'])

function loadKeybinds() {
    const changedKeybinds = JSON.parse(localStorage.getItem('keybinds'))
    if (!changedKeybinds) {
        return
    }
    actions.forEachAction((action, actionName) => {
        if (changedKeybinds[actionName] !== undefined) {
            action.keyCombo = changedKeybinds[actionName]
        }
    })
}

loadKeybinds()

function saveKeybinds() {
    const changedKeybinds: { [key: string]: string } = {}
    actions.forEachAction((action, actionName) => {
        if (!action.usesDefaultKeyCombo) {
            changedKeybinds[actionName] = action.keyCombo
        }
    })
    if (Object.keys(changedKeybinds).length) {
        localStorage.setItem('keybinds', JSON.stringify(changedKeybinds))
    } else {
        localStorage.removeItem('keybinds')
    }
}

window.addEventListener('unload', saveKeybinds)

export default actions
