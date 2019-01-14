import G from '../common/globals'
import F from './functions'

/** Panel */
/**
 * Base Panel for usage whenever a permanent panel shall be shown to the user
 *
 * Per default the panel
 *  + is visible (this.visible = true)
 *  + is interactive (this.interactive = true)
 *  + has interactive children (this.interactiveChildren = true)
 *  + automatically executes 'onBrowserResize()' on Browser Resizing
 *  + does not automatically set its position (hint: override onBrowserResize())
 */
export default class Panel extends PIXI.Container {

    /** Event string of browser resize */
    private static readonly WINDOW_RESIZE_EVENT_STRING = 'browserResized'

    /** Background Graphic */
    private readonly m_Background: PIXI.Graphics

    /**
     * Constructor
     *
     * @param width - Width of the Control
     * @param height - Height of the Control
     * @param background - Background Color of the Control
     * @param alpha - Background Alpha of the Control (1...no transparency)
     * @param border - Border Width of the Control (0...no border)
     */
    constructor(width: number,
                height: number,
                background: number = G.colors.controls.panel.background.color,
                alpha: number = G.colors.controls.panel.background.alpha,
                border: number = G.colors.controls.panel.background.border) {
        super()

        // Subscribe to browser window resized to amit a panel contained event
        window.addEventListener('resize', () => this.emit(Panel.WINDOW_RESIZE_EVENT_STRING, this))
        // Based on panel event, fire protected method setPosition()
        this.on(Panel.WINDOW_RESIZE_EVENT_STRING, () => this.setPosition())

        this.interactive = true
        this.interactiveChildren = true

        this.m_Background = F.DrawRectangle(width, height, background, alpha, border, false)
        this.addChild(this.m_Background)

        this.setPosition()
    }

    /** Width of the Control */
    public get width(): number {
        return this.m_Background.width
    }

    /** Height of the Control */
    public get height(): number {
        return this.m_Background.height
    }

    /** Called by when the browser is resized */
    protected setPosition() {
        return
    }
}
