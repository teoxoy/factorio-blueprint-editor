import { Container, Graphics, Text } from 'pixi.js'
import { colors, styles } from '../style'
import F from './functions'

/** Base Checkbox */
export class Checkbox extends Container {
    /** Checkmark Polygon */
    // prettier-ignore
    private static readonly CHECK_POLYGON = [
        8,  8, 12,  8, 16, 12, 20, 12, 24,  8,
       28,  8, 28, 12, 24, 16, 24, 20, 28, 24,
       28, 28, 24, 28, 20, 24, 16, 24, 12, 28,
        8, 28,  8, 24, 12, 20, 12, 16,  8, 12,
        8,  8]

    /** Checkbox Graphic */
    private m_Checkbox: Graphics

    /** Checkbox Hover */
    private m_Hover: Graphics

    /** Data of Checkbox */
    private m_Checked: boolean

    public constructor(checked = false, text?: string) {
        super()

        this.eventMode = 'static'
        this.checked = checked

        // Draw text
        if (text !== undefined) {
            const label = new Text({ text, style: styles.controls.checkbox })
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

    /**
     * Draw Checkbox Graphic
     * @param checked - Whether the checkbox graphic shall be checked
     * @param hover - Whether the checkbox graphic shall be shown hovered
     */
    private static drawGraphic(checked: boolean, hover: boolean, visible: boolean): Graphics {
        const graphic = new Graphics()
        graphic
            .rect(2, 2, 32, 32)
            .fill(
                F.colorAndAlphaToColorSource(
                    colors.controls.checkbox.background.color,
                    colors.controls.checkbox.background.alpha
                )
            )
            .roundRect(0, 0, 36, 36, 10)
            .fill(
                F.colorAndAlphaToColorSource(
                    hover
                        ? colors.controls.checkbox.hover.color
                        : colors.controls.checkbox.background.color,
                    hover
                        ? colors.controls.checkbox.hover.alpha
                        : colors.controls.checkbox.background.alpha
                )
            )
            .stroke({
                width: 2,
                color: colors.controls.checkbox.checkmark.color,
                alpha: colors.controls.checkbox.checkmark.alpha,
            })
        if (checked) {
            graphic
                .poly(Checkbox.CHECK_POLYGON)
                .fill(
                    F.colorAndAlphaToColorSource(
                        colors.controls.checkbox.checkmark.color,
                        colors.controls.checkbox.checkmark.alpha
                    )
                )
        }
        graphic.cacheAsTexture(true)
        graphic.scale.set(0.5, 0.5)
        graphic.position.set(0, 0)
        graphic.visible = visible
        return graphic
    }

    /** Is checkbox checked */
    public get checked(): boolean {
        return this.m_Checked
    }
    public set checked(checked: boolean) {
        if (this.m_Checked !== checked) {
            this.m_Checked = checked

            if (this.m_Checkbox !== undefined) {
                this.removeChild(this.m_Checkbox)
            }
            this.m_Checkbox = Checkbox.drawGraphic(this.m_Checked, false, true)
            this.addChild(this.m_Checkbox)

            if (this.m_Hover !== undefined) {
                this.removeChild(this.m_Hover)
            }
            this.m_Hover = Checkbox.drawGraphic(this.m_Checked, true, false)
            this.addChild(this.m_Hover)
        }
    }
}
