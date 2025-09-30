import { Container } from 'pixi.js'
import { DirectionType, IPoint } from '../types'
import FD from '../core/factorioData'
import util from '../common/util'
import { Entity } from '../core/Entity'
import { EntitySprite } from './EntitySprite'
import { VisualizationArea } from './VisualizationArea'
import { PaintContainer } from './PaintContainer'
import { BlueprintContainer } from './BlueprintContainer'

export class PaintEntityContainer extends PaintContainer {
    private visualizationArea: VisualizationArea
    private directionType: DirectionType
    private direction: number
    /** This is only a reference */
    private undergroundLine: Container

    public constructor(bpc: BlueprintContainer, name: string, direction: number) {
        super(bpc, name)

        this.direction = direction
        this.directionType = FD.entities[name].type === 'loader' ? 'output' : 'input'

        this.visualizationArea = this.bpc.underlayContainer.create(this.name, this.position)
        this.visualizationArea.highlight()
        this.bpc.underlayContainer.activateRelatedAreas(this.name)

        this.attachUpdateOn16()
        this.moveAtCursor()
        this.redraw()
    }

    private get size(): IPoint {
        return util.switchSizeBasedOnDirection(FD.entities[this.name].size, this.direction)
    }

    public hide(): void {
        this.bpc.underlayContainer.deactivateActiveAreas()
        this.destroyUndergroundLine()
        super.hide()
    }

    public show(): void {
        this.bpc.underlayContainer.activateRelatedAreas(this.name)
        this.updateUndergroundLine()
        super.show()
    }

    public destroy(): void {
        this.visualizationArea.destroy()
        this.bpc.underlayContainer.deactivateActiveAreas()
        this.destroyUndergroundLine()
        super.destroy()
    }

    public override getItemName(): string {
        return Entity.getItemName(this.name)
    }

    private checkBuildable(): void {
        const position = this.getGridPosition()
        const direction = this.directionType === 'input' ? this.direction : (this.direction + 4) % 8

        if (
            this.bpc.bp.entityPositionGrid.checkFastReplaceableGroup(
                this.name,
                direction,
                position
            ) ||
            this.bpc.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(
                this.name,
                direction,
                position
            ) ||
            this.bpc.bp.entityPositionGrid.isAreaAvailable(this.name, position, direction)
        ) {
            this.blocked = false
        } else {
            this.blocked = true
        }
    }

    private updateUndergroundBeltRotation(): void {
        const fd = FD.entities[this.name]
        if (fd.type === 'underground-belt') {
            const otherEntity = this.bpc.bp.entityPositionGrid.getOpposingEntity(
                this.name,
                (this.direction + 4) % 8,
                {
                    x: this.x / 32,
                    y: this.y / 32,
                },
                this.direction,
                fd.max_distance
            )
            if (otherEntity) {
                const oe = this.bpc.bp.entities.get(otherEntity)
                this.directionType = oe.directionType === 'input' ? 'output' : 'input'
            } else {
                if (this.directionType === 'output') {
                    this.directionType = 'input'
                }
            }
            this.redraw()
        }
    }

    private updateUndergroundLine(): void {
        this.destroyUndergroundLine()
        this.undergroundLine = this.bpc.overlayContainer.createUndergroundLine(
            this.name,
            this.getGridPosition(),
            this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
            this.name === 'pipe-to-ground' ? (this.direction + 4) % 8 : this.direction
        )
    }

    private destroyUndergroundLine(): void {
        if (this.undergroundLine) {
            this.undergroundLine.destroy()
        }
    }

    public override rotate(ccw = false): void {
        if (!this.visible) return

        const pr = FD.entities[this.name].possible_rotations
        if (!pr) return
        this.direction = pr[(pr.indexOf(this.direction) + (ccw ? 3 : 1)) % pr.length]

        this.redraw()
        this.moveAtCursor()
    }

    public override canFlipOrRotateByCopying(): boolean {
        return false
    }

    public override rotatedEntities(_ccw?: boolean): Entity[] {
        return undefined
    }

    public override flippedEntities(_vertical: boolean): Entity[] {
        return undefined
    }

    protected override redraw(): void {
        this.removeChildren()
        const sprites = EntitySprite.getParts({
            name: this.name,
            direction: this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
            directionType: this.directionType,
        })
        this.addChild(...sprites)
    }

    public override moveAtCursor(): void {
        if (!this.visible) return

        const railRelatedNames = ['legacy-straight-rail', 'legacy-curved-rail', 'train-stop']
        const firstRailPos = this.bpc.bp.getFirstRailRelatedEntityPos()

        if (railRelatedNames.includes(this.name) && firstRailPos) {
            // grid offsets
            const oX =
                -Math.abs(
                    (Math.abs(this.bpc.gridData.x32) % 2) - (Math.abs(firstRailPos.x - 1) % 2)
                ) + 1
            const oY =
                -Math.abs(
                    (Math.abs(this.bpc.gridData.y32) % 2) - (Math.abs(firstRailPos.y - 1) % 2)
                ) + 1

            this.setPosition({
                x: (this.bpc.gridData.x32 + oX) * 32,
                y: (this.bpc.gridData.y32 + oY) * 32,
            })
        } else {
            this.setNewPosition(this.size)
        }

        this.updateUndergroundBeltRotation()
        this.updateUndergroundLine()

        this.visualizationArea.moveTo(this.position)

        this.checkBuildable()
    }

    public override removeContainerUnder(): void {
        if (!this.visible) return

        const entities = this.bpc.bp.entityPositionGrid.getEntitiesInArea({
            ...this.getGridPosition(),
            w: this.size.x,
            h: this.size.y,
        })
        this.bpc.bp.removeEntities(entities)
        this.checkBuildable()
    }

    public override placeEntityContainer(): void {
        if (!this.visible) return

        const fd = FD.entities[this.name]
        const position = this.getGridPosition()
        const direction = this.directionType === 'input' ? this.direction : (this.direction + 4) % 8

        if (this.bpc.bp.fastReplaceEntity(this.name, direction, position)) return

        const snEnt = this.bpc.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(
            this.name,
            direction,
            position
        )
        if (snEnt) {
            snEnt.direction = direction
            return
        }

        if (this.bpc.bp.entityPositionGrid.isAreaAvailable(this.name, position, direction)) {
            this.bpc.bp.createEntity(
                {
                    name: this.name,
                    position,
                    direction,
                    type:
                        fd.type === 'underground-belt' || fd.type === 'loader'
                            ? this.directionType
                            : undefined,
                },
                true
            )

            if (fd.type === 'underground-belt' || this.name === 'pipe-to-ground') {
                this.direction = (direction + 4) % 8
                this.redraw()
                this.destroyUndergroundLine()
            }
        }

        this.checkBuildable()
    }
}
