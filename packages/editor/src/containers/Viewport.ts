import * as PIXI from 'pixi.js'

export class Viewport {
    private size: IPoint
    private viewPortSize: IPoint
    private anchor: IPoint
    private maxZoom: number
    private dirty = true
    private positionX = 0
    private positionY = 0
    private scaleX = 1
    private scaleY = 1
    private scaleCenterX = 0
    private scaleCenterY = 0
    private origTransform = new PIXI.Matrix()
    private transform = new PIXI.Matrix()

    public constructor(size: IPoint, viewPortSize: IPoint, anchor: IPoint, maxZoom: number) {
        this.size = size
        this.viewPortSize = viewPortSize
        this.anchor = anchor
        this.maxZoom = maxZoom
    }

    private _updateMatrix(): void {
        // Accumulate zoom transformations.
        // origTransform is an intermediate accumulative matrix used for tracking the current zoom target.
        this.origTransform.append(new PIXI.Matrix(1, 0, 0, 1, this.scaleCenterX, this.scaleCenterY))
        this.origTransform.append(new PIXI.Matrix(this.scaleX, 0, 0, this.scaleY, 0, 0))
        this.origTransform.append(
            new PIXI.Matrix(1, 0, 0, 1, -this.scaleCenterX, -this.scaleCenterY)
        )

        // We reset Scale because origTransform is accumulative and has "captured" the information.
        this.scaleX = 1
        this.scaleY = 1

        // Tack on translation. Note: we don't append it, but concat it into a separate matrix.
        // We want to leave origTransform solely responsible for zooming.
        // "transform" is the final matrix.
        this.transform = this.origTransform.clone()

        // UpperLeft Corner constraints
        const minX = this.size.x * this.transform.a * this.anchor.x - this.transform.tx
        const minY = this.size.y * this.transform.a * this.anchor.y - this.transform.ty
        // LowerRight Corner constraints
        const maxX =
            -(this.size.x * (1 - this.anchor.x) * this.transform.a - this.viewPortSize.x) -
            this.transform.tx
        const maxY =
            -(this.size.y * (1 - this.anchor.y) * this.transform.a - this.viewPortSize.y) -
            this.transform.ty

        // Check if viewport area is bigger than the container
        if (maxX - minX > 0 || maxY - minY > 0) {
            this.origTransform = new PIXI.Matrix()

            this.scaleCenterX = this.size.x / 2
            this.scaleCenterY = this.size.y / 2

            const maxZoom =
                Math.max(
                    this.viewPortSize.x / (this.size.x * this.transform.a),
                    this.viewPortSize.y / (this.size.y * this.transform.a)
                ) * this.transform.a
            this.scaleX = maxZoom
            this.scaleY = maxZoom

            this._updateMatrix()

            return
        }

        if (this.positionX > minX) {
            this.positionX = minX
        }
        if (this.positionY > minY) {
            this.positionY = minY
        }
        if (this.positionX < maxX) {
            this.positionX = maxX
        }
        if (this.positionY < maxY) {
            this.positionY = maxY
        }

        this.transform.translate(this.positionX, this.positionY)
    }

    public centerViewPort(focusObjectSize: IPoint, offset: IPoint): void {
        this.origTransform = new PIXI.Matrix()

        this.positionX = -this.size.x / 2 + this.viewPortSize.x / 2 + offset.x
        this.positionY = -this.size.y / 2 + this.viewPortSize.y / 2 + offset.y

        this.scaleCenterX = this.size.x / 2 + -offset.x
        this.scaleCenterY = this.size.y / 2 + -offset.y

        const zoom = Math.min(
            this.viewPortSize.x / focusObjectSize.x,
            this.viewPortSize.y / focusObjectSize.y,
            this.maxZoom
        )
        this.scaleX = zoom
        this.scaleY = zoom

        this.dirty = true
    }

    public getTransform(): PIXI.Matrix {
        if (this.dirty) {
            this._updateMatrix()
            this.dirty = false
        }
        return this.transform
    }

    public setSize(x: number, y: number): void {
        this.viewPortSize.x = x
        this.viewPortSize.y = y
        this.dirty = true
    }

    public setPosition(posX: number, posY: number): void {
        this.positionX = posX
        this.positionY = posY
        this.dirty = true
    }

    public zoomBy(deltaX: number, deltaY?: number): void {
        if (Math.sign(deltaX) === 1 && this.origTransform.a > this.maxZoom) return
        this.scaleX += deltaX
        this.scaleY += deltaY === undefined ? deltaX : deltaY
        this.dirty = true
    }

    public translateBy(deltaX: number, deltaY: number): void {
        this.positionX += deltaX
        this.positionY += deltaY
        this.dirty = true
    }

    public setCurrentScale(newScale: number): void {
        if (this.dirty) {
            this._updateMatrix()
        }

        // We use dimensional analysis to set the scale. Remember we can't
        // just set the scale absolutely because origTransform is an accumulating matrix.
        // We have to take its current value and compute a new value based
        // on the passed in value.

        const scaleFactor = newScale / this.origTransform.a

        this.scaleX = scaleFactor
        this.scaleY = scaleFactor

        this.dirty = true
    }

    public getCurrentScale(): number {
        return this.origTransform.a
    }

    public setScaleCenter(posX: number, posY: number): void {
        this.scaleCenterX = posX
        this.scaleCenterY = posY
        this.dirty = true
    }
}
