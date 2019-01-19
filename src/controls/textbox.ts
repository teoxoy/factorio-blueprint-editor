import G from '../common/globals'
import F from './functions'
import keyboardjs from 'keyboardjs'

// TODO: Evaluate enhancement: Posibility to set caret with mouse (prototype commented ou with 'PT')
// TODO: Evaluate enhancement: Text marking / copy / paste

/** Class representing single character in textbox */
class TextChar extends PIXI.Text {

    /** Text metrics for character */
    private readonly m_Metrics: PIXI.TextMetrics

    constructor(char: string, left: number = 0) {
        super(char, G.styles.controls.textbox)
        // (PT) this.interactive = true
        this.position.set(left, 0)
        this.m_Metrics = PIXI.TextMetrics.measureText(this.text, G.styles.controls.textbox)
    }

    /** Width in pixel of char */
    public get width(): number {
        return this.m_Metrics.width
    }

    /** Height in pixel of char */
    public get height(): number {
        return this.m_Metrics.height
    }
}

/** Class representing all text in textbox */
class TextContainer extends PIXI.Container {

    /**
     * Construct text container
     * @param text Initial text
     */
    constructor(text: string) {
        super()
        this.text = text
        this.interactiveChildren = false
    }

    /** Text value */
    public get text(): string {
        return this.children.reduce((text: string, current: TextChar) => text + current.text, '')
    }
    public set text(text: string) {
        this.removeChildren()
        for (let i = 0; i < text.length; i++) {
            // (PT) const char: TextChar = new TextChar(text.charAt(i), this.width)
            // (PT) char.on('pointerdown', () => this.onTextCharDown(char))
            // (PT) this.addChild(char)
            this.addChild(new TextChar(text.charAt(i), this.width))
        }
    }

    // (PT) /** Activate text for mouse interactions */
    // (PT) public activate() {
    // (PT)     this.interactiveChildren = true
    // (PT)     this.cursor = 'text'
    // (PT) }

    // (PT) /** Deactivate text for mouse interactions */
    // (PT) public deactivate() {
    // (PT)     this.interactiveChildren = false
    // (PT)     this.cursor = undefined
    // (PT) }

    /** Get char from a specific position (position is base 1 indexed) */
    public getChar(position: number): TextChar {
        if (position < 1 || position > this.children.length) throw new RangeError('Argument position out of range')
        return super.getChildAt(position - 1) as TextChar
    }

    /** Add char at specific position (position is base 1 indexed) */
    public insertChar(char: TextChar, position?: number) {
        if (position === undefined) {
            // (PT) char.on('pointerdown', () => this.onTextCharDown(char))
            super.addChild(char)
        } else {
            if (position < 0 || position > this.children.length) {
                throw new RangeError('Argument position out of range')
            } else if (position === 0) {
                // (PT) char.on('pointerdown', () => this.onTextCharDown(char))
                super.addChildAt(char, 0)
            } else {
                // (PT) char.on('pointerdown', () => this.onTextCharDown(char))
                super.addChildAt(char, position)
            }
        }
        this.alignTextChars()
    }

    /** Remove char from specific position (position is base 1 indexed) */
    public removeChar(position: number) {
        if (position < 1 || position > this.children.length) throw new RangeError('Argument position out of range')
        // (PT) this.getChar(position).removeAllListeners()
        super.removeChildAt(position - 1)
        this.alignTextChars()
    }

    /** Realign text chars if a character was inserted or removed */
    private alignTextChars() {
        let x = 0
        for (const textChar of this.children) {
            textChar.x = x
            x += (textChar as TextChar).width
        }
    }

    // /** Pointer down on char event handler */
    // private readonly onTextCharDown = (char: TextChar) => {
    //     if (char === undefined) return
    //     const index = this.getChildIndex(char)
    //     if (index === undefined) return
    //     this.emit('textchardown', index)
    // }
}

/** Base Textbox Control */
export default class Textbox extends PIXI.Container {

    /** Textbox regular background graphic */
    private readonly m_Background: PIXI.Graphics

    /** Textbox active background graphic */
    private readonly m_Active: PIXI.Graphics

    /** Container to hold text chars */
    private readonly m_Text: TextContainer

    /** Maximum Text Length */
    private readonly m_Length: number

    /** Text Input Filter */
    private readonly m_Filter: string

    /** Caret Graphic */
    private readonly m_CaretGraphic: PIXI.Graphics

    /** Caret Position */
    private p_CaretPosition: number

    /** Indiciate whether pointer (mouse) is within the boundaries of the textbox */
    private m_MouseInside: boolean

