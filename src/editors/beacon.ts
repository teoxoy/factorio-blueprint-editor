import Editor from './editor'

/** Beacon Editor */
export default class BeaconEditor extends Editor {

    constructor(entity: any) {
        super(402, 171, entity)
    }

    get spritePosition(): PIXI.Point {
        return new PIXI.Point(57, 67)
    }

    get spriteScale(): PIXI.Point {
        const scale: number = 106 / this.spriteBounds.height
        return new PIXI.Point(scale, scale)
    }
}
