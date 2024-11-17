import { Renderer } from '@pixi/core'
import { Container, DisplayObject, IDestroyOptions } from '@pixi/display'
import { Graphics } from '@pixi/graphics'
import { Matrix } from '@pixi/math'
import { FunctionKeys } from 'utility-types'
import { colors, styles } from '../style'

type State = 'FOCUSED' | 'DISABLED' | 'DEFAULT' | string

type BoxGenerator = (w: number, h: number, state: State) => DisplayObject

type Style = {
    fill?: number
    rounded?: number
    stroke?: {
        width?: number
        color?: number
        alpha?: number
    }
}

type Styles = Record<Lowercase<State>, Style>

type Options = {
    multiline?: boolean
    box?: Styles | BoxGenerator
    input?: InputStyles
}

type InputStyles = Partial<
    Omit<CSSStyleDeclaration, 'length' | 'parentRule' | FunctionKeys<CSSStyleDeclaration>>
>

type IRect = {
    top: number
    left: number
    width: number
    height: number
}

type PreviousData = {
    state: State
    canvas_bounds: IRect
    input_bounds: IRect
    world_transform: Matrix
    world_alpha: number
    world_visible: boolean
}

// The class below is a modified version of Mwni's pixi-text-input under the MIT License
// https://github.com/Mwni/pixi-text-input/blob/8e3f913ac9b497506474205028e5d783e3aab71c/src/PIXI.TextInput.js

class OriginalTextInput extends Container {
    private _input_style: InputStyles
    private _placeholder: string
    private _box_generator: BoxGenerator
    private _box_cache: Record<State, DisplayObject>
    private _previous: Partial<PreviousData>
    private _dom_added: boolean
    private _dom_visible: boolean
    private _dom_input: HTMLInputElement | HTMLTextAreaElement
    private _selection: number[]
    private _restrict_value: string
    private _restrict_regex: RegExp
    private _disabled: boolean
    private _max_length: number
    private _multiline: boolean
    private _last_renderer: Renderer
    private _resolution: number
    private _canvas_bounds: IRect
    private _box: DisplayObject
    public state: State

    public constructor(options?: Options) {
        super()
        this._input_style = {
            position: 'absolute',
            background: 'none',
            border: 'none',
            outline: 'none',
            transformOrigin: '0 0',
            lineHeight: '1',
            ...options.input,
        }

        if (options.box)
            this._box_generator =
                typeof options.box === 'function' ? options.box : DefaultBoxGenerator(options.box)
        else this._box_generator = null

        this._multiline = !!options.multiline

        this._box_cache = {}
        this._previous = {}
        this._dom_added = false
        this._dom_visible = true
        this._placeholder = ''
        this._selection = [0, 0]
        this._restrict_value = ''
        this._createDOMInput()
        this._setState('DEFAULT')
        this._addListeners()
    }

    // GETTERS & SETTERS

    public get placeholder(): string {
        return this._placeholder
    }

    public set placeholder(text: string) {
        this._placeholder = text
        this._dom_input.placeholder = text
    }

    public get disabled(): boolean {
        return this._disabled
    }

    public set disabled(disabled: boolean) {
        this._disabled = disabled
        this._dom_input.disabled = disabled
        this._setState(disabled ? 'DISABLED' : 'DEFAULT')
    }

    public get maxLength(): number {
        return this._max_length
    }

    public set maxLength(length: number) {
        this._max_length = length
        this._dom_input.setAttribute('maxlength', `${length}`)
    }

    public get restrict(): RegExp {
        return this._restrict_regex
    }

    public set restrict(regex: RegExp | string) {
        if (regex instanceof RegExp) {
            let _regex = regex.toString().slice(1, -1)

            if (_regex.charAt(0) !== '^') _regex = `^${_regex}`

            if (_regex.charAt(_regex.length - 1) !== '$') _regex += '$'

            this._restrict_regex = new RegExp(_regex)
        } else {
            this._restrict_regex = new RegExp(`^[${regex}]*$`)
        }
    }

    public get text(): string {
        return this._dom_input.value
    }

    public set text(text: string) {
        this._dom_input.value = text
    }

    public get htmlInput(): HTMLInputElement | HTMLTextAreaElement {
        return this._dom_input
    }

    public focus(): void {
        this._dom_input.focus()
    }

    public blur(): void {
        this._dom_input.blur()
    }

    public select(): void {
        this.focus()
        this._dom_input.select()
    }

    public setInputStyle<K extends keyof InputStyles>(key: K, value: InputStyles[K]): void {
        this._input_style[key] = value
        this._dom_input.style[key] = value

        if (this._last_renderer) this._update()
    }