    /**
     * Constructor
     *
     * @param width - Optional width of the textbox
     * @param size - Font size of the text
     * @param text - Text to display in textbox
     * @param length - Maximum length of text (0 will automatically make it the length of the provided text)
     * @param filter - Filter for allowed characters (e.g. '1234567890')
     */
    constructor(width: number, text: string = '', length: number = 0, filter: string = '') {
        super()

        this.m_Length = length === 0 ? text.length : length
        this.m_Filter = filter

        // 1 (Border) + 2 (Space) + Text Height + 2 (Space) + 1 Border = Text Height + 6
        const height: number = PIXI.TextMetrics.measureText(text, G.styles.controls.textbox).height

        this.m_Background = F.DrawRectangle(width, height + 6,
            G.colors.controls.textbox.background.color,
            G.colors.controls.textbox.background.alpha,
            1, true)
        this.addChild(this.m_Background)

        this.m_Active = F.DrawRectangle(width, height + 6,
            G.colors.controls.textbox.active.color,
            G.colors.controls.textbox.active.alpha,
            1, true)
        this.m_Active.visible = false
        this.addChild(this.m_Active)

        this.m_Text = new TextContainer(text)
        this.m_Text.position.set(3, 3)
        // (PT) this.m_Text.on('textchardown', (position: number) => this.caretPosition = position)
        this.addChild(this.m_Text)

        this.m_CaretGraphic = new PIXI.Graphics()
        this.m_CaretGraphic.lineStyle(1, G.colors.controls.textbox.foreground.color).moveTo(0, 0).lineTo(0, height)
        this.m_CaretGraphic.y = 3
        this.m_CaretGraphic.visible = false
        this.addChild(this.m_CaretGraphic)

        this.caretPosition = text.length

        this.interactive = true
        this.on('pointerover', () => { this.m_MouseInside = true })
        this.on('pointerout', () => { this.m_MouseInside = false })
        this.on('pointerup', this.onPointerUp)
    }

    /** Textbox text */
    public get text(): string {
        return this.m_Text.text
    }
    public set text(text: string) {
        if (this.m_Text.text !== text) {
            this.m_Text.text = text
            this.caretPosition = text.length
            this.emit('changed')
        }
    }

    /** Set caret to new position */
    private get caretPosition(): number {
        return this.p_CaretPosition
    }
    private set caretPosition(position: number) {
        if (position < 0 || position > this.m_Text.children.length) return
        this.p_CaretPosition = position
        if (this.p_CaretPosition === 0) {
            this.m_CaretGraphic.x = 3
        } else {
            const textChar = this.m_Text.getChildAt(position - 1) as TextChar
            this.m_CaretGraphic.x = textChar.x + textChar.width + 3
        }
    }

    /**
     * Insert Character
     * @param char - Character to insert at current caret position
     */
    private instertCharacter(char: string) {
        if (char === undefined || char.length !== 1) return
        if (this.m_Text.children.length >= this.m_Length) return
        if (this.m_Filter !== '' && this.m_Filter.indexOf(char) < 0) return

        this.m_Text.insertChar(new TextChar(char), this.caretPosition)
        this.caretPosition++
        this.emit('changed')
    }

    /**
     * Remove Character
     * @param direction - The direction in which to remove a character (-1: before current position; 1: after current position)
     */
    private removeCharacter(direction: number) {
        if (direction === -1) {
            if (this.caretPosition < 1) return
            this.m_Text.removeChar(this.caretPosition)
            this.caretPosition--
        } else if (direction === 1) {
            if (this.caretPosition >= this.m_Text.children.length) return
            this.m_Text.removeChar(this.caretPosition + 1)
        }
        this.emit('changed')
    }

    /** Pointer up event callback */
    private readonly onPointerUp = () => {
        if (!this.m_Active.visible) {
            keyboardjs.setContext('textbox')
            keyboardjs.bind(undefined, this.keyPressedCallback)
            window.addEventListener('mousedown', this.releaseKeybindings)
            this.m_CaretGraphic.visible = true
            // (PT) this.m_Text.activate()
            this.m_Active.visible = true
        }
    }

    /** Window wouse up event callback */
    private readonly releaseKeybindings: EventListener = () => {
        if (!this.m_MouseInside) {
            window.removeEventListener('mousedown', this.releaseKeybindings)
            keyboardjs.unbind(undefined, this.keyPressedCallback)
            keyboardjs.setContext('app')
            this.m_CaretGraphic.visible = false
            // (PT) this.m_Text.deactivate()
            this.m_Active.visible = false
        }
    }

    /** KeyboardJS key released event callback */
    private readonly keyPressedCallback: EventListener = (e: keyboardjs.KeyEvent) => {
        switch (e.key) {
            case 'Enter':
            case 'Escape':
            case 'Tab': {
                this.releaseKeybindings(undefined)
                break
            }
            case 'ArrowRight': {
                this.caretPosition++
                break
            }
            case 'ArrowLeft': {
                this.caretPosition--
                break
            }
            case 'Backspace': {
                this.removeCharacter(-1)
                break
            }
            case 'Delete': {
                this.removeCharacter(1)
                break
            }
            case 'Space':
            default: {
                this.instertCharacter(e.key)
            }
        }
    }
}
