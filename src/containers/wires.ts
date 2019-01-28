import { EntityContainer } from './entity'
import G from '../common/globals'
import util from '../common/util'
import FD from 'factorio-data'
import U from '../factorio-data/generators/util'

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

    static getWireSprite(entity_number_1: number, entity_number_2: number, color: string, entity_side_1 = 0, entity_side_2 = 0) {
        return WiresContainer.createWire(
            getWirePos(entity_number_1, color, entity_side_1),
            getWirePos(entity_number_2, color, entity_side_2),
            color
        )

        function getWirePos(entity_number: number, color: string, side: number) {
            const point = G.bp.entity(entity_number).getWireConnectionPoint(color, side)
            return {
                x: EntityContainer.mappings.get(entity_number).position.x + point[0] * 32,
                y: EntityContainer.mappings.get(entity_number).position.y + point[1] * 32
            }
        }
    }

    entityWiresMapping: Map<string, PIXI.Sprite[]>
    passiveWiresMapping: Map<string, PIXI.Sprite>

    constructor() {
        super()

        this.interactive = false
        this.interactiveChildren = false

        this.entityWiresMapping = new Map()
        this.passiveWiresMapping = new Map()
    }

    remove(entity_number: number) {
        this.entityWiresMapping.forEach((v, k) => {
            if (k.includes(entity_number.toString())) {
                for (const g of v) g.destroy()
                this.entityWiresMapping.delete(k)
            }
        })
    }

    update(entity_number: number) {
        if (G.bp.entity(entity_number).type === 'electric_pole') {
            // Remove connection so that updatePassiveWires diffs correctly
            this.passiveWiresMapping.forEach((v, k) => {
                if (k.includes(entity_number.toString())) {
                    v.destroy()
                    this.passiveWiresMapping.delete(k)
                }
            })

            this.updatePassiveWires()
        }

        if (!G.bp.entity(entity_number).hasConnections) return

        this.remove(entity_number)
        G.bp.connections.connections.forEach((v, k) => {
            const first = Number(k.split('-')[0])
            const second = Number(k.split('-')[1])
            if (first === entity_number || second === entity_number) {
                if (first === entity_number) EntityContainer.mappings.get(second).redraw()
                else if (second === entity_number) EntityContainer.mappings.get(first).redraw()

                const sprites = v
                    .map(c => c.toJS())
                    .map((c: IConnection) =>
                        WiresContainer.getWireSprite(c.entity_number_1, c.entity_number_2, c.color, c.entity_side_1, c.entity_side_2)
                    )

                sprites.forEach(s => this.addChild(s))
                this.entityWiresMapping.set(k, sprites.toArray())
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

            const sprites = v
                .map(c => c.toJS())
                .map((c: IConnection) =>
                    WiresContainer.getWireSprite(c.entity_number_1, c.entity_number_2, c.color, c.entity_side_1, c.entity_side_2)
                )

            sprites.forEach(s => this.addChild(s))
            this.entityWiresMapping.set(k, sprites.toArray())
        })
    }

    updatePassiveWires() {
        interface IPole extends IPoint {
            entity_number: number
            name: number
        }

        const poleNames = Object.keys(FD.entities)
            .map(k => FD.entities[k])
            .filter(e => e.type === 'electric_pole')
            .map(e => e.name)

        const poles: IPole[] = G.bp.rawEntities
            .filter(e => poleNames.includes(e.name))
            .map(e => ({
                ...e,
                x: EntityContainer.mappings.get(e.entity_number).position.x / 32,
                y: EntityContainer.mappings.get(e.entity_number).position.y / 32
            }))

        if (poles.length < 2) return

        const lineHash = (line: Array<{ entity_number: number }>) =>
            `${Math.min(line[0].entity_number, line[1].entity_number)}-${Math.max(line[0].entity_number, line[1].entity_number)}`

        const setsOfLines = U.pointsToTriangles(poles)
            .map(tri => tri
                .reduce((acc, _, i, arr) => {
                    if (i === arr.length - 1) return acc.concat([[arr[0], arr[i]]])
                    return acc.concat([[arr[i], arr[i + 1]]])
                }, [] as IPole[][])
                .filter(line =>
                    U.pointInCircle(line[0], line[1], Math.min(
                        FD.entities[line[0].name].maximum_wire_distance,
                        FD.entities[line[1].name].maximum_wire_distance
                    ))
                )
            )

        const lines = setsOfLines
            .reduce((acc, val) => acc.concat(val), [])
            .sort((a, b) =>
                (Math.min(a[0].x, a[1].x) + Math.min(a[0].y, a[1].y)) -
                (Math.min(b[0].x, b[1].x) + Math.min(b[0].y, b[1].y))
            )
            .sort((a, b) => U.manhattenDistance(a[0], a[1]) - U.manhattenDistance(b[0], b[1]))

        const triangles = setsOfLines
            .filter(lines => lines.length === 3)
            .map(lines => lines.map(lineHash))

        const finalLines: IPole[][] = []
        const addedMap: Map<string, boolean> = new Map()

        while (lines.length) {
            const line = lines.shift()
            const hash = lineHash(line)

            const formsATriangle = triangles
                .filter(tri => tri.includes(hash))
                .map(tri => tri.filter(h => h !== hash))
                .map(oLines => oLines.every(h => addedMap.get(h)))
                .reduce((acc, bool) => acc || bool, false)

            if (!formsATriangle) {
                finalLines.push(line)
                addedMap.set(hash, true)
            }
        }

        const finalLinesHashes = finalLines
            .reduce((map, line) => map.set(lineHash(line), line), new Map())
        const toAdd = Array.from(finalLinesHashes.keys()).filter(k => !this.passiveWiresMapping.get(k))
        const toDel = Array.from(this.passiveWiresMapping.keys()).filter(k => !finalLinesHashes.get(k))

        // console.log(toAdd, toDel)

        toAdd
            .forEach(hash => {
                const sprite = WiresContainer.getWireSprite(Number(hash.split('-')[0]), Number(hash.split('-')[1]), 'copper')
                this.addChild(sprite)
                this.passiveWiresMapping.set(hash, sprite)
            })

        toDel
            .forEach(hash => {
                this.passiveWiresMapping.get(hash).destroy()
                this.passiveWiresMapping.delete(hash)
            })
    }
}
