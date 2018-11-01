import G from '../globals'
import { ZoomPan } from '../zoomPan'
import { WiresContainer } from './wires'
import { UnderlayContainer } from './underlay'
import { EntitySprite } from '../entitySprite'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import { EntityContainer } from './entity'
import { OverlayContainer } from './overlay'
import { EntityPaintContainer } from './entityPaint'
import { TileContainer } from './tile'
import { TilePaintContainer } from './tilePaint'

export class BlueprintContainer extends PIXI.Container {

    holdingLeftClick: boolean
    grid: PIXI.extras.TilingSprite
    wiresContainer: WiresContainer
    overlayContainer: OverlayContainer
    underlayContainer: UnderlayContainer
    tiles: PIXI.Container
    entities: PIXI.Container
    movingEntityFilter: AdjustmentFilter
    tileSprites: PIXI.Container
    entitySprites: PIXI.Container
    zoomPan: ZoomPan
    holdingRightClick: boolean
    pgOverlay: PIXI.Graphics
    hoverContainer: undefined | EntityContainer
    movingContainer: undefined | EntityContainer
    paintContainer: undefined | EntityPaintContainer | TilePaintContainer

    constructor() {
        super()
        this.interactive = true

        this.holdingLeftClick = false
        this.holdingRightClick = false

        this.zoomPan = new ZoomPan(this, G.sizeBPContainer, G.positionBPContainer, {
            width: G.app.screen.width,
            height: G.app.screen.height
        }, 5)

        this.movingEntityFilter = new AdjustmentFilter({ red: 0.4, blue: 0.4, green: 1 })

        const gridTexture = new PIXI.Graphics()
            .beginFill(0x808080).drawRect(0, 0, 32, 32).drawRect(32, 32, 32, 32).endFill()
            .beginFill(0xFFFFFF).drawRect(0, 32, 32, 32).drawRect(32, 0, 32, 32).endFill()
            .generateCanvasTexture()

        this.grid = new PIXI.extras.TilingSprite(gridTexture, G.sizeBPContainer.width, G.sizeBPContainer.height)
        this.grid.interactive = false
        G.colors.addSpriteForAutomaticTintChange(this.grid)
        this.addChild(this.grid)

        this.pgOverlay = new PIXI.Graphics()
        this.pgOverlay.alpha = 0.2
        // this.addChild(this.pgOverlay)

        this.underlayContainer = new UnderlayContainer()
        this.addChild(this.underlayContainer)

        this.tileSprites = new PIXI.Container()
        this.tileSprites.interactive = false
        this.tileSprites.interactiveChildren = false
        this.addChild(this.tileSprites)

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

        this.on('pointerdown', this.pointerDownEventHandler)
        this.on('pointerup', this.pointerUpEventHandler)
        this.on('pointerupoutside', this.pointerUpEventHandler)

        document.addEventListener('wheel', e => {
            e.preventDefault()
            this.zoomPan.setScaleCenter(G.gridData.position.x, G.gridData.position.y)
            const z = Math.sign(-e.deltaY) * 0.1
            this.zoomPan.zoomBy(z, z)
            this.zoomPan.updateTransform()
            G.gridData.recalculate(this)
            this.updateViewportCulling()
        }, false)

        G.app.ticker.add(() => {
            const WSXOR = G.keyboard.w !== G.keyboard.s
            const ADXOR = G.keyboard.a !== G.keyboard.d
            if (WSXOR || ADXOR) {
                const finalSpeed = G.moveSpeed / (WSXOR && ADXOR ? 1.4142 : 1)
                this.zoomPan.translateBy(
                    (ADXOR ? (G.keyboard.a ? 1 : -1) : 0) * finalSpeed,
                    (WSXOR ? (G.keyboard.w ? 1 : -1) : 0) * finalSpeed
                )
                this.zoomPan.updateTransform()

                G.gridData.recalculate(this)

                this.updateViewportCulling()
            }
        })

        if (G.renderOnly) {
            this.interactiveChildren = false
        }

        G.gridData.onUpdate(() => {
            if (this.movingContainer) this.movingContainer.moveAtCursor()
            if (this.paintContainer) this.paintContainer.moveAtCursor()

            if (G.keyboard.movingViaWASD()) return
            if (this.hoverContainer) {
                if (this.holdingRightClick) this.hoverContainer.removeContainer()
                if (this.holdingLeftClick && G.keyboard.shift) this.hoverContainer.pasteData()
            }
        })
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
        for (const entity_number of G.bp.rawEntities.keys()) {
            this.entities.addChild(new EntityContainer(entity_number, false))
        }
        G.bp.tiles.forEach((v, k) => {
            this.tiles.addChild(new TileContainer(v, { x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }))
        })

        this.sortEntities()
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

        this.holdingLeftClick = false
        this.holdingRightClick = false
        this.hoverContainer = undefined
        this.movingContainer = undefined
        this.paintContainer = undefined

        this.underlayContainer = new UnderlayContainer()

        this.tileSprites = new PIXI.Container()
        this.tileSprites.interactive = false
        this.tileSprites.interactiveChildren = false

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
            this.grid, this.underlayContainer, this.tileSprites, this.entitySprites,
            this.tiles, this.entities, this.wiresContainer, this.overlayContainer
        )

        G.currentMouseState = G.mouseStates.NONE
    }

    sortEntities() {
        (this.entities.children as EntityContainer[]).sort((a, b) =>
            ((b.hitArea as PIXI.Rectangle).height - (a.hitArea as PIXI.Rectangle).height)
        );

        (this.entitySprites.children as EntitySprite[]).sort((a, b) => {
            if (a.isMoving && !b.isMoving) return 1
            if (b.isMoving && !a.isMoving) return -1
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
            this.zoomPan.setPosition(-G.sizeBPContainer.width / 2, -G.sizeBPContainer.height / 2)
            this.zoomPan.updateTransform()
            return
        }

        const bounds = this.getBlueprintBounds()
        this.zoomPan.centerViewPort({
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

    pointerDownEventHandler(e: PIXI.interaction.InteractionEvent) {
        if (G.currentMouseState === G.mouseStates.NONE) {
            if (e.data.button === 0) {
                if (!G.openedGUIWindow && !G.keyboard.shift) {
                    G.currentMouseState = G.mouseStates.PANNING
                }
                this.holdingLeftClick = true
            } else if (e.data.button === 2) {
                this.holdingRightClick = true
            }
        }
    }

    pointerUpEventHandler(e: PIXI.interaction.InteractionEvent) {
        if (e.data.button === 0) {
            if (G.currentMouseState === G.mouseStates.PANNING) {
                G.currentMouseState = G.mouseStates.NONE
            }
            this.holdingLeftClick = false
        } else if (e.data.button === 2) {
            this.holdingRightClick = false
        }
    }
}
