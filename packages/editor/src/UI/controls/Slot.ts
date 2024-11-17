import { DisplayObject } from '@pixi/display'
import { colors } from '../style'
import { Button } from './Button'

/**
 * Base Slot
 */
export class Slot<Data, Content extends DisplayObject = DisplayObject> extends Button<
    Data,
    Content
> {
    public name: string

    // Override Rollover Color of Button
    public get hover(): number {
        return colors.controls.slot.hover.color
    }

    // Override Pressed appearance of Button
    public get pressed(): boolean {
        return true
    }

    public constructor(width = 36, height = 36, border = 1) {
        super(width, height, border)
    }
}
