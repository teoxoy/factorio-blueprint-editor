import * as PIXI from 'pixi.js'
import { EventEmitter } from 'eventemitter3'
import { MaxRectsPacker, PACKING_LOGIC } from 'maxrects-packer'
import G from '../common/globals'

interface IOptions {
    maxSize: number
    alpha: boolean
    scaleMode: PIXI.SCALE_MODES
    /** padding around each texture */
    padding: number
    /** extrude the edges of textures - useful for removing gaps in sprites when tiling */
    extrude: boolean
    /** draw different colored boxes behind each texture - for debugging */
    testBoxes: boolean
    /** attach the canvases to document.body - for debugging */
    show: boolean
}

interface IEntry {
    x: number
    y: number
    width: number
    height: number
    id: string
    image: HTMLImageElement
    ready: boolean
    texture: PIXI.Texture
}

const getCanvas = (baseTexture: PIXI.BaseTexture): HTMLCanvasElement => {
    const resource = baseTexture.resource as PIXI.resources.CanvasResource
    return resource.source as HTMLCanvasElement
}

export class DynamicSpritesheet extends EventEmitter {
    private testBoxes = false
    private maxSize = 2048
    private padding = 2
    private show = false
    private extrude = false
    /** Max number of images loading at the same time */
    private maxLoading = 200
    private baseTextures: Map<number, PIXI.BaseTexture> = new Map()
    private entries: Map<string, IEntry> = new Map()
    private canvasesDiv: HTMLDivElement
    private packer: MaxRectsPacker<IEntry>
    /** Number of images loading */
    private loading = 0
    private nrOfBinsOnLastRepack = 0
    private textureToEntry: WeakMap<PIXI.Texture, IEntry> = new WeakMap()
    private rendering = false
    /** Mechanism to rerender in case `render` was called but it was already rendering */
    private rerender = false
    private firstRender = true
    private alpha = true
    private subtextures: Map<string, PIXI.Texture> = new Map()
    /** Mechanism to limit the number of images loading at the same time */
    private waitingQueue: (() => void)[] = []

    public constructor(options: Partial<IOptions> = {}) {
        super()
        Object.assign(this, options)
        if (this.extrude && this.padding < 2) {
            this.padding = 2
        }
        this.packer = new MaxRectsPacker<IEntry>(this.maxSize, this.maxSize, this.padding * 2, {
            smart: false,
            pot: true,
            square: false,
            allowRotation: false,
            tag: false,
            border: this.padding,
            logic: PACKING_LOGIC.MAX_EDGE,
        })

        if (this.show) {
            this.canvasesDiv = document.createElement('div')
            this.canvasesDiv.style.position = 'fixed'
            this.canvasesDiv.style.display = 'flex'
            this.canvasesDiv.style.top = '0'
            this.canvasesDiv.style.zIndex = '1000'
            document.body.appendChild(this.canvasesDiv)
        }
    }

    public awaitSprites(): Promise<void> {
        if (this.loading === 0 && !this.rendering) return

        return new Promise(resolve => this.once('render', resolve))
    }

