import G from '../common/globals'
import F from './functions'

/**
 * Base Button
 */
export default class Button extends PIXI.Container {

    /** Background Graphic */
    private readonly m_Background: PIXI.Graphics

    /** Active Graphic */
    private readonly m_Active: PIXI.Graphics

    /** Rollover Graphic */
    private readonly m_Hover: PIXI.Graphics

    /** Content of Button */
    private m_Content: PIXI.DisplayObject

    constructor(width: number = 36, height: number = 36, border: number = 1) {
        super()

        this.interactive = true
        this.buttonMode = true

        this.m_Background = F.DrawRectangle(width, height, this.background, 1, border, this.pressed)
        this.m_Background.position = new PIXI.Point(0, 0)

        this.m_Active = F.DrawRectangle(width, height, G.colors.button.active, 1, border, !this.pressed)
        this.m_Active.position = new PIXI.Point(0, 0)
        this.m_Active.visible = false

        this.m_Hover = F.DrawRectangle(width, height, this.hover, 0.5, 0)
        this.m_Hover.position = new PIXI.Point(0, 1)
        this.m_Hover.visible = false

        this.addChild(this.m_Background, this.m_Active, this.m_Hover)

        // Enable Rollover
        this.on('pointerover', () => {
            if (!this.m_Active.visible) this.m_Hover.visible = true
        })
        this.on('pointerout', () => {
            this.m_Hover.visible = false
        })
    }

    /** Is button active */
    public get active(): boolean {
        return this.m_Active.visible
    }
    public set active(active: boolean) {
        this.m_Active.visible = active
    }

    /** Content of the button */
    public get content(): PIXI.DisplayObject {
        return this.m_Content
    }
    public set content(content: PIXI.DisplayObject) {
        if (this.m_Content !== undefined) {
            this.removeChild(this.m_Content)
        }

        if (content !== undefined) {
            // Get size of content
            const bounds: PIXI.Rectangle = content.getBounds()

            // Set content for button
            this.m_Content = content
            this.m_Content.position.set((this.width - bounds.width) / 2, (this.height - bounds.height) / 2)

            // Add content to button
            this.addChild(this.m_Content)
        }
    }

    /** Background color of the button (can be overriden) */
    protected get background(): number { return G.colors.button.background }

    /** Rollover color of the button (can be overriden) */
    protected get hover(): number { return  G.colors.button.hover }

    /** Shall button be raised or pressed (can be overridden) */
    protected get pressed(): boolean { return false }
}
