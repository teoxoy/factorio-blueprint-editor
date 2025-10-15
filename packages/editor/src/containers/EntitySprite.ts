import { BLEND_MODES, Sprite, Texture } from 'pixi.js'
import { ArithmeticOperation, ComparatorString, IPoint } from '../types'
import G from '../common/globals'
import F from '../UI/controls/functions'
import { Entity } from '../core/Entity'
import { PositionGrid } from '../core/PositionGrid'
import { getSpriteData, ExtendedSpriteData } from '../core/spriteDataBuilder'
import { ColorWithAlpha, getColor } from '../core/factorioData'
import { BlendMode } from 'factorio:prototype'

interface IEntityData {
    name: string
    type?: string
    direction?: number
    position?: IPoint
    generateConnector?: boolean
    directionType?: string
    operator?: undefined | ComparatorString | ArithmeticOperation
    assemblerHasFluidInputs?: boolean
    assemblerHasFluidOutputs?: boolean
    trainStopColor?: ColorWithAlpha
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

        const blend_mode = data.blend_mode || 'normal'
        const mapBlendMode = (blend_mode: BlendMode): BLEND_MODES => {
            switch (blend_mode) {
                case 'normal':
                    return 'normal'
                case 'additive':
                    return 'add'
                case 'multiplicative':
                    return 'multiply'
                case 'additive-soft':
                case 'multiplicative-with-alpha':
                case 'overwrite':
                default:
                    throw new Error('Missing blend mode mapping!')
            }
        }
        this.blendMode = mapBlendMode(blend_mode)

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
            F.applyTint(this, getColor(data.tint))
        } else if (data.apply_runtime_tint) {
            F.applyTint(this, {
                r: 233 / 255,
                g: 195 / 255,
                b: 153 / 255,
                a: 0.8,
            })
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
            assemblerHasFluidInputs: entity.assemblerHasFluidInputs,
            assemblerHasFluidOutputs: entity.assemblerHasFluidOutputs,
            trainStopColor: entity.trainStopColor,
            modules: entity.modules,
        })

        // TODO: maybe move the __zIndex logic to spriteDataBuilder
        const parts: EntitySprite[] = []

        let foundMainBelt = false
        for (let i = 0; i < spriteData.length; i++) {
            const data = spriteData[i]
            if (!data) continue
            if (data.draw_as_shadow) continue

            const texture = G.getTexture(
                data.filename,
                data.x,
                data.y,
                data.width || (Array.isArray(data.size) ? data.size[0] : data.size),
                data.height || (Array.isArray(data.size) ? data.size[1] : data.size)
            )
            const sprite = new EntitySprite(texture, data, position)

            if (data.filename.includes('circuit-connector')) {
                sprite.__zIndex = 1
            } else if (entity.type === 'artillery-turret' && i > 0) {
                sprite.__zIndex = 2
            } else if (
                (entity.type === 'rail-signal' || entity.type === 'rail-chain-signal') &&
                i === 0
            ) {
                sprite.__zIndex = -8
            } else if (
                entity.type === 'legacy-straight-rail' ||
                entity.type === 'legacy-curved-rail'
            ) {
                if (i < 2) {
                    sprite.__zIndex = -10
                } else if (i < 4) {
                    sprite.__zIndex = -9
                } else {
                    sprite.__zIndex = -7
                }
            } else if (entity.type === 'transport-belt' || entity.type === 'heat-pipe') {
                sprite.__zIndex = i === 0 ? -6 : -5

                if (data.filename.includes('connector') && !data.filename.includes('back-patch')) {
                    sprite.__zIndex = 0
                }
            } else if (
                entity.type === 'splitter' ||
                entity.type === 'underground-belt' ||
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
