import G from '../common/globals'
import { Viewport } from '../viewport'
import { WiresContainer } from './wires'
import { UnderlayContainer } from './underlay'
import { EntitySprite } from '../entitySprite'
import { EntityContainer } from './entity'
import { OverlayContainer } from './overlay'
import { EntityPaintContainer } from './entityPaint'
import { TileContainer } from './tile'
import { TilePaintContainer } from './tilePaint'
import util from '../common/util'
import FD from 'factorio-data'
import actions from '../actions'

export class BlueprintContainer extends PIXI.Container {

    grid: PIXI.extras.TilingSprite
    wiresContainer: WiresContainer
    overlayContainer: OverlayContainer
    underlayContainer: UnderlayContainer
    tiles: PIXI.Container
    entities: PIXI.Container
    tileSprites: PIXI.Container
    entitySprites: PIXI.Container
    viewport: Viewport
    pgOverlay: PIXI.Graphics
    hoverContainer: undefined | EntityContainer
    paintContainer: undefined | EntityPaintContainer | TilePaintContainer

    constructor() {
        super()
        this.interactive = true

        this.viewport = new Viewport(this, G.sizeBPContainer, G.positionBPContainer, {
            width: G.app.screen.width,
            height: G.app.screen.height
        }, 3)

        this.generateGrid(G.colors.pattern)

        this.pgOverlay = new PIXI.Graphics()
        this.pgOverlay.alpha = 0.2
        // this.addChild(this.pgOverlay)

        this.tileSprites = new PIXI.Container()
        this.tileSprites.interactive = false
        this.tileSprites.interactiveChildren = false
        this.addChild(this.tileSprites)

        this.underlayContainer = new UnderlayContainer()
        this.addChild(this.underlayContainer)

        this.entitySprites = new PIXI.Container()
        this.entitySprites.interactive = false
        this.entitySprites.interactiveChildren = false
        this.addChild(this.entitySprites)

        this.tiles = new PIXI.Container()
        this.tiles.interactive = false
        this.tiles.interactiveChildren = true
        this.addChild(this.tiles)

        this.entities = new PIXI.Container()
        this.entities.interactive = false
        this.entities.interactiveChildren = true
        this.addChild(this.entities)

        this.wiresContainer = new WiresContainer()
        this.addChild(this.wiresContainer)

        this.overlayContainer = new OverlayContainer()
        this.addChild(this.overlayContainer)

        document.addEventListener('wheel', e => {
            e.preventDefault()
            this.viewport.setScaleCenter(G.gridData.position.x, G.gridData.position.y)
            const z = Math.sign(-e.deltaY) * 0.1
            this.viewport.zoomBy(z, z)
            this.viewport.updateTransform()
            G.gridData.recalculate(this)
            this.updateViewportCulling()
        }, false)

        G.app.ticker.add(() => {
            if (actions.movingViaKeyboard) {
                const WSXOR = actions.moveUp.pressed !== actions.moveDown.pressed
                const ADXOR = actions.moveLeft.pressed !== actions.moveRight.pressed
                if (WSXOR || ADXOR) {
                    const finalSpeed = G.moveSpeed / (WSXOR && ADXOR ? 1.4142 : 1)
                    this.viewport.translateBy(
                        (ADXOR ? (actions.moveLeft.pressed ? 1 : -1) : 0) * finalSpeed,
                        (WSXOR ? (actions.moveUp.pressed ? 1 : -1) : 0) * finalSpeed
                    )
                    this.viewport.updateTransform()

                    G.gridData.recalculate(this)

                    this.updateViewportCulling()
                }
            }
        })

        if (G.renderOnly) {
            this.interactiveChildren = false
        }

        G.gridData.onUpdate(() => {
            if (this.paintContainer) this.paintContainer.moveAtCursor()

            // Instead of decreasing the global interactionFrequency, call the over and out entity events here
            this.updateHoverContainer()
        })
    }

