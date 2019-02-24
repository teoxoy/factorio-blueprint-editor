import G from '../common/globals'
import FD from 'factorio-data'
import Tile from '../factorio-data/tile'
import * as PIXI from 'pixi.js'
import { EntitySprite } from '../entitySprite'

export class TileContainer {

    static generateSprite(name: string, position: IPoint) {
        // TODO: maybe optimize this with PIXI.TilingSprite and masks
        // https://github.com/pixijs/pixi.js/wiki/v4-Gotchas#graphics--tilingsprite
        return new EntitySprite({
            filename: name === 'stone_path'
                ? 'graphics/terrain/stone-path/stone-path.png'
                : FD.tiles[name].variants.material_background.hr_version.picture,
            x: Math.floor(position.x) % 8 * 64,
            y: Math.floor(position.y) % 8 * 64,
            width: 64,
            height: 64,
            scale: 0.5
        })
    }

    tileSprites: PIXI.Sprite[]

    constructor(tile: Tile) {
        this.tileSprites = []

        const sprite = TileContainer.generateSprite(tile.name, tile.position)
        sprite.position.set(tile.position.x * 32, tile.position.y * 32)
        this.tileSprites.push(sprite)
        G.BPC.tileSprites.addChild(sprite)

        tile.on('destroy', () => this.tileSprites.forEach(s => s.destroy()))
    }
}
