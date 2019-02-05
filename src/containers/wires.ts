import { EntityContainer } from './entity'
import G from '../common/globals'
import util from '../common/util'
import FD from 'factorio-data'
import U from '../factorio-data/generators/util'
import Entity from '../factorio-data/entity'

const hashConn = (conn: IConnection) => {
    const firstE = Math.min(conn.entity_number_1, conn.entity_number_2)
    const secondE = Math.max(conn.entity_number_1, conn.entity_number_2)
    const firstS = firstE === conn.entity_number_1 ? conn.entity_side_1 : conn.entity_side_2
    const secondS = secondE === conn.entity_number_2 ? conn.entity_side_2 : conn.entity_side_1
    return `${conn.color}-${firstE}-${secondE}-${firstS}-${secondS}`
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

    connectionToSprite: Map<string, PIXI.Sprite>
    passiveConnToSprite: Map<string, PIXI.Sprite>
    entNrToConnectedEntNrs: Map<number, number[]>

    constructor() {
        super()

        this.interactive = false
        this.interactiveChildren = false

        this.connectionToSprite = new Map()
        this.passiveConnToSprite = new Map()
    }

    add(connections: IConnection[]) {
        connections.forEach(conn => {
            const hash = hashConn(conn)
            if (!this.connectionToSprite.has(hash)) {
                const sprite = this.getWireSprite(conn)
                this.addChild(sprite)
                this.connectionToSprite.set(hash, sprite)
            }
        })
    }

    remove(connection: IConnection) {
        const hash = hashConn(connection)
        const sprite = this.connectionToSprite.get(hash)
        if (sprite) {
            sprite.destroy()
            this.connectionToSprite.delete(hash)
        }
    }

    update(entity: Entity) {
        if (entity.type === 'electric_pole') {
            // Remove connection so that updatePassiveWires diffs correctly
            this.passiveConnToSprite.forEach((v, k) => {
                if (k.includes(entity.entity_number.toString())) {
                    v.destroy()
                    this.passiveConnToSprite.delete(k)
                }
            })

            this.updatePassiveWires()
        }

        if (!entity.hasConnections) return

        const connections = entity.connections
        connections.forEach(c => this.remove(c))
        this.add(connections)
    }

    getWireSprite(connection: IConnection) {
        const getWirePos = (entity_number: number, color: string, side: number) => {
            const entity = G.bp.entities.get(entity_number)
            const direction = entity.type === 'electric_pole' ? this.getPowerPoleDirection(entity) : entity.direction
            const point = entity.getWireConnectionPoint(color, side, direction)
            return {
                x: (entity.position.x + point[0]) * 32,
                y: (entity.position.y + point[1]) * 32
            }
        }

        return WiresContainer.createWire(
            getWirePos(connection.entity_number_1, connection.color, connection.entity_side_1),
            getWirePos(connection.entity_number_2, connection.color, connection.entity_side_2),
            connection.color
        )
    }

    getPowerPoleDirection(entity: Entity) {
        if (!this.entNrToConnectedEntNrs) return 0
        const entNrArr = this.entNrToConnectedEntNrs.get(entity.entity_number)
        if (!entNrArr) return 0
        return getPowerPoleRotation(
            entity.position,
            entNrArr
                .map(entNr => G.bp.entities.get(entNr))
                .filter(e => !!e)
                .map(ent => ent.position)
        )

        function getPowerPoleRotation(centre: IPoint, points: IPoint[]) {
            const sectorSum = points
                .map(p => U.getAngle(0, 0, p.x - centre.x, (p.y - centre.y) * -1 /* invert Y axis */))
                .map(angleToSector)
                .reduce((acc, sec) => acc + sec, 0)

            return Math.floor(sectorSum / points.length) * 2

            function angleToSector(angle: number) {
                const cwAngle = 360 - angle
                const sectorAngle = 360 / 8
                const offset = sectorAngle * 1.5
                let newAngle = cwAngle - offset
                if (Math.sign(newAngle) === -1) newAngle = 360 + newAngle
                const sector = Math.floor(newAngle / sectorAngle)
                return (sector % 4) as 0 | 1 | 2 | 3
            }
        }
    }

    updatePassiveWires() {
        interface IPole extends IPoint {
            entity_number: number
            name: string
        }

        const poles: IPole[] = G.bp.entities
            .filter(e => e.type === 'electric_pole')
            .map(e => ({
                entity_number: e.entity_number,
                name: e.name,
                x: e.position.x,
                y: e.position.y
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

        this.entNrToConnectedEntNrs = finalLines
            .reduce((map: Map<number, number[]>, line) => {
                const eNr0 = line[0].entity_number
                const eNr1 = line[1].entity_number

                const arr0 = map.get(eNr0)
                if (arr0 && !arr0.includes(eNr1)) arr0.push(eNr1)
                if (!arr0) map.set(eNr0, [eNr1])

                const arr1 = map.get(eNr1)
                if (arr1 && !arr1.includes(eNr0)) arr1.push(eNr0)
                if (!arr1) map.set(eNr1, [eNr0])

                return map
            }, new Map<number, number[]>())

        const finalLinesHashes = finalLines
            .reduce((map, line) => map.set(lineHash(line), line), new Map())
        const toAdd = Array.from(finalLinesHashes.keys()).filter(k => !this.passiveConnToSprite.get(k))
        const toDel = Array.from(this.passiveConnToSprite.keys()).filter(k => !finalLinesHashes.get(k))

        // update rotations
        const toUpdate: number[] = [...toAdd, ...toDel]
            .reduce((arr, hash) => {
                const entNr0 = Number(hash.split('-')[0])
                const entNr1 = Number(hash.split('-')[1])
                if (!arr.includes(entNr0)) arr.push(entNr0)
                if (!arr.includes(entNr1)) arr.push(entNr1)
                return arr
            }, [])

        const addWire = (hash: string) => {
            const sprite = this.getWireSprite({
                color: 'copper',
                entity_number_1: Number(hash.split('-')[0]),
                entity_number_2: Number(hash.split('-')[1]),
                entity_side_1: 1,
                entity_side_2: 1
            })
            this.addChild(sprite)
            this.passiveConnToSprite.set(hash, sprite)
        }

        const removeWire = (hash: string) => {
            this.passiveConnToSprite.get(hash).destroy()
            this.passiveConnToSprite.delete(hash)
        }

        toUpdate.forEach(entNr => {
            const ec = EntityContainer.mappings.get(entNr)
            if (G.bp.entities.get(entNr) && ec) {
                // redraw to update direction
                ec.redraw()

                // redraw connected wires
                if (this.entNrToConnectedEntNrs.get(entNr)) {
                    this.entNrToConnectedEntNrs.get(entNr)
                        .forEach((eNr: number) => {
                            const hash = lineHash([{ entity_number: eNr }, { entity_number: entNr }])
                            if (this.passiveConnToSprite.get(hash)) {
                                removeWire(hash)
                                addWire(hash)
                            }
                        })
                }
            }
        })

        // console.log(toAdd, toDel)

        toAdd.forEach(addWire)
        toDel.forEach(removeWire)
    }
}
