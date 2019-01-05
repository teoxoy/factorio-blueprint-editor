import G from '../globals'
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

    /** Field to hold any data for the Slot */
    private m_Data: any = undefined

    constructor(width: number = 36, height: number = 36, border: number = 1) {
        super(width, height, border)
    }

    /** Slot Data */
    public get data(): any { return this.m_Data }
    public set data(value: any) { this.m_Data = value }
}
