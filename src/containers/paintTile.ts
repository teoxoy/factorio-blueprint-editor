import G from '../common/globals'
import Tile from '../factorio-data/tile'
import { TileContainer } from './tile'
import { PaintContainer } from './paint'

export class TilePaintContainer extends PaintContainer {
    private static size = 2

    private static getTilePositions() {
        return [...Array(Math.pow(TilePaintContainer.size, 2)).keys()].map(i => {
            const offset = TilePaintContainer.size / 2 - 0.5
            return {
                x: (i % TilePaintContainer.size) - offset,
                y: (i - (i % TilePaintContainer.size)) / TilePaintContainer.size - offset
            }
        })
    }

    public constructor(name: string) {
        super(name)

        G.BPC.transparentEntities()

        this.moveAtCursor()
        this.redraw()
    }

    public hide() {
        G.BPC.transparentEntities(false)
        super.hide()
    }

    public show() {
        G.BPC.transparentEntities()
        super.show()
    }

    public destroy() {
        G.BPC.transparentEntities(false)
        super.destroy()
    }

    public getItemName() {
        return Tile.getItemName(this.name)
    }

    public increaseSize() {
        if (TilePaintContainer.size === 20) {
            return
        }
        TilePaintContainer.size += 1
        this.moveAtCursor()
        this.redraw()
    }

    public decreaseSize() {
        if (TilePaintContainer.size === 1) {
            return
        }
        TilePaintContainer.size -= 1
        this.moveAtCursor()
        this.redraw()
    }

    public rotate() {
        if (this.name.includes('hazard')) {
            this.name = this.name.includes('left')
                ? this.name.replace('left', 'right')
                : this.name.replace('right', 'left')
            this.redraw()
        }
    }

    protected redraw() {
        this.removeChildren()

        this.addChild(
            ...TilePaintContainer.getTilePositions().map(p => {
                const s = TileContainer.generateSprite(this.name, {
                    x: p.x + this.position.x,
                    y: p.y + this.position.y
                })
                s.position.set(p.x * 32, p.y * 32)
                s.alpha = 0.5
                return s
            })
        )
    }

    public moveAtCursor() {
        this.setNewPosition({
            x: TilePaintContainer.size,
            y: TilePaintContainer.size
        })
    }

    public removeContainerUnder() {
        const position = this.getGridPosition()

        G.bp.removeTiles(TilePaintContainer.getTilePositions().map(p => ({ x: p.x + position.x, y: p.y + position.y })))
    }

    public placeEntityContainer() {
        if (!this.visible) {
            return
        }

        const position = this.getGridPosition()

        G.bp.createTiles(
            this.name,
            TilePaintContainer.getTilePositions().map(p => ({ x: p.x + position.x, y: p.y + position.y }))
        )
    }
}
