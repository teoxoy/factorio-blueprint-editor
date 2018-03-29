import G from '../globals'
import util from '../util'
import factorioData from '../factorio-data/factorioData'
import { EntityContainer } from './entity'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import { UnderlayContainer } from './underlay'

export class PaintContainer extends PIXI.Container {
    areaVisualization: PIXI.Sprite | PIXI.Sprite[] | undefined
    holdingRightClick: boolean
    directionType: string
    direction: number
    holdingLeftClick: boolean
    filter: AdjustmentFilter

    constructor(name: string, direction: number, position: IPoint) {
        super()
        this.name = name
        this.direction = direction
        this.directionType = 'input'
        this.position.set(position.x, position.y)
        this.filter = new AdjustmentFilter({ blue: 0.4 })
        this.filters = [this.filter]
        this.checkBuildable()

        this.interactive = true
        this.interactiveChildren = false
        this.buttonMode = true

        this.holdingLeftClick = false

        this.areaVisualization = G.BPC.underlayContainer.createNewArea(this.name)
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => {
            s.alpha += 0.25
            s.visible = true
        })
        G.BPC.underlayContainer.activateRelatedAreas(this.name)

        this.on('pointerdown', this.pointerDownEventHandler)
        this.on('pointerup', this.pointerUpEventHandler)
        this.on('pointerupoutside', this.pointerUpEventHandler)
        // this.on('pointermove', this.pointerMoveEventHandler)

