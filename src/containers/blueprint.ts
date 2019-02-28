import FD from 'factorio-data'
import { EventEmitter } from 'eventemitter3'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import actions from '../actions'
import Entity from '../factorio-data/entity'
import Tile from '../factorio-data/tile'
import { Viewport } from '../viewport'
import { EntitySprite } from '../entitySprite'
import { WiresContainer } from './wires'
import { UnderlayContainer } from './underlay'
import { EntityContainer } from './entity'
import { OverlayContainer } from './overlay'
import { EntityPaintContainer } from './paintEntity'
import { TileContainer } from './tile'
import { TilePaintContainer } from './paintTile'
import { PaintContainer } from './paint'

class GridData extends EventEmitter {
    /** mouse x in 32 pixel size grid */
    x = 0
    /** mouse y in 32 pixel size grid */
    y = 0

    /** mouse x in 16 pixel size grid */
    private x16 = 0
    /** mouse y in 16 pixel size grid */
    private y16 = 0

    private lastMousePosX = 0
    private lastMousePosY = 0

    constructor() {
        super()
        document.addEventListener('mousemove', e => this.update(e.clientX, e.clientY))
    }

    get mousePositionInBPC() {
        return { x: this.x16 * 16, y: this.y16 * 16 }
    }

    public recalculate() {
        this.update(this.lastMousePosX, this.lastMousePosY)
    }

    private update(x: number, y: number) {
        this.lastMousePosX = x
        this.lastMousePosY = y

        const mousePositionInBP = {
            x: Math.abs(G.BPC.position.x - x) / G.BPC.viewport.getCurrentScale(),
            y: Math.abs(G.BPC.position.y - y) / G.BPC.viewport.getCurrentScale()
        }
        const gridCoordsOfCursor16 = {
            x: (mousePositionInBP.x - (mousePositionInBP.x % 16)) / 16,
            y: (mousePositionInBP.y - (mousePositionInBP.y % 16)) / 16
        }

        if (gridCoordsOfCursor16.x !== this.x16 || gridCoordsOfCursor16.y !== this.y16) {
            const X = Math.floor(gridCoordsOfCursor16.x / 2)
            const Y = Math.floor(gridCoordsOfCursor16.y / 2)
            this.x16 = gridCoordsOfCursor16.x
            this.y16 = gridCoordsOfCursor16.y

            // don't emit updates if panning
            const notPanning = G.currentMouseState !== G.mouseStates.PANNING
            // emit update16 when mouse changes tile whithin the 16 pixel size grid
            if (notPanning) {
                this.emit('update16', this)
            }

            if (X !== this.x || Y !== this.y) {
                this.x = X
                this.y = Y
                // emit update when mouse changes tile whithin the 32 pixel size grid
                if (notPanning) {
                    this.emit('update', this)
                }
            }
        }
    }
}

// This container improves rendering time by around 10-40% and has baked in viewport culling
class OptimizedContainer extends PIXI.Container {
    children: EntitySprite[]

    updateTransform() {
        this._boundsID += 1

        this.transform.updateTransform(this.parent.transform)

        this.worldAlpha = this.alpha * this.parent.worldAlpha

        for (const c of this.children) {
            if (c.visible) {
                c.updateTransform()
            }
        }
    }

    render(renderer: PIXI.Renderer) {
        for (const c of this.children) {
            if (G.BPC.viewportCulling) {
                // faster than using c.getBounds()
                if (
                    c.cachedBounds[0] * this.worldTransform.a + c.worldTransform.tx > G.app.screen.width ||
                    c.cachedBounds[1] * this.worldTransform.d + c.worldTransform.ty > G.app.screen.height ||
                    c.cachedBounds[2] * this.worldTransform.a + c.worldTransform.tx < G.positionBPContainer.x ||
                    c.cachedBounds[3] * this.worldTransform.d + c.worldTransform.ty < G.positionBPContainer.y
                ) {
                    continue
                }
            }

            c.render(renderer)
        }
    }
}

export class BlueprintContainer extends PIXI.Container {
    grid: PIXI.TilingSprite
    wiresContainer: WiresContainer
    overlayContainer: OverlayContainer
    underlayContainer: UnderlayContainer
    tilePaintSlot: PIXI.Container
    entityPaintSlot: PIXI.Container
    tileSprites: OptimizedContainer
    entitySprites: OptimizedContainer
    viewport: Viewport
    hoverContainer: EntityContainer
    paintContainer: PaintContainer
    viewportCulling = true
    gridData: GridData

