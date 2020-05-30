import FD from '@fbe/factorio-data'
import G from '../common/globals'
import { Tile } from '../core/Tile'
import { EntitySprite } from './EntitySprite'

export class TileContainer {
    private readonly tileSprites: EntitySprite[] = []

    public constructor(tile: Tile) {
        const sprite = TileContainer.generateSprite(tile.name, tile.x, tile.y)
        this.tileSprites.push(sprite)
        G.BPC.addTileSprites([sprite])

        tile.on('destroy', () => this.tileSprites.forEach(s => s.destroy()))
    }

    public static generateSprite(name: string, x: number, y: number): EntitySprite {
        const width = G.hr ? 64 : 32
        const height = G.hr ? 64 : 32
        const scale = G.hr ? 0.5 : 1

        let filename: string
        let countX: number
        let countY: number
        let X: number
        let Y: number

        const variants = FD.tiles[name].variants
        if (variants.material_background === undefined) {
            let variant = variants.main.find(v => (v.size || 1) === 1)
            if (G.hr) {
                variant = variant.hr_version
            }
            filename = variant.picture
            countX = variant.count
            countY = 1
            X = Math.floor(Math.random() * countX)
            Y = Math.floor(Math.random() * countY)
        } else {
            let variant = variants.material_background
            if (G.hr) {
                variant = variant.hr_version
            }
            filename = variant.picture
            countX = 8
            countY = 8
            X = Math.abs(Math.floor(x)) % countX
            Y = Math.abs(Math.floor(y)) % countY
            if (Math.sign(x) === -1) {
                X = countX - 1 - X
            }
            if (Math.sign(y) === -1) {
                Y = countY - 1 - Y
            }
        }

        const mainTexture = G.sheet2.get(filename, 0, 0, countX * width, countY * height)
        const texture = G.sheet2.getSubtexture(
            mainTexture,
            filename,
            X * width,
            Y * height,
            width,
            height
        )

        return new EntitySprite(
            texture,
            {
                filename,
                width,
                height,
                scale,
            },
            {
                x: x * width * scale,
                y: y * height * scale,
            }
        )
    }
}
