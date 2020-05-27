import FD from 'factorio-data'
import * as PIXI from 'pixi.js'
import { Tile } from '../core/Tile'
import { Entity } from '../core/Entity'
import { IConnection } from '../core/WireConnections'
import { isActionActive, callAction } from '../actions'
import G from '../common/globals'
import { Viewport } from './Viewport'
import { EntitySprite } from './EntitySprite'
import { WiresContainer } from './WiresContainer'
import { UnderlayContainer } from './UnderlayContainer'
import { EntityContainer } from './EntityContainer'
import { OverlayContainer } from './OverlayContainer'
import { PaintEntityContainer } from './PaintEntityContainer'
import { TileContainer } from './TileContainer'
import { PaintTileContainer } from './PaintTileContainer'
import { PaintContainer } from './PaintContainer'
import { PaintBlueprintContainer } from './PaintBlueprintContainer'
import { OptimizedContainer } from './OptimizedContainer'
import { GridData } from './GridData'

export type GridPattern = 'checker' | 'grid'

export enum EditorMode {
    /** Default */
    NONE,
    /** Active when an entity is being hovered */
    EDIT,
    /** Active when "painting" */
    PAINT,
    /** Active when panning */
    PAN,
    /** Active when selecting multiple entities for copy/stamp */
    COPY,
    /** Active when selecting multiple entities for deletion */
    DELETE,
}

export class BlueprintContainer extends PIXI.Container {
    public moveSpeed = 10
    private _gridColor = 0x303030
    private _gridPattern: GridPattern = 'grid'
    private grid: PIXI.TilingSprite
    private chunkGrid: PIXI.TilingSprite
    public wiresContainer: WiresContainer
    public overlayContainer: OverlayContainer
    public underlayContainer: UnderlayContainer
    private tilePaintSlot: PIXI.Container
    private entityPaintSlot: PIXI.Container
    private tileSprites: OptimizedContainer
    private entitySprites: OptimizedContainer
    private viewport: Viewport
    public hoverContainer: EntityContainer
    public paintContainer: PaintContainer
    public gridData: GridData
    private _mode: EditorMode = EditorMode.NONE
    private size: IPoint
    private anchor: IPoint = {
        x: 0.5,
        y: 0.5,
    }
    private _entityForCopyData: Entity
    private copyModeEntities: Entity[] = []
    private deleteModeEntities: Entity[] = []
    private copyModeUpdateFn: (endX: number, endY: number) => void
    private deleteModeUpdateFn: (endX: number, endY: number) => void

    public constructor() {
        super()

        // Nr of cunks needs to be odd because the chunk grid is offset
        const chunks = 32 - 1
        // Chunk offset - Measured in tiles
        const chunkOffset = 16

        this.size = {
            x: chunks * 32 * 32,
            y: chunks * 32 * 32,
        }

        this.interactive = true
        this.interactiveChildren = false
        this.hitArea = new PIXI.Rectangle(
            -this.size.x * this.anchor.x,
            -this.size.y * this.anchor.y,
            this.size.x,
            this.size.y
        )

        this.viewport = new Viewport(
            this.size,
            {
                x: G.app.screen.width,
                y: G.app.screen.height,
            },
            this.anchor,
            3
        )

        this.generateGrid()
        this.tileSprites = new OptimizedContainer()
        this.tilePaintSlot = new PIXI.Container()
        this.underlayContainer = new UnderlayContainer()
        this.entitySprites = new OptimizedContainer()
        this.entityPaintSlot = new PIXI.Container()
        this.wiresContainer = new WiresContainer()
        this.overlayContainer = new OverlayContainer()
        this.generateChunkGrid(chunkOffset)

        this.addChild(
            this.chunkGrid,
            this.tileSprites,
            this.tilePaintSlot,
            this.underlayContainer,
            this.entitySprites,
            this.wiresContainer,
            this.overlayContainer,
            this.entityPaintSlot
        )

        this.gridData = new GridData()

        G.app.ticker.add(() => {
            if (this.mode !== EditorMode.PAN) {
                const WSXOR = isActionActive('moveUp') !== isActionActive('moveDown')
                const ADXOR = isActionActive('moveLeft') !== isActionActive('moveRight')
                if (WSXOR || ADXOR) {
                    const finalSpeed = this.moveSpeed / (WSXOR && ADXOR ? 1.4142 : 1)
                    this.viewport.translateBy(
                        (ADXOR ? (isActionActive('moveLeft') ? 1 : -1) : 0) * finalSpeed,
                        (WSXOR ? (isActionActive('moveUp') ? 1 : -1) : 0) * finalSpeed
                    )
                    this.applyViewportTransform()
                }
            }
        })

        this.gridData.on('update16', () => {
            if (this.mode === EditorMode.PAINT) {
                this.paintContainer.moveAtCursor()
            }
        })

        this.gridData.on('update32', () => {
            // Instead of decreasing the global interactionFrequency, call the over and out entity events here
            this.updateHoverContainer()

            if (isActionActive('build')) {
                callAction('build')
            }
            if (isActionActive('mine')) {
                callAction('mine')
            }
            if (isActionActive('pasteEntitySettings')) {
                callAction('pasteEntitySettings')
            }
        })

        this.addListener('pointerover', () => {
            if (this.mode === EditorMode.PAINT) {
                this.paintContainer.show()
            }
            this.updateHoverContainer()
        })
        this.addListener('pointerout', () => {
            if (this.mode === EditorMode.PAINT) {
                this.paintContainer.hide()
            }
            this.updateHoverContainer()
        })

        document.addEventListener('mousemove', e => {
            if (this.mode === EditorMode.PAN) {
                this.viewport.translateBy(e.movementX, e.movementY)
                this.applyViewportTransform()
            }
        })

        window.addEventListener(
            'resize',
            () => {
                this.viewport.setSize(G.app.screen.width, G.app.screen.height)
                this.applyViewportTransform()
            },
            false
        )
    }

