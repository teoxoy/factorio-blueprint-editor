import * as PIXI from 'pixi.js'
import util from '../../../common/util'
import { EntitySprite } from '../../../containers/EntitySprite'
import { OverlayContainer } from '../../../containers/OverlayContainer'
import { Entity } from '../../../core/Entity'
import { colors } from '../../style'

/** Preview of Entity */
export class Preview extends PIXI.Container {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    /** Field to store size for later usage */
    private readonly m_Size: number

    /** Container to host preview */
    private m_Preview: PIXI.Container

    public constructor(entity: Entity, size: number) {
        super()

        this.m_Entity = entity
        this.m_Size = size

        // Background of entity preview
        const background = new PIXI.Graphics()
            .beginFill(colors.editor.sprite.background.color, colors.editor.sprite.background.alpha)
            .drawRect(0, 0, size, size)
            .endFill()
        this.addChild(background)

        // Mask for the entity parts
        const mask = new PIXI.Graphics().beginFill(0xffffff).drawRect(0, 0, size, size).endFill()
        this.addChild(mask)
        this.mask = mask

        // Create preview
        this.m_Preview = this.generatePreview()

        // Attach events
        this.onEntityChange('recipe', this.onEntityChanged)
        this.onEntityChange('modules', this.onEntityChanged)
        this.onEntityChange('filters', this.onEntityChanged)
        this.onEntityChange('splitterInputPriority', this.onEntityChanged)
        this.onEntityChange('splitterOutputPriority', this.onEntityChanged)
    }

    private onEntityChange(event: string, fn: (...args: any[]) => void): void {
        this.m_Entity.on(event, fn)
        this.once('destroy', () => this.m_Entity.off(event, fn))
    }

    public destroy(opts?: boolean | PIXI.IDestroyOptions): void {
        this.emit('destroy')
        super.destroy(opts)
    }

    /** Create the perview */
    private generatePreview(): PIXI.Container {
        // Add all entity parts to a separate container
        const entityParts: PIXI.Container = new PIXI.Container()
        entityParts.addChild(...EntitySprite.getParts(this.m_Entity))
        this.addChild(entityParts)

        const actualSpriteSize = { x: this.m_Entity.size.x, y: this.m_Entity.size.y }
        const offset = { x: 0, y: 0 }

        if (this.m_Entity.entityData !== undefined) {
            /** Adjust sprite size and offset based on drawing box */
            const assignDataFromDrawingBox = (db: number[][]): void => {
                actualSpriteSize.x = Math.abs(db[0][0]) + db[1][0]
                actualSpriteSize.y = Math.abs(db[0][1]) + db[1][1]
                offset.x = actualSpriteSize.x / 2 - db[1][0]
                offset.y = actualSpriteSize.y / 2 - db[1][1]
            }

            if (this.m_Entity.entityData.drawing_box !== undefined) {
                assignDataFromDrawingBox(this.m_Entity.entityData.drawing_box)
            }

            if (this.m_Entity.entityData.drawing_boxes !== undefined) {
                assignDataFromDrawingBox(
                    this.m_Entity.entityData.drawing_boxes[util.intToDir(this.m_Entity.direction)]
                )
            }
        }

        const SCALE = this.m_Size / (Math.max(actualSpriteSize.x, actualSpriteSize.y, 3) * 32 + 32)
        entityParts.scale.set(SCALE)
        entityParts.position.set(
            this.m_Size / 2 + offset.x * 32 * SCALE,
            this.m_Size / 2 + offset.y * 32 * SCALE
        )

        const o = OverlayContainer.createEntityInfo(this.m_Entity, { x: 0, y: 0 })
        if (o !== undefined) {
            entityParts.addChild(o)
        }

        return entityParts
    }

    /** Entity changed event callback */
    private readonly onEntityChanged = (): void => {
        this.m_Preview.destroy()
        this.m_Preview = this.generatePreview()
    }
}
