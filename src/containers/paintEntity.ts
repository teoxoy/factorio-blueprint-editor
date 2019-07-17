import FD from 'factorio-data'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import util from '../common/util'
import { EntitySprite } from '../entitySprite'
import Entity from '../factorio-data/entity'
import { EntityContainer } from './entity'
import { UnderlayContainer } from './underlay'
import { PaintContainer } from './paint'

export class EntityPaintContainer extends PaintContainer {
    static isContainerOutOfBpArea(newPos: IPoint, size: IPoint) {
        return (
            newPos.x - size.x / 2 < 0 ||
            newPos.y - size.y / 2 < 0 ||
            newPos.x + size.x / 2 > G.bpArea.width ||
            newPos.y + size.y / 2 > G.bpArea.height
        )
    }

    areaVisualization: PIXI.Sprite | PIXI.Sprite[]
    directionType: 'input' | 'output'
    direction: number
    /** This is only a reference */
    undergroundLine: PIXI.Container

    constructor(name: string, direction: number) {
        super(name)

        this.direction = direction
        this.directionType = FD.entities[name].type === 'loader' ? 'output' : 'input'

        this.areaVisualization = G.BPC.underlayContainer.createNewArea(this.name)
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => {
            s.alpha += 0.25
            s.visible = true
        })
        G.BPC.underlayContainer.activateRelatedAreas(this.name)

        this.moveAtCursor()
        this.redraw()
    }

    hide() {
        G.BPC.underlayContainer.deactivateActiveAreas()
        super.hide()
    }

    show() {
        G.BPC.underlayContainer.activateRelatedAreas(this.name)
        super.show()
    }

    destroy() {
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())
        G.BPC.underlayContainer.deactivateActiveAreas()
        this.destroyUndergroundLine()
        super.destroy()
    }

    getItemName() {
        return Entity.getItemName(this.name)
    }

    checkBuildable() {
        const position = this.getGridPosition()
        const direction = this.directionType === 'input' ? this.direction : (this.direction + 4) % 8
        const size = util.switchSizeBasedOnDirection(FD.entities[this.name].size, direction)
        if (
            !EntityPaintContainer.isContainerOutOfBpArea(position, size) &&
            (G.bp.entityPositionGrid.checkFastReplaceableGroup(this.name, direction, position) ||
                G.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(this.name, direction, position) ||
                G.bp.entityPositionGrid.isAreaAvalible(this.name, position, direction))
        ) {
            this.blocked = false
        } else {
            this.blocked = true
        }
    }

    updateUndergroundBeltRotation() {
        const fd = FD.entities[this.name]
        if (fd.type === 'underground_belt') {
            const otherEntity = G.bp.entityPositionGrid.getOpposingEntity(
                this.name,
                (this.direction + 4) % 8,
                {
                    x: this.x / 32,
                    y: this.y / 32
                },
                this.direction,
                fd.max_distance
            )
            if (otherEntity) {
                const oe = G.bp.entities.get(otherEntity)
                this.directionType = oe.directionType === 'input' ? 'output' : 'input'
            } else {
                if (this.directionType === 'output') {
                    this.directionType = 'input'
                }
            }
            this.redraw()
        }
    }

    updateUndergroundLine() {
        this.destroyUndergroundLine()
        this.undergroundLine = G.BPC.overlayContainer.createUndergroundLine(
            this.name,
            { x: this.position.x / 32, y: this.position.y / 32 },
            this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
            this.name === 'pipe_to_ground' ? (this.direction + 4) % 8 : this.direction
        )
    }

    destroyUndergroundLine() {
        if (this.undergroundLine) {
            this.undergroundLine.destroy()
        }
    }

    rotate(ccw = false) {
        const pr = FD.entities[this.name].possible_rotations
        if (!pr) {
            return
        }
        this.direction = pr[(pr.indexOf(this.direction) + (ccw ? 3 : 1)) % pr.length]

        this.redraw()
        this.moveAtCursor()
    }

    redraw() {
        this.removeChildren()
        this.addChild(
            ...EntitySprite.getParts(
                {
                    name: this.name,
                    direction: this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
                    directionType: this.directionType
                },
                G.quality.hr,
                true
            )
        )
    }

    moveAtCursor() {
        switch (this.name) {
            case 'straight_rail':
            case 'curved_rail':
            case 'train_stop':
                this.position.set(
                    // 64 pixel size grid
                    Math.floor((G.BPC.gridData.x32 + G.railMoveOffset.x) / 2) * 64,
                    Math.floor((G.BPC.gridData.y32 + G.railMoveOffset.y) / 2) * 64
                )
                break
            default:
                this.setNewPosition(util.switchSizeBasedOnDirection(FD.entities[this.name].size, this.direction))
        }

        this.updateUndergroundBeltRotation()
        this.updateUndergroundLine()

        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.position.copyFrom(this.position))

        this.checkBuildable()
    }

    removeContainerUnder() {
        const entity = G.bp.entityPositionGrid.getEntityAtPosition(G.BPC.gridData.x32, G.BPC.gridData.y32)
        if (entity) {
            G.bp.removeEntity(entity)
            this.checkBuildable()
        }
    }

    placeEntityContainer() {
        if (!this.visible) {
            return
        }

        const fd = FD.entities[this.name]
        const position = this.getGridPosition()
        const direction = this.directionType === 'input' ? this.direction : (this.direction + 4) % 8
        const size = util.switchSizeBasedOnDirection(fd.size, direction)

        if (EntityPaintContainer.isContainerOutOfBpArea(position, size)) {
            return
        }

        const frgEnt = G.bp.entityPositionGrid.checkFastReplaceableGroup(this.name, direction, position)
        if (frgEnt) {
            G.bp.fastReplaceEntity(frgEnt, this.name, direction)
            return
        }
        const snEnt = G.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(this.name, direction, position)
        if (snEnt) {
            snEnt.direction = direction
            return
        }

        if (G.bp.entityPositionGrid.isAreaAvalible(this.name, position, direction)) {
            const newEntity = G.bp.createEntity({
                name: this.name,
                position,
                direction,
                type: fd.type === 'underground_belt' || fd.type === 'loader' ? this.directionType : undefined
            })

            const ec = EntityContainer.mappings.get(newEntity.entityNumber)
            UnderlayContainer.modifyVisualizationArea(ec.areaVisualization, s => {
                s.visible = true
            })

            if (fd.type === 'underground_belt' || this.name === 'pipe_to_ground') {
                this.direction = (direction + 4) % 8
                this.redraw()
                this.destroyUndergroundLine()
            }
        }

        this.checkBuildable()
    }
}