    public get entityForCopyData(): Entity {
        return this._entityForCopyData
    }

    public copyEntitySettings(): void {
        if (this.mode === EditorMode.EDIT) {
            // Store reference to source entity
            this._entityForCopyData = this.hoverContainer.entity
        }
    }

    public pasteEntitySettings(): void {
        if (this._entityForCopyData && this.mode === EditorMode.EDIT) {
            // Hand over reference of source entity to target entity for pasting data
            this.hoverContainer.entity.pasteSettings(this._entityForCopyData)
        }
    }

    public getViewportScale(): number {
        return this.viewport.getCurrentScale()
    }

    private applyViewportTransform(): void {
        const t = this.viewport.getTransform()
        this.setTransform(t.tx, t.ty, t.a, t.d)
        this.gridData.recalculate()
    }

    public get mode(): EditorMode {
        return this._mode
    }

    private setMode(mode: EditorMode): void {
        this._mode = mode
        this.emit('mode', mode)
    }

    public enterCopyMode(): void {
        if (this.mode === EditorMode.COPY) return

        this.updateHoverContainer(true)
        this.setMode(EditorMode.COPY)

        this.overlayContainer.showSelectionArea(0x00d400)

        const startPos = { x: this.gridData.x32, y: this.gridData.y32 }
        this.copyModeUpdateFn = (endX: number, endY: number) => {
            const X = Math.min(startPos.x, endX)
            const Y = Math.min(startPos.y, endY)
            const W = Math.abs(endX - startPos.x) + 1
            const H = Math.abs(endY - startPos.y) + 1

            for (const e of this.copyModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
            }

            this.copyModeEntities = G.bp.entityPositionGrid.getEntitiesInArea({
                x: X + W / 2,
                y: Y + H / 2,
                w: W,
                h: H,
            })

            for (const e of this.copyModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = 'copy'
            }
        }
        this.copyModeUpdateFn(startPos.x, startPos.y)
        this.gridData.on('update32', this.copyModeUpdateFn)
    }

    public exitCopyMode(cancel = false): void {
        if (this.mode !== EditorMode.COPY) return

        this.overlayContainer.hideSelectionArea()
        this.gridData.off('update32', this.copyModeUpdateFn)

        this.setMode(EditorMode.NONE)
        this.updateHoverContainer()

        if (!cancel && this.copyModeEntities.length !== 0) {
            this.spawnPaintContainer(this.copyModeEntities)
        }
        for (const e of this.copyModeEntities) {
            EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
        }
        this.copyModeEntities = []
    }

