import { Entity } from '../core/Entity'
import { Blueprint } from '../core/Blueprint'
import { WireConnections } from '../core/WireConnections'
import { EntitySprite } from './EntitySprite'
import { PaintContainer } from './PaintContainer'
import { PaintBlueprintEntityContainer } from './PaintBlueprintEntityContainer'
import { BlueprintContainer } from './BlueprintContainer'

export class PaintBlueprintContainer extends PaintContainer {
    private readonly bp: Blueprint
    private readonly entities = new Map<Entity, PaintBlueprintEntityContainer>()
    public children: EntitySprite[]

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
        this.bp = new Blueprint({
            entities: entities.map(e => {
                const ent = e.serialize(entNrWhitelist)
                ent.position.x -= center.x
                ent.position.y -= center.y
                return ent
            }),
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

    public getItemName(): string {
        return 'blueprint'
    }

    public rotate(): void {
        if (!this.visible) return

        // TODO: implement
        return undefined
    }

    public moveAtCursor(): void {
        if (!this.visible) return

        const firstRailHere = this.bp.getFirstRailRelatedEntity()
        const firstRailInBP = this.bpc.bp.getFirstRailRelatedEntity()

        if (firstRailHere && firstRailInBP) {
            const frX = this.bpc.gridData.x32 + firstRailHere.position.x
            const frY = this.bpc.gridData.y32 + firstRailHere.position.y

            // grid offsets
            const oX =
                -Math.abs((Math.abs(frX) % 2) - (Math.abs(firstRailInBP.position.x - 1) % 2)) + 1
            const oY =
                -Math.abs((Math.abs(frY) % 2) - (Math.abs(firstRailInBP.position.y - 1) % 2)) + 1

            this.x = (this.bpc.gridData.x32 + oX) * 32
            this.y = (this.bpc.gridData.y32 + oY) * 32
        } else {
            this.x = this.bpc.gridData.x32 * 32
            this.y = this.bpc.gridData.y32 * 32
        }

        for (const [, c] of this.entities) {
            c.moveAtCursor()
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    protected redraw(): void {}

    public placeEntityContainer(): void {
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
                    .filter(
                        connection =>
                            oldEntIDToNewEntID.has(connection.entityNumber1) &&
                            oldEntIDToNewEntID.has(connection.entityNumber2)
                    )
                    .map(connection => ({
                        ...connection,
                        entityNumber1: oldEntIDToNewEntID.get(connection.entityNumber1),
                        entityNumber2: oldEntIDToNewEntID.get(connection.entityNumber2),
                    }))
                    .forEach(conn => this.bpc.bp.wireConnections.create(conn))
            }
        }

        this.bpc.bp.history.commitTransaction()
    }

    public removeContainerUnder(): void {
        if (!this.visible) return

        this.bpc.bp.history.startTransaction('Remove Entities')
        for (const [, c] of this.entities) {
            c.removeContainerUnder()
        }
        this.bpc.bp.history.commitTransaction()
    }
}
