import { EntityContainer } from './entity'
import G from '../common/globals'
import util from '../util'

interface IConnection {
    circuit_id: number
    color: string
    entity_number_1: number
    entity_number_2: number
    entity_side_1: number
    entity_side_2: number
}

export class WiresContainer extends PIXI.Container {

    static canvasRenderer = new PIXI.CanvasRenderer()

    static createWire(p1: IPoint, p2: IPoint, color: string) {
        const wire = new PIXI.Graphics()

        wire.lineWidth = 1.5
        if (color === 'copper') wire.lineColor = 0xCF7C00
        else if (color === 'red') wire.lineColor = 0xC83718
        else wire.lineColor = 0x588C38

        const minX = Math.min(p1.x, p2.x)
        const minY = Math.min(p1.y, p2.y)

        if (p1.x === p2.x) {
            wire.lineWidth = 3

            wire.moveTo(p1.x - minX, p1.y - minY)
            wire.lineTo(p2.x - minX, p2.y - minY)
        } else {
            const force = 0.2
            const dX = Math.max(p1.x, p2.x) - minX
            const dY = Math.max(p1.y, p2.y) - minY
            const X = dX / 2
            const Y = (dY / dX) * X + force * dX

            // TODO: make wires smoother, use 2 points instead of 1
            wire.moveTo(p1.x - minX, p1.y - minY)
            wire.bezierCurveTo(X, Y, X, Y, p2.x - minX, p2.y - minY)
        }

        // Modified version of generateCanvasTexture, makes the texture a power of 2 so that it generates mipmaps
        // https://github.com/pixijs/pixi.js/blob/c2bff5c07b5178ff4ca2b3b8ddcfa3e002cf598f/src/core/graphics/Graphics.js#L1268
        function generateCanvasTexture(scaleMode: number, resolution = 1) {
            const bounds = wire.getLocalBounds()
            const canvasBuffer = PIXI.RenderTexture.create(
                util.nearestPowerOf2(bounds.width),
                util.nearestPowerOf2(bounds.height),
                scaleMode,
                resolution
            )
            WiresContainer.canvasRenderer.render(wire, canvasBuffer, true)
            const texture = PIXI.Texture.fromCanvas(canvasBuffer.baseTexture._canvasRenderTarget.canvas, scaleMode, 'graphics')
            texture.baseTexture.resolution = resolution
            texture.baseTexture.update()
            return texture
        }

        const s = new PIXI.Sprite(generateCanvasTexture(undefined, 2))
        s.position.set(minX, minY)
        return s
    }

    static getFinalPos(entity_number: number, color: string, side: number) {
        const point = G.bp.entity(entity_number).getWireConnectionPoint(color, side)
        return {
            x: EntityContainer.mappings.get(entity_number).position.x + point[0] * 32,
            y: EntityContainer.mappings.get(entity_number).position.y + point[1] * 32
        }
    }

    entityWiresMapping: Map<string, PIXI.Sprite[]>

    constructor() {
        super()

        this.interactive = false
        this.interactiveChildren = false

        this.entityWiresMapping = new Map()
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
    }

    drawWires() {
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
    }
}
