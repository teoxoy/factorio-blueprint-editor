import * as PIXI from 'pixi.js'

export class ZoomPan {

    private container: PIXI.Container
    private size: any
    private viewPortPosition: any
    private viewPortSize: any
    private maxZoom: number
    private dirty: boolean
    private positionX: number
    private positionY: number
    private scaleX: number
    private scaleY: number
    private scaleCenterX: number
    private scaleCenterY: number
    private origTransform: PIXI.Matrix
    private transform: PIXI.Matrix

    constructor(container: PIXI.Container, size: any, viewPortPosition: any, viewPortSize: any, maxZoom: number) {
        this.container = container

        this.size = size
        this.viewPortPosition = viewPortPosition
        this.viewPortSize = viewPortSize
        this.maxZoom = maxZoom

        this.dirty = true

        this.positionX = 0
        this.positionY = 0

        this.scaleX = 1
        this.scaleY = 1

        this.scaleCenterX = 0
        this.scaleCenterY = 0

        this.origTransform = new PIXI.Matrix()

        this.transform = new PIXI.Matrix()
    }

    updateTransform() {
        const t = this.getTransform()
        this.container.setTransform(t.tx, t.ty, t.a, t.d)
    }

    _updateMatrix() {
        // Accumulate zoom transformations.
        // origTransform is an intermediate accumulative matrix used for tracking the current zoom target.
        this.origTransform.append(new PIXI.Matrix(1, 0, 0, 1, this.scaleCenterX, this.scaleCenterY))
        this.origTransform.append(new PIXI.Matrix(this.scaleX, 0, 0, this.scaleY, 0, 0))
        this.origTransform.append(new PIXI.Matrix(1, 0, 0, 1, -this.scaleCenterX, -this.scaleCenterY))

        // We reset Scale because origTransform is accumulative and has "captured" the information.
        this.scaleX = 1
        this.scaleY = 1

        // Tack on translation. Note: we don't append it, but concat it into a separate matrix.
        // We want to leave origTransform solely responsible for zooming.
        // "transform" is the final matrix.
        this.transform = this.origTransform.clone()

        // UpperLeft Corner constraints
        const minX = this.viewPortPosition.x - this.transform.tx
        const minY = this.viewPortPosition.y - this.transform.ty
        // LowerRight Corner constraints
        const maxX = -(this.size.width * this.transform.a - this.viewPortSize.width) - this.transform.tx
        const maxY = -(this.size.height * this.transform.a - this.viewPortSize.height) - this.transform.ty

        // Check if viewport area is bigger than the container
        if (maxX - minX > 0 || maxY - minY > 0) {
            this.origTransform = new PIXI.Matrix()

            this.scaleCenterX = this.size.width / 2
            this.scaleCenterY = this.size.height / 2

            const maxZoom = Math.max(
                this.viewPortSize.width / (this.size.width * this.transform.a),
                this.viewPortSize.height / (this.size.height * this.transform.a)
            ) * this.transform.a
            this.scaleX = maxZoom
            this.scaleY = maxZoom

            this._updateMatrix()

            return
        }

        if (this.positionX > minX) this.positionX = minX
        if (this.positionY > minY) this.positionY = minY
        if (this.positionX < maxX) this.positionX = maxX
        if (this.positionY < maxY) this.positionY = maxY

        this.transform.translate(this.positionX, this.positionY)
    }

    centerViewPort(focusObjectSize: IPoint, offset: IPoint) {
        this.origTransform = new PIXI.Matrix()

        this.positionX = this.viewPortPosition.x - (this.size.width / 2) +
            (this.viewPortSize.width - this.viewPortPosition.x) / 2 + offset.x
        this.positionY = this.viewPortPosition.y - (this.size.height / 2) +
            (this.viewPortSize.height - this.viewPortPosition.y) / 2 + offset.y

        this.scaleCenterX = this.size.width / 2 + -offset.x
        this.scaleCenterY = this.size.height / 2 + -offset.y

        const zoom = Math.min(
            (this.viewPortSize.width - this.viewPortPosition.x) / focusObjectSize.x,
            (this.viewPortSize.height - this.viewPortPosition.y) / focusObjectSize.y,
            this.maxZoom
        )
        this.scaleX = zoom
        this.scaleY = zoom

        this.dirty = true
        this.updateTransform()
    }

    getTransform() {
        if (this.dirty) {
            this._updateMatrix()
            this.dirty = false
        }
        return this.transform
    }

    setViewPortSize(width: number, height: number) {
        this.viewPortSize.width = width
        this.viewPortSize.height = height
        this.dirty = true
    }

    setPosition(posX: number, posY: number) {
        this.positionX = posX
        this.positionY = posY
        this.dirty = true
    }

    getPositionX() {
        return this.positionX
    }

    getPositionY() {
        return this.positionY
    }

    zoomBy(deltaX: number, deltaY: number) {
        if (Math.sign(deltaX) === 1 && this.origTransform.a > this.maxZoom) return
        this.scaleX += deltaX
        this.scaleY += deltaY
        this.dirty = true
    }

    translateBy(deltaX: number, deltaY: number) {
        this.positionX += deltaX
        this.positionY += deltaY
        this.dirty = true
    }

    setCurrentScale(newScale: number) {
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

    getCurrentScale() {
        return this.origTransform.a
    }

    setScaleCenter(posX: number, posY: number) {
        this.scaleCenterX = posX
        this.scaleCenterY = posY
        this.dirty = true
    }
}
