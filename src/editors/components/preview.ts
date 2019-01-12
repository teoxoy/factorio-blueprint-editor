import C from '../../controls/common'
import G from '../../common/globals'
import { IEntity } from '../../interfaces/iBlueprintEditor'
import { EntityContainer } from '../../containers/entity'
import { OverlayContainer } from '../../containers/overlay'

/** Preview of Entity */
export default class Preview extends PIXI.Container {

    /** Blueprint Editor Entity reference */
    private readonly m_Entity: IEntity

    /** Field to store size for later usage */
    private readonly m_Size: number

    /** Container to host preview */
    private m_Preview: PIXI.Container

    constructor(entity: IEntity, size: number) {
        super()

        this.m_Entity = entity
        this.m_Size = size

        // Background of entity preview
        const background = new PIXI.Graphics()
            .beginFill(C.colors.editor.sprite.background.color, C.colors.editor.sprite.background.alpha)
            .drawRect(0, 0, size, size)
            .endFill()
        this.addChild(background)

        // Mask for the entity parts
        const mask = new PIXI.Graphics()
            .beginFill(0xFFFFFF)
            .drawRect(0, 0, size, size)
            .endFill()
        this.addChild(mask)
        this.mask = mask

        // Create preview
        this.m_Preview = this.generatePreview()
    }

    /** Redraw the preview */
    public redraw() {
        this.m_Preview.destroy()
        this.m_Preview = this.generatePreview()
    }

    /** Create the perview */
    private generatePreview(): PIXI.Container {
        // Add all entity parts to a separate container
        const entityParts: PIXI.Container = new PIXI.Container()
        EntityContainer.getParts(this.m_Entity, G.hr, true).forEach(s => entityParts.addChild(s))
        this.addChild(entityParts)

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

        const SCALE = (this.m_Size / (Math.max(actualSpriteSize.x, actualSpriteSize.y, 3) * 32 + 32))
        entityParts.scale.set(SCALE)
        entityParts.position.set(this.m_Size / 2 + offset.x * 32 * SCALE, this.m_Size / 2 + offset.y * 32 * SCALE)

        const oc: OverlayContainer = new OverlayContainer()
        const o: PIXI.Container = oc.createEntityInfo(this.m_Entity.entity_number, { x: 0, y: 0})
        if (o !== undefined) {
            entityParts.addChild(o)
        }

        return entityParts
    }
}
