import G from '../globals'
import { ZoomPan } from '../zoomPan'
import { WiresContainer } from './wires'
import { UnderlayContainer } from './underlay'
import { EntitySprite } from '../entitySprite'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import { EntityContainer } from './entity'
import { OverlayContainer } from './overlay'
import { PaintContainer } from './paint'

export class BlueprintContainer extends PIXI.Container {

    holdingLeftClick: boolean
    grid: PIXI.Sprite
    wiresContainer: WiresContainer
    overlayContainer: OverlayContainer
    underlayContainer: UnderlayContainer
    entities: PIXI.Container
    movingEntityFilter: AdjustmentFilter
    entitySprites: PIXI.Container
    movementSpeed: number
    zoomPan: ZoomPan
    holdingRightClick: boolean
    lastCursorPos: IPoint
    pgOverlay: PIXI.Graphics
    hoverContainer: undefined | EntityContainer
    movingContainer: undefined | EntityContainer
    paintContainer: undefined | PaintContainer

    constructor() {
        super()
        this.interactive = true

        this.holdingLeftClick = false
        this.holdingRightClick = false
        this.lastCursorPos = { x: 0, y: 0 }

        this.movementSpeed = 10

        this.zoomPan = new ZoomPan(this, G.sizeBPContainer, G.positionBPContainer, {
            width: G.app.renderer.width,
            height: G.app.renderer.height
        }, 10)

        this.movingEntityFilter = new AdjustmentFilter({ red: 0.4, blue: 0.4, green: 1 })

        const ggrid = new PIXI.Graphics()
        for (let i = 0, l = G.sizeBPContainer.width; i < l; i += G.cellSize) {
            for (let j = 0, l2 = G.sizeBPContainer.height; j < l2; j += G.cellSize) {
                if ((i + j) / G.cellSize % 2) {
                    ggrid.beginFill(G.UIColors.primary)
                } else {
                    ggrid.beginFill(G.UIColors.secondary)
                }
                ggrid.drawRect(i, j, G.cellSize, G.cellSize)
                ggrid.endFill()
            }
        }
        this.grid = new PIXI.Sprite(G.app.renderer.generateTexture(ggrid))
        this.grid.interactive = false
        this.addChild(this.grid)

        this.pgOverlay = new PIXI.Graphics()
        this.pgOverlay.alpha = 0.2
        // this.addChild(this.pgOverlay)

        this.underlayContainer = new UnderlayContainer()
        this.addChild(this.underlayContainer)

        this.entitySprites = new PIXI.Container()
        this.entitySprites.interactive = false
        this.entitySprites.interactiveChildren = false
        this.addChild(this.entitySprites)

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
        this.on('pointermove', this.pointerMoveEventHandler)

        document.addEventListener('wheel', e => {
            e.preventDefault()
            this.zoomPan.setScaleCenter(G.gridCoordsOfCursor.x * 32, G.gridCoordsOfCursor.y * 32)
            const z = Math.sign(-e.deltaY) * 0.1
            this.zoomPan.zoomBy(z, z)
            this.zoomPan.updateTransform()
            this.updateViewportCulling()
        }, false)

        G.app.ticker.add(() => {
            const WSXOR = G.keyboard.w !== G.keyboard.s
            const ADXOR = G.keyboard.a !== G.keyboard.d
            if (WSXOR || ADXOR) {
                this.zoomPan.translateBy(
                    ADXOR ? (G.keyboard.a ? this.movementSpeed : -this.movementSpeed) : 0,
                    WSXOR ? (G.keyboard.w ? this.movementSpeed : -this.movementSpeed) : 0
                )
                this.zoomPan.updateTransform()

                if (this.updateCursorPosition() && (this.movingContainer || this.paintContainer)) {
                    (this.movingContainer || this.paintContainer).moveTo({
                        x: G.gridCoordsOfCursor.x * 32,
                        y: G.gridCoordsOfCursor.y * 32
                    })
                }

                this.updateViewportCulling()
            }
        })

        if (G.renderOnly) {
            this.interactiveChildren = false
        }
    }

