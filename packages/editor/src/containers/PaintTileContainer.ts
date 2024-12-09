import FD from '../core/factorioData'
import { Tile } from '../core/Tile'
import util from '../common/util'
import { TileContainer } from './TileContainer'
import { PaintContainer } from './PaintContainer'
import { BlueprintContainer } from './BlueprintContainer'

export class PaintTileContainer extends PaintContainer {
    private static size = 2

    public constructor(bpc: BlueprintContainer, name: string) {
        super(bpc, name)

        this.bpc.transparentEntities()

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
        this.bpc.transparentEntities(false)
        super.hide()
    }

    public show(): void {
        this.bpc.transparentEntities()
        super.show()
    }

    public destroy(): void {
        this.bpc.transparentEntities(false)
        super.destroy()
    }

    public getItemName(): string {
        return Tile.getItemName(this.name)
    }

    public increaseSize(): void {
        if (PaintTileContainer.size === 20) return
        PaintTileContainer.size += 1
        this.moveAtCursor()
        this.redraw()
    }

    public decreaseSize(): void {
        if (PaintTileContainer.size === 1) return
        PaintTileContainer.size -= 1
        this.moveAtCursor()
        this.redraw()
    }

    public rotate(ccw = false): void {
        const nD = FD.tiles[this.name].next_direction
        if (nD) {
            this.name = nD
            this.redraw()
        }
    }

    public canFlipOrRotateByCopying(): boolean {
        return false
    }

    protected redraw(): void {
        this.removeChildren()
        const sprites = TileContainer.generateSprites(
            this.name,
            this.position,
            PaintTileContainer.getTilePositions()
        )
        this.addChild(...sprites)
    }

    public moveAtCursor(): void {
        this.setNewPosition({
            x: PaintTileContainer.size,
            y: PaintTileContainer.size,
        })
    }

    public removeContainerUnder(): void {
        if (!this.visible) return

        const position = this.getGridPosition()

        this.bpc.bp.removeTiles(
            PaintTileContainer.getTilePositions().map(p => util.sumprod(p, position))
        )
    }

    public placeEntityContainer(): void {
        if (!this.visible) return

        const position = this.getGridPosition()

        this.bpc.bp.createTiles(
            this.name,
            PaintTileContainer.getTilePositions().map(p => util.sumprod(p, position))
        )
    }
}