    constructor() {
        super()

        this.interactive = true
        this.interactiveChildren = false
        this.hitArea = new PIXI.Rectangle(0, 0, G.sizeBPContainer.width, G.sizeBPContainer.height)

        this.viewport = new Viewport(
            this,
            G.sizeBPContainer,
            G.positionBPContainer,
            {
                width: G.app.screen.width,
                height: G.app.screen.height
            },
            3
        )

        this.generateGrid(G.colors.pattern)

        this.tileSprites = new OptimizedContainer()
        this.tilePaintSlot = new PIXI.Container()
        this.underlayContainer = new UnderlayContainer()
        this.entitySprites = new OptimizedContainer()
        this.entityPaintSlot = new PIXI.Container()
        this.wiresContainer = new WiresContainer()
        this.overlayContainer = new OverlayContainer()

        this.addChild(
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
            if (G.currentMouseState !== G.mouseStates.PANNING) {
                const WSXOR = actions.moveUp.pressed !== actions.moveDown.pressed
                const ADXOR = actions.moveLeft.pressed !== actions.moveRight.pressed
                if (WSXOR || ADXOR) {
                    const finalSpeed = G.moveSpeed / (WSXOR && ADXOR ? 1.4142 : 1)
                    /* eslint-disable no-nested-ternary */
                    this.viewport.translateBy(
                        (ADXOR ? (actions.moveLeft.pressed ? 1 : -1) : 0) * finalSpeed,
                        (WSXOR ? (actions.moveUp.pressed ? 1 : -1) : 0) * finalSpeed
                    )
                    /* eslint-enable no-nested-ternary */
                    this.viewport.updateTransform()

                    this.gridData.recalculate()
                }
            }
        })

        if (G.renderOnly) {
            this.interactiveChildren = false
        }

        // Hack for plugging the mouse into keyboardJS
        actions.attachEventsToContainer(this)

        this.gridData.on('update16', () => {
            if (G.currentMouseState === G.mouseStates.PAINTING) {
                this.paintContainer.moveAtCursor()
            }
        })