    initBP() {
        // TODO: maybe check for curved rails as well
        for (const entity_number of G.bp.rawEntities.keys()) {
            const entity = G.bp.entity(entity_number)
            if (entity.name === 'straight-rail') {
                const x = Math.abs(entity.position.x)
                const y = Math.abs(entity.position.y)
                G.railMoveOffset = {
                    x: x % 2 + 1,
                    y: y % 2 + 1
                }
                break
            }
        }

        // Render Bp
        for (const entity_number of G.bp.rawEntities.keys()) {
            this.entities.addChild(new EntityContainer(entity_number, false))
        }

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
        this.underlayContainer.destroy(opt)
        this.entitySprites.destroy(opt)
        this.entities.destroy(opt)
        this.wiresContainer.destroy(opt)
        this.overlayContainer.destroy(opt)

        this.removeChildren()

        this.holdingLeftClick = false
        this.holdingRightClick = false
        this.hoverContainer = undefined
        this.movingContainer = undefined
        this.paintContainer = undefined

        this.underlayContainer = new UnderlayContainer()

        this.entitySprites = new PIXI.Container()
        this.entitySprites.interactive = false
        this.entitySprites.interactiveChildren = false

        this.entities = new PIXI.Container()
        this.entities.interactive = false
        this.entities.interactiveChildren = true

        this.wiresContainer = new WiresContainer()

        this.overlayContainer = new OverlayContainer()

        this.addChild(this.grid, this.underlayContainer, this.entitySprites, this.entities, this.wiresContainer, this.overlayContainer)

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

    updateCursorPosition(mousePosition?: IPoint) {
        const mousePositionInBP = {
            x: Math.abs(this.position.x - (mousePosition ? mousePosition.x : G.app.renderer.plugins.interaction.mouse.global.x))
                / this.zoomPan.getCurrentScale(),
            y: Math.abs(this.position.y - (mousePosition ? mousePosition.y : G.app.renderer.plugins.interaction.mouse.global.y))
                / this.zoomPan.getCurrentScale()
        }
        const newGridCoordsOfCursor = {
            x: (mousePositionInBP.x - mousePositionInBP.x % 32) / 32,
            y: (mousePositionInBP.y - mousePositionInBP.y % 32) / 32
        }
        if (newGridCoordsOfCursor.x !== G.gridCoordsOfCursor.x || newGridCoordsOfCursor.y !== G.gridCoordsOfCursor.y) {
            this.lastCursorPos = { ...(mousePosition ? mousePosition : G.app.renderer.plugins.interaction.mouse.global) }
            G.gridCoordsOfCursor = newGridCoordsOfCursor
            G.toolbarContainer.updateGridPos(G.gridCoordsOfCursor)
            return true
        }
    }

    updateOverlay() {
        return
        const TEMP = G.bp.entityPositionGrid.getAllPositions()
        this.pgOverlay.clear()
        for (const t of TEMP) {
            this.pgOverlay.beginFill(0x0080FF)
            this.pgOverlay.drawRect(t.x * 32, t.y * 32, G.cellSize, G.cellSize)
            this.pgOverlay.endFill()
        }
    }

    centerViewport() {
        if (G.bp.rawEntities.size === 0) {
            this.zoomPan.setPosition(-G.sizeBPContainer.width / 2, -G.sizeBPContainer.height / 2)
            this.zoomPan.updateTransform()
            return
        }

        const TL = G.bp.topLeft()
        const TR = G.bp.topRight()
        const BL = G.bp.bottomLeft()

        const W = G.bpArea.width / 2
        const H = G.bpArea.height / 2

        const hor1 = Math.abs(TL.x - W)
        const hor2 = TR.x - W

        const ver1 = Math.abs(TL.y - H)
        const ver2 = BL.y - H

        this.zoomPan.centerViewPort({
            x: (hor1 + hor2) * 32,
            y: (ver1 + ver2) * 32
        }, {
            x: (hor1 - hor2) * 16,
            y: (ver1 - ver2) * 16
        })
        this.updateViewportCulling()
    }

    updateViewportCulling() {
        cullChildren(this.entitySprites.children)
        cullChildren(this.overlayContainer.overlay.children)

        function cullChildren(children: PIXI.DisplayObject[]) {
            for (const c of children) {
                const b = c.getBounds()
                c.renderable =
                    b.x + b.width > G.positionBPContainer.x &&
                    b.y + b.height > G.positionBPContainer.y &&
                    b.x < G.app.renderer.width &&
                    b.y < G.app.renderer.height
            }
        }
    }

    pointerMoveEventHandler(e: PIXI.interaction.InteractionEvent) {
        // Update the position here to avoid calling all pointermove eventHandlers with
        // G.app.renderer.plugins.interaction.moveWhenInside set to false
        const newCursorPos = e.data.getLocalPosition(e.currentTarget)
        if (this.movingContainer || this.paintContainer) {
            (this.movingContainer || this.paintContainer).moveTo(newCursorPos)
        }

        if (G.keyboard.w !== G.keyboard.s || G.keyboard.a !== G.keyboard.d) return
        const newGridCoordsOfCursor = {
            x: (newCursorPos.x - newCursorPos.x % 32) / 32,
            y: (newCursorPos.y - newCursorPos.y % 32) / 32
        }
        if (newGridCoordsOfCursor.x !== G.gridCoordsOfCursor.x || newGridCoordsOfCursor.y !== G.gridCoordsOfCursor.y) {
            if (this.hoverContainer) {
                if (this.holdingRightClick) this.hoverContainer.removeContainer()
                if (this.holdingLeftClick && G.keyboard.shift) this.hoverContainer.pasteData()
            }
            G.gridCoordsOfCursor = newGridCoordsOfCursor
            G.toolbarContainer.updateGridPos(G.gridCoordsOfCursor)
        }
        if (G.currentMouseState === G.mouseStates.PANNING) {
            const dX = G.app.renderer.plugins.interaction.mouse.global.x - this.lastCursorPos.x
            const dY = G.app.renderer.plugins.interaction.mouse.global.y - this.lastCursorPos.y
            this.zoomPan.translateBy(dX, dY)
            this.zoomPan.updateTransform()
            this.updateViewportCulling()
        }
        this.lastCursorPos = { ...G.app.renderer.plugins.interaction.mouse.global }
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
