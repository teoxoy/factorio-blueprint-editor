import G from '../common/globals'
import { Tile } from '../core/Tile'
import { TileContainer } from './TileContainer'
import { PaintContainer } from './PaintContainer'

export class PaintTileContainer extends PaintContainer {
    private static size = 2

    public constructor(name: string) {
        super(name)

        G.BPC.transparentEntities()

        this.moveAtCursor()
        this.redraw()
    }

    private static getTilePositions(): IPoint[] {
        return [...Array(Math.pow(PaintTileContainer.size, 2)).keys()].map(i => {
            const offset = PaintTileContainer.size / 2 - 0.5
            return {
                x: (i % PaintTileContainer.size) - offset,
                y: (i - (i % PaintTileContainer.size)) / PaintTileContainer.size - offset,
            }
        })
    }

    public hide(): void {
        G.BPC.transparentEntities(false)
        super.hide()
    }

    public show(): void {
        G.BPC.transparentEntities()
        super.show()
    }

    public destroy(): void {
        G.BPC.transparentEntities(false)
        super.destroy()
    }

    public getItemName(): string {
        return Tile.getItemName(this.name)
    }

    public increaseSize(): void {
        if (PaintTileContainer.size === 20) {
            return
        }
        PaintTileContainer.size += 1
        this.moveAtCursor()
        this.redraw()
    }

    public decreaseSize(): void {
        if (PaintTileContainer.size === 1) {
            return
        }
        PaintTileContainer.size -= 1
        this.moveAtCursor()
        this.redraw()
    }

    public rotate(): void {
        if (this.name.includes('hazard')) {
            this.name = this.name.includes('left')
                ? this.name.replace('left', 'right')
                : this.name.replace('right', 'left')
            this.redraw()
        }
    }

    protected redraw(): void {
        this.removeChildren()

        this.addChild(
            ...PaintTileContainer.getTilePositions().map(p => {
                const s = TileContainer.generateSprite(
                    this.name,
                    p.x + this.position.x,
                    p.y + this.position.y
                )
                s.position.set(p.x * 32, p.y * 32)
                s.alpha = 0.5
                return s
            })
        )
    }

    public moveAtCursor(): void {
        this.setNewPosition({
            x: PaintTileContainer.size,
            y: PaintTileContainer.size,
        })
    }

    public removeContainerUnder(): void {
        if (!this.visible) {
            return
        }

        const position = this.getGridPosition()

        G.bp.removeTiles(
            PaintTileContainer.getTilePositions().map(p => ({
                x: p.x + position.x,
                y: p.y + position.y,
            }))
        )
    }

    public placeEntityContainer(): void {
        if (!this.visible) {
            return
        }

        const position = this.getGridPosition()

        G.bp.createTiles(
            this.name,
            PaintTileContainer.getTilePositions().map(p => ({
                x: p.x + position.x,
                y: p.y + position.y,
            }))
        )
    }
}