    public enterDeleteMode(): void {
        if (this.mode === EditorMode.DELETE) return

        this.updateHoverContainer(true)
        this.setMode(EditorMode.DELETE)

        this.overlayContainer.showSelectionArea(0xff3200)

        const startPos = { x: this.gridData.x32, y: this.gridData.y32 }
        this.deleteModeUpdateFn = (endX: number, endY: number) => {
            const X = Math.min(startPos.x, endX)
            const Y = Math.min(startPos.y, endY)
            const W = Math.abs(endX - startPos.x) + 1
            const H = Math.abs(endY - startPos.y) + 1

            for (const e of this.deleteModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
            }

            this.deleteModeEntities = G.bp.entityPositionGrid.getEntitiesInArea({
                x: X + W / 2,
                y: Y + H / 2,
                w: W,
                h: H,
            })

            for (const e of this.deleteModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = 'not_allowed'
            }
        }
        this.deleteModeUpdateFn(startPos.x, startPos.y)
        this.gridData.on('update32', this.deleteModeUpdateFn)
    }

    public exitDeleteMode(cancel = false): void {
        if (this.mode !== EditorMode.DELETE) return

        this.overlayContainer.hideSelectionArea()
        this.gridData.off('update32', this.deleteModeUpdateFn)

        this.setMode(EditorMode.NONE)
        this.updateHoverContainer()

        if (cancel) {
            for (const e of this.deleteModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
            }
        } else {
            G.bp.removeEntities(this.deleteModeEntities)
        }

        this.deleteModeEntities = []
    }

    public enterPanMode(): void {
        if (this.mode === EditorMode.NONE && this.isPointerInside) {
            this.setMode(EditorMode.PAN)
            this.cursor = 'move'
        }
    }

    public exitPanMode(): void {
        if (this.mode === EditorMode.PAN) {
            this.setMode(EditorMode.NONE)
            this.cursor = 'inherit'
        }
    }

    public zoom(zoomIn = true): void {
        const zoomFactor = 0.1
        this.viewport.setScaleCenter(this.gridData.x, this.gridData.y)
        this.viewport.zoomBy(zoomFactor * (zoomIn ? 1 : -1))
        this.applyViewportTransform()
    }

    private get isPointerInside(): boolean {
        const container = G.app.renderer.plugins.interaction.hitTest(
            G.app.renderer.plugins.interaction.mouse.global,
            G.app.stage
        )
        return container === this
    }

    private updateHoverContainer(forceRemove = false): void {
        const removeHoverContainer = (): void => {
            this.hoverContainer.pointerOutEventHandler()
            this.hoverContainer = undefined
            this.setMode(EditorMode.NONE)
            this.cursor = 'inherit'
            this.emit('removeHoverContainer')
        }

        if (forceRemove || !this.isPointerInside) {
            if (this.hoverContainer) {
                removeHoverContainer()
            }
            return
        }

        if (!G.bp) return

        const entity = G.bp.entityPositionGrid.getEntityAtPosition(
            this.gridData.x32,
            this.gridData.y32
        )
        const eC = entity ? EntityContainer.mappings.get(entity.entityNumber) : undefined

        if (eC && this.hoverContainer === eC) return

        if (this.mode === EditorMode.EDIT) {
            removeHoverContainer()
        }

        if (eC && this.mode === EditorMode.NONE) {
            this.hoverContainer = eC
            this.setMode(EditorMode.EDIT)
            this.cursor = 'pointer'
            eC.pointerOverEventHandler()
            this.emit('createHoverContainer')
        }
    }

    public get gridColor(): number {
        return this._gridColor
    }

    public set gridColor(color: number) {
        this._gridColor = color
        this.grid.tint = color
    }

    public get gridPattern(): GridPattern {
        return this._gridPattern
    }

    public set gridPattern(pattern: GridPattern) {
        this._gridPattern = pattern
        this.generateGrid()
    }

