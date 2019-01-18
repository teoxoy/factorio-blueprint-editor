import G from '../common/globals'
import F from '../controls/functions'

/** Base Checkbox */
export default class Slider extends PIXI.Container {

    /** Static width of slider */
    private static readonly SLIDER_WIDTH = 148 // Actual Width is 164 ... this is a necessary constant to improve calculation
    /** Static height of slider */
    private static readonly SLIDER_HEIGHT = 16

    /** Container to hold switch button */
    private readonly m_Button: PIXI.Container

    /** Is the button being dragged */
    private m_Dragging: boolean

    /** Field to hold reference drag point */
    private m_Dragpoint: number

    /** Value of Slider */
    private m_Value: number

    /**
     * Create switch control
     * @param values - Possible values
     * @param value - Default value (If value is set to undefined - tri-state switch)
     */
    constructor(value: number = 1) {
        super()

        this.interactive = true
        this.m_Dragging = false
        this.m_Value = value
        const factor = 2

        // Draw Slidebar
        const slidebar = F.DrawControlFace(Slider.SLIDER_WIDTH + Slider.SLIDER_HEIGHT, Slider.SLIDER_HEIGHT, factor,
            G.colors.controls.slider.slidebar.color, 1,
            G.colors.controls.slider.slidebar.p0,
            G.colors.controls.slider.slidebar.p1,
            G.colors.controls.slider.slidebar.p2,
            G.colors.controls.slider.slidebar.p3)
        slidebar.position.set(0, 0)
        this.addChild(slidebar)

        // Draw button
        const buttonFace = F.DrawControlFace(Slider.SLIDER_HEIGHT, Slider.SLIDER_HEIGHT, factor,
            G.colors.controls.slider.button.color, 1,
            G.colors.controls.slider.button.p0,
            G.colors.controls.slider.button.p1,
            G.colors.controls.slider.button.p2,
            G.colors.controls.slider.button.p3)
        buttonFace.position.set(0, 0)
        this.addChild(buttonFace)

        const buttonHover = F.DrawControlFace(Slider.SLIDER_HEIGHT, Slider.SLIDER_HEIGHT, factor,
            G.colors.controls.slider.hover.color, 1,
            G.colors.controls.slider.hover.p0,
            G.colors.controls.slider.hover.p1,
            G.colors.controls.slider.hover.p2,
            G.colors.controls.slider.hover.p3)
        buttonHover.position.set(0, 0)
        buttonHover.visible = false
        this.addChild(buttonHover)

        // Add Button
        this.m_Button = new PIXI.Container()
        this.m_Button.interactive = true
        this.m_Button.addChild(buttonFace)
        this.m_Button.addChild(buttonHover)
        this.m_Button.on('pointerover', () => { buttonHover.visible = true })
        this.m_Button.on('pointerout', () => { if (!this.m_Dragging) buttonHover.visible = false })
        this.m_Button.on('pointerdown', (event: PIXI.interaction.InteractionEvent) => this.onButtonDragStart(event))
        this.m_Button.on('pointermove', (event: PIXI.interaction.InteractionEvent) => this.onButtonDragMove(event))
        this.m_Button.on('pointerup', () => this.onButtonDragEnd())
        this.m_Button.on('pointerupoutside', () => this.onButtonDragEnd())
        this.addChild(this.m_Button)
        this.updateButtonPosition()
    }

    /** Slider value */
    public get value(): number {
        return this.m_Value
    }
    public set value(value: number) {
        if (this.m_Value !== value) {
            this.m_Value = value
            this.emit('changed')
            if (! this.m_Dragging) this.updateButtonPosition()
        }
    }

    /** Drag start event responder */
    private onButtonDragStart(event: PIXI.interaction.InteractionEvent) {
        if (!this.m_Dragging) {
            this.m_Dragging = true
            this.m_Dragpoint = event.data.getLocalPosition(this.m_Button.parent).x - this.m_Button.x
            this.m_Button.getChildAt(1).visible = true
        }
    }

    /** Drag move event responder  */
    private onButtonDragMove(event: PIXI.interaction.InteractionEvent) {
        if (this.m_Dragging) {
            const position: PIXI.Point = event.data.getLocalPosition(this.m_Button.parent)

            let x = position.x - this.m_Dragpoint
            if (x > 0 && x < Slider.SLIDER_WIDTH) {
                this.m_Button.x = x
            } else if (x < 0) {
                this.m_Button.x = 0
                x = 0
            } else if (x > Slider.SLIDER_WIDTH) {
                this.m_Button.x = Slider.SLIDER_WIDTH
                x = Slider.SLIDER_WIDTH
            }

            const value = Math.floor(x / 4) + 1
            if (value > 36) {
                this.value = (value - 36) * 10000
            } else if (value > 27) {
                this.value = (value - 27) * 1000
            } else if (value > 18) {
                this.value = (value - 18) * 100
            } else if (value > 9) {
                this.value = (value - 9) * 10
            } else {
                this.value = value
            }
        }
    }

    /** Drag end event responder */
    private onButtonDragEnd() {
        if (this.m_Dragging) {
            this.m_Dragging = false
            this.m_Button.getChildAt(1).visible = false
        }
    }

    /** Update Button Position */
    private updateButtonPosition() {
        let x = 0
        if (this.value >= 20000) {
            x = Slider.SLIDER_WIDTH / 4
        } else if (this.value >= 10000) {
            x = this.value / 10000 + 35
        } else if (this.value >= 1000) {
            x = this.value / 1000 + 26
        } else if (this.value >= 100) {
            x = this.value / 100 + 17
        } else if (this.value >= 10) {
            x = this.value / 10 + 8
        } else if (this.value <= 0) {
            x = 0
        } else {
            x = this.value - 1
        }
        x *= 4
        if (this.m_Button.x !== x) {
            this.m_Button.x = x
        }
    }
}
