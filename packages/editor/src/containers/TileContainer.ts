import * as PIXI from 'pixi.js'
import FD from '@fbe/factorio-data'
import G from '../common/globals'
import { Tile } from '../core/Tile'
import { EntitySprite } from './EntitySprite'

export class TileContainer {
    private readonly tileSprites: PIXI.Sprite[] = []

    public constructor(tile: Tile) {
        const sprite = TileContainer.generateSprite(tile.name, tile.x, tile.y)
        sprite.position.set(tile.x * 32, tile.y * 32)
        this.tileSprites.push(sprite)
        G.BPC.addTileSprites([sprite])

        tile.on('destroy', () => this.tileSprites.forEach(s => s.destroy()))
    }

    public static generateSprite(name: string, x: number, y: number): EntitySprite {
        // TODO: maybe optimize this with PIXI.TilingSprite and masks
        // https://github.com/pixijs/pixi.js/wiki/v4-Gotchas#graphics--tilingsprite

        const filename = (() => {
            switch (name) {
                case 'stone_path':
                    return 'graphics/terrain/stone-path/stone-path.png'
                case 'landfill':
                    return 'graphics/terrain/grass-1/grass-1.png'
                default:
                    return FD.tiles[name].variants.material_background.hr_version.picture
            }
        })()

        return new EntitySprite({
            filename,
            x: (Math.abs(Math.floor(x)) % 8) * 64,
            y: (Math.abs(Math.floor(y)) % 8) * 64,
            width: 64,
            height: 64,
            scale: 0.5,
        })
    }
}
