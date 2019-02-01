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

    /** Content of Control */
    private m_Content: PIXI.DisplayObject

    /** Data of Control */
    private m_Data: any

    constructor(width: number = 36, height: number = 36, border: number = G.colors.controls.button.border) {
        super()

        this.interactive = true
        this.buttonMode = true

        this.m_Background = F.DrawRectangle(width, height,
            this.background,
            G.colors.controls.button.background.alpha,
            border, this.pressed)
        this.m_Background.position.set(0, 0)

        this.m_Active = F.DrawRectangle(width, height,
            G.colors.controls.button.active.color,
            G.colors.controls.button.active.alpha,
            border, !this.pressed)
        this.m_Active.position.set(0, 0)
        this.m_Active.visible = false

        this.m_Hover = F.DrawRectangle(width, height,
            G.colors.controls.button.hover.color,
            G.colors.controls.button.hover.alpha,
            0)
        this.m_Hover.position.set(0, 1)
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
        // this.on()
    }
    public set active(active: boolean) {
        this.m_Active.visible = active
    }

    /** Control Content */
    public get content(): PIXI.DisplayObject {
        return this.m_Content
    }
    public set content(content: PIXI.DisplayObject) {
        if (this.m_Content !== undefined || (this.m_Content !== undefined && content === undefined)) {
            this.removeChild(this.m_Content)
            this.m_Content.destroy()
            this.m_Content = undefined
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

    /** Control Data */
    public get data(): any { return this.m_Data }        /* tslint:disable-line */ // Need to use any to be able to assign anything
    public set data(value: any) { this.m_Data = value }  /* tslint:disable-line */ // Need to use any to be able to assign anything

    /** Background color of the button (can be overriden) */
    protected get background(): number { return G.colors.controls.button.background.color }

    /** Rollover color of the button (can be overriden) */
    protected get hover(): number { return  G.colors.controls.button.hover.color }

    /** Shall button be raised or pressed (can be overridden) */
    protected get pressed(): boolean { return false }
}
