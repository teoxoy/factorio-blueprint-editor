import { Entity } from '../core/Entity'
import F from '../UI/controls/functions'
import G from '../common/globals'
import { Blueprint } from '../core/Blueprint'
import { EntitySprite } from './EntitySprite'
import { VisualizationArea } from './VisualizationArea'
import { PaintBlueprintContainer } from './PaintBlueprintContainer'

export class PaintBlueprintEntityContainer {
    private readonly bpc: PaintBlueprintContainer
    private readonly bp: Blueprint
    private readonly entity: Entity
    private readonly visualizationArea: VisualizationArea
    public readonly entitySprites: EntitySprite[]
    /** This is only a reference */
    private undergroundLine: PIXI.Container

    public constructor(bpc: PaintBlueprintContainer, bp: Blueprint, entity: Entity) {
        this.bpc = bpc
        this.bp = bp
        this.entity = entity

        this.visualizationArea = G.BPC.visualizationAreaContainer.create(this.entity.name, this.position)

        this.entitySprites = EntitySprite.getParts(this.entity, this.bp.entityPositionGrid)
    }

    private get entityPosition(): IPoint {
        return {
            x: this.bpc.x / 32 + this.entity.position.x,
            y: this.bpc.y / 32 + this.entity.position.y
        }
    }

    private get position(): IPoint {
        return {
            x: this.bpc.x + this.entity.position.x,
            y: this.bpc.y + this.entity.position.y
        }
    }

    public destroy(): void {
        this.visualizationArea.destroy()
        this.destroyUndergroundLine()
    }

    private checkBuildable(): void {
        const position = this.entityPosition
        const direction = this.entity.direction

        const allow =
            G.bp.entityPositionGrid.checkFastReplaceableGroup(this.entity.name, direction, position) ||
            G.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(this.entity.name, direction, position) ||
            G.bp.entityPositionGrid.isAreaAvalible(this.entity.name, position, direction)

        this.entitySprites.forEach(s =>
            F.applyTint(s, {
                r: allow ? 0.4 : 1,
                g: allow ? 1 : 0.4,
                b: 0.4,
                a: 1
            })
        )
    }

    private updateUndergroundLine(): void {
        this.destroyUndergroundLine()
        this.undergroundLine = G.BPC.overlayContainer.createUndergroundLine(
            this.entity.name,
            this.entityPosition,
            this.entity.directionType === 'input' ? this.entity.direction : (this.entity.direction + 4) % 8,
            this.entity.name === 'pipe_to_ground' || this.entity.directionType === 'output'
                ? (this.entity.direction + 4) % 8
                : this.entity.direction
        )
    }

    private destroyUndergroundLine(): void {
        if (this.undergroundLine) {
            this.undergroundLine.destroy()
        }
    }

    public moveAtCursor(): void {
        this.updateUndergroundLine()

        this.visualizationArea.moveTo(this.position)

        this.checkBuildable()
    }

    public removeContainerUnder(): void {
        const size = this.entity.size

        const entities = G.bp.entityPositionGrid.getEntitiesInArea({
            ...this.entityPosition,
            w: size.x,
            h: size.y
        })
        G.bp.removeEntities(entities)
        this.checkBuildable()
    }

    public placeEntityContainer(): Entity {
        const position = this.entityPosition
        const direction = this.entity.direction

        const frgEnt = G.bp.entityPositionGrid.checkFastReplaceableGroup(this.entity.name, direction, position)
        if (frgEnt) {
            G.bp.fastReplaceEntity(frgEnt, this.entity.name, direction)
            return
        }
        const snEnt = G.bp.entityPositionGrid.checkSameEntityAndDifferentDirection(
            this.entity.name,
            direction,
            position
        )
        if (snEnt) {
            snEnt.direction = direction
            return
        }

        let ent: Entity
        if (G.bp.entityPositionGrid.isAreaAvalible(this.entity.name, position, direction)) {
            ent = G.bp.createEntity({
                ...this.entity.serialize(),
                entity_number: undefined,
                connections: undefined,
                position
            })
        }

        this.checkBuildable()

        return ent
    }
}