    private generateGrid(pattern = this.gridPattern): void {
        const gridGraphics =
            pattern === 'checker'
                ? new PIXI.Graphics()
                      .beginFill(0x808080)
                      .drawRect(0, 0, 32, 32)
                      .drawRect(32, 32, 32, 32)
                      .endFill()
                      .beginFill(0xffffff)
                      .drawRect(0, 32, 32, 32)
                      .drawRect(32, 0, 32, 32)
                      .endFill()
                : new PIXI.Graphics()
                      .beginFill(0x808080)
                      .drawRect(0, 0, 32, 32)
                      .endFill()
                      .beginFill(0xffffff)
                      .drawRect(1, 1, 31, 31)
                      .endFill()

        const renderTexture = PIXI.RenderTexture.create({
            width: gridGraphics.width,
            height: gridGraphics.height,
        })

        renderTexture.baseTexture.mipmap = PIXI.MIPMAP_MODES.POW2
        G.app.renderer.render(gridGraphics, renderTexture)

        const grid = new PIXI.TilingSprite(renderTexture, this.size.x, this.size.y)
        grid.anchor.set(this.anchor.x, this.anchor.y)

        grid.tint = this.gridColor

        if (this.grid) {
            const index = this.getChildIndex(this.grid)
            this.removeChild(this.grid)
            this.addChildAt(grid, index)
        } else {
            this.addChild(grid)
        }

        this.grid = grid
    }

    public generateChunkGrid(chunkOffset: number): void {
        const W = 32 * 32
        const H = 32 * 32
        const gridGraphics = new PIXI.Graphics()
            .lineStyle(2, 0x000000)
            .moveTo(0, 0)
            .lineTo(W, 0)
            .lineTo(W, H)
            .lineTo(0, H)
            .lineTo(0, 0)

        const renderTexture = PIXI.RenderTexture.create({
            width: W,
            height: H,
        })

        renderTexture.baseTexture.mipmap = PIXI.MIPMAP_MODES.POW2
        G.app.renderer.render(gridGraphics, renderTexture)

        // Add one more chunk to the size because of the offset
        const grid = new PIXI.TilingSprite(renderTexture, this.size.x + W, this.size.y + H)
        // Offset chunk grid
        grid.position.set(chunkOffset * 32, chunkOffset * 32)
        grid.anchor.set(this.anchor.x, this.anchor.y)

        this.chunkGrid = grid
    }

    public initBP(): void {
        // Render Bp
        G.bp.entities.forEach(e => new EntityContainer(e, false))
        G.bp.wireConnections.on('create', (hash, connection: IConnection) => {
            this.wiresContainer.add(hash, connection)
            EntityContainer.mappings.get(connection.entityNumber1).redraw()
            EntityContainer.mappings.get(connection.entityNumber2).redraw()
        })
        G.bp.wireConnections.on('remove', (hash, connection: IConnection) => {
            this.wiresContainer.remove(hash)
            EntityContainer.mappings.get(connection.entityNumber1).redraw()
            EntityContainer.mappings.get(connection.entityNumber2).redraw()
        })
        G.bp.tiles.forEach(t => new TileContainer(t))

        G.bp.on('create-entity', (entity: Entity) => new EntityContainer(entity))
        G.bp.on('create-entity', () => this.wiresContainer.updatePassiveWires())
        G.bp.on('remove-entity', () => this.wiresContainer.updatePassiveWires())

        G.bp.on('create-tile', (tile: Tile) => new TileContainer(tile))

        G.bp.on('create-entity', () => this.updateHoverContainer())
        G.bp.on('remove-entity', () => this.updateHoverContainer())

        G.bp.wireConnections.forEach((connection, hash) =>
            this.wiresContainer.add(hash, connection)
        )

        this.sortEntities()
        this.wiresContainer.updatePassiveWires()
        this.centerViewport()
    }

    public clearData(): void {
        const opt = { children: true }
        this.tileSprites.destroy(opt)
        this.tilePaintSlot.destroy(opt)
        this.visualizationAreaContainer.destroy(opt)
        this.entitySprites.destroy(opt)
        this.entityPaintSlot.destroy(opt)
        this.wiresContainer.destroy(opt)
        this.overlayContainer.destroy(opt)

        this.removeChildren()

        this.cursor = 'inherit'

        this.hoverContainer = undefined
        this.paintContainer = undefined

        this.tileSprites = new OptimizedContainer()
        this.tilePaintSlot = new PIXI.Container()
        this.visualizationAreaContainer = new VisualizationAreaContainer()
        this.entitySprites = new OptimizedContainer()
        this.entityPaintSlot = new PIXI.Container()
        this.wiresContainer = new WiresContainer()
        this.overlayContainer = new OverlayContainer()

        this.addChild(
            this.grid,
            this.chunkGrid,
            this.tileSprites,
            this.tilePaintSlot,
            this.visualizationAreaContainer,
            this.entitySprites,
            this.wiresContainer,
            this.overlayContainer,
            this.entityPaintSlot
        )

        this.setMode(EditorMode.NONE)
    }

