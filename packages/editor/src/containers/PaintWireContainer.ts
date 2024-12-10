import * as PIXI from 'pixi.js'
import G from '../common/globals'
import U from '../core/generators/util'
import { IConnection, IConnectionPoint } from '../core/WireConnections'
import { Entity } from '../core/Entity'
import { EntityContainer } from './EntityContainer'
import { PaintContainer } from './PaintContainer'
import { BlueprintContainer } from './BlueprintContainer'

export class PaintWireContainer extends PaintContainer {
    private color?: string
    private cp?: IConnectionPoint = undefined
    /** This is only a reference */
    private cursorBox: PIXI.Container

    public constructor(bpc: BlueprintContainer, name: string) {
        super(bpc, name)

        this.color = name.split('_', 1)[0]
        this.cp = undefined

        this.moveAtCursor()
        this.redraw()
    }

    private get entity(): Entity {
        if (this.cp === undefined) return undefined
        return this.bpc.bp.entities.get(this.cp.entityNumber)
    }

    public hide(): void {
        super.hide()
    }

    public show(): void {
        super.hide() // keep icon visible
        this.visible = true
    }

    public destroy(pipette = false): void {
        if (pipette && this.cp) {
            this.cp = undefined
            this.redraw()
            return
        }
        this.bpc.wiresContainer.remove('paint-wire')
        this.destroycursorBox()
        super.destroy()
    }

    public getItemName(): string {
        return this.name
    }

    private updatecursorBox(): IConnectionPoint {
        this.destroycursorBox()
        const cursor_position = this.getGridPosition()
        const entity = this.bpc.bp.entityPositionGrid.getEntityAtPosition(cursor_position)
        if (entity === undefined) return undefined
        const ec = EntityContainer.mappings.get(entity.entityNumber)

        const cp = this.bpc.bp.entityPositionGrid.getConnectionPointAtPosition(
            cursor_position,
            this.color
        )

        let connectionsReach = true
        if (this.cp && G.BPC.limitWireReach) {
            connectionsReach &&= U.pointInCircle(
                entity.position,
                this.cp.position ?? this.entity.position,
                Math.min(
                    entity.maxWireDistance ?? Infinity,
                    this.entity?.maxWireDistance ?? Infinity
                )
            )
        }

        this.cursorBox = this.bpc.overlayContainer.createCursorBox(
            ec.position,
            entity.size,
            cp === undefined ? 'not_allowed' : !connectionsReach ? 'not_allowed' : 'regular'
        )
        if (connectionsReach) return cp
    }
    private destroycursorBox(): void {
        this.cursorBox?.destroy()
    }

    public rotate(): void {
        if (!this.visible) return

        // const cursor_position = this.getGridPosition()
        // const entity = this.bpc.bp.entityPositionGrid.getEntityAtPosition(cursor_position)
        // entity?.rotate(ccw, true)

        /** Non-standard behavior: cycle between colors */
        if (this.name === 'red_wire') this.name = 'green_wire'
        else if (this.name === 'green_wire') this.name = 'red_wire'
        this.color = this.name.split('_', 1)[0]

        this.redraw()
    }

    public canFlipOrRotateByCopying(): boolean {
        return false
    }

    protected redraw(): void {
        this.updatecursorBox()
        this.bpc.wiresContainer.remove('paint-wire')
        if (this.cp) {
            const connection: IConnection = {
                color: this.color,
                cps: [this.cp, { position: this.getGridPosition() }],
            }
            this.bpc.wiresContainer.add('paint-wire', connection)
        }
    }

    public moveAtCursor(): void {
        this.setNewPosition()
        this.redraw()
    }

    public placeEntityContainer(): void {
        if (!this.visible) return

        const cp = this.updatecursorBox()
        if (cp === undefined) return

        if (this.cp?.entityNumber === undefined) {
            this.cp = cp
        } else {
            const connection: IConnection = {
                color: this.color,
                cps: [this.cp, cp],
            }
            if (cp.entityNumber === this.cp.entityNumber && cp.entitySide === this.cp.entitySide) {
                this.cp = undefined
            } else if (this.bpc.bp.wireConnections.has(connection)) {
                this.bpc.bp.wireConnections.remove(connection)
                this.cp = undefined
            } else {
                this.bpc.bp.wireConnections.create(connection)
                this.cp = cp
            }
        }
        this.moveAtCursor()
    }

    /** Non-standard behavior: on right click, keep focusing same connection point. */
    public removeContainerUnder(): void {
        if (!this.visible) return

        const cp = this.updatecursorBox()
        if (cp === undefined) return

        if (this.cp?.entityNumber === undefined) {
            this.cp = cp
        } else {
            const connection: IConnection = {
                color: this.color,
                cps: [this.cp, cp],
            }
            if (cp.entityNumber === this.cp.entityNumber && cp.entitySide === this.cp.entitySide) {
                this.cp = undefined
            } else if (this.bpc.bp.wireConnections.has(connection)) {
                this.bpc.bp.wireConnections.remove(connection)
            } else {
                this.bpc.bp.wireConnections.create(connection)
            }
        }
        this.moveAtCursor()
    }
}
