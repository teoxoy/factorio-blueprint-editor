import { Container, Text } from 'pixi.js'
import { styles } from '../style'

/** Base Checkbox */
export class Enable extends Container {
    /** Reference to regular text */
    private readonly m_TextText: Text

    /** Reference to hover text */
    private readonly m_HoverText: Text

    /** Reference to active text */
    private readonly m_ActiveText: Text

    /** Data of toggle */
    private m_Active: boolean

    /**
     * Create switch control
     * @param values - Possible values
     * @param value - Default value
     */
    public constructor(active = false, text: string) {
        super()

        this.eventMode = 'static'
        this.m_Active = active

        // Draw text
        this.m_TextText = new Text({ text, style: styles.controls.enable.text })
        this.m_TextText.position.set(0, 0)
        this.m_TextText.visible = !active
        this.addChild(this.m_TextText)

        this.m_HoverText = new Text({ text, style: styles.controls.enable.hover })
        this.m_HoverText.position.set(0, 0)
        this.m_HoverText.visible = false
        this.addChild(this.m_HoverText)

        this.m_ActiveText = new Text({ text, style: styles.controls.enable.active })
        this.m_ActiveText.position.set(0, 0)
        this.m_ActiveText.visible = active
        this.addChild(this.m_ActiveText)

        // Attach events
        this.on('pointerdown', () => {
            if (!this.active) {
                this.active = true
                this.emit('changed')
            }
        })
        this.on('pointerover', () => {
            if (!this.active) {
                this.m_HoverText.visible = true
            }
        })
        this.on('pointerout', () => {
            this.m_HoverText.visible = false
        })
    }

    /** Is checkbox checked */
    public get active(): boolean {
        return this.m_Active
    }
    public set active(value: boolean) {
        if (this.m_Active !== value) {
            this.m_Active = value

            this.m_TextText.visible = !this.active
            this.m_HoverText.visible = false
            this.m_ActiveText.visible = this.active
        }
    }
}