    public override destroy(options?: boolean | IDestroyOptions): void {
        this._destroyBoxCache()
        super.destroy(options)
    }

    // SETUP

    private _createDOMInput(): void {
        if (this._multiline) {
            this._dom_input = document.createElement('textarea')
            this._dom_input.style.resize = 'none'
        } else {
            this._dom_input = document.createElement('input')
            this._dom_input.type = 'text'
        }

        for (const [key, value] of Object.entries(this._input_style)) {
            this._dom_input.style[key as keyof InputStyles] = value
        }
    }

    private _addListeners(): void {
        this.on('added', this._onAdded.bind(this))
        this.on('removed', this._onRemoved.bind(this))
        this._dom_input.addEventListener('keydown', this._onInputKeyDown.bind(this))
        this._dom_input.addEventListener('input', this._onInputInput.bind(this))
        this._dom_input.addEventListener('keyup', this._onInputKeyUp.bind(this))
        this._dom_input.addEventListener('focus', this._onFocused.bind(this))
        this._dom_input.addEventListener('blur', this._onBlurred.bind(this))
    }

    private _onInputKeyDown(): void {
        this._selection = [this._dom_input.selectionStart, this._dom_input.selectionEnd]

        // this.emit('keydown', e.keyCode)
    }

    private _onInputInput(): void {
        if (this._restrict_regex) this._applyRestriction()

        this.emit('changed')
    }

    private _onInputKeyUp(): void {
        // this.emit('keyup', e.keyCode)
    }

    private _onFocused(): void {
        this._setState('FOCUSED')
        // this.emit('focus')
    }

    private _onBlurred(): void {
        this._setState('DEFAULT')
        // this.emit('blur')
    }

    private _onAdded(): void {
        document.body.appendChild(this._dom_input)
        this._dom_input.style.display = 'none'
        this._dom_added = true
    }

    private _onRemoved(): void {
        document.body.removeChild(this._dom_input)
        this._dom_added = false
    }

    private _setState(state: State): void {
        this.state = state
        this._updateBox()
    }

    // RENDER & UPDATE

    public override render(renderer: Renderer): void {
        super.render(renderer)
        this._renderInternal(renderer)
    }

    private _renderInternal(renderer: Renderer): void {
        this._resolution = renderer.resolution
        this._last_renderer = renderer
        this._canvas_bounds = this._getCanvasBounds()
        if (this._needsUpdate()) this._update()
    }

    private _update(): void {
        this._updateDOMInput()
        this._updateBox()
    }

    private _updateBox(): void {
        if (!this._box_generator) return

        if (this._needsNewBoxCache()) this._buildBoxCache()

        if (this.state === this._previous.state && this._box === this._box_cache[this.state]) return

        if (this._box) this.removeChild(this._box)

        this._box = this._box_cache[this.state]
        this.addChildAt(this._box, 0)
        this._previous.state = this.state
    }

    private _updateDOMInput(): void {
        if (!this._canvas_bounds) return

        this._dom_input.style.top = `${this._canvas_bounds.top || 0}px`
        this._dom_input.style.left = `${this._canvas_bounds.left || 0}px`
        this._dom_input.style.transform = this._pixiMatrixToCSS(
            this._getDOMRelativeWorldTransform()
        )
        this._dom_input.style.opacity = `${this.worldAlpha}`
        this._setDOMInputVisible(this.worldVisible && this._dom_visible)

        this._previous.canvas_bounds = this._canvas_bounds
        this._previous.world_transform = this.worldTransform.clone()
        this._previous.world_alpha = this.worldAlpha
        this._previous.world_visible = this.worldVisible
    }

    private _applyRestriction(): void {
        if (this._restrict_regex.test(this.text)) {
            this._restrict_value = this.text
        } else {
            this.text = this._restrict_value
            this._dom_input.setSelectionRange(this._selection[0], this._selection[1])
        }
    }

    // STATE COMPAIRSON (FOR PERFORMANCE BENEFITS)

    private _needsUpdate(): boolean {
        return (
            !this._comparePixiMatrices(this.worldTransform, this._previous.world_transform) ||
            !this._compareClientRects(this._canvas_bounds, this._previous.canvas_bounds) ||
            this.worldAlpha !== this._previous.world_alpha ||
            this.worldVisible !== this._previous.world_visible
        )
    }

    private _needsNewBoxCache(): boolean {
        const input_bounds = this._getDOMInputBounds()
        return (
            !this._previous.input_bounds ||
            input_bounds.width !== this._previous.input_bounds.width ||
            input_bounds.height !== this._previous.input_bounds.height
        )
    }