    public addEntitySprites(entitySprites: EntitySprite[], sort = true): void {
        this.entitySprites.addChild(...entitySprites)
        if (sort) {
            this.sortEntities()
        }
    }

    public addTileSprites(tileSprites: EntitySprite[]): void {
        this.tileSprites.addChild(...tileSprites)
    }

    private sortEntities(): void {
        this.entitySprites.children.sort(EntitySprite.compareFn)
    }

    public transparentEntities(bool = true): void {
        const alpha = bool ? 0.5 : 1
        this.entitySprites.alpha = alpha
        this.wiresContainer.alpha = alpha
        this.overlayContainer.alpha = alpha
    }

    public centerViewport(): void {
        const bounds = G.bp.isEmpty()
            ? new PIXI.Rectangle(-16 * 32, -16 * 32, 32 * 32, 32 * 32)
            : this.getBlueprintBounds()

        this.viewport.centerViewPort(
            {
                x: bounds.width,
                y: bounds.height,
            },
            {
                x: (this.size.x - bounds.width) / 2 - bounds.x,
                y: (this.size.y - bounds.height) / 2 - bounds.y,
            }
        )

        this.applyViewportTransform()
    }

    public getBlueprintBounds(): PIXI.Rectangle {
        const bounds = new PIXI.Bounds()

        const addBounds = (sprite: EntitySprite): void => {
            const sB = new PIXI.Bounds()
            const W = sprite.width * sprite.anchor.x
            const H = sprite.height * sprite.anchor.y
            sB.minX = sprite.x - W
            sB.minY = sprite.y - H
            sB.maxX = sprite.x + W
            sB.maxY = sprite.y + H
            bounds.addBounds(sB)
        }

        this.entitySprites.children.forEach(addBounds)
        this.tileSprites.children.forEach(addBounds)

        const rect = bounds.getRectangle(new PIXI.Rectangle())

        const X = Math.floor(rect.x / 32) * 32
        const Y = Math.floor(rect.y / 32) * 32
        const W = Math.ceil((rect.width + rect.x - X) / 32) * 32
        const H = Math.ceil((rect.height + rect.y - Y) / 32) * 32
        return new PIXI.Rectangle(X, Y, W, H)
    }

    public getPicture(): Promise<Blob> {
        // getLocalBounds is needed because it seems that it has sideeffects
        // without it generateTexture returns an empty texture
        this.getLocalBounds()
        const region = this.getBlueprintBounds()
        const texture = G.app.renderer.generateTexture(this, PIXI.SCALE_MODES.LINEAR, 1, region)
        const canvas = G.app.renderer.plugins.extract.canvas(texture)

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
                resolve(blob)
            })
        })
    }

    public spawnPaintContainer(itemNameOrEntities: string | Entity[], direction = 0): void {
        if (this.mode === EditorMode.PAINT) {
            this.paintContainer.destroy()
        }

        this.updateHoverContainer(true)
        this.setMode(EditorMode.PAINT)
        this.cursor = 'pointer'

        if (typeof itemNameOrEntities === 'string') {
            const itemData = FD.items[itemNameOrEntities]
            const tileResult = itemData.place_as_tile && itemData.place_as_tile.result
            const placeResult = itemData.place_result || tileResult

            if (tileResult) {
                this.paintContainer = new PaintTileContainer(placeResult)
                this.tilePaintSlot.addChild(this.paintContainer)
            } else {
                this.paintContainer = new PaintEntityContainer(placeResult, direction)
                this.entityPaintSlot.addChild(this.paintContainer)
            }
        } else {
            this.paintContainer = new PaintBlueprintContainer(itemNameOrEntities)
            this.entityPaintSlot.addChild(this.paintContainer)
        }

        if (!this.isPointerInside) {
            this.paintContainer.hide()
        }

        this.paintContainer.on('destroy', () => {
            this.paintContainer = undefined
            this.setMode(EditorMode.NONE)
            this.updateHoverContainer()
            this.cursor = 'inherit'
        })
    }
}
