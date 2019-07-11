import keyboardJS from 'keyboardjs'

// Set the general application keyboard context
// Needed to have seperate context's for input controls (i.e. Textbox)
keyboardJS.setContext('editor')

const canvasEl = document.getElementById('editor') as HTMLCanvasElement

// Bind the events on the canvas
keyboardJS.watch(canvasEl)

// keyboardJS.watch will bind keydown and keyup events on the canvas but
// keydown and keyup will only fire if the canvas is focused
canvasEl.addEventListener('mouseover', () => canvasEl.focus())
canvasEl.addEventListener('blur', () => {
    keyboardJS.releaseAllKeys()
})

// Hack for plugging the mouse into keyboardJS
keyboardJS._locale.bindKeyCode(300, ['lclick'])
keyboardJS._locale.bindKeyCode(301, ['mclick'])
keyboardJS._locale.bindKeyCode(302, ['rclick'])
keyboardJS._locale.bindKeyCode(303, ['wheelNeg'])
keyboardJS._locale.bindKeyCode(304, ['wheelPos'])
canvasEl.addEventListener('mousedown', e => keyboardJS.pressKey(e.button + 300, e))
// attach mouseup to window so that releaseKey will be called even when mouseup is fired from outside the window
window.addEventListener('mouseup', e => keyboardJS.releaseKey(e.button + 300, e))

canvasEl.addEventListener('wheel', e => {
    e.preventDefault()
    keyboardJS.pressKey(Math.sign(-e.deltaY) === 1 ? 303 : 304, e)
    keyboardJS.releaseKey(Math.sign(-e.deltaY) === 1 ? 303 : 304, e)
})

/**
 * Passes trough all events to the callback
 * @param cb Callback - return true if you want to stop the passtrough
 */
function passtroughAllEvents(cb: (e: keyboardJS.KeyEvent) => boolean) {
    keyboardJS.setContext('passtrough')
    const callback = (e: keyboardJS.KeyEvent) => {
        const stop = cb(e)
        if (stop) {
            keyboardJS.unbind(undefined, callback)
            keyboardJS.setContext('editor')
        }
    }
    keyboardJS.bind(undefined, callback)
}

class Action {
    readonly defaultKeyCombo: string

    private m_active = true
    private m_keyCombo: string
    private handlers: {
        press(e?: keyboardJS.KeyEvent): void
        release(e?: keyboardJS.KeyEvent): void
    }[] = []
    private _pressed = false

    constructor(defaultKeyCombo: string) {
        this.defaultKeyCombo = defaultKeyCombo
        this.m_keyCombo = defaultKeyCombo

        this.bind(
            () => {
                this._pressed = true
            },
            () => {
                this._pressed = false
            }
        )
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

    get pressed() {
        return this._pressed
    }

    get usesDefaultKeyCombo() {
        return this.keyCombo === this.defaultKeyCombo
    }

    resetKeyCombo() {
        this.keyCombo = this.defaultKeyCombo
    }

    bind(
        pressHandler?: (e: keyboardJS.KeyEvent) => void,
        releaseHandler?: (e: keyboardJS.KeyEvent) => void,
        once = false,
        preventRepeat = false
    ) {
        let pressHandlerRanOnce = false

        // Wrap pressHandler to preventDefault
        const PRESS = pressHandler
            ? (e: keyboardJS.KeyEvent) => {
                  if (preventRepeat && pressHandlerRanOnce) {
                      return
                  }
                  pressHandlerRanOnce = true
                  if (e && e.preventDefault) {
                      e.preventDefault()
                  }
                  pressHandler(e)
              }
            : undefined

        // Wrap releaseHandler for once
        const RELEASE = releaseHandler
            ? (e: keyboardJS.KeyEvent) => {
                  pressHandlerRanOnce = false
                  if (once) {
                      keyboardJS.unbind(this.keyCombo, handlerData.press, handlerData.release)
                      this.handlers = this.handlers.filter(h => h !== handlerData)
                  }
                  releaseHandler(e)
              }
            : () => {
                  pressHandlerRanOnce = false
              }

        if (this.active) {
            keyboardJS.bind(this.keyCombo, PRESS, RELEASE)
        }
        const handlerData = {
            press: PRESS,
            release: RELEASE
        }
        this.handlers.push(handlerData)
    }

    unbindAll() {
        this.handlers.forEach(h => keyboardJS.unbind(this.keyCombo, h.press, h.release))
        this.handlers = []
    }

    call() {
        this.handlers.forEach(h => h.press())
    }
}

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

    moveUp: new Action('w'),
    moveLeft: new Action('a'),
    moveDown: new Action('s'),
    moveRight: new Action('d'),

    inventory: new Action('e'),
    build: new Action('lclick'),
    mine: new Action('rclick'),
    copyEntitySettings: new Action('shift+rclick'),
    pasteEntitySettings: new Action('shift+lclick'),
    /** Used for highlighting the source entity */
    tryPasteEntitySettings: new Action('shift'),
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

    importKeybinds(keybinds: Record<string, string>) {
        if (!keybinds) {
            return
        }
        actions.forEachAction((action, actionName) => {
            if (keybinds[actionName] !== undefined) {
                action.keyCombo = keybinds[actionName]
            }
        })
    },

    exportKeybinds(changedOnly = true) {
        const changedKeybinds: Record<string, string> = {}
        actions.forEachAction((action, actionName) => {
            if (!changedOnly || !action.usesDefaultKeyCombo) {
                changedKeybinds[actionName] = action.keyCombo
            }
        })
        return changedKeybinds
    }
}

export { passtroughAllEvents }
export default actions
