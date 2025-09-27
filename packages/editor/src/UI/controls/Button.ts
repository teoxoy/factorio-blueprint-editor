import { Container, Sprite } from 'pixi.js'
import { colors } from '../style'
import F from './functions'

/**
 * Base Button
 */
export class Button<Data = undefined, Content extends Container = Container> extends Container {
    /** Background Graphic */
    private readonly m_Background: Sprite

    /** Active Graphic */
    private readonly m_Active: Sprite

    /** Rollover Graphic */
    private readonly m_Hover: Sprite

    /** Content of Control */
    private m_Content: Content

    /** Data of Control */
    private m_Data: Data

    public constructor(width = 36, height = 36, border = colors.controls.button.border) {
        super()

        this.eventMode = 'static'
        this.cursor = 'pointer'

        this.m_Background = F.DrawRectangle(
            width,
            height,
            this.background,
            colors.controls.button.background.alpha,
            border,
            this.pressed
        )
        this.m_Background.position.set(0, 0)

        this.m_Active = F.DrawRectangle(
            width,
            height,
            colors.controls.button.active.color,
            colors.controls.button.active.alpha,
            border,
            !this.pressed
        )
        this.m_Active.position.set(0, 0)
        this.m_Active.visible = false

        this.m_Hover = F.DrawRectangle(
            width,
            height,
            colors.controls.button.hover.color,
            colors.controls.button.hover.alpha,
            0
        )
        this.m_Hover.position.set(0, 1)
        this.m_Hover.visible = false

        this.addChild(this.m_Background, this.m_Active, this.m_Hover)

        // Enable Rollover
        this.on('pointerover', () => {
            if (!this.m_Active.visible) {
                this.m_Hover.visible = true
            }
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
    public get content(): Content {
        return this.m_Content
    }
    public set content(content: Content) {
        if (
            this.m_Content !== undefined ||
            (this.m_Content !== undefined && content === undefined)
        ) {
            this.removeChild(this.m_Content)
            this.m_Content.destroy()
            this.m_Content = undefined
        }

        if (content !== undefined) {
            // Set content for button
            this.m_Content = content
            this.m_Content.position.set(this.width / 2, this.height / 2)

            // Add content to button
            this.addChild(this.m_Content)
        }
    }

    /** Control Data */
    // Need to use any to be able to assign anything
    public get data(): Data {
        return this.m_Data
    }
    public set data(value: Data) {
        this.m_Data = value
    }

    /** Background color of the button (can be overriden) */
    protected get background(): number {
        return colors.controls.button.background.color
    }

    /** Rollover color of the button (can be overriden) */
    protected get hover(): number {
        return colors.controls.button.hover.color
    }

    /** Shall button be raised or pressed (can be overridden) */
    protected get pressed(): boolean {
        return false
    }
}
