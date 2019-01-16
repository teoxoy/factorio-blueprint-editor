import G from '../common/globals'
import FD from 'factorio-data'

export class TileContainer extends PIXI.Container {
    static mappings: Map<string, TileContainer> = new Map()

    static generateSprite(name: string, position: IPoint) {
        // TODO: maybe optimize this with PIXI.extras.TilingSprite and masks
        const X = Math.floor(position.x) % 8
        const Y = Math.floor(position.y) % 8
        const textureKey = `${name}-${X}-${Y}`
        let texture = PIXI.utils.TextureCache[textureKey]
        if (!texture) {
            const filename = name === 'stone_path' ? 'graphics/terrain/stone-path/stone-path.png' :
                FD.tiles[name].variants.material_background.hr_version.picture

            const spriteData = PIXI.Texture.fromFrame(filename)
            texture = new PIXI.Texture(spriteData.baseTexture, new PIXI.Rectangle(
                spriteData.frame.x + X * 64,
                spriteData.frame.y + Y * 64,
                64,
                64
            ))
            PIXI.Texture.addToCache(texture, textureKey)
        }
        const s = new PIXI.Sprite(texture)
        s.scale.set(0.5)
        s.anchor.set(0.5)
        return s
    }

    tileSprites: PIXI.Sprite[]

    constructor(name: string, position: IPoint) {
        super()

        this.name = name

        this.interactive = false
        this.interactiveChildren = false

        this.position.set(position.x * 32, position.y * 32)
        TileContainer.mappings.set(`${position.x},${position.y}`, this)

        this.tileSprites = []

        const sprite = TileContainer.generateSprite(this.name, position)
        sprite.position = this.position
        this.tileSprites.push(sprite)
        G.BPC.tileSprites.addChild(sprite)
    }

    destroy() {
        TileContainer.mappings.delete(`${this.position.x / 32},${this.position.y / 32}`)
        for (const s of this.tileSprites) s.destroy()
        super.destroy()
    }
}
