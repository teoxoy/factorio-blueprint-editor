import { Container, Graphics } from 'pixi.js'
import EventEmitter from 'eventemitter3'
import util from '../../../common/util'
import { EntitySprite } from '../../../containers/EntitySprite'
import { OverlayContainer } from '../../../containers/OverlayContainer'
import { Entity, EntityEvents } from '../../../core/Entity'
import { colors } from '../../style'
import F from '../../controls/functions'

/** Preview of Entity */
export class Preview extends Container {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    /** Field to store size for later usage */
    private readonly m_Size: number

    /** Container to host preview */
    private m_Preview: Container

    public constructor(entity: Entity, size: number) {
        super()

        this.m_Entity = entity
        this.m_Size = size

        // Background of entity preview
        const background = new Graphics()
            .rect(0, 0, size, size)
            .fill(
                F.colorAndAlphaToColorSource(
                    colors.editor.sprite.background.color,
                    colors.editor.sprite.background.alpha
                )
            )
        this.addChild(background)

        // Mask for the entity parts
        const mask = new Graphics().rect(0, 0, size, size).fill(0xffffff)
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

    private onEntityChange<T extends EventEmitter.EventNames<EntityEvents>>(
        event: T,
        fn: EventEmitter.EventListener<EntityEvents, T>
    ): void {
        this.m_Entity.on(event, fn)
        this.once('destroyed', () => this.m_Entity.off(event, fn))
    }

    /** Create the perview */
    private generatePreview(): Container {
        // Add all entity parts to a separate container
        const entityParts = new Container()
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