    private add(id: string, src: string): IEntry {
        const image = new Image()
        const finish = (): void => {
            this.loading -= 1
            if (this.waitingQueue.length > 0) {
                this.waitingQueue.pop()()
            } else if (this.loading === 0) {
                if (this.rendering) {
                    this.rerender = true
                } else {
                    this.render()
                }
            }
        }
        image.onload = () => {
            entry.width = entry.image.width
            entry.height = entry.image.height
            finish()
        }
        image.onerror = () => {
            console.error('Could not load image:', id)
            entry.ready = true
            finish()
        }
        const load = (): void => {
            this.loading += 1
            image.src = src
        }
        if (this.maxLoading > 200) {
            this.waitingQueue.push(load)
        } else {
            load()
        }
        const texture = new PIXI.Texture(PIXI.Texture.EMPTY.baseTexture)
        const entry: IEntry = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            id,
            image,
            ready: false,
            texture,
        }
        this.textureToEntry.set(texture, entry)
        this.entries.set(id, entry)
        return entry
    }

    public get(filename: string, x = 0, y = 0, width = 0, height = 0): PIXI.Texture {
        const key = `${filename}-${x}-${y}-${width}-${height}`

        let entry = this.entries.get(key)
        if (!entry) {
            const query: string[] = []
            if (x !== 0) query.push(`x=${x}`)
            if (y !== 0) query.push(`y=${y}`)
            if (width !== 0) query.push(`w=${width}`)
            if (height !== 0) query.push(`h=${height}`)
            let url = `./api/graphics/${encodeURI(filename)}`
            if (query.length !== 0) {
                url += `?${query.join('&')}`
            }
            entry = this.add(key, url)
        }

        return entry.texture
    }

    public getSubtexture(
        mainTexture: PIXI.Texture,
        filename: string,
        x: number,
        y: number,
        width: number,
        height: number
    ): PIXI.Texture {
        const key = `${filename}-${x}-${y}-${width}-${height}`

        let texture = this.subtextures.get(key)
        if (texture) return texture

        const getFrame = (): PIXI.Rectangle =>
            new PIXI.Rectangle(mainTexture.frame.x + x, mainTexture.frame.y + y, width, height)

        texture = new PIXI.Texture(mainTexture.baseTexture, getFrame())
        this.on('render', () => {
            if (texture.baseTexture !== mainTexture.baseTexture) {
                texture.baseTexture = mainTexture.baseTexture
                texture.frame = getFrame()
            }
        })
        this.subtextures.set(key, texture)
        this.textureToEntry.set(texture, this.textureToEntry.get(mainTexture))
        return texture
    }

    public onAllLoaded(textures: PIXI.Texture[]): Promise<void> {
        const notReady = textures
            .map(texture => this.textureToEntry.get(texture))
            .filter(entry => !entry.ready)
        if (notReady.length === 0) {
            return Promise.resolve()
        }

        return new Promise(resolve => {
            let loading = notReady.length
            for (const entry of notReady) {
                this.once(entry.id, () => {
                    loading -= 1
                    if (loading === 0) {
                        resolve()
                    }
                })
            }
        })
    }

    public async render(): Promise<void> {
        this.rendering = true

        this.packer.addArray([...this.entries.values()].filter(e => !e.ready))

        if (this.firstRender) {
            this.firstRender = false
            this.nrOfBinsOnLastRepack = this.packer.bins.length
        }

        const repack = this.packer.bins.length >= this.nrOfBinsOnLastRepack + 2
        if (repack) {
            this.nrOfBinsOnLastRepack = this.packer.bins.length
            this.packer.repack(false)
        }

        const oldBaseTextures: Map<number, PIXI.BaseTexture> = new Map()

        this.packer.bins.forEach((bin, i) => {
            if (!bin.dirty) return

            let baseTexture = this.baseTextures.get(i)
            const reuseCanvas = !repack && !!baseTexture

            let canvas: HTMLCanvasElement
            if (reuseCanvas) {
                canvas = getCanvas(baseTexture)
            } else {
                canvas = document.createElement('canvas')
                canvas.width = bin.width
                canvas.height = bin.height
            }
            const ctx = canvas.getContext('2d', { alpha: this.alpha })

            for (const entry of bin.rects) {
                if (reuseCanvas && entry.ready) continue

                if (this.testBoxes) {
                    ctx.fillStyle = this.randomColor()
                    ctx.fillRect(entry.x, entry.y, entry.width, entry.height)
                }

                ctx.drawImage(entry.image, entry.x, entry.y)

                if (this.extrude) {
                    this.extrudeEntry(entry, ctx)
                }
            }

            if (reuseCanvas) {
                baseTexture.resource.update()
            } else {
                oldBaseTextures.set(i, baseTexture)
                baseTexture = new PIXI.BaseTexture(new PIXI.resources.CanvasResource(canvas))
                this.baseTextures.set(i, baseTexture)
            }
            G.app.renderer.plugins.prepare.add(baseTexture)

            for (const entry of bin.rects) {
                if (reuseCanvas && entry.ready) continue

                entry.texture.baseTexture = baseTexture
                entry.texture.frame = new PIXI.Rectangle(
                    entry.x,
                    entry.y,
                    entry.width,
                    entry.height
                )
                entry.ready = false
            }
        })

        // Wait for base textures to be uploaded to the GPU
        await new Promise(resolve => G.app.renderer.plugins.prepare.upload(resolve))

        for (const bin of this.packer.bins) {
            if (!bin.dirty) continue

            for (const entry of bin.rects) {
                entry.ready = true
                this.emit(entry.id)
            }
        }

        this.emit('render')

        this.packer.bins.forEach((bin, i) => {
            if (!bin.dirty) return

            const oldBaseTexture = oldBaseTextures.get(i)
            const baseTexture = this.baseTextures.get(i)
            const canvas = getCanvas(baseTexture)

            if (this.show) {
                canvas.style.width = 'auto'
                canvas.style.height = 'auto'
                canvas.style.maxHeight = '25vh'
                canvas.style.background = this.randomColor()

                if (oldBaseTexture) {
                    const oldCanvas = getCanvas(oldBaseTexture)
                    this.canvasesDiv.replaceChild(canvas, oldCanvas)
                } else {
                    this.canvasesDiv.appendChild(canvas)
                }
            }

            if (oldBaseTexture) {
                oldBaseTexture.destroy()
            }

            bin.setDirty(false)
        })

        if (repack && this.baseTextures.size > this.packer.bins.length) {
            for (let i = this.baseTextures.size - 1; i >= this.packer.bins.length; i--) {
                this.baseTextures.get(i).destroy()
                this.baseTextures.delete(i)
            }
        }

        if (this.show && this.canvasesDiv) {
            for (const el of this.canvasesDiv.children) {
                const canvas = el as HTMLCanvasElement
                canvas.style.maxWidth = `${100 / this.baseTextures.size}vw`
            }
        }

        if (this.rerender) {
            this.rerender = false
            this.render()
        } else {
            this.rendering = false
        }
    }

    private randomColor(): string {
        const rnd = (): number => Math.floor(Math.random() * 255)
        return `rgba(${rnd()},${rnd()},${rnd()}, 0.2)`
    }

    private extrudeEntry(entry: IEntry, ctx: CanvasRenderingContext2D): void {
        const p = this.padding
        const { x, y, width: w, height: h } = entry

        const left = ctx.getImageData(entry.x, entry.y, 1, entry.height).data
        const right = ctx.getImageData(entry.x + entry.width - 1, entry.y, 1, entry.height).data
        const top = ctx.getImageData(entry.x, entry.y, entry.width, 1).data
        const bottom = ctx.getImageData(entry.x, entry.y + entry.height - 1, entry.width, 1).data

        const getColor = (d: Uint8ClampedArray, i: number): string =>
            `rgba(${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]})`

        // SIDES
        for (let i = 0; i < h; i++) {
            // left
            ctx.fillStyle = getColor(left, i * 4)
            ctx.fillRect(x - p, y + i, p, 1)

            // right
            ctx.fillStyle = getColor(right, i * 4)
            ctx.fillRect(x + w, y + i, p, 1)
        }

        for (let i = 0; i < w; i++) {
            // top
            ctx.fillStyle = getColor(top, i * 4)
            ctx.fillRect(x + i, y - p, 1, p)

            // bottom
            ctx.fillStyle = getColor(bottom, i * 4)
            ctx.fillRect(x + i, y + h, 1, p)
        }

        // CORNERS
        // top left
        ctx.fillStyle = getColor(left, 0)
        ctx.fillRect(x - p, y - p, p, p)

        // top right
        ctx.fillStyle = getColor(right, 0)
        ctx.fillRect(x + w, y - p, p, p)

        // bottom right
        ctx.fillStyle = getColor(bottom, bottom.length - 4)
        ctx.fillRect(x + w, y + h, p, p)

        // bottom left
        ctx.fillStyle = getColor(bottom, 0)
        ctx.fillRect(x - p, y + h, p, p)
    }
}