        this.gridData.on('update', () => {
            // Instead of decreasing the global interactionFrequency, call the over and out entity events here
            this.updateHoverContainer()

            if (actions.build.pressed) {
                actions.build.call()
            }
            if (actions.mine.pressed) {
                actions.mine.call()
            }
            if (actions.pasteEntitySettings.pressed) {
                actions.pasteEntitySettings.call()
            }
        })
    }

    zoom(zoomIn = true) {
        const zoomFactor = 0.1
        this.viewport.setScaleCenter(this.gridData.mousePositionInBPC.x, this.gridData.mousePositionInBPC.y)
        this.viewport.zoomBy(zoomFactor * (zoomIn ? 1 : -1))
        this.viewport.updateTransform()
        this.gridData.recalculate()
    }

    updateHoverContainer() {
        const removeHoverContainer = () => {
            this.hoverContainer.pointerOutEventHandler()
            this.hoverContainer = undefined
            this.cursor = 'inherit'
        }

        if (G.currentMouseState === G.mouseStates.PAINTING) {
            if (this.hoverContainer) {
                removeHoverContainer()
            }
            return
        }

        if (!G.bp) {
            return
        }
        const e = EntityContainer.mappings.get(G.bp.entityPositionGrid.getCellAtPosition(this.gridData))

        if (e && this.hoverContainer === e) {
            return
        }

        if (this.hoverContainer) {
            removeHoverContainer()
        }

        if (e && G.currentMouseState === G.mouseStates.NONE) {
            this.hoverContainer = e
            this.cursor = 'pointer'
            e.pointerOverEventHandler()
        }
    }

    generateGrid(pattern: 'checker' | 'grid' = 'checker') {
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
            height: gridGraphics.height
        })

        renderTexture.baseTexture.mipmap = PIXI.MIPMAP_MODES.POW2
        G.app.renderer.render(gridGraphics, renderTexture)

        const grid = new PIXI.TilingSprite(renderTexture, G.sizeBPContainer.width, G.sizeBPContainer.height)

        G.colors.addSpriteForAutomaticTintChange(grid)

        if (this.grid) {
            const index = this.getChildIndex(this.grid)
            this.removeChild(this.grid)
            this.addChildAt(grid, index)
        } else {
            this.addChild(grid)
        }

        this.grid = grid
    }

    initBP() {
        const firstRail = G.bp.getFirstRail()
        if (firstRail) {
            G.railMoveOffset = {
                x: (Math.abs(firstRail.position.x) % 2) + 1,
                y: (Math.abs(firstRail.position.y) % 2) + 1
            }
        }

        // Render Bp
        G.bp.entities.forEach(e => new EntityContainer(e, false))
        G.bp.entities.forEach(e => this.wiresContainer.add(e.connections))
        G.bp.tiles.forEach(t => new TileContainer(t))

        G.bp.on('create', (entity: Entity) => new EntityContainer(entity))
        G.bp.on('create', (entity: Entity) => this.wiresContainer.add(entity.connections))
        G.bp.on('create', () => this.wiresContainer.updatePassiveWires())
        G.bp.on('destroy', () => this.wiresContainer.updatePassiveWires())

        G.bp.on('create_t', (tile: Tile) => new TileContainer(tile))

        G.bp.on('create', () => this.updateHoverContainer())
        G.bp.on('destroy', () => this.updateHoverContainer())

        this.sortEntities()
        this.wiresContainer.updatePassiveWires()
        this.centerViewport()

        if (G.renderOnly) {
            this.cacheAsBitmap = false
            this.cacheAsBitmap = true
        }
    }

    clearData() {
        const opt = { children: true }
        this.tileSprites.destroy(opt)
        this.tilePaintSlot.destroy(opt)
        this.underlayContainer.destroy(opt)
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
        this.underlayContainer = new UnderlayContainer()
        this.entitySprites = new OptimizedContainer()
        this.entityPaintSlot = new PIXI.Container()
        this.wiresContainer = new WiresContainer()
        this.overlayContainer = new OverlayContainer()

        this.addChild(
            this.grid,
            this.tileSprites,
            this.tilePaintSlot,
            this.underlayContainer,
            this.entitySprites,
            this.wiresContainer,
            this.overlayContainer,
            this.entityPaintSlot
        )

        G.currentMouseState = G.mouseStates.NONE
    }

    sortEntities() {
        this.entitySprites.children.sort((a, b) => {
            const dZ = a.zIndex - b.zIndex
            if (dZ !== 0) {
                return dZ
            }

            const dY = a.y - a.shift.y - (b.y - b.shift.y)
            if (dY !== 0) {
                return dY
            }

            const dO = a.zOrder - b.zOrder
            if (dO !== 0) {
                return dO
            }

            const dX = a.x - a.shift.x - (b.x - b.shift.x)
            if (dX !== 0) {
                return dX
            }

            return a.id - b.id
        })
    }

    transparentEntities(bool = true) {
        const alpha = bool ? 0.5 : 1
        this.entitySprites.alpha = alpha
        this.wiresContainer.alpha = alpha
        this.overlayContainer.alpha = alpha
    }

    centerViewport() {
        if (G.bp.isEmpty()) {
            this.viewport.setPosition(-G.sizeBPContainer.width / 2, -G.sizeBPContainer.height / 2)
            this.viewport.updateTransform()
            return
        }

        const bounds = this.getBlueprintBounds()
        this.viewport.centerViewPort(
            {
                x: bounds.width,
                y: bounds.height
            },
            {
                x: (G.sizeBPContainer.width - bounds.width) / 2 - bounds.x,
                y: (G.sizeBPContainer.height - bounds.height) / 2 - bounds.y
            }
        )
    }

    getBlueprintBounds() {
        const bounds = new PIXI.Bounds()

        const addBounds = (sprite: EntitySprite) => {
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

        const rect = bounds.getRectangle()

        const X = Math.floor(rect.x / 32) * 32
        const Y = Math.floor(rect.y / 32) * 32
        const W = Math.ceil((rect.width + rect.x - X) / 32) * 32
        const H = Math.ceil((rect.height + rect.y - Y) / 32) * 32
        return new PIXI.Rectangle(X, Y, W, H)
    }

    spawnPaintContainer(itemName: string, direction = 0) {
        const itemData = FD.items[itemName]
        const tileResult = itemData.place_as_tile && itemData.place_as_tile.result
        const placeResult = itemData.place_result || tileResult

        if (G.currentMouseState === G.mouseStates.PAINTING) {
            this.paintContainer.destroy()
        }

        G.currentMouseState = G.mouseStates.PAINTING
        this.updateHoverContainer()
        this.cursor = 'pointer'

        if (tileResult) {
            this.paintContainer = new TilePaintContainer(placeResult)
            this.tilePaintSlot.addChild(this.paintContainer)
        } else {
            this.paintContainer = new EntityPaintContainer(placeResult, direction)
            this.entityPaintSlot.addChild(this.paintContainer)
        }

        this.paintContainer.on('destroy', () => {
            this.paintContainer = undefined
            G.currentMouseState = G.mouseStates.NONE
            this.updateHoverContainer()
            this.cursor = 'inherit'
        })
    }
}
