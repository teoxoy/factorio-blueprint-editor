import FD from '@fbe/factorio-data'
import { Tile } from '../core/Tile'
import { TileContainer } from './TileContainer'
import { PaintContainer } from './PaintContainer'
import { BlueprintContainer } from './BlueprintContainer'
import { EntitySprite } from './EntitySprite'

export class PaintTileContainer extends PaintContainer {
    private static size = 2

    /** mechanism to make sure that the result of the promise is still needed */
    private getPartsPromise: Promise<EntitySprite[]>

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

    public rotate(): void {
        const nD = FD.tiles[this.name].next_direction
        if (nD) {
            this.name = nD
            this.redraw()
        }
    }

    protected redraw(): void {
        this.bpc.cursor = 'wait'
        this.removeChildren()

        const promise = TileContainer.generateSprites(
            this.name,
            this.position,
            PaintTileContainer.getTilePositions()
        )
        this.getPartsPromise = promise

        promise.then(sprites => {
            if (this.getPartsPromise !== promise) return

            this.addChild(...sprites)
            this.bpc.cursor = 'pointer'
        })
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
            PaintTileContainer.getTilePositions().map(p => ({
                x: p.x + position.x,
                y: p.y + position.y,
            }))
        )
    }

    public placeEntityContainer(): void {
        if (!this.visible) return

        const position = this.getGridPosition()

        this.bpc.bp.createTiles(
            this.name,
            PaintTileContainer.getTilePositions().map(p => ({
                x: p.x + position.x,
                y: p.y + position.y,
            }))
        )
    }
}
