import * as PIXI from 'pixi.js'
import { EntitySprite } from './EntitySprite'

export class OptimizedContainer extends PIXI.ParticleContainer {
    public children: EntitySprite[]

    public constructor() {
        super(undefined, undefined, undefined, true)
    }
}
