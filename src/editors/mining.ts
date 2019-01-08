import Editor from './editor'

/** Electric Mining Drill Editor */
export default class MiningEditor extends Editor {

    constructor(entity: any) {
        super(402, 171, entity)
    }

    get spriteScale(): PIXI.Point {
        const scale: number = 106 / Math.max(this.spriteBounds.height, this.spriteBounds.width)
        return new PIXI.Point(scale, scale)
    }
}
