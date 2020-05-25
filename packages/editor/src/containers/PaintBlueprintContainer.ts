import { Entity } from '../core/Entity'
import G from '../common/globals'
import { Blueprint } from '../core/Blueprint'
import { serialize, deserialize } from '../core/WireConnections'
import { EntitySprite } from './EntitySprite'
import { PaintContainer } from './PaintContainer'
import { PaintBlueprintEntityContainer } from './PaintBlueprintEntityContainer'

export class PaintBlueprintContainer extends PaintContainer {
    private readonly bp: Blueprint
    private readonly entities = new Map<Entity, PaintBlueprintEntityContainer>()
    public children: EntitySprite[]

    public constructor(entities: Entity[]) {
        super('blueprint')

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

        const entMap = new Map(entities.map(e => [e.entityNumber, e]))
        const rawEntities = entities.map(e => e.serialize())
        rawEntities.forEach(e => {
            e.position.x -= center.x
            e.position.y -= center.y
            // Filter out connections outside selection
            e.connections = serialize(
                e.entity_number,
                deserialize(e.entity_number, e.connections).filter(
                    c => entMap.has(c.entityNumber1) && entMap.has(c.entityNumber2)
                )
            )
        })
        this.bp = new Blueprint({
            entities: rawEntities,
        })

        this.bp.entities.forEach(e => {
            const epc = new PaintBlueprintEntityContainer(this, this.bp, e)

            epc.entitySprites.forEach(sprite => {
                sprite.setPosition({
                    x: e.position.x * 32,
                    y: e.position.y * 32,
                })
            })

            this.entities.set(e, epc)
            this.addChild(...epc.entitySprites)
        })

        this.children.sort(EntitySprite.compareFn)

        this.entities.forEach((_, e) =>
            G.BPC.visualizationAreaContainer.activateRelatedAreas(e.name)
        )

        this.moveAtCursor()
    }

    public hide(): void {
        G.BPC.visualizationAreaContainer.deactivateActiveAreas()
        super.hide()
    }

    public show(): void {
        if (this.entities) {
            this.entities.forEach((_, e) =>
                G.BPC.visualizationAreaContainer.activateRelatedAreas(e.name)
            )
        }
        super.show()
    }

    public destroy(): void {
        G.BPC.visualizationAreaContainer.deactivateActiveAreas()
        this.entities.forEach(c => c.destroy())
        super.destroy()
    }

    public getItemName(): string {
        return 'blueprint'
    }

    public rotate(): void {
        if (!this.visible) {
            return
        }

        // TODO: implement
        return undefined
    }

    public moveAtCursor(): void {
        if (!this.visible) {
            return
        }

        const firstRailHere = this.bp.getFirstRailRelatedEntity()
        const firstRailInBP = G.bp.getFirstRailRelatedEntity()

        if (firstRailHere && firstRailInBP) {
            const frX = G.BPC.gridData.x32 + firstRailHere.position.x
            const frY = G.BPC.gridData.y32 + firstRailHere.position.y

            // grid offsets
            const oX =
                -Math.abs((Math.abs(frX) % 2) - (Math.abs(firstRailInBP.position.x - 1) % 2)) + 1
            const oY =
                -Math.abs((Math.abs(frY) % 2) - (Math.abs(firstRailInBP.position.y - 1) % 2)) + 1

            this.x = (G.BPC.gridData.x32 + oX) * 32
            this.y = (G.BPC.gridData.y32 + oY) * 32
        } else {
            this.x = G.BPC.gridData.x32 * 32
            this.y = G.BPC.gridData.y32 * 32
        }

        this.entities.forEach(c => c.moveAtCursor())
    }

    protected redraw(): void {}

    public placeEntityContainer(): void {
        if (!this.visible) {
            return
        }

        G.bp.history.startTransaction('Create Entities')

        const oldEntIDToNewEntID = new Map<number, number>()
        this.entities.forEach((c, entity) => {
            const e = c.placeEntityContainer()
            if (e) {
                oldEntIDToNewEntID.set(entity.entityNumber, e.entityNumber)
            }
        })

        // Create wire connections
        if (oldEntIDToNewEntID.size !== 0) {
            oldEntIDToNewEntID.forEach((_, oldID) => {
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
                    .forEach(conn => G.bp.wireConnections.create(conn))
            })
        }

        G.bp.history.commitTransaction()
    }

    public removeContainerUnder(): void {
        if (!this.visible) {
            return
        }

        G.bp.history.startTransaction('Remove Entities')
        this.entities.forEach(c => c.removeContainerUnder())
        G.bp.history.commitTransaction()
    }
}
