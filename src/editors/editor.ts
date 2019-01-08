import C from '../controls/common'
import G from '../globals'
import Dialog from '../controls/dialog'
import { EntityContainer } from '../containers/entity'

/** Editor */
export default abstract class Editor extends Dialog {

    /** Capitalize String */
    private static capitalize(text: string): string {
        return text.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    }

    /** Textbox for Title */
    private readonly m_Tilte: PIXI.Text

    /** Container for Sprite */
    private readonly m_Sprite: PIXI.Container

    /** Field to hold entity */
    private readonly m_Entity: any

    constructor(width: number, height: number, entity: any) {
        super(width, height)

        this.m_Entity = entity

        this.m_Tilte = new PIXI.Text(Editor.capitalize(this.m_Entity.name), C.styles.dialog.title)
        this.m_Tilte.position.set(12, 10)
        this.addChild(this.m_Tilte)

        const spriteBackground: PIXI.Graphics = new PIXI.Graphics()
        spriteBackground.position.set(12, 45)
        spriteBackground
            .beginFill(C.colors.editor.sprite.background.color, C.colors.editor.sprite.background.alpha)
            .drawRect(0, 0, 114, 114)
            .endFill()
        this.addChild(spriteBackground)

        const spriteForeground: PIXI.Container = new PIXI.Container()
        spriteForeground.position.set(12, 45)
        this.addChild(spriteForeground)

        this.m_Sprite = new PIXI.Container()
        for (const s of EntityContainer.getParts(this.m_Entity, G.hr, true)) {
            this.m_Sprite.addChild(s)
        }
        this.m_Sprite.position = this.spritePosition
        this.m_Sprite.scale = this.spriteScale
        spriteForeground.addChild(this.m_Sprite)
    }

    /** The generated sprite which can be used for calculating spriteLocation and spriteScale */
    protected get spriteBounds(): PIXI.Rectangle { return this.m_Sprite.getBounds() }

    /** Override default Sprite Location (Center) */
    protected get spritePosition(): PIXI.Point { return new PIXI.Point(57, 57) }

    /** Override default Sprite Scale (1) */
    protected get spriteScale(): PIXI.Point { return new PIXI.Point(1, 1) }

}
