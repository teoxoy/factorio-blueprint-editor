import G from '../common/globals'
import Tile from '../factorio-data/tile'
import { TileContainer } from './tile'
import { PaintContainer } from './paint'

export class TilePaintContainer extends PaintContainer {
    static size = 2

    static getTilePositions() {
        return [...Array(Math.pow(TilePaintContainer.size, 2)).keys()].map(i => {
            const offset = TilePaintContainer.size / 2 - 0.5
            return {
                x: (i % TilePaintContainer.size) - offset,
                y: (i - (i % TilePaintContainer.size)) / TilePaintContainer.size - offset
            }
        })
    }

    constructor(name: string) {
        super(name)

        G.BPC.transparentEntities()

        this.moveAtCursor()
        this.redraw()
    }

    hide() {
        G.BPC.transparentEntities(false)
        super.hide()
    }

    show() {
        G.BPC.transparentEntities()
        super.show()
    }

    destroy() {
        G.BPC.transparentEntities(false)
        super.destroy()
    }

    getItemName() {
        return Tile.getItemName(this.name)
    }

    increaseSize() {
        if (TilePaintContainer.size === 20) {
            return
        }
        TilePaintContainer.size += 1
        this.moveAtCursor()
        this.redraw()
    }

    decreaseSize() {
        if (TilePaintContainer.size === 1) {
            return
        }
        TilePaintContainer.size -= 1
        this.moveAtCursor()
        this.redraw()
    }

    rotate() {
        if (this.name.includes('hazard')) {
            this.name = this.name.includes('left')
                ? this.name.replace('left', 'right')
                : this.name.replace('right', 'left')
            this.redraw()
        }
    }

    redraw() {
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

    moveAtCursor() {
        this.setNewPosition({
            x: TilePaintContainer.size,
            y: TilePaintContainer.size
        })
    }

    removeContainerUnder() {
        const position = this.getGridPosition()

        G.bp.removeTiles(TilePaintContainer.getTilePositions().map(p => ({ x: p.x + position.x, y: p.y + position.y })))
    }

    placeEntityContainer() {
        const position = this.getGridPosition()

        G.bp.createTiles(
            this.name,
            TilePaintContainer.getTilePositions().map(p => ({ x: p.x + position.x, y: p.y + position.y }))
        )
    }
}
