import C from '../controls/common'
import G from '../common/globals'
import Dialog from '../controls/dialog'
import { EntityContainer } from '../containers/entity'

/** Editor */
export default class Editor extends Dialog {

    /** Capitalize String */
    private static capitalize(text: string): string {
        return text.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    }

    /** Textbox for Title */
    private readonly m_Tilte: PIXI.Text

    /** Container for The Entity Preview */
    private readonly m_EntityPreview: PIXI.Container

    /** Field to hold entity */
    private readonly m_Entity: any

    constructor(width: number, height: number, entity: any) {
        super(width, height)

        this.m_Entity = entity

        this.m_Tilte = new PIXI.Text(Editor.capitalize(this.m_Entity.name), C.styles.dialog.title)
        this.m_Tilte.position.set(12, 10)
        this.addChild(this.m_Tilte)

        this.m_EntityPreview = this.generateEntityPreview(120)
        this.m_EntityPreview.position.set(12, 45)
        this.addChild(this.m_EntityPreview)
    }

    generateEntityPreview(previewSize: number) {

        const entityPreview = new PIXI.Container()

        // Background of entity preview
        const background = new PIXI.Graphics()
            .beginFill(C.colors.editor.sprite.background.color, C.colors.editor.sprite.background.alpha)
            .drawRect(0, 0, previewSize, previewSize)
            .endFill()
        entityPreview.addChild(background)

        // Mask for the entity parts
        const mask = new PIXI.Graphics()
            .beginFill(0xFFFFFF)
            .drawRect(0, 0, previewSize, previewSize)
            .endFill()
        entityPreview.addChild(mask)
        entityPreview.mask = mask

        // Add all entity parts to a separate container
        const entityParts = new PIXI.Container()
        EntityContainer.getParts(this.m_Entity, G.hr, true).forEach(s => entityParts.addChild(s))
        entityPreview.addChild(entityParts)

        // Insted of using entityParts.getBounds() to calculate the position and scale of entityParts
        // we have to use the enity size and manually tinker with values to get the preview to look right.
        // This is because the width and height of getBounds include the transparent padding of the entity parts.
        const actualSpriteSize = { x: this.m_Entity.size.x, y: this.m_Entity.size.y }
        let offset = { x: 0, y: 0 }

        switch (this.m_Entity.name) {
            case 'train_stop':
                actualSpriteSize.x += 2
                actualSpriteSize.y += 2

                switch (this.m_Entity.direction) {
                    case 0: offset = { x: 1, y: 0.5 }; break
                    case 2: offset = { x: 0, y: 1.5 }; break
                    case 4: offset = { x: -1, y: 1 }; break
                    case 6: offset = { x: 0, y: -0.5 }
                }
                break
            case 'beacon':
            case 'centrifuge':
                actualSpriteSize.y += 0.4

                offset = { x: 0, y: 0.4 }
                break
            case 'programmable_speaker':
                offset = { x: 0, y: 1 }
                break
            case 'pumpjack':
                actualSpriteSize.y += 0.15

                offset = { x: 0, y: 0.15 }
                break
            case 'chemical_plant':
                if (this.m_Entity.direction === 0 || this.m_Entity.direction === 4) {
                    actualSpriteSize.y += 0.25

                    offset = { x: 0, y: 0.25 }
                }
                break
            case 'oil_refinery':
                if (this.m_Entity.direction === 0 || this.m_Entity.direction === 6) {
                    actualSpriteSize.y += 0.25

                    offset = { x: 0, y: 0.25 }
                }

            case 'offshore_pump':
                if (this.m_Entity.direction === 4) offset = { x: 0, y: -0.5 }
        }

        const SCALE = (previewSize / (Math.max(actualSpriteSize.x, actualSpriteSize.y, 3) * 32 + 32))
        entityParts.scale.set(SCALE)
        entityParts.position.set(previewSize / 2 + offset.x * 32 * SCALE, previewSize / 2 + offset.y * 32 * SCALE)

        return entityPreview
    }
}
