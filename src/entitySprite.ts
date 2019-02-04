import { AdjustmentFilter } from '@pixi/filter-adjustment'

export class EntitySprite extends PIXI.Sprite {
    static nextID = 0

    id: number
    shift: IPoint
    zIndex: number
    zOrder: number

    constructor(data: ISpriteData) {
        if (!data.shift) data.shift = [0, 0]
        if (!data.x) data.x = 0
        if (!data.y) data.y = 0
        if (!data.divW) data.divW = 1
        if (!data.divH) data.divH = 1

        const textureKey = `${data.filename}-${data.x}-${data.y}-${data.width / data.divW}-${data.height / data.divH}`
        let texture = PIXI.utils.TextureCache[textureKey]
        if (!texture) {
            const spriteData = PIXI.Texture.fromFrame(data.filename)
            texture = new PIXI.Texture(spriteData.baseTexture, new PIXI.Rectangle(
                spriteData.frame.x + data.x,
                spriteData.frame.y + data.y,
                data.width / data.divW,
                data.height / data.divH
            ))
            PIXI.Texture.addToCache(texture, textureKey)
        }
        super(texture)

        this.interactive = false
        this.id = EntitySprite.nextID++

        this.shift = {
            x: data.shift[0] * 32,
            y: data.shift[1] * 32
        }

        this.position.set(this.shift.x, this.shift.y)

        if (data.scale) this.scale.set(data.scale, data.scale)
        this.anchor.set(0.5, 0.5)

        if (data.flipX) this.scale.x *= -1
        if (data.flipY) this.scale.y *= -1

        if (data.height_divider) this.height /= data.height_divider

        if (data.rot) this.rotation = data.rot * Math.PI * 0.5

        if (data.color) {
            this.filters = [new AdjustmentFilter({
                gamma: 1.4,
                contrast: 1.4,
                brightness: 1.2,
                red: data.color.r,
                green: data.color.g,
                blue: data.color.b,
                alpha: data.color.a
            })]
        }

        return this
    }

    setPosition(position: PIXI.Point | PIXI.ObservablePoint) {
        this.position.set(
            position.x + this.shift.x,
            position.y + this.shift.y
        )
    }
}
