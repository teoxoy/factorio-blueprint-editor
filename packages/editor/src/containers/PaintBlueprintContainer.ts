import { Entity } from '../core/Entity'
import { Blueprint } from '../core/Blueprint'
import { EntitySprite } from './EntitySprite'
import { PaintContainer } from './PaintContainer'
import { PaintBlueprintEntityContainer } from './PaintBlueprintEntityContainer'
import { BlueprintContainer } from './BlueprintContainer'
import { IConnectionPoint } from '../core/WireConnections'

export class PaintBlueprintContainer extends PaintContainer {
    private readonly bp: Blueprint
    private readonly entities = new Map<Entity, PaintBlueprintEntityContainer>()

    public constructor(bpc: BlueprintContainer, entities: Entity[]) {
        super(bpc, 'blueprint')

        const minX = entities.reduce(
            (min, e) => Math.min(min, e.position.x - e.size.x / 2),
            Infinity
        )
        const minY = entities.reduce(
            (min, e) => Math.min(min, e.position.y - e.size.y / 2),
            Infinity
        )
        const maxX = entities.reduce(
            (max, e) => Math.max(max, e.position.x + e.size.x / 2),
            -Infinity
        )
        const maxY = entities.reduce(
            (max, e) => Math.max(max, e.position.y + e.size.y / 2),
            -Infinity
        )

        const center = {
            x: Math.floor((minX + maxX) / 2),
            y: Math.floor((minY + maxY) / 2),
        }

        const entNrWhitelist = new Set(entities.map(e => e.entityNumber))
        const wires = entities[0].Blueprint.wireConnections
            .serializeBpWires()
            .filter(wire => entNrWhitelist.has(wire[0]) && entNrWhitelist.has(wire[2]))
        this.bp = new Blueprint({
            entities: entities.map(e => {
                const ent = e.serialize(entNrWhitelist)
                ent.position.x -= center.x
                ent.position.y -= center.y
                return ent
            }),
            wires,
        })

        for (const [, e] of this.bp.entities) {
            const epc = new PaintBlueprintEntityContainer(this, this.bpc, this.bp, e)
            this.addChild(...epc.entitySprites)
            this.entities.set(e, epc)
        }

        this.children.sort(EntitySprite.compareFn)
        for (const [e] of this.entities) {
            this.bpc.underlayContainer.activateRelatedAreas(e.name)
        }

        this.attachUpdateOn16()
        this.moveAtCursor()
    }

    public hide(): void {
        this.bpc.underlayContainer.deactivateActiveAreas()
        super.hide()
    }

    public show(): void {
        if (this.entities) {
            for (const [e] of this.entities) {
                this.bpc.underlayContainer.activateRelatedAreas(e.name)
            }
        }
        super.show()
    }

    public destroy(): void {
        this.bpc.underlayContainer.deactivateActiveAreas()
        for (const [, c] of this.entities) {
            c.destroy()
        }
        super.destroy()
    }

    public override getItemName(): string {
        return 'blueprint'
    }

    public override rotate(_ccw?: boolean): void {}

    public logDataForComparison(): void {
        const withOutNums = [...this.entities.keys()].map(e => ({
            ...e.rawEntity,
            entity_number: undefined,
        }))
        withOutNums.sort(
            (a, b) =>
                Math.sign(b.position.y - a.position.y) || Math.sign(b.position.x - a.position.x)
        )
        console.log(withOutNums)
    }

    public override canFlipOrRotateByCopying(): boolean {
        return true
    }

    public override rotatedEntities(ccw?: boolean): Entity[] {
        if (!this.visible) return undefined
        const result = []
        for (const [e] of this.entities) {
            result.push(e.getRotatedCopy(ccw))
        }
        return result
    }

    public override flippedEntities(vertical: boolean): Entity[] {
        const result = []
        for (const [e] of this.entities) {
            result.push(e.getFlippedCopy(vertical))
        }
        return result
    }

    public override moveAtCursor(): void {
        if (!this.visible) return

        const firstRailPosHere = this.bp.getFirstRailRelatedEntityPos()
        const firstRailPosInBP = this.bpc.bp.getFirstRailRelatedEntityPos()

        if (firstRailPosHere && firstRailPosInBP) {
            const frX = this.bpc.gridData.x32 + firstRailPosHere.x
            const frY = this.bpc.gridData.y32 + firstRailPosHere.y

            // grid offsets
            const oX = -Math.abs((Math.abs(frX) % 2) - (Math.abs(firstRailPosInBP.x - 1) % 2)) + 1
            const oY = -Math.abs((Math.abs(frY) % 2) - (Math.abs(firstRailPosInBP.y - 1) % 2)) + 1

            this.setPosition({
                x: (this.bpc.gridData.x32 + oX) * 32,
                y: (this.bpc.gridData.y32 + oY) * 32,
            })
        } else {
            this.setPosition({
                x: this.bpc.gridData.x32 * 32,
                y: this.bpc.gridData.y32 * 32,
            })
        }

        for (const [, c] of this.entities) {
            c.moveAtCursor()
        }
    }

    protected override redraw(): void {}

    public override placeEntityContainer(): void {
        if (!this.visible) return

        this.bpc.bp.history.startTransaction('Create Entities')

        const oldEntIDToNewEntID = new Map<number, number>()
        for (const [entity, c] of this.entities) {
            const e = c.placeEntityContainer()
            if (e) {
                oldEntIDToNewEntID.set(entity.entityNumber, e.entityNumber)
            }
        }

        // Create wire connections
        if (oldEntIDToNewEntID.size !== 0) {
            for (const [oldID] of oldEntIDToNewEntID) {
                this.bp.wireConnections
                    .getEntityConnections(oldID)
                    .filter(connection =>
                        connection.cps.every(cp => oldEntIDToNewEntID.has(cp.entityNumber))
                    )
                    .map(connection => ({
                        ...connection,
                        cps: connection.cps.map(cp => ({
                            ...cp,
                            entityNumber: oldEntIDToNewEntID.get(cp.entityNumber),
                        })) as [IConnectionPoint, IConnectionPoint],
                    }))
                    .forEach(conn => this.bpc.bp.wireConnections.create(conn))
            }
        }

        this.bpc.bp.history.commitTransaction()
    }

    public override removeContainerUnder(): void {
        if (!this.visible) return

        this.bpc.bp.history.startTransaction('Remove Entities')
        for (const [, c] of this.entities) {
            c.removeContainerUnder()
        }
        this.bpc.bp.history.commitTransaction()
    }
}
