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

enum EditorMode {
    /** Default */
    NONE,
    /** Active when an entity is being hovered */
    EDIT,
    /** Active when "painting" */
    PAINT,
    /** Active when panning */
    PAN
}

class GridData extends EventEmitter {
    private _x = 0
    private _y = 0
    private _x16 = 0
    private _y16 = 0
    private _x32 = 0
    private _y32 = 0

    private lastMousePosX = 0
    private lastMousePosY = 0

    public constructor() {
        super()
        document.addEventListener('mousemove', e => this.update(e.clientX, e.clientY))
    }

    /** mouse x */
    public get x() {
        return this._x
    }
    /** mouse y */
    public get y() {
        return this._y
    }
    /** mouse x in 16 pixel size grid */
    public get x16() {
        return this._x16
    }
    /** mouse y in 16 pixel size grid */
    public get y16() {
        return this._y16
    }
    /** mouse x in 32 pixel size grid */
    public get x32() {
        return this._x32
    }
    /** mouse y in 32 pixel size grid */
    public get y32() {
        return this._y32
    }

    public recalculate() {
        this.update(this.lastMousePosX, this.lastMousePosY)
    }

    private update(mouseX: number, mouseY: number) {
        this.lastMousePosX = mouseX
        this.lastMousePosY = mouseY

        const oldX = this._x
        const oldY = this._y
        this._x = Math.floor(Math.abs(G.BPC.position.x - mouseX) / G.BPC.getViewportScale())
        this._y = Math.floor(Math.abs(G.BPC.position.y - mouseY) / G.BPC.getViewportScale())

        const oldX16 = this._x16
        const oldY16 = this._y16
        this._x16 = Math.floor(this._x / 16)
        this._y16 = Math.floor(this._y / 16)

        const oldX32 = this._x32
        const oldY32 = this._y32
        this._x32 = Math.floor(this._x / 32)
        this._y32 = Math.floor(this._y / 32)

        if (G.BPC.mode === EditorMode.PAN) {
            return
        }

        // emit update when mouse changes tile whithin the 1 pixel size grid
        if (!(oldX === this._x && oldY === this._y)) {
            this.emit('update', this._x, this._y)
        }
        // emit update16 when mouse changes tile whithin the 16 pixel size grid
        if (!(oldX16 === this._x16 && oldY16 === this._y16)) {
            this.emit('update16', this._x16, this._y16)
        }
        // emit update32 when mouse changes tile whithin the 32 pixel size grid
        if (!(oldX32 === this._x32 && oldY32 === this._y32)) {
            this.emit('update32', this._x32, this._y32)
        }
    }
}

class OptimizedContainer extends PIXI.ParticleContainer {
    public children: EntitySprite[]

    public constructor() {
        super(undefined, undefined, undefined, true)
    }
}

// Old OptimizedContainer implementation - maybe remove this in the future
// // This container improves rendering time by around 10-40% and has baked in viewport culling
// class OptimizedContainer extends PIXI.Container {
//     children: EntitySprite[]

//     updateTransform() {
//         this._boundsID += 1

//         this.transform.updateTransform(this.parent.transform)

//         this.worldAlpha = this.alpha * this.parent.worldAlpha

//         for (const c of this.children) {
//             if (c.visible) {
//                 c.updateTransform()
//             }
//         }
//     }

//     render(renderer: PIXI.Renderer) {
//         for (const c of this.children) {
//             if (G.BPC.viewportCulling) {
//                 // faster than using c.getBounds()
//                 if (
//                     c.cachedBounds[0] * this.worldTransform.a + c.worldTransform.tx > G.app.screen.width ||
//                     c.cachedBounds[1] * this.worldTransform.d + c.worldTransform.ty > G.app.screen.height ||
//                     c.cachedBounds[2] * this.worldTransform.a + c.worldTransform.tx < G.positionBPContainer.x ||
//                     c.cachedBounds[3] * this.worldTransform.d + c.worldTransform.ty < G.positionBPContainer.y
//                 ) {
//                     continue
//                 }
//             }

//             c.render(renderer)
//         }
//     }
// }q

class BlueprintContainer extends PIXI.Container {
    private grid: PIXI.TilingSprite
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