    // CACHING OF INPUT BOX GRAPHICS

    private _buildBoxCache(): void {
        this._destroyBoxCache()

        const states = ['DEFAULT', 'FOCUSED', 'DISABLED']
        const input_bounds = this._getDOMInputBounds()

        for (const state of states) {
            this._box_cache[state] = this._box_generator(
                input_bounds.width,
                input_bounds.height,
                state
            )
        }

        this._previous.input_bounds = input_bounds
    }

    private _destroyBoxCache(): void {
        if (this._box) {
            this.removeChild(this._box)
            this._box = null
        }

        for (const obj of Object.values(this._box_cache)) {
            obj.destroy()
        }
        this._box_cache = {}
    }

    // HELPER FUNCTIONS

    private _setDOMInputVisible(visible: boolean): void {
        this._dom_input.style.display = visible ? 'block' : 'none'
    }

    private _getCanvasBounds(): IRect {
        const rect = this._last_renderer.view.getBoundingClientRect()
        const bounds = { top: rect.y, left: rect.x, width: rect.width, height: rect.height }
        bounds.left += window.scrollX
        bounds.top += window.scrollY
        return bounds
    }

    private _getDOMInputBounds(): IRect {
        let remove_after = false

        if (!this._dom_added) {
            document.body.appendChild(this._dom_input)
            remove_after = true
        }

        const org_transform = this._dom_input.style.transform
        const org_display = this._dom_input.style.display
        this._dom_input.style.transform = ''
        this._dom_input.style.display = 'block'
        const bounds = this._dom_input.getBoundingClientRect()
        this._dom_input.style.transform = org_transform
        this._dom_input.style.display = org_display

        if (remove_after) document.body.removeChild(this._dom_input)

        return bounds
    }

    private _getDOMRelativeWorldTransform(): Matrix {
        const canvas_bounds = this._last_renderer.view.getBoundingClientRect()
        const matrix = this.worldTransform.clone()

        matrix.scale(this._resolution, this._resolution)
        matrix.scale(
            canvas_bounds.width / this._last_renderer.width,
            canvas_bounds.height / this._last_renderer.height
        )
        return matrix
    }

    private _pixiMatrixToCSS(m: Matrix): string {
        return `matrix(${[m.a, m.b, m.c, m.d, m.tx, m.ty].join(',')})`
    }

    private _comparePixiMatrices(m1: Matrix, m2: Matrix): boolean {
        if (!m1 || !m2) return false
        return (
            m1.a === m2.a &&
            m1.b === m2.b &&
            m1.c === m2.c &&
            m1.d === m2.d &&
            m1.tx === m2.tx &&
            m1.ty === m2.ty
        )
    }

    private _compareClientRects(r1: IRect, r2: IRect): boolean {
        if (!r1 || !r2) return false
        return (
            r1.left === r2.left &&
            r1.top === r2.top &&
            r1.width === r2.width &&
            r1.height === r2.height
        )
    }
}

function DefaultBoxGenerator(styles: Styles): BoxGenerator {
    if (styles.default) {
        styles.focused = styles.focused || styles.default
        styles.disabled = styles.disabled || styles.default
    }

    return (w, h, state) => {
        const style = styles[state.toLowerCase() as Lowercase<State>]
        const box = new Graphics()

        if (style.fill) box.beginFill(style.fill)

        if (style.stroke)
            box.lineStyle(style.stroke.width || 1, style.stroke.color || 0, style.stroke.alpha || 1)

        if (style.rounded) box.drawRoundedRect(0, 0, w, h, style.rounded)
        else box.drawRect(0, 0, w, h)

        box.endFill()
        box.closePath()

        return box
    }
}

export class TextInput extends OriginalTextInput {
    public constructor(width: number, text: string, maxLength: number, numericOnly = false) {
        super({
            input: {
                fontFamily: styles.controls.textbox.fontFamily,
                fontWeight: styles.controls.textbox.fontWeight,
                fontSize: `${styles.controls.textbox.fontSize}`,
                width: `${width}px`,
                color: `black`,
            },
            box: {
                default: {
                    fill: colors.controls.textbox.background.color,
                    rounded: 1,
                    stroke: { color: 0xcbcee0, width: 1 },
                },
                focused: {
                    fill: colors.controls.textbox.active.color,
                    rounded: 1,
                    stroke: { color: 0xabafc6, width: 1 },
                },
                // disabled: { fill: 0xdbdbdb, rounded: 1 },
            },
        })
        if (numericOnly) {
            this.restrict = '0123456789'
        }
        this.maxLength = maxLength
        this.text = text
    }
}
