import G from './common/globals'

export enum MouseButton {
    Left = 0,
    Middle = 1,
    Right = 2,
    Fourth = 3,
    Fifth = 4,
}

// https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
type ModifierKey = 'Control' | 'Shift' | 'Alt'

/**
 * Intersection of codes emitted by Firefox and Chrome on all platforms listed on
 * https://github.com/mdn/content/blob/16ab3138acadc039e018361916a8264a359be774/files/en-us/web/api/ui_events/keyboard_event_code_values/index.md
 */
type KeyCode =
    | 'AltLeft'
    | 'AltRight'
    | 'ArrowDown'
    | 'ArrowLeft'
    | 'ArrowRight'
    | 'ArrowUp'
    | 'Backquote'
    | 'Backslash'
    | 'Backspace'
    | 'BracketLeft'
    | 'BracketRight'
    | 'CapsLock'
    | 'Comma'
    | 'ContextMenu'
    | 'ControlLeft'
    | 'ControlRight'
    | 'Delete'
    | 'Digit0'
    | 'Digit1'
    | 'Digit2'
    | 'Digit3'
    | 'Digit4'
    | 'Digit5'
    | 'Digit6'
    | 'Digit7'
    | 'Digit8'
    | 'Digit9'
    | 'End'
    | 'Enter'
    | 'Equal'
    | 'Escape'
    | 'F1'
    | 'F10'
    | 'F11'
    | 'F12'
    | 'F13'
    | 'F14'
    | 'F15'
    | 'F16'
    | 'F17'
    | 'F18'
    | 'F19'
    | 'F2'
    | 'F20'
    | 'F3'
    | 'F4'
    | 'F5'
    | 'F6'
    | 'F7'
    | 'F8'
    | 'F9'
    | 'Home'
    | 'IntlBackslash'
    | 'IntlRo'
    | 'IntlYen'
    | 'KeyA'
    | 'KeyB'
    | 'KeyC'
    | 'KeyD'
    | 'KeyE'
    | 'KeyF'
    | 'KeyG'
    | 'KeyH'
    | 'KeyI'
    | 'KeyJ'
    | 'KeyK'
    | 'KeyL'
    | 'KeyM'
    | 'KeyN'
    | 'KeyO'
    | 'KeyP'
    | 'KeyQ'
    | 'KeyR'
    | 'KeyS'
    | 'KeyT'
    | 'KeyU'
    | 'KeyV'
    | 'KeyW'
    | 'KeyX'
    | 'KeyY'
    | 'KeyZ'
    | 'Minus'
    | 'NumLock'
    | 'Numpad0'
    | 'Numpad1'
    | 'Numpad2'
    | 'Numpad3'
    | 'Numpad4'
    | 'Numpad5'
    | 'Numpad6'
    | 'Numpad7'
    | 'Numpad8'
    | 'Numpad9'
    | 'NumpadAdd'
    | 'NumpadComma'
    | 'NumpadDecimal'
    | 'NumpadDivide'
    | 'NumpadEnter'
    | 'NumpadEqual'
    | 'NumpadMultiply'
    | 'NumpadSubtract'
    | 'PageDown'
    | 'PageUp'
    | 'Period'
    | 'Quote'
    | 'Semicolon'
    | 'ShiftLeft'
    | 'ShiftRight'
    | 'Slash'
    | 'Space'
    | 'Tab'

interface Modifiers {
    control?: boolean
    shift?: boolean
    alt?: boolean
}

interface Callbacks {
    /**
     * Return `true` to indicate that the action succeeded.
     *
     * Note that `onRelease` won't be called if this callback hasn't succeeded.
     */
    onPress: () => boolean
    onRelease?: () => void
}

interface IMouseTrigger {
    button: MouseButton // | number
}

interface IKeyboardTrigger {
    code: KeyCode // | string
}

type ITrigger = IMouseTrigger | IKeyboardTrigger

type TriggerEvent = PointerEvent | KeyboardEvent

interface IAction {
    trigger: ITrigger
    modifiers?: Modifiers
    callbacks: Callbacks
    modifierCallbacks?: Callbacks
}

const objectMap = <InValue, OutValue>(
    obj: Record<string, InValue>,
    fn: (key: string, value: InValue, index: number) => OutValue
): Record<string, OutValue> =>
    Object.fromEntries(Object.entries(obj).map(([k, v], i) => [k, fn(k, v, i)]))

export class ActionRegistry {
    private actions: Map<string, Action>
    private sortedActions: Action[]
    private modifiers = {
        control: false,
        shift: false,
        alt: false,
    }

