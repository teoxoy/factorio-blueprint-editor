import * as PIXI from 'pixi.js'
import G from '../common/globals'
import F from '../UI/controls/functions'
import { Entity } from '../core/Entity'
import { PositionGrid } from '../core/PositionGrid'
import { getSpriteData, ISpriteData } from '../core/spriteDataBuilder'

interface IEntityData {
    name: string
    type?: string
    direction?: number
    position?: IPoint
    generateConnector?: boolean
    directionType?: string
    operator?: string
    assemblerCraftsWithFluid?: boolean
    assemblerPipeDirection?: string
    trainStopColor?: {
        r: number
        g: number
        b: number
        a: number
    }
    chemicalPlantDontConnectOutput?: boolean
}

export class EntitySprite extends PIXI.Sprite {
    private static nextID = 0

    private id: number
    /** Should be private but TS complains */
    public zIndex: number
    private zOrder: number
    private readonly entityPos: IPoint

    public constructor(data: ISpriteData, position: IPoint = { x: 0, y: 0 }) {
        if (!data.x) {
            data.x = 0
        }
        if (!data.y) {
            data.y = 0
        }

        const textureKey = `${data.filename}-${data.x}-${data.y}-${data.width}-${data.height}`
        let texture = PIXI.utils.TextureCache[textureKey]
        if (!texture) {
            const spriteData = PIXI.Texture.from(data.filename)
            texture = new PIXI.Texture(
                spriteData.baseTexture,
                new PIXI.Rectangle(
                    spriteData.frame.x + data.x,
                    spriteData.frame.y + data.y,
                    data.width,
                    data.height
                )
            )
            PIXI.Texture.addToCache(texture, textureKey)
        }
        super(texture)

        this.id = EntitySprite.getNextID()

        this.entityPos = position
        this.position.set(position.x, position.y)

        if (data.shift) {
            this.position.x += data.shift[0] * 32
            this.position.y += data.shift[1] * 32
        }

        if (data.scale) {
            this.scale.set(data.scale)
        }

        this.anchor.x = data.anchorX === undefined ? 0.5 : data.anchorX
        this.anchor.y = data.anchorY === undefined ? 0.5 : data.anchorY

        if (data.squishY) {
            this.height /= data.squishY
        }

        if (data.rotAngle) {
            this.angle = data.rotAngle
        }

        if (data.tint) {
            F.applyTint(this, data.tint)
        }

        return this
    }

    private static getNextID(): number {
        this.nextID += 1
        return this.nextID
    }

    public static getParts(
        entity: IEntityData | Entity,
        position?: IPoint,
        positionGrid?: PositionGrid
    ): EntitySprite[] {
        const spriteData = getSpriteData({
            hr: G.hr,
            dir:
                positionGrid && entity.type === 'electric_pole' && entity instanceof Entity
                    ? G.BPC.wiresContainer.getPowerPoleDirection(entity)
                    : entity.direction,

            name: entity.name,
            positionGrid,
            position: entity.position,
            generateConnector: entity.generateConnector,

            dirType: entity.directionType,
            operator: entity.operator,
            assemblerCraftsWithFluid: entity.assemblerCraftsWithFluid,
            assemblerPipeDirection: entity.assemblerPipeDirection,
            trainStopColor: entity.trainStopColor,
            chemicalPlantDontConnectOutput: entity.chemicalPlantDontConnectOutput,
        })

        // TODO: maybe move the zIndex logic to spriteDataBuilder
        const parts: EntitySprite[] = []

        let foundMainBelt = false
        for (let i = 0; i < spriteData.length; i++) {
            const data = spriteData[i]
            const sprite = new EntitySprite(data, position)

            if (data.filename.includes('circuit-connector')) {
                sprite.zIndex = 1
            } else if (entity.name === 'artillery_turret' && i > 0) {
                sprite.zIndex = 2
            } else if (
                (entity.name === 'rail_signal' || entity.name === 'rail_chain_signal') &&
                i === 0
            ) {
                sprite.zIndex = -8
            } else if (entity.name === 'straight_rail' || entity.name === 'curved_rail') {
                if (i < 2) {
                    sprite.zIndex = -10
                } else if (i < 4) {
                    sprite.zIndex = -9
                } else {
                    sprite.zIndex = -7
                }
            } else if (entity.type === 'transport_belt' || entity.name === 'heat_pipe') {
                sprite.zIndex = i === 0 ? -6 : -5

                if (data.filename.includes('connector') && !data.filename.includes('back-patch')) {
                    sprite.zIndex = 0
                }
            } else if (
                entity.type === 'splitter' ||
                entity.type === 'underground_belt' ||
                entity.type === 'loader'
            ) {
                if (!foundMainBelt && data.filename.includes('transport-belt')) {
                    foundMainBelt = true
                    sprite.zIndex = -6
                }
            } else {
                sprite.zIndex = 0
            }
            sprite.zOrder = i

            parts.push(sprite)
        }

        return parts
    }

    public static compareFn(a: EntitySprite, b: EntitySprite): number {
        const dZ = a.zIndex - b.zIndex
        if (dZ !== 0) return dZ

        const dY = a.entityPos.y - b.entityPos.y
        if (dY !== 0) return dY

        const dO = a.zOrder - b.zOrder
        if (dO !== 0) return dO

        const dX = a.entityPos.x - b.entityPos.x
        if (dX !== 0) return dX

        return a.id - b.id
    }
}