        this.redraw()
    }

    destroy() {
        super.destroy()
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())
        G.BPC.underlayContainer.deactivateActiveAreas()
        G.BPC.overlayContainer.hideUndergroundLines()
    }

    checkBuildable() {
        const position = EntityContainer.getGridPosition(this.position)
        const size = util.switchSizeBasedOnDirection(factorioData.getEntity(this.name).size, this.direction)
        if (!EntityContainer.isContainerOutOfBpArea(position, size) &&
            (G.bp.entityPositionGrid.checkFastReplaceableGroup(this.name, this.direction, position) ||
            G.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(this.name, this.direction, position) ||
            G.bp.entityPositionGrid.checkNoOverlap(this.name, this.direction, position))
        ) {
            this.filter.red = 0.4
            this.filter.green = 1
        } else {
            this.filter.red = 1
            this.filter.green = 0.4
        }
    }

    updateUndergroundBeltRotation() {
        const fd = factorioData.getEntity(this.name)
        if (fd.type === 'underground-belt') {
            const otherEntity = G.bp.entityPositionGrid.findEntityWithSameNameAndDirection(
                this.name, (this.direction + 4) % 8, {
                    x: this.x / 32,
                    y: this.y / 32
                },
                this.direction,
                fd.max_distance
            )
            if (otherEntity) {
                const oe = G.bp.entity(otherEntity)
                this.directionType = oe.directionType === 'input' ? 'output' : 'input'
            } else {
                if (this.directionType === 'output') this.directionType = 'input'
            }
            this.redraw()
        }
    }

    updateUndergroundLines() {
        G.BPC.overlayContainer.updateUndergroundLines(
            this.name,
            { x: this.position.x / 32, y: this.position.y / 32 },
            this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
            this.name === 'pipe-to-ground' ? (this.direction + 4) % 8 : this.direction
        )
    }

    rotate() {
        const pr = factorioData.getEntity(this.name).possible_rotations
        if (!pr) return
        this.direction = pr[ (pr.indexOf(this.direction) + 1) % pr.length ]
        this.redraw()
        const size = util.switchSizeBasedOnDirection(factorioData.getEntity(this.name).size, this.direction)
        if (size.x !== size.y) {
            this.position.set(
                this.x + ((this.x / 16 - G.gridCoords16.x) === 0 ? 0.5 : -0.5) * 32,
                this.y + ((this.y / 16 - G.gridCoords16.y) === 0 ? 0.5 : -0.5) * 32
            )

            const pos = EntityContainer.getPositionFromData(this.position, size)
            this.position.set(pos.x, pos.y)
        }
        this.checkBuildable()
        this.updateUndergroundBeltRotation()
        this.updateUndergroundLines()
    }

    redraw() {
        this.removeChildren()
        this.addChild(...EntityContainer.getParts({
            name: this.name,
            direction: this.directionType === 'output' ? (this.direction + 4) % 8 : this.direction,
            directionType: this.directionType
        }, true, true))
        const size = util.switchSizeBasedOnDirection(factorioData.getEntity(this.name).size, this.direction)
        this.hitArea = new PIXI.Rectangle(
            -size.x * 16,
            -size.y * 16,
            size.x * 32,
            size.y * 32
        )
    }

    pointerDownEventHandler(e: PIXI.interaction.InteractionEvent) {
        if (e.data.button === 0) {
            this.holdingLeftClick = true
            this.placeEntityContainer()
        } else if (e.data.button === 2) {
            this.holdingRightClick = true
            this.removeContainer()
        }
    }

    pointerUpEventHandler(e: PIXI.interaction.InteractionEvent) {
        if (e.data.button === 0) {
            this.holdingLeftClick = false
        } else if (e.data.button === 2) {
            this.holdingRightClick = false
        }
    }

    // pointerMoveEventHandler(e: PIXI.interaction.InteractionEvent) {
    //     this.moveTo(e.data.getLocalPosition(this.parent))
    // }

    moveTo(newPosition: IPoint) {
        const newCursorPos = {
            x: (newPosition.x - newPosition.x % 16) / 16,
            y: (newPosition.y - newPosition.y % 16) / 16
        }
        if (newCursorPos.x !== G.gridCoords16.x || newCursorPos.y !== G.gridCoords16.y) {
            if (this.holdingRightClick) this.removeContainer()

            switch (this.name) {
                case 'straight-rail':
                case 'curved-rail':
                case 'train-stop':
                    this.position.set(
                        newPosition.x - (newPosition.x + G.railMoveOffset.x * 32) % 64 + 32,
                        newPosition.y - (newPosition.y + G.railMoveOffset.y * 32) % 64 + 32
                    )
                    break
                default:
                    const size = util.switchSizeBasedOnDirection(factorioData.getEntity(this.name).size, this.direction)
                    const pos = EntityContainer.getPositionFromData(newPosition, size)
                    this.position.set(pos.x, pos.y)
            }

            this.updateUndergroundBeltRotation()
            G.BPC.overlayContainer.updateUndergroundLinesPosition(this.position)
            this.updateUndergroundLines()

            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.position.copy(this.position))

            if (this.holdingLeftClick) this.placeEntityContainer()
            G.gridCoords16 = newCursorPos

            this.checkBuildable()
        }
    }

    removeContainer() {
        const position = EntityContainer.getGridPosition(this.position)
        const c = EntityContainer.mappings.get(G.bp.entityPositionGrid.getCellAtPosition(position))
        if (c) {
            c.removeContainer()
            this.checkBuildable()
        }
    }

    placeEntityContainer() {
        const fd = factorioData.getEntity(this.name)
        const position = EntityContainer.getGridPosition(this.position)
        const size = util.switchSizeBasedOnDirection(fd.size, this.direction)
        if (EntityContainer.isContainerOutOfBpArea(position, size)) return

        const frgEntNr = G.bp.entityPositionGrid.checkFastReplaceableGroup(this.name, this.direction, position)
        if (frgEntNr) {
            const frgEnt = G.bp.entity(frgEntNr)
            frgEnt.change(this.name, this.direction)
            const c = EntityContainer.mappings.get(frgEntNr)
            c.redraw()
            c.redrawSurroundingEntities()
            return
        }
        const snEntNr = G.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(
            this.name, this.direction, position
        )
        if (snEntNr) {
            G.bp.entity(snEntNr).direction = this.direction
            const c = EntityContainer.mappings.get(snEntNr)
            c.redraw()
            c.redrawSurroundingEntities()
            return
        }

        const isUB = fd.type === 'underground-belt'
        const res = G.bp.createEntity(this.name, position,
            isUB && this.directionType === 'output' ? (this.direction + 4) % 8 : this.direction,
            isUB ? this.directionType : undefined
        )
        if (res) {
            const ec = new EntityContainer(res)
            if (ec.areaVisualization) {
                if (ec.areaVisualization instanceof PIXI.Sprite) {
                    ec.areaVisualization.visible = true
                } else {
                    for (const s of ec.areaVisualization) s.visible = true
                }
            }
            G.BPC.entities.addChild(ec)
            ec.redrawSurroundingEntities()

            if (isUB || this.name === 'pipe-to-ground') {
                this.direction = (this.direction + 4) % 8
                this.redraw()
                G.BPC.overlayContainer.hideUndergroundLines()
            }

            G.BPC.updateOverlay()
        }

        this.checkBuildable()
    }
}