    public constructor(actions: Record<string, IAction>) {
        const onKeyComboChange = () => {
            this.sort()
        }
        this.actions = new Map(
            Object.entries(actions).map(([k, v]) => [k, new Action(k, v, onKeyComboChange)])
        )
        this.sortedActions = [...this.actions.values()]
        this.sort()
    }

    public add(name: string, action: IAction): void {
        const onKeyComboChange = () => {
            this.sort()
        }
        const a = new Action(name, action, onKeyComboChange)
        this.actions.set(name, a)
        this.sortedActions.push(a)
        this.sort()
    }
    public get(name: string): Action {
        return this.actions.get(name)
    }
    public forEach(cb: (action: Action) => void): void {
        for (const [, action] of this.actions) {
            cb(action)
        }
    }

    private sort() {
        this.sortedActions.sort((a, b) => b.nrOfModifiers() - a.nrOfModifiers())
    }

    public pressButton(e: PointerEvent): void {
        this.press(e)
    }
    public releaseButton(e: PointerEvent): void {
        this.release(e)
    }

    public pressKey(e: KeyboardEvent): void {
        if (this.isModifier(e.key)) {
            this.setModifiers(e.key, true)

            for (const action of this.sortedActions) {
                if (action.pressMod(this.modifiers, e.key)) return
            }
        }
        this.press(e)
    }
    public releaseKey(e: KeyboardEvent): void {
        if (this.isModifier(e.key)) {
            for (const action of this.sortedActions) {
                action.releaseMod(e.key)
            }

            this.setModifiers(e.key, false)
        }
        this.release(e)
    }

    private press(e: TriggerEvent): void {
        for (const action of this.sortedActions) {
            if (action.press(this.modifiers, e)) {
                if (e instanceof KeyboardEvent) {
                    e.preventDefault()
                }
                return
            }
        }
    }
    private release(e: TriggerEvent): void {
        // e.preventDefault()

        for (const action of this.sortedActions) {
            action.release(e)
        }
    }

    private isModifier(key: string): key is ModifierKey {
        return key === 'Control' || key === 'Shift' || key === 'Alt'
    }
    private setModifiers(key: ModifierKey, value: boolean): void {
        switch (key) {
            case 'Control':
                this.modifiers.control = value
                break
            case 'Shift':
                this.modifiers.shift = value
                break
            case 'Alt':
                this.modifiers.alt = value
                break
        }
    }

    public releaseAll(): void {
        this.modifiers.control = false
        this.modifiers.shift = false
        this.modifiers.alt = false

        for (const action of this.sortedActions) {
            action.forceRelease()
        }
    }
}

function isMouse(trigger: ITrigger): trigger is IMouseTrigger {
    return 'button' in trigger
}

class Action {
    public readonly name: string
    private readonly defaultKeyCombo: string
    private trigger: ITrigger
    private modifiers?: Modifiers
    private callbacks: Callbacks
    private modifierCallbacks?: Callbacks
    private isActive = false
    private isActiveModifier = false
    private onKeyComboChange: () => void

    public constructor(name: string, data: IAction, onKeyComboChange: () => void) {
        this.name = name
        this.trigger = data.trigger
        this.modifiers = data.modifiers
        this.callbacks = data.callbacks
        this.modifierCallbacks = data.modifierCallbacks
        this.defaultKeyCombo = this.keyCombo
        this.onKeyComboChange = onKeyComboChange
    }

    public get prettyName(): string {
        return this.name
            .split(/([A-Z1-9]+[a-z0-9]*)/)
            .join(' ')
            .replace(/(\b\w)/, c => c.toUpperCase())
    }

    public get keyCombo(): string {
        let out = ''
        const add = (name: string) => {
            if (out !== '') {
                out += '+'
            }
            out += name
        }
        if (this.modifiers) {
            if (this.modifiers.control) {
                add('Control')
            }
            if (this.modifiers.shift) {
                add('Shift')
            }
            if (this.modifiers.alt) {
                add('Alt')
            }
        }
        const getTriggerName = (): string => {
            if (isMouse(this.trigger)) {
                switch (this.trigger.button) {
                    case MouseButton.Left:
                        return 'ClickL'
                    case MouseButton.Middle:
                        return 'ClickM'
                    case MouseButton.Right:
                        return 'ClickR'
                    case MouseButton.Fourth:
                        return 'Click4'
                    case MouseButton.Fifth:
                        return 'Click5'
                }
            } else {
                return this.trigger.code
            }
        }
        add(getTriggerName())
        return out
    }