    public constructor() {
        super()

        this.interactive = true
        this.interactiveChildren = false
        this.hitArea = new PIXI.Rectangle(0, 0, G.sizeBPContainer.width, G.sizeBPContainer.height)

        this.viewport = new Viewport(
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
            if (this.mode !== EditorMode.PAN) {
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
    }

    public getViewportScale() {
        return this.viewport.getCurrentScale()
    }

    public setViewportSize(width: number, height: number) {
        this.viewport.setSize(width, height)
    }

    public applyViewportTransform() {
        const t = this.viewport.getTransform()
        this.setTransform(t.tx, t.ty, t.a, t.d)
        this.gridData.recalculate()
    }

    public get mode() {
        return this._mode
    }

    private setMode(mode: EditorMode) {
        this._mode = mode
        this.emit('mode', mode)
    }

    public enterPanMode() {
        if (this.mode === EditorMode.NONE && this.isPointerInside) {
            this.setMode(EditorMode.PAN)
            this.cursor = 'move'
        }
    }

    public exitPanMode() {
        if (this.mode === EditorMode.PAN) {
            this.setMode(EditorMode.NONE)
            this.cursor = 'inherit'
        }
    }

    public zoom(zoomIn = true) {
        const zoomFactor = 0.1
        this.viewport.setScaleCenter(this.gridData.x, this.gridData.y)
        this.viewport.zoomBy(zoomFactor * (zoomIn ? 1 : -1))
        this.applyViewportTransform()
    }

    private get isPointerInside() {
        const container = G.app.renderer.plugins.interaction.hitTest(
            G.app.renderer.plugins.interaction.mouse.global,
            G.app.stage
        )
        return container === this
    }

    private updateHoverContainer(forceRemove = false) {
        const removeHoverContainer = () => {
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

        if (!G.bp) {
            return
        }

        const entity = G.bp.entityPositionGrid.getEntityAtPosition(this.gridData.x32, this.gridData.y32)
        const eC = entity ? EntityContainer.mappings.get(entity.entityNumber) : undefined

        if (eC && this.hoverContainer === eC) {
            return
        }

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

    public generateGrid(pattern: 'checker' | 'grid' = 'checker') {
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

    public initBP() {
        const firstRail = G.bp.getFirstRail()
        if (firstRail) {
            G.railMoveOffset = {
                x: (Math.abs(firstRail.position.x) % 2) + 1,
                y: (Math.abs(firstRail.position.y) % 2) + 1
            }
        }

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

        G.bp.wireConnections.forEach((connection, hash) => this.wiresContainer.add(hash, connection))

        this.sortEntities()
        this.wiresContainer.updatePassiveWires()
        this.centerViewport()
    }

    public clearData() {
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

        this.setMode(EditorMode.NONE)
    }

    public addEntitySprites(entitySprites: EntitySprite[], sort = true) {
        this.entitySprites.addChild(...entitySprites)
        if (sort) {
            this.sortEntities()
        }
    }

    public addTileSprites(tileSprites: EntitySprite[]) {
        this.tileSprites.addChild(...tileSprites)
    }

    private sortEntities() {
        this.entitySprites.children.sort(EntitySprite.compareFn)
    }

    public transparentEntities(bool = true) {
        const alpha = bool ? 0.5 : 1
        this.entitySprites.alpha = alpha
        this.wiresContainer.alpha = alpha
        this.overlayContainer.alpha = alpha
    }

    public centerViewport() {
        if (G.bp.isEmpty()) {
            this.viewport.setCurrentScale(1)
            this.viewport.setPosition(
                -G.sizeBPContainer.width / 2 + G.app.screen.width / 2,
                -G.sizeBPContainer.height / 2 + G.app.screen.width / 2
            )
            this.applyViewportTransform()
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
        this.applyViewportTransform()
    }

    public getBlueprintBounds() {
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

        const rect = bounds.getRectangle(new PIXI.Rectangle())

        const X = Math.floor(rect.x / 32) * 32
        const Y = Math.floor(rect.y / 32) * 32
        const W = Math.ceil((rect.width + rect.x - X) / 32) * 32
        const H = Math.ceil((rect.height + rect.y - Y) / 32) * 32
        return new PIXI.Rectangle(X, Y, W, H)
    }

    public spawnPaintContainer(itemName: string, direction = 0) {
        const itemData = FD.items[itemName]
        const tileResult = itemData.place_as_tile && itemData.place_as_tile.result
        const placeResult = itemData.place_result || tileResult

        if (this.mode === EditorMode.PAINT) {
            this.paintContainer.destroy()
        }

        this.updateHoverContainer(true)
        this.setMode(EditorMode.PAINT)
        this.cursor = 'pointer'

        if (tileResult) {
            this.paintContainer = new TilePaintContainer(placeResult)
            this.tilePaintSlot.addChild(this.paintContainer)
        } else {
            this.paintContainer = new EntityPaintContainer(placeResult, direction)
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

export { EditorMode, BlueprintContainer }