    updateHoverContainer() {
        const e = G.app.renderer.plugins.interaction.hitTest(G.gridData._lastMousePos, this.entities)
        if (e && this.hoverContainer === e) return
        if (this.hoverContainer) this.hoverContainer.pointerOutEventHandler()
        if (e) e.pointerOverEventHandler()
    }

    generateGrid(pattern: 'checker' | 'grid' = 'checker') {
        const gridGraphics = pattern === 'checker'
            ? new PIXI.Graphics()
                .beginFill(0x808080).drawRect(0, 0, 32, 32).drawRect(32, 32, 32, 32).endFill()
                .beginFill(0xFFFFFF).drawRect(0, 32, 32, 32).drawRect(32, 0, 32, 32).endFill()
            : new PIXI.Graphics()
                .beginFill(0x808080).drawRect(0, 0, 32, 32).endFill()
                .beginFill(0xFFFFFF).drawRect(1, 1, 31, 31).endFill()

        const grid = new PIXI.extras.TilingSprite(gridGraphics.generateCanvasTexture(), G.sizeBPContainer.width, G.sizeBPContainer.height)

        grid.interactive = false
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
                x: Math.abs(firstRail.position.x) % 2 + 1,
                y: Math.abs(firstRail.position.y) % 2 + 1
            }
        }

        // Render Bp
        G.bp.entities.forEach(e => new EntityContainer(e, false))

        G.bp.tiles.forEach((v, k) => new TileContainer(v, { x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }))

        G.bp.on('create', entity => new EntityContainer(entity))

        this.sortEntities()
        this.wiresContainer.updatePassiveWires()
        this.wiresContainer.drawWires()
        this.updateOverlay()
        this.centerViewport()

        if (G.renderOnly) {
            this.cacheAsBitmap = false
            this.cacheAsBitmap = true
        }
    }

    clearData() {
        const opt = { children: true }
        this.tiles.destroy(opt)
        this.entities.destroy(opt)
        this.tileSprites.destroy(opt)
        this.entitySprites.destroy(opt)
        this.underlayContainer.destroy(opt)
        this.overlayContainer.destroy(opt)
        this.wiresContainer.destroy(opt)

        this.removeChildren()

        this.hoverContainer = undefined
        this.paintContainer = undefined

        this.tileSprites = new PIXI.Container()
        this.tileSprites.interactive = false
        this.tileSprites.interactiveChildren = false

        this.underlayContainer = new UnderlayContainer()

        this.entitySprites = new PIXI.Container()
        this.entitySprites.interactive = false
        this.entitySprites.interactiveChildren = false

        this.tiles = new PIXI.Container()
        this.tiles.interactive = false
        this.tiles.interactiveChildren = true

        this.entities = new PIXI.Container()
        this.entities.interactive = false
        this.entities.interactiveChildren = true

        this.wiresContainer = new WiresContainer()

        this.overlayContainer = new OverlayContainer()

        this.addChild(
            this.grid, this.tileSprites, this.underlayContainer, this.entitySprites,
            this.tiles, this.entities, this.wiresContainer, this.overlayContainer
        )

        G.currentMouseState = G.mouseStates.NONE
    }

    sortEntities() {
        (this.entities.children as EntityContainer[]).sort((a, b) =>
            ((b.hitArea as PIXI.Rectangle).height - (a.hitArea as PIXI.Rectangle).height)
        );

        (this.entitySprites.children as EntitySprite[]).sort((a, b) => {
            const dZ = a.zIndex - b.zIndex
            if (dZ !== 0) return dZ
            const dY = (a.y - a.shift.y) - (b.y - b.shift.y)
            if (dY !== 0) return dY
            const dO = a.zOrder - b.zOrder
            if (dO !== 0) return dO
            const dX = (a.x - a.shift.x) - (b.x - b.shift.x)
            if (dX !== 0) return dX
            return a.id - b.id
        })
    }

    transparentEntities(bool = true) {
        this.entities.interactiveChildren = !bool
        this.entitySprites.alpha = bool ? 0.5 : 1
    }

    // For testing
    updateOverlay() {
        // const TEMP = G.bp.entityPositionGrid.getAllPositions()
        // this.pgOverlay.clear()
        // for (const t of TEMP) {
        //     this.pgOverlay.beginFill(0x0080FF)
        //     this.pgOverlay.drawRect(t.x * 32, t.y * 32, G.cellSize, G.cellSize)
        //     this.pgOverlay.endFill()
        // }
    }

    centerViewport() {
        if (G.bp.isEmpty()) {
            this.viewport.setPosition(-G.sizeBPContainer.width / 2, -G.sizeBPContainer.height / 2)
            this.viewport.updateTransform()
            return
        }

        const bounds = this.getBlueprintBounds()
        this.viewport.centerViewPort({
            x: bounds.width,
            y: bounds.height
        }, {
            x: (G.sizeBPContainer.width - bounds.width) / 2 - bounds.x,
            y: (G.sizeBPContainer.height - bounds.height) / 2 - bounds.y
        })
        this.updateViewportCulling()
    }

    getBlueprintBounds() {
        const bounds = new PIXI.Bounds()
        const sprites = this.entitySprites.children.concat(this.tileSprites.children) as PIXI.Sprite[]
        for (const sprite of sprites) {
            const sB = new PIXI.Bounds()
            const W = sprite.width * sprite.anchor.x
            const H = sprite.height * sprite.anchor.y
            sB.minX = sprite.x - W
            sB.minY = sprite.y - H
            sB.maxX = sprite.x + W
            sB.maxY = sprite.y + H
            bounds.addBounds(sB)
        }
        const rect = bounds.getRectangle()

        const X = Math.floor(rect.x / 32) * 32
        const Y = Math.floor(rect.y / 32) * 32
        const W = Math.ceil((rect.width + rect.x - X) / 32) * 32
        const H = Math.ceil((rect.height + rect.y - Y) / 32) * 32
        return new PIXI.Rectangle(X, Y, W, H)
    }

    enableRenderableOnChildren() {
        this.tileSprites.children.forEach(c => c.renderable = true)
        this.entitySprites.children.forEach(c => c.renderable = true)
        this.overlayContainer.overlay.children.forEach(c => c.renderable = true)
    }

    updateViewportCulling() {
        cullChildren(this.tileSprites.children)
        cullChildren(this.entitySprites.children)
        cullChildren(this.overlayContainer.overlay.children)

        function cullChildren(children: PIXI.DisplayObject[]) {
            for (const c of children) {
                const b = c.getBounds()
                c.renderable =
                    b.x + b.width > G.positionBPContainer.x &&
                    b.y + b.height > G.positionBPContainer.y &&
                    b.x < G.app.screen.width &&
                    b.y < G.app.screen.height
            }
        }
    }

    spawnEntityAtMouse(itemName: string) {
        const itemData = FD.items[itemName]
        const tileResult = itemData.place_as_tile && itemData.place_as_tile.result
        const placeResult = itemData.place_result || tileResult

        G.currentMouseState = G.mouseStates.PAINTING
        if (this.paintContainer) this.paintContainer.destroy()

        if (tileResult) {
            this.paintContainer = new TilePaintContainer(
                placeResult,
                EntityContainer.getPositionFromData(
                    G.gridData.position,
                    { x: TilePaintContainer.size, y: TilePaintContainer.size }
                )
            )
            this.tiles.addChild(this.paintContainer)
        } else {
            this.paintContainer = new EntityPaintContainer(
                placeResult,
                0,
                EntityContainer.getPositionFromData(
                    G.gridData.position,
                    util.switchSizeBasedOnDirection(FD.entities[placeResult].size, 0)
                )
            )
            this.addChild(this.paintContainer)
        }

        if (this.hoverContainer) this.hoverContainer.pointerOutEventHandler()
    }
}
