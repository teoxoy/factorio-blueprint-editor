import keyboardJS from 'keyboardjs'

function initActions(canvas: HTMLCanvasElement): void {
    // Set the general application keyboard context
    // Needed to have seperate context's for input controls (i.e. Textbox)
    // keyboardJS.setContext('editor')

    // Bind the events on the canvas
    // @ts-ignore
    keyboardJS.watch(canvas)

    // keyboardJS.watch will bind keydown and keyup events on the canvas but
    // keydown and keyup will only fire if the canvas is focused
    // canvas.addEventListener('mouseover', () => canvas.focus())
    window.addEventListener('blur', () => {
        keyboardJS.releaseAllKeys()
    })

    // Hack for plugging the mouse into keyboardJS
    // @ts-ignore
    // keyboardJS._locale.bindKeyCode(300, ['lclick'])
    // // @ts-ignore
    // keyboardJS._locale.bindKeyCode(301, ['mclick'])
    // // @ts-ignore
    // keyboardJS._locale.bindKeyCode(302, ['rclick'])
    // // @ts-ignore
    // keyboardJS._locale.bindKeyCode(303, ['wheelNeg'])
    // // @ts-ignore
    // keyboardJS._locale.bindKeyCode(304, ['wheelPos'])
    // canvas.addEventListener('pointerdown', e => {
    //     // @ts-ignore
    //     keyboardJS.pressKey(e.button + 300, e)
    // })
    // // attach mouseup to window so that releaseKey will be called even when mouseup is fired from outside the window
    // // @ts-ignore
    // window.addEventListener('pointerup', e => keyboardJS.releaseKey(e.button + 300, e))

    // canvas.addEventListener('wheel', e => {
    //     e.preventDefault()
    //     // @ts-ignore
    //     keyboardJS.pressKey(Math.sign(-e.deltaY) === 1 ? 303 : 304, e)
    //     // @ts-ignore
    //     keyboardJS.releaseKey(Math.sign(-e.deltaY) === 1 ? 303 : 304, e)
    // })
}

class Action {
    public readonly name: string
    private readonly defaultKeyCombo: string

    private m_active = true
    private m_keyCombo: string
    private handlers: {
        press: (e?: keyboardJS.KeyEvent) => void
        release: (e?: keyboardJS.KeyEvent) => void
    }[] = []
    private _pressed = false

    public constructor(name: string, defaultKeyCombo: string) {
        this.name = name
        this.defaultKeyCombo = defaultKeyCombo
        this.m_keyCombo = defaultKeyCombo

        this.bind({
            press: () => {
                this._pressed = true
            },
            release: () => {
                this._pressed = false
            },
        })
    }

    public get prettyName(): string {
        return this.name
            .split(/(?=[A-Z1-9])/)
            .join(' ')
            .replace(/(\b\w)/, c => c.toUpperCase())
    }

    private get active(): boolean {
        return this.m_active
    }

    private set active(value: boolean) {
        for (const h of this.handlers) {
            if (value) {
                keyboardJS.bind(this.keyCombo, h.press, h.release)
            } else {
                keyboardJS.unbind(this.keyCombo, h.press, h.release)
            }
        }
        this.m_active = value
    }

    public get keyCombo(): string {
        return this.m_keyCombo
    }

    public set keyCombo(value: string) {
        if (!this.active && value.length !== 0) {
            this.active = true
        }

        if (value.length === 0) {
            this.active = false
        } else {
            for (const h of this.handlers) {
                keyboardJS.unbind(this.keyCombo, h.press, h.release)
                keyboardJS.bind(value, h.press, h.release)
            }
        }

        this.m_keyCombo = value
    }

    public get pressed(): boolean {
        return this._pressed
    }

    public get usesDefaultKeyCombo(): boolean {
        return this.keyCombo === this.defaultKeyCombo
    }

    public resetKeyCombo(): void {
        this.keyCombo = this.defaultKeyCombo
    }

    public bind(opts: {
        /** Press Handler */
        press?: (e: keyboardJS.KeyEvent) => void
        /** Release Handler */
        release?: (e: keyboardJS.KeyEvent) => void
        /** Only runs both handlers once then removes them */
        once?: boolean
        /** Lets the press handler run multiple times per button press */
        repeat?: boolean
    }): void {
        if (opts.press === undefined && opts.release === undefined) return

        opts.once = opts.once || false
        opts.repeat = opts.repeat || false

        let pressHandlerRanOnce = false

        // Wrap pressHandler to preventDefault
        const PRESS = opts.press
            ? (e: keyboardJS.KeyEvent) => {
                  if (!opts.repeat && pressHandlerRanOnce) return
                  pressHandlerRanOnce = true
                  if (e && e.preventDefault) {
                      e.preventDefault()
                  }
                  opts.press(e)
              }
            : undefined

        // Wrap releaseHandler for once
        const RELEASE = opts.release
            ? (e: keyboardJS.KeyEvent) => {
                  pressHandlerRanOnce = false
                  if (opts.once) {
                      keyboardJS.unbind(this.keyCombo, handlerData.press, handlerData.release)
                      this.handlers = this.handlers.filter(h => h !== handlerData)
                  }
                  opts.release(e)
              }
            : () => {
                  pressHandlerRanOnce = false
              }

        if (this.active) {
            keyboardJS.bind(this.keyCombo, PRESS, RELEASE)
        }
        const handlerData = {
            press: PRESS,
            release: RELEASE,
        }
        this.handlers.push(handlerData)
    }

    public call(): void {
        for (const h of this.handlers) h.press()
    }
}

const actions = new Map<string, Action>()

function registerAction(name: string, keyCombo: string): Action {
    const action = new Action(name, keyCombo)
    actions.set(name, action)
    return action
}

function forEachAction(cb: (action: Action, actionName: string) => void): void {
    for (const [name, action] of actions) {
        cb(action, name)
    }
}

function resetKeybinds(): void {
    for (const [, action] of actions) {
        action.resetKeyCombo()
    }
}

function importKeybinds(keybinds: Record<string, string>): void {
    if (!keybinds) return
    for (const [name, action] of actions) {
        if (keybinds[name] !== undefined) {
            action.keyCombo = keybinds[name]
        }
    }
}

function exportKeybinds(changedOnly = true): Record<string, string> {
    const changedKeybinds: Record<string, string> = {}
    for (const [name, action] of actions) {
        if (!changedOnly || !action.usesDefaultKeyCombo) {
            changedKeybinds[name] = action.keyCombo
        }
    }
    return changedKeybinds
}

export { initActions, registerAction, forEachAction, resetKeybinds, importKeybinds, exportKeybinds }
