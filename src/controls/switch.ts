import G from '../common/globals'
import F from '../controls/functions'

/** Base Checkbox */
export default class Switch extends PIXI.Container {

    /** Container to hold switch button */
    private readonly m_Button: PIXI.Container

    /** Options for switch */
    private readonly m_Values: string[]

    /** Data of switch */
    private m_Value: string

    /**
     * Create switch control
     * @param values - Possible values
     * @param value - Default value (If value is set to undefined - tri-state switch)
     */
    constructor(values: string[], value?: string) {
        super()

        this.interactive = true
        this.m_Values = values
        this.m_Value = value

        // Draw bounds (needed so mouse click will react at the entire switch area)
        const boundaryGraphic: PIXI.Graphics = new PIXI.Graphics()
        boundaryGraphic.beginFill(0x000000, 0).drawRect(0, 0, 36, 16).endFill()
        boundaryGraphic.position.set(0, 0)
        this.addChild(boundaryGraphic)

        // Draw line
        const buttonLine: PIXI.Graphics = new PIXI.Graphics()
        buttonLine
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.line.color, G.colors.controls.switch.line.p0))
            .moveTo(1, 0).lineTo(72, 0)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.line.color, G.colors.controls.switch.line.p1))
            .moveTo(1, 2).lineTo(72, 2)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.line.color, G.colors.controls.switch.line.p2))
            .moveTo(1, 4).lineTo(72, 4)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.line.color, G.colors.controls.switch.line.p3))
            .moveTo(1, 6).lineTo(72, 6)
        buttonLine.cacheAsBitmap = true
        buttonLine.scale.set(0.5, 0.5)
        buttonLine.position.set(0, 6)
        this.addChild(buttonLine)

        // Draw button
        const buttonMask: PIXI.Graphics = new PIXI.Graphics()
        buttonMask.beginFill(0x000000).drawRoundedRect(0, 0, 32, 32, 6).endFill()

        const buttonFace: PIXI.Graphics = new PIXI.Graphics()
        buttonFace
            .beginFill(G.colors.controls.switch.background.color).drawRect(0, 0, 32, 32).endFill()
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.background.color, G.colors.controls.switch.background.p3), 1, 0)
            .moveTo(32, 0).lineTo(32, 32).lineTo(0, 32)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.background.color, G.colors.controls.switch.background.p2), 1, 0)
            .moveTo(30, 2).lineTo(30, 30).lineTo(2, 30)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.background.color, G.colors.controls.switch.background.p1), 1, 0)
            .moveTo(30, 2).lineTo(2, 2).lineTo(2, 30)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.background.color, G.colors.controls.switch.background.p0), 1, 0)
            .moveTo(32, 0).lineTo(0, 0).lineTo(0, 32)
        buttonFace.cacheAsBitmap = true
        buttonFace.scale.set(0.5, 0.5)
        buttonFace.position.set(0, 0)
        buttonFace.mask = buttonMask

        const buttonHover: PIXI.Graphics = new PIXI.Graphics()
        buttonHover
            .beginFill(G.colors.controls.switch.hover.color).drawRect(0, 0, 32, 32).endFill()
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.hover.color, G.colors.controls.switch.hover.p3), 1, 0)
            .moveTo(32, 0).lineTo(32, 32).lineTo(0, 32)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.hover.color, G.colors.controls.switch.hover.p2), 1, 0)
            .moveTo(30, 2).lineTo(30, 30).lineTo(2, 30)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.hover.color, G.colors.controls.switch.hover.p1), 1, 0)
            .moveTo(30, 2).lineTo(2, 2).lineTo(2, 30)
            .lineStyle(2, F.ShadeColor(G.colors.controls.switch.hover.color, G.colors.controls.switch.hover.p0), 1, 0)
            .moveTo(32, 0).lineTo(0, 0).lineTo(0, 32)
        buttonHover.cacheAsBitmap = true
        buttonHover.scale.set(0.5, 0.5)
        buttonHover.position.set(0, 0)
        buttonHover.mask = buttonMask
        buttonHover.visible = false

        this.m_Button = new PIXI.Container()
        this.m_Button.addChild(buttonFace)
        this.m_Button.addChild(buttonHover)
        this.addChild(this.m_Button)
        this.updateButtonPosition()

        // Attach events
        this.on('pointerdown', () => {
            const index: number = this.m_Value === undefined ? 1 : this.m_Values.indexOf(this.m_Value)
            this.value = this.m_Values[index === 0 ? 1 : 0]
        })
        this.on('pointerover', () => {
            buttonHover.visible = true
        })
        this.on('pointerout', () => {
            buttonHover.visible = false
        })
    }

    /** Is checkbox checked */
    public get value(): string {
        return this.m_Value
    }
    public set value(value: string) {
        if (this.m_Value !== value) {
            this.m_Value = value
            this.emit('changed')
            this.updateButtonPosition()
        }
    }

    /** Update Button Position based on value */
    private updateButtonPosition() {
        const index: number = this.m_Value === undefined ? -1 : this.m_Values.indexOf(this.m_Value)
        if (index === -1) {
            this.m_Button.position.set(10, 0)
        } else {
            this.m_Button.position.set(20 * index, 0)
        }
    }
}
