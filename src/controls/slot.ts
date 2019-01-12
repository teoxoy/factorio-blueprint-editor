import G from '../common/globals'
import Button from './button'

/**
 * Base Slot
 */
export default class Slot extends Button {

    // Override Background Color of Button
    get background() { return G.colors.slot.background }

    // Override Rollover Color of Button
    get hover() { return G.colors.slot.hover }

    // Override Pressed appearance of Button
    get pressed(): boolean { return true }

    constructor(width: number = 36, height: number = 36, border: number = 1) {
        super(width, height, border)
    }
}
