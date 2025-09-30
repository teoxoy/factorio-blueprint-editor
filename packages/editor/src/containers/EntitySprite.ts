import { Sprite, Texture } from 'pixi.js'
import { IPoint } from '../types'
import G from '../common/globals'
import F from '../UI/controls/functions'
import { Entity } from '../core/Entity'
import { PositionGrid } from '../core/PositionGrid'
import { getSpriteData, ExtendedSpriteData } from '../core/spriteDataBuilder'
import { ColorWithAlpha } from '../core/factorioData'

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
    trainStopColor?: ColorWithAlpha
    chemicalPlantDontConnectOutput?: boolean
    modules?: string[]
}

export class EntitySprite extends Sprite {
    private static nextID = 0

    private id: number
    private __zIndex: number
    private zOrder: number
    private readonly entityPos: IPoint

    public constructor(
        texture: Texture,
        data: ExtendedSpriteData,
        position: IPoint = { x: 0, y: 0 }
    ) {
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
            dir: entity.direction,

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
            modules: entity.modules,
        })

        // TODO: maybe move the __zIndex logic to spriteDataBuilder
        const parts: EntitySprite[] = []

        let foundMainBelt = false
        for (let i = 0; i < spriteData.length; i++) {
            const data = spriteData[i]

            const texture = G.getTexture(data.filename, data.x, data.y, data.width, data.height)
            const sprite = new EntitySprite(texture, data, position)

            if (data.filename.includes('circuit-connector')) {
                sprite.__zIndex = 1
            } else if (entity.name === 'artillery_turret' && i > 0) {
                sprite.__zIndex = 2
            } else if (
                (entity.name === 'rail_signal' || entity.name === 'rail_chain_signal') &&
                i === 0
            ) {
                sprite.__zIndex = -8
            } else if (
                entity.name === 'legacy_straight_rail' ||
                entity.name === 'legacy_curved_rail'
            ) {
                if (i < 2) {
                    sprite.__zIndex = -10
                } else if (i < 4) {
                    sprite.__zIndex = -9
                } else {
                    sprite.__zIndex = -7
                }
            } else if (entity.type === 'transport_belt' || entity.name === 'heat_pipe') {
                sprite.__zIndex = i === 0 ? -6 : -5

                if (data.filename.includes('connector') && !data.filename.includes('back-patch')) {
                    sprite.__zIndex = 0
                }
            } else if (
                entity.type === 'splitter' ||
                entity.type === 'underground_belt' ||
                entity.type === 'loader'
            ) {
                if (!foundMainBelt && data.filename.includes('transport-belt')) {
                    foundMainBelt = true
                    sprite.__zIndex = -6
                }
            } else {
                sprite.__zIndex = 0
            }
            sprite.zOrder = i

            parts.push(sprite)
        }

        return parts
    }

    public static compareFn(a: EntitySprite, b: EntitySprite): number {
        const dZ = a.__zIndex - b.__zIndex
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
