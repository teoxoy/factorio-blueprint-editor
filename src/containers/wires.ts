import { EntityContainer } from './entity'
import G from '../globals'

interface IConnection {
    circuit_id: number
    color: string
    entity_number_1: number
    entity_number_2: number
    entity_side_1: number
    entity_side_2: number
}

export class WiresContainer extends PIXI.Container {

    static resolution = 2
    static lineWidth = 2 * WiresContainer.resolution

    static createWire(p1: IPoint, p2: IPoint, color: string) {
        const wire = new PIXI.Graphics()
        if (color === 'copper') {
            wire.lineStyle(WiresContainer.lineWidth, 0xCF7C00, 1, 0.5)
        } else if (color === 'red') {
            wire.lineStyle(WiresContainer.lineWidth, 0xC83718, 1, 0.5)
        } else {
            wire.lineStyle(WiresContainer.lineWidth, 0x588C38, 1, 0.5)
        }

        const force = 0.25
        const minX = Math.min(p1.x, p2.x)
        const minY = Math.min(p1.y, p2.y)
        const dX = Math.max(p1.x, p2.x) - minX
        const dY = Math.max(p1.y, p2.y) - minY
        const X = minX + dX / 2
        const Y = (dY / dX) * (X - minX) + minY + force * dX

        wire.moveTo(p1.x * WiresContainer.resolution, p1.y * WiresContainer.resolution)
        // TODO: make wires smoother, use 2 points instead of 1
        if (p1.x === p2.x) {
            wire.lineTo(p2.x * WiresContainer.resolution, p2.y * WiresContainer.resolution)
        } else {
            wire.bezierCurveTo(
                X * WiresContainer.resolution,
                Y * WiresContainer.resolution,
                X * WiresContainer.resolution,
                Y * WiresContainer.resolution,
                p2.x * WiresContainer.resolution,
                p2.y * WiresContainer.resolution
            )
        }
        return wire
    }

    static getFinalPos(entity_number: number, color: string, side: number) {
        const point = G.bp.entity(entity_number).getWireConnectionPoint(color, side)
        return {
            x: EntityContainer.mappings.get(entity_number).position.x + point[0] * 32,
            y: EntityContainer.mappings.get(entity_number).position.y + point[1] * 32
        }
    }

    entityWiresMapping: Map<string, PIXI.Graphics[]>

    constructor() {
        super()

        this.interactive = false
        this.interactiveChildren = false

        this.entityWiresMapping = new Map()

        this.scale.set(1 / WiresContainer.resolution)
    }

    remove(entity_number: number) {
        this.entityWiresMapping.forEach((v, k) => {
            const first = Number(k.split('-')[0])
            const second = Number(k.split('-')[1])
            if (first === entity_number || second === entity_number) {
                for (const g of v) g.destroy()
                this.entityWiresMapping.delete(k)
            }
        })
    }

    update(entity_number: number) {
        this.cacheAsBitmap = false
        if (!G.bp.entity(entity_number).hasConnections) return
        this.remove(entity_number)
        G.bp.connections.connections.forEach((v, k) => {
            const first = Number(k.split('-')[0])
            const second = Number(k.split('-')[1])
            if (first === entity_number || second === entity_number) {
                if (first === entity_number) EntityContainer.mappings.get(second).redraw()
                else if (second === entity_number) EntityContainer.mappings.get(first).redraw()

                const paths = v.map(c => c.toJS()).map((c: IConnection) =>
                    WiresContainer.createWire(
                        WiresContainer.getFinalPos(c.entity_number_1, c.color, c.entity_side_1),
                        WiresContainer.getFinalPos(c.entity_number_2, c.color, c.entity_side_2),
                        c.color
                    )
                )
                for (const p of paths) {
                    this.addChild(p)
                }
                this.entityWiresMapping.set(k, paths.toArray())
            }
        })
        this.cacheAsBitmap = true
    }

    drawWires() {
        this.cacheAsBitmap = false
        G.bp.connections.connections.forEach((v, k) => {
            if (this.entityWiresMapping.has(k)) {
                for (const p of this.entityWiresMapping.get(k)) {
                    this.removeChild(p)
                }
            }

            const paths = v.map(c => c.toJS()).map((c: IConnection) =>
                WiresContainer.createWire(
                    WiresContainer.getFinalPos(c.entity_number_1, c.color, c.entity_side_1),
                    WiresContainer.getFinalPos(c.entity_number_2, c.color, c.entity_side_2),
                    c.color
                )
            )
            for (const p of paths) {
                this.addChild(p)
            }
            this.entityWiresMapping.set(k, paths.toArray())
        })
        this.cacheAsBitmap = true
    }
}
