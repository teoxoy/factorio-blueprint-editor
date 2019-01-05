import G from '../globals'
import Button from './button'

/**
 * Base Slot
 */
export default class Slot extends Button {

    // Override Background Color of Button
    get background() { return G.colors.slot.background }

    // Override Rollover Color of Button
    get rollover() { return G.colors.slot.rollover }

    // Override Pressed appearance of Button
    get pressed(): boolean { return true }

    /** Field to hold any data for the Slot */
    private m_Data: object = undefined

    constructor(width: number = 36, height: number = 36, border: number = 1) {
        super(width, height, border)
    }

    /** Slot Data */
    public get data(): object { return this.m_Data }
    public set data(value: object) { this.m_Data = value }
}
