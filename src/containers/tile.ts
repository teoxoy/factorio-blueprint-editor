import G from '../common/globals'
import FD from 'factorio-data'
import Tile from '../factorio-data/tile'

export class TileContainer extends PIXI.Container {

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

    constructor(tile: Tile) {
        super()

        this.interactive = false
        this.interactiveChildren = false

        this.position.set(tile.position.x * 32, tile.position.y * 32)

        this.tileSprites = []

        const sprite = TileContainer.generateSprite(tile.name, tile.position)
        sprite.position = this.position
        this.tileSprites.push(sprite)
        G.BPC.tileSprites.addChild(sprite)

        G.BPC.tiles.addChild(this)

        tile.on('destroy', () => {
            this.destroy()
            for (const s of this.tileSprites) s.destroy()
        })
    }
}