    public set keyCombo(value: string) {
        const parts = value.split('+')
        const getModifier = (name: string): keyof Modifiers => {
            switch (name) {
                case 'Control':
                    return 'control'
                case 'Shift':
                    return 'shift'
                case 'Alt':
                    return 'alt'
            }
        }
        const modifiers: Modifiers = {}
        for (const part of parts.slice(0, -1)) {
            const mod = getModifier(part)
            if (!mod) {
                return
            }
            modifiers[mod] = true
        }

        const last = parts[parts.length - 1]
        const getTrigger = (name: string): ITrigger => {
            switch (name) {
                case 'ClickL':
                    return { button: MouseButton.Left }
                case 'ClickM':
                    return { button: MouseButton.Middle }
                case 'ClickR':
                    return { button: MouseButton.Right }
                case 'Click4':
                    return { button: MouseButton.Fourth }
                case 'Click5':
                    return { button: MouseButton.Fifth }
                case '':
                    return undefined
                default:
                    return { code: name as KeyCode }
            }
        }
        const trigger = getTrigger(last)
        if (!trigger) {
            return
        }

        this.modifiers = modifiers
        this.trigger = trigger
        this.onKeyComboChange()
    }

    public get usesDefaultKeyCombo(): boolean {
        return this.keyCombo === this.defaultKeyCombo
    }

    public resetKeyCombo(): void {
        this.keyCombo = this.defaultKeyCombo
    }

    private hasModifier(modifier: ModifierKey): boolean {
        if (!this.modifiers) return false
        switch (modifier) {
            case 'Control':
                return this.modifiers.control
            case 'Shift':
                return this.modifiers.shift
            case 'Alt':
                return this.modifiers.alt
        }
    }

    private hasModifiers(modifiers: Modifiers): boolean {
        if (!this.modifiers) return true
        if (this.modifiers.control && !modifiers.control) return false
        if (this.modifiers.shift && !modifiers.shift) return false
        if (this.modifiers.alt && !modifiers.alt) return false
        return true
    }

    public nrOfModifiers(): number {
        if (!this.modifiers) return 0
        let count = 0
        if (this.modifiers.control) count += 1
        if (this.modifiers.shift) count += 1
        if (this.modifiers.alt) count += 1
        return count
    }

    public press(modifiers: Modifiers, e: TriggerEvent): boolean {
        if (!this.triggerMatches(e)) return false
        if (!this.hasModifiers(modifiers)) return false

        // assert(!this.isActive)

        const succeeded = this.callbacks.onPress()
        this.isActive = succeeded && !!this.callbacks.onRelease
        return succeeded
    }
    public release(e: TriggerEvent): void {
        if (this.triggerMatches(e)) this.forceReleaseB()
    }
    private triggerMatches(e: TriggerEvent): boolean {
        function isMouseEvent(e: TriggerEvent): e is PointerEvent {
            return 'button' in e
        }

        if (isMouseEvent(e)) {
            return isMouse(this.trigger) && e.button === this.trigger.button
        } else {
            return !isMouse(this.trigger) && e.code === this.trigger.code
        }
    }
    private forceReleaseB(): void {
        if (this.isActive) {
            this.callbacks.onRelease()
            this.isActive = false
        }
    }

    public pressMod(modifiers: Modifiers, modifier: ModifierKey): boolean {
        if (!this.modifierCallbacks) return false
        if (!this.hasModifier(modifier)) return false
        if (!this.hasModifiers(modifiers)) return false

        // assert(!this.isActiveModifier)

        const succeeded = this.modifierCallbacks.onPress()
        this.isActiveModifier = succeeded && !!this.modifierCallbacks.onRelease
        return succeeded
    }
    public releaseMod(modifier: ModifierKey): void {
        if (this.hasModifier(modifier)) this.forceReleaseM()
    }
    private forceReleaseM(): void {
        if (this.isActiveModifier) {
            this.modifierCallbacks.onRelease()
            this.isActiveModifier = false
        }
    }

    public forceRelease(): void {
        this.forceReleaseB()
        this.forceReleaseM()
    }
}

function registerAction(name: string, action: IAction): void {
    G.actions.add(name, action)
}

function forEachAction(cb: (action: Action) => void): void {
    G.actions.forEach(cb)
}

function resetKeybinds(): void {
    G.actions.forEach(action => {
        action.resetKeyCombo()
    })
}

function importKeybinds(keybinds: Record<string, string>): void {
    if (!keybinds) return

    for (const [name, kc] of Object.entries(keybinds)) {
        G.actions.get(name).keyCombo = kc
    }
}

function exportKeybinds(): Record<string, string> {
    const changedKeybinds: Record<string, string> = {}
    G.actions.forEach(action => {
        if (!action.usesDefaultKeyCombo) {
            changedKeybinds[action.name] = action.keyCombo
        }
    })
    return changedKeybinds
}

export { registerAction, forEachAction, resetKeybinds, importKeybinds, exportKeybinds }
