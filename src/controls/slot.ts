import G from '../common/globals'
import Button from './button'

/**
 * Base Slot
 */
export default class Slot extends Button {
    // Override Rollover Color of Button
    get hover() {
        return G.colors.controls.slot.hover.color
    }

    // Override Pressed appearance of Button
    get pressed(): boolean {
        return true
    }

    constructor(width: number = 36, height: number = 36, border: number = 1) {
        super(width, height, border)
    }
}
