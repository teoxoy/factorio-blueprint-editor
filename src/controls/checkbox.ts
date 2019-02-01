import G from '../common/globals'

/** Base Checkbox */
export default class Checkbox extends PIXI.Container {

    /** Checkmark Polygon */
    private static readonly CHECK_POLYGON: PIXI.Polygon = new PIXI.Polygon(
         8,  8, 12,  8, 16, 12, 20, 12, 24,  8,
        28,  8, 28, 12, 24, 16, 24, 20, 28, 24,
        28, 28, 24, 28, 20, 24, 16, 24, 12, 28,
         8, 28,  8, 24, 12, 20, 12, 16,  8, 12,
         8,  8)

    /**
     * Draw Checkbox Graphic
     * @param checked - Whether the checkbox graphic shall be checked
     * @param hover - Whether the checkbox graphic shall be shown hovered
     */
    private static drawGraphic(checked: boolean, hover: boolean, visible: boolean): PIXI.Graphics {
        const graphic: PIXI.Graphics = new PIXI.Graphics()
        graphic
            .beginFill(G.colors.controls.checkbox.background.color, G.colors.controls.checkbox.background.alpha)
            .drawRect(2, 2, 32, 32)
            .beginFill(hover ? G.colors.controls.checkbox.hover.color : G.colors.controls.checkbox.background.color,
                       hover ? G.colors.controls.checkbox.hover.alpha : G.colors.controls.checkbox.background.alpha)
            .drawRoundedRect(0, 0, 36, 36, 10)
            .lineStyle(2, G.colors.controls.checkbox.checkmark.color, G.colors.controls.checkbox.checkmark.alpha, 0.5)
        if (checked) {
            graphic
                .beginFill(G.colors.controls.checkbox.checkmark.color, G.colors.controls.checkbox.checkmark.alpha)
                .drawPolygon(Checkbox.CHECK_POLYGON)
        }
        graphic.cacheAsBitmap = true
        graphic.scale.set(0.5, 0.5)
        graphic.position.set(0, 0)
        graphic.visible = visible
        return graphic
    }

    /** Checkbox Graphic */
    private m_Checkbox: PIXI.Graphics

    /** Checkbox Hover */
    private m_Hover: PIXI.Graphics

    /** Data of Checkbox */
    private m_Checked: boolean

    constructor(checked: boolean = false, text?: string) {
        super()

        this.interactive = true
        this.checked = checked

        // Draw text
        if (text !== undefined) {
            const label: PIXI.Text = new PIXI.Text(text, G.styles.controls.checkbox)
            label.position.set(24, 0)
            this.addChild(label)
        }

        // Attach events
        this.on('pointerdown', () => {
            this.checked = !this.checked
            this.emit('changed')
        })
        this.on('pointerover', () => {
            this.m_Hover.visible = true
        })
        this.on('pointerout', () => {
            this.m_Hover.visible = false
        })
    }

    /** Is checkbox checked */
    public get checked(): boolean {
        return this.m_Checked
    }
    public set checked(checked: boolean) {
        if (this.m_Checked !== checked) {
            this.m_Checked = checked

            if (this.m_Checkbox !== undefined) this.removeChild(this.m_Checkbox)
            this.m_Checkbox = Checkbox.drawGraphic(this.m_Checked, false, true)
            this.addChild(this.m_Checkbox)

            if (this.m_Hover !== undefined) this.removeChild(this.m_Hover)
            this.m_Hover = Checkbox.drawGraphic(this.m_Checked, true, false)
            this.addChild(this.m_Hover)
        }
    }
}
