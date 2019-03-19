import { AdjustmentFilter } from '@pixi/filter-adjustment'
import * as PIXI from 'pixi.js'
import spriteDataBuilder from './factorio-data/spriteDataBuilder'
import Entity from './factorio-data/entity'
import G from './common/globals'

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
    static nextID = 0
    static getNextID() {
        this.nextID += 1
        return this.nextID
    }

    static getParts(entity: IEntityData | Entity, hr: boolean, ignoreConnections?: boolean): EntitySprite[] {
        const anims = spriteDataBuilder.getSpriteData({
            hr,
            dir:
                !ignoreConnections && entity.type === 'electric_pole' && entity instanceof Entity
                    ? G.BPC.wiresContainer.getPowerPoleDirection(entity)
                    : entity.direction,

            name: entity.name,
            bp: ignoreConnections ? undefined : G.bp,
            position: entity.position,
            generateConnector: entity.generateConnector,

            dirType: entity.directionType,
            operator: entity.operator,
            assemblerCraftsWithFluid: entity.assemblerCraftsWithFluid,
            assemblerPipeDirection: entity.assemblerPipeDirection,
            trainStopColor: entity.trainStopColor,
            chemicalPlantDontConnectOutput: entity.chemicalPlantDontConnectOutput
        })

        // TODO: maybe move the zIndex logic to spriteDataBuilder
        const parts: EntitySprite[] = []

        let foundMainBelt = false
        for (let i = 0; i < anims.length; i++) {
            const img = new EntitySprite(anims[i])
            if (anims[i].filename.includes('circuit-connector')) {
                img.zIndex = 1
            } else if (entity.name === 'artillery_turret' && i > 0) {
                img.zIndex = 2
            } else if ((entity.name === 'rail_signal' || entity.name === 'rail_chain_signal') && i === 0) {
                img.zIndex = -8
            } else if (entity.name === 'straight_rail' || entity.name === 'curved_rail') {
                if (i < 2) {
                    img.zIndex = -10
                } else if (i < 4) {
                    img.zIndex = -9
                } else {
                    img.zIndex = -7
                }
            } else if (entity.type === 'transport_belt' || entity.name === 'heat_pipe') {
                img.zIndex = i === 0 ? -6 : -5

                if (anims[i].filename.includes('connector') && !anims[i].filename.includes('back-patch')) {
                    img.zIndex = 0
                }
            } else if (entity.type === 'splitter' || entity.type === 'underground_belt' || entity.type === 'loader') {
                if (!foundMainBelt && anims[i].filename.includes('transport-belt')) {
                    foundMainBelt = true
                    img.zIndex = -6
                }
            } else {
                img.zIndex = 0
            }
            img.zOrder = i

            parts.push(img)
        }

        return parts
    }

    id: number
    shift: IPoint
    zIndex: number
    zOrder: number
    cachedBounds: number[]

    constructor(data: ISpriteData) {
        if (!data.shift) {
            data.shift = [0, 0]
        }
        if (!data.x) {
            data.x = 0
        }
        if (!data.y) {
            data.y = 0
        }
        if (!data.divW) {
            data.divW = 1
        }
        if (!data.divH) {
            data.divH = 1
        }

        const textureKey = `${data.filename}-${data.x}-${data.y}-${data.width / data.divW}-${data.height / data.divH}`
        let texture = PIXI.utils.TextureCache[textureKey]
        if (!texture) {
            const spriteData = PIXI.Texture.from(data.filename)
            texture = new PIXI.Texture(
                spriteData.baseTexture,
                new PIXI.Rectangle(
                    spriteData.frame.x + data.x,
                    spriteData.frame.y + data.y,
                    data.width / data.divW,
                    data.height / data.divH
                )
            )
            PIXI.Texture.addToCache(texture, textureKey)
        }
        super(texture)

        this.id = EntitySprite.getNextID()

        this.shift = {
            x: data.shift[0] * 32,
            y: data.shift[1] * 32
        }

        this.position.set(this.shift.x, this.shift.y)

        if (data.scale) {
            this.scale.set(data.scale, data.scale)
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
            this.filters = [
                new AdjustmentFilter({
                    gamma: 1.4,
                    contrast: 1.4,
                    brightness: 1.2,
                    red: data.tint.r || 1,
                    green: data.tint.g || 1,
                    blue: data.tint.b || 1,
                    alpha: data.tint.a || 1
                })
            ]
        }

        // CACHE LOCAL BOUNDS
        let minX = this.texture.orig.width * -this.anchor.x * data.scale
        let minY = this.texture.orig.height * -this.anchor.y * data.scale
        let maxX = this.texture.orig.width * (1 - this.anchor.x) * data.scale
        let maxY = this.texture.orig.height * (1 - this.anchor.y) * data.scale

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

        this.cachedBounds = [minX, minY, maxX, maxY]

        return this
    }

    setPosition(position: IPoint) {
        this.position.set(position.x + this.shift.x, position.y + this.shift.y)
    }
}
