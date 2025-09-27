import { Container, Graphics } from 'pixi.js'
import { colors } from '../style'
import F from './functions'

/** Base Checkbox */
export class Switch<T extends string> extends Container {
    /** Container to hold switch button */
    private readonly m_Button: Container

    /** Options for switch */
    private readonly m_Values: T[]

    /** Data of switch */
    private m_Value: T

    /**
     * Create switch control
     * @param values - Possible values
     * @param value - Default value (If value is set to undefined - tri-state switch)
     */
    public constructor(values: T[], value?: T) {
        super()

        this.eventMode = 'static'
        this.m_Values = values
        this.m_Value = value

        // Draw bounds (needed so mouse click will react at the entire switch area)
        const boundaryGraphic = new Graphics()
        boundaryGraphic.rect(0, 0, 36, 16).fill({ r: 0, g: 0, b: 0, a: 0 })
        boundaryGraphic.position.set(0, 0)
        this.addChild(boundaryGraphic)

        // Draw line
        const buttonLine = new Graphics()
        buttonLine
            .moveTo(1, 0)
            .lineTo(72, 0)
            .stroke({
                width: 2,
                color: F.ShadeColor(
                    colors.controls.switch.line.color,
                    colors.controls.switch.line.p0
                ),
            })
            .moveTo(1, 2)
            .lineTo(72, 2)
            .stroke({
                width: 2,
                color: F.ShadeColor(
                    colors.controls.switch.line.color,
                    colors.controls.switch.line.p1
                ),
            })
            .moveTo(1, 4)
            .lineTo(72, 4)
            .stroke({
                width: 2,
                color: F.ShadeColor(
                    colors.controls.switch.line.color,
                    colors.controls.switch.line.p2
                ),
            })
            .moveTo(1, 6)
            .lineTo(72, 6)
            .stroke({
                width: 2,
                color: F.ShadeColor(
                    colors.controls.switch.line.color,
                    colors.controls.switch.line.p3
                ),
            })
        buttonLine.cacheAsTexture(true)
        buttonLine.scale.set(0.5, 0.5)
        buttonLine.position.set(0, 6)
        this.addChild(buttonLine)

        // Draw button
        const buttonMask = new Graphics()
        buttonMask.roundRect(0, 0, 32, 32, 6).fill(0x000000)

        // Draw button
        const buttonFace = F.DrawControlFace(
            16,
            16,
            2,
            colors.controls.switch.background.color,
            1,
            colors.controls.switch.background.p0,
            colors.controls.switch.background.p1,
            colors.controls.switch.background.p2,
            colors.controls.switch.background.p3
        )
        buttonFace.position.set(0, 0)

        const buttonHover = F.DrawControlFace(
            16,
            16,
            2,
            colors.controls.switch.hover.color,
            1,
            colors.controls.switch.hover.p0,
            colors.controls.switch.hover.p1,
            colors.controls.switch.hover.p2,
            colors.controls.switch.hover.p3
        )
        buttonHover.position.set(0, 0)
        buttonHover.visible = false

        this.m_Button = new Container()
        this.m_Button.addChild(buttonFace)
        this.m_Button.addChild(buttonHover)
        this.addChild(this.m_Button)
        this.updateButtonPosition()

        // Attach events
        this.on('pointerdown', () => {
            const index: number =
                this.m_Value === undefined ? 1 : this.m_Values.indexOf(this.m_Value)
            this.value = this.m_Values[index === 0 ? 1 : 0]
            this.emit('changed')
        })
        this.on('pointerover', () => {
            buttonHover.visible = true
        })
        this.on('pointerout', () => {
            buttonHover.visible = false
        })
    }

    /** Is checkbox checked */
    public get value(): T {
        return this.m_Value
    }
    public set value(value: T) {
        if (this.m_Value !== value) {
            this.m_Value = value
            this.updateButtonPosition()
        }
    }

    /** Update Button Position based on value */
    private updateButtonPosition(): void {
        const index = this.m_Value === undefined ? -1 : this.m_Values.indexOf(this.m_Value)
        if (index === -1) {
            this.m_Button.position.set(10, 0)
        } else {
            this.m_Button.position.set(20 * index, 0)
        }
    }
}
