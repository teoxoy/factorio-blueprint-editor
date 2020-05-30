import * as PIXI from 'pixi.js'
import { EntitySprite } from './EntitySprite'

export class OptimizedContainer extends PIXI.Container {
    public children: EntitySprite[]
}
