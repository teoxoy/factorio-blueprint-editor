import G from '../globals'
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
    constructor(width: number, height: number, background: number = G.colors.pannel.background, alpha: number = 0.7, border: number = 2) {
        super()

        window.addEventListener('resize', () => {
            this.onBrowserResize()
        }, false)

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

    /**
     * Called when the browser window is reseized
     */
    protected onBrowserResize(): void {
        this.setPosition()
    }

    /**
     * Called by onBrowserResize
     */
    protected setPosition() {
        return
    }
}
