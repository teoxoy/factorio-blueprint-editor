import { Container, ContainerChild, FederatedPointerEvent } from 'pixi.js'
import { colors } from '../style'
import F from './functions'

/** Slider Control */
export class Slider extends Container {
    /** Static width of slider */
    private static readonly SLIDER_WIDTH = 148 // Actual Width is 164 ... this is a necessary constant to improve calculation
    /** Static height of slider */
    private static readonly SLIDER_HEIGHT = 16

    /** Container to hold slider button */
    private readonly m_SliderButton: Container

    /** Container to hold slider value graphic */
    private readonly m_SliderValue: Container

    /** Is the button being dragged */
    private m_Dragging: boolean

    /** Field to hold reference drag point */
    private m_Dragpoint: number

    /** Value of Slider */
    private p_Value: number

    /**
     * Create slider control
     * @param values - Possible values
     * @param value - Default value (If value is set to undefined - tri-state switch)
     */
    public constructor(value = 1) {
        super()

        this.eventMode = 'static'
        this.m_Dragging = false
        const factor = 2

        // Draw slide bar
        const slidebar = F.DrawControlFace(
            Slider.SLIDER_WIDTH + Slider.SLIDER_HEIGHT,
            Slider.SLIDER_HEIGHT,
            factor,
            colors.controls.slider.slidebar.color,
            1,
            colors.controls.slider.slidebar.p0,
            colors.controls.slider.slidebar.p1,
            colors.controls.slider.slidebar.p2,
            colors.controls.slider.slidebar.p3
        )
        slidebar.position.set(0, 0)
        this.addChild(slidebar)

        // Draw slider value
        this.m_SliderValue = new Container()
        this.m_SliderValue.position.set(0, 0)
        this.addChild(this.m_SliderValue)

        // Draw slide button
        const buttonFace = F.DrawControlFace(
            Slider.SLIDER_HEIGHT,
            Slider.SLIDER_HEIGHT,
            factor,
            colors.controls.slider.button.color,
            1,
            colors.controls.slider.button.p0,
            colors.controls.slider.button.p1,
            colors.controls.slider.button.p2,
            colors.controls.slider.button.p3
        )
        buttonFace.position.set(0, 0)

        const buttonHover = F.DrawControlFace(
            Slider.SLIDER_HEIGHT,
            Slider.SLIDER_HEIGHT,
            factor,
            colors.controls.slider.hover.color,
            1,
            colors.controls.slider.hover.p0,
            colors.controls.slider.hover.p1,
            colors.controls.slider.hover.p2,
            colors.controls.slider.hover.p3
        )
        buttonHover.position.set(0, 0)
        buttonHover.visible = false

        // Add Button
        this.m_SliderButton = new Container()
        this.m_SliderButton.eventMode = 'static'
        this.m_SliderButton.addChild(buttonFace)
        this.m_SliderButton.addChild(buttonHover)
        this.m_SliderButton.on('pointerover', () => {
            buttonHover.visible = true
        })
        this.m_SliderButton.on('pointerout', () => {
            if (!this.m_Dragging) {
                buttonHover.visible = false
            }
        })
        this.m_SliderButton.on('pointerdown', this.onButtonDragStart, this)
        this.m_SliderButton.on('globalpointermove', this.onButtonDragMove, this)
        this.m_SliderButton.on('pointerup', this.onButtonDragEnd, this)
        this.m_SliderButton.on('pointerupoutside', this.onButtonDragEnd, this)
        this.addChild(this.m_SliderButton)
        this.value = value
    }

    /** Slider value */
    public get value(): number {
        return this.p_Value
    }
    public set value(value: number) {
        if (this.p_Value !== value) {
            this.p_Value = value
            this.emit('changed')
            if (!this.m_Dragging) {
                this.updateButtonPosition()
            }
        }
    }

    /** Update button position */
    private updateButtonPosition(): void {
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
        if (this.m_SliderButton.x !== x) {
            this.m_SliderButton.x = x
        }

        this.updateSliderValue()
    }

    /** Update slider value */
    private updateSliderValue(): void {
        this.m_SliderValue.removeChildren()
        if (this.m_SliderButton.x > 0) {
            this.m_SliderValue.addChild(
                F.DrawControlFace(
                    this.m_SliderButton.x + 2,
                    Slider.SLIDER_HEIGHT,
                    2,
                    colors.controls.slider.value.color,
                    1,
                    colors.controls.slider.value.p0,
                    colors.controls.slider.value.p1,
                    colors.controls.slider.value.p2,
                    colors.controls.slider.value.p3
                )
            )
        }
    }

    /** Drag start event responder */
    private readonly onButtonDragStart = (event: FederatedPointerEvent): void => {
        if (!this.m_Dragging) {
            this.m_Dragging = true
            this.m_Dragpoint =
                this.m_SliderButton.parent.worldTransform.applyInverse(event.global).x -
                this.m_SliderButton.x
            this.m_SliderButton.getChildAt<ContainerChild>(1).visible = true
        }
    }

    /** Drag move event callback  */
    private readonly onButtonDragMove = (event: FederatedPointerEvent): void => {
        if (this.m_Dragging) {
            const position = this.m_SliderButton.parent.worldTransform.applyInverse(event.global)

            let x = position.x - this.m_Dragpoint
            if (x > 0 && x < Slider.SLIDER_WIDTH) {
                this.m_SliderButton.x = x
            } else if (x < 0) {
                this.m_SliderButton.x = 0
                x = 0
            } else if (x > Slider.SLIDER_WIDTH) {
                this.m_SliderButton.x = Slider.SLIDER_WIDTH
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

            this.updateSliderValue()
        }
    }

    /** Drag end event callback */
    private readonly onButtonDragEnd = (): void => {
        if (this.m_Dragging) {
            this.m_Dragging = false
            this.m_SliderButton.getChildAt<ContainerChild>(1).visible = false
        }
    }
}
