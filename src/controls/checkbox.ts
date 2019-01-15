import G from '../common/globals'

/** Base Checkbox */
export default class Checkbox extends PIXI.Container {

    /** Checkmark Polygon */
    private static readonly CHECK_POLYGON: PIXI.Polygon = new PIXI.Polygon(
         0,  0,  4,  0,  8,  4, 12,  4, 16,  0,
        20,  0, 20,  4, 16,  8, 16, 12, 20, 16,
        20, 20, 16, 20, 12, 16,  8, 16,  4, 20,
         0, 20,  0, 16,  4, 12,  4,  8,  0,  4)

    /** Checkmark Graphic */
    private readonly m_Checkmark: PIXI.Graphics

    /** Data of Control */
    private m_Checked: boolean

    constructor(checked: boolean = false, text?: string) {
        super()

        this.interactive = true

        this.m_Checked = checked

        const checkBackground1: PIXI.Graphics = new PIXI.Graphics()
        checkBackground1
            .beginFill(G.colors.controls.checkbox.background.color, G.colors.controls.checkbox.background.alpha)
            .drawRoundedRect(0, 0, 36, 34, 10)
            .endFill()
        checkBackground1.cacheAsBitmap = true
        checkBackground1.scale.set(0.5, 0.5)
        checkBackground1.position.set(0, 0)
        this.addChild(checkBackground1)

        const checkBackground2: PIXI.Graphics = new PIXI.Graphics()
        checkBackground2
            .beginFill(G.colors.controls.checkbox.background.color, G.colors.controls.checkbox.background.alpha)
            .drawRect(0, 0, 16, 15)
            .endFill()
        checkBackground2.position.set(1, 1)
        this.addChild(checkBackground2)

        const checkHover: PIXI.Graphics = new PIXI.Graphics()
        checkHover
            .beginFill(G.colors.controls.checkbox.hover.color, G.colors.controls.checkbox.hover.alpha)
            .drawRoundedRect(0, 0, 36, 34, 10)
            .endFill()
        checkHover.cacheAsBitmap = true
        checkHover.scale.set(0.5, 0.5)
        checkHover.position.set(0, 0)
        checkHover.visible = false
        this.addChild(checkHover)

        this.m_Checkmark = new PIXI.Graphics()
        this.m_Checkmark
            .lineStyle(2, G.colors.controls.checkbox.checkmark.color, G.colors.controls.checkbox.checkmark.alpha, 0.5)
            .beginFill(G.colors.controls.checkbox.checkmark.color, G.colors.controls.checkbox.checkmark.alpha)
            .drawPolygon(Checkbox.CHECK_POLYGON)
        this.m_Checkmark.cacheAsBitmap = true
        this.m_Checkmark.scale.set(0.5, 0.5)
        this.m_Checkmark.position.set(4, 3)
        this.m_Checkmark.visible = this.m_Checked
        this.addChild(this.m_Checkmark)

        if (text !== undefined) {
            const label: PIXI.Text = new PIXI.Text(text, G.styles.controls.checkbox)
            label.position.set(24, 0)
            this.addChild(label)
        }

        this.on('pointerdown', () => {
            this.checked = !this.checked
        })

        this.on('pointerover', () => {
            checkHover.visible = true
        })
        this.on('pointerout', () => {
            checkHover.visible = false
        })
    }

    /** Is button active */
    public get checked(): boolean {
        return this.m_Checked
    }
    public set checked(checked: boolean) {
        if (this.m_Checked !== checked) {
            this.m_Checked = checked
            this.m_Checkmark.visible = this.m_Checked
            this.emit('changed')
        }
    }

}
