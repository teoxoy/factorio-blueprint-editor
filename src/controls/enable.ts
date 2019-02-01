import G from '../common/globals'

/** Base Checkbox */
export default class Enable extends PIXI.Container {

    /** Reference to regular text */
    private readonly m_TextText: PIXI.Text

    /** Reference to hover text */
    private readonly m_HoverText: PIXI.Text

    /** Reference to active text */
    private readonly m_ActiveText: PIXI.Text

    /** Data of toggle */
    private m_Active: boolean

    /**
     * Create switch control
     * @param values - Possible values
     * @param value - Default value
     */
    constructor(active: boolean = false, text: string) {
        super()

        this.interactive = true
        this.m_Active = active

        // Draw text
        this.m_TextText = new PIXI.Text(text, G.styles.controls.enable.text)
        this.m_TextText.position.set(0, 0)
        this.m_TextText.visible = !active
        this.addChild(this.m_TextText)

        this.m_HoverText = new PIXI.Text(text, G.styles.controls.enable.hover)
        this.m_HoverText.position.set(0, 0)
        this.m_HoverText.visible = false
        this.addChild(this.m_HoverText)

        this.m_ActiveText = new PIXI.Text(text, G.styles.controls.enable.active)
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
            if (!this.active) this.m_HoverText.visible = true
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
