import keyboardJS from 'keyboardjs'

class Action {

    readonly defaultKeyCombo: string

    private m_active = true
    private m_keyCombo: string
    private handlers: Array<{
        press(e: keyboardJS.KeyEvent): void;
        release(e: keyboardJS.KeyEvent): void;
    }> = []

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
            ? (e: keyboardJS.KeyEvent) => { e.preventDefault(); pressHandler(e) }
            : undefined

        if (this.active) keyboardJS.bind(this.keyCombo, PRESSED, releaseHandler)
        this.handlers.push({
            press: PRESSED,
            release: releaseHandler
        })
    }

    unbind() {
        this.handlers.forEach(h => keyboardJS.unbind(this.keyCombo, h.press, h.release))
        this.handlers = []
    }
}

class ToggleAction extends Action {
    pressed = false

    constructor(defaultKeyCombo: string) {
        super(defaultKeyCombo)
        this.bind(() => this.pressed = true, () => this.pressed = false)
    }
}

const actions = {
    clear: new Action('shift+n'),
    focus: new Action('f'),
    picture: new Action('shift+s'),
    undo: new Action('modifier+z'),
    redo: new Action('modifier+y'),
    info: new Action('i'),

    moveUp: new ToggleAction('w'),
    moveLeft: new ToggleAction('a'),
    moveDown: new ToggleAction('s'),
    moveRight: new ToggleAction('d'),

    inventory: new Action('e'),
    copyPasteEntitySettings: new ToggleAction('shift'),
    showInfo: new Action('alt'),
    pippete: new Action('q'),
    rotate: new Action('r'),
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

    moving() {
        return this.moveUp.pressed !== this.moveDown.pressed ||
            this.moveLeft.pressed !== this.moveRight.pressed
    },

    forEachAction(cb: (action: Action, actionName: string) => void) {
        for (const actionName in this) {
            if (this[actionName] instanceof Action) {
                cb(this[actionName], actionName)
            }
        }
    },

    disableOnElementFocus(element: HTMLElement) {
        element.addEventListener('focus', keyboardJS.pause.bind(keyboardJS))
        element.addEventListener('blur', keyboardJS.resume.bind(keyboardJS))
    }
}

function loadKeybinds() {
    const changedKeybinds = JSON.parse(localStorage.getItem('keybinds'))
    if (!changedKeybinds) return
    actions.forEachAction((action, actionName) => {
        if (changedKeybinds[actionName] !== undefined) {
            action.keyCombo = changedKeybinds[actionName]
        }
    })
}

loadKeybinds()

function saveKeybinds() {
    const changedKeybinds = {}
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
