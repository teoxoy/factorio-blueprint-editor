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
    modules?: string[]
}

export class EntitySprite extends PIXI.Sprite {
    private static nextID = 0

    private id: number
    /** Should be private but TS complains */
    public zIndex: number
    private zOrder: number
    public cachedBounds: [number, number, number, number]
    private readonly entityPos: IPoint

    public constructor(
        texture: PIXI.Texture,
        data: ISpriteData,
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

        this.cacheBounds(data.width, data.height)

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
            modules: entity.modules,
        })

        // TODO: maybe move the zIndex logic to spriteDataBuilder
        const parts: EntitySprite[] = []

        let foundMainBelt = false
        for (let i = 0; i < spriteData.length; i++) {
            const data = spriteData[i]

            const texture = G.sheet.get(data.filename, data.x, data.y, data.width, data.height)
            const sprite = new EntitySprite(texture, data, position)

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

    public static getPartsAsync(
        entity: IEntityData | Entity,
        position?: IPoint,
        positionGrid?: PositionGrid
    ): Promise<EntitySprite[]> {
        const parts = EntitySprite.getParts(entity, position, positionGrid)
        return G.sheet.onAllLoaded(parts.map(s => s.texture)).then(() => parts)
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

    private cacheBounds(width: number, height: number): void {
        let minX = width * -this.anchor.x * this.scale.x
        let minY = height * -this.anchor.y * this.scale.y
        let maxX = width * (1 - this.anchor.x) * this.scale.x
        let maxY = height * (1 - this.anchor.y) * this.scale.y

        if (this.rotation !== 0) {
            const sin = Math.sin(this.rotation)
            const cos = Math.cos(this.rotation)
            // 01
            // 23
            const x0 = minX * cos - minY * sin
            const y0 = minX * sin + minY * cos

            const x1 = maxX * cos - minY * sin
            const y1 = maxX * sin + minY * cos

            const x2 = minX * cos - maxY * sin
            const y2 = minX * sin + maxY * cos

            const x3 = maxX * cos - maxY * sin
            const y3 = maxX * sin + maxY * cos

            minX = Math.min(x0, x1, x2, x3)
            minY = Math.min(y0, y1, y2, y3)
            maxX = Math.max(x0, x1, x2, x3)
            maxY = Math.max(y0, y1, y2, y3)
        }

        this.cachedBounds = [
            this.position.x + minX,
            this.position.y + minY,
            this.position.x + maxX,
            this.position.y + maxY,
        ]
    }
}
