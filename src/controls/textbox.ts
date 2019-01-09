import G from '../common/globals'
import F from './functions'
import keyboardjs from 'keyboardjs'

/** Base Textbox Control */
export default class Textbox extends PIXI.Container {

    /** Textbox Background Graphic */
    private readonly m_Background: PIXI.Graphics

    /** Textbox Rollover Graphic */
    private readonly m_Hover: PIXI.Graphics

    /** Textbox Active Graphic */
    private readonly m_Active: PIXI.Graphics

    /** Text Style for Textbox */
    private readonly m_Style: PIXI.TextStyle

    /** Text Metrics for Textbox */
    private readonly m_Metrics: PIXI.TextMetrics

    /** Textbox Text Container */
    private readonly m_Foreground: PIXI.Text

    /** The Actual Text (needed as PIXI.Text cannot handle an empty text) */
    private m_Text: string

    /** Maximum Text Length */
    private readonly m_Length: number

    /** Text Input Filter */
    private readonly m_Filter: string

    /** Caret Position */
    private m_CaretPosition: number

    /** Caret Graphic */
    private readonly m_CaretGraphic: PIXI.Graphics

    /** Indiciate whether pointer (mouse) is within the boundaries of the textbox */
    private m_MouseInside: boolean

    /**
     * Constructor
     *
     * @param width - Optional width of the textbox
     * @param size - Font size of the text
     * @param text - Text to display in textbox
     * @param length - Maximum length of text (0 will automatically make it the length of the provided @param text)
     * @param filter - Filter for allowed characters (e.g. '1234567890')
     */
    constructor(width: number, size: number, text: string = '', length: number = 0, filter: string = '') {
        super()

        this.m_Text = text
        this.m_Length = length === 0 ? text.length : length
        this.m_Filter = filter

        this.m_Style = new PIXI.TextStyle({
            fill: G.colors.textbox.foreground,
            fontFamily: G.fontFamily,
            fontWeight: '500',
            fontSize: size
        })

        this.m_Metrics = PIXI.TextMetrics.measureText(PIXI.TextMetrics.METRICS_STRING, this.m_Style)

        // 1 (Border) + 2 (Space) + Text Height + 2 (Space) + 1 Border = Text Height + 6
        const height: number = this.m_Metrics.height + 6

        this.m_Background = F.DrawRectangle(width, height, G.colors.textbox.background, 1, 1, true)
        this.addChild(this.m_Background)

        this.m_Hover = F.DrawRectangle(width, height, G.colors.textbox.hover, 0.5, 1, true)
        this.m_Hover.visible = false
        this.addChild(this.m_Hover)

        this.m_Active = F.DrawRectangle(width, height, G.colors.textbox.active, 1, 1, true)
        this.m_Active.visible = false
        this.addChild(this.m_Active)

        this.m_Foreground = new PIXI.Text(this.m_Text, this.m_Style)
        this.m_Foreground.position.set(3, 3)
        this.addChild(this.m_Foreground)

        this.m_CaretPosition = text.length

        this.m_CaretGraphic = new PIXI.Graphics()
        this.m_CaretGraphic.lineStyle(1, G.colors.textbox.foreground).moveTo(0, 0).lineTo(0, this.m_Metrics.height)
        this.m_CaretGraphic.visible = false
        this.moveCaret(this.m_CaretPosition)
        this.addChild(this.m_CaretGraphic)

        this.interactive = true
        this.on('pointerover', () => {
            this.m_MouseInside = true
            if (!this.m_Active.visible) this.m_Hover.visible = true
        }, false)
        this.on('pointerout', () => {
            this.m_MouseInside = false
            this.m_Hover.visible = false
        } , false)
        this.on('pointerup', () => {
            keyboardjs.setContext('textbox')
            keyboardjs.bind(undefined, this.keyPressedCallback)
            window.addEventListener('mouseup', this.releaseKeybindings, false)
            this.m_Active.visible = true
            this.m_CaretGraphic.visible = true
        }, false)
    }

    /** Text of Textbox */
    public get text(): string { return this.m_Text }

    /** Window Mouse Up Event Callback */
    private readonly releaseKeybindings: EventListener = () => {
        if (!this.m_MouseInside) {
            window.removeEventListener('mouseup', this.releaseKeybindings, false)
            keyboardjs.unbind(undefined, this.keyPressedCallback)
            keyboardjs.setContext('app')
            this.m_CaretGraphic.visible = false
            this.m_Active.visible = false
        }
    }

    /** KeyboardJS Key Released Callback */
    private readonly keyPressedCallback: EventListener = (e: keyboardjs.KeyEvent) => {
        e.stopImmediatePropagation()
        switch (e.key) {
            case 'Enter':
            case 'Escape':
            case 'Tab': {
                this.releaseKeybindings(undefined)
                break
            }
            case 'ArrowRight': {
                this.moveCaret(this.m_CaretPosition + 1)
                break
            }
            case 'ArrowLeft': {
                this.moveCaret(this.m_CaretPosition - 1)
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

    /**
     * Move caret to new position
     * @param position - Position to where to move the caret to
     */
    private moveCaret(position: number) {
        if (position < 0 || position > this.m_Text.length) return

        this.m_CaretPosition = position
        this.m_CaretGraphic.position.set(3 + PIXI.TextMetrics.measureText(this.m_Text.substr(0, this.m_CaretPosition), this.m_Style).width, 3)
    }

    /**
     * Insert Character
     * @param character - Character to insert at current caret position
     */
    private instertCharacter(character: string) {
        if (character.length !== 1) return
        if (this.m_Text.length >= this.m_Length) return
        if (this.m_Filter !== '') {
            if (this.m_Filter.indexOf(character) < 0) return
        }

        this.m_Text = this.m_Text.slice(0, this.m_CaretPosition) + character + this.m_Text.slice(this.m_CaretPosition)
        this.m_Foreground.text = this.m_Text
        this.moveCaret(this.m_CaretPosition + 1)
    }

    /**
     * Remove Character
     * @param direction - The direction in which to remove a character (-1: before current position; 1: after current position)
     */
    private removeCharacter(direction: number) {
        if (direction === -1) {
            if (this.m_CaretPosition < 1) return
            this.m_Text = this.m_Text.slice(0, this.m_CaretPosition - 1) + this.m_Text.slice(this.m_CaretPosition)
            this.m_Foreground.text = this.m_Text
            this.moveCaret(this.m_CaretPosition - 1)
        } else if (direction === 1) {
            this.m_Text = this.m_Text.slice(0, this.m_CaretPosition) + this.m_Text.slice(this.m_CaretPosition + 1)
            this.m_Foreground.text = this.m_Text
        }
    }
}
