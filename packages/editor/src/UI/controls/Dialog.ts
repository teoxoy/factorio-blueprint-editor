import { Graphics, Text } from 'pixi.js'
import G from '../../common/globals'
import { colors, styles } from '../style'
import F from './functions'
import { Panel } from './Panel'

/**
 * Base Dialog for usage whenever a dialog shall be shown to the user
 *
 * Per default the dialog
 *  + is not visible (this.visible = false)
 *  + is interactive (this.eventMode = 'static')
 *  + has interactive children (this.interactiveChildren = true)
 *  + automatically executes 'setDialogPosition()' on Browser Resizing
 */
export abstract class Dialog extends Panel {
    /** Stores all open dialogs */
    protected static s_openDialogs: Dialog[] = []

    public constructor(width: number, height: number, title?: string) {
        super(
            width,
            height,
            colors.dialog.background.color,
            colors.dialog.background.alpha,
            colors.dialog.background.border
        )

        this.visible = true
        this.eventMode = 'static'
        this.interactiveChildren = true

        if (title !== undefined) {
            this.addLabel(12, 10, title, styles.dialog.title)
        }

        Dialog.s_openDialogs.push(this)
    }

    /** Closes last open dialog */
    public static closeLast(): void {
        if (Dialog.anyOpen()) {
            Dialog.s_openDialogs[Dialog.s_openDialogs.length - 1].close()
        }
    }

    /** Closes all open dialogs */
    public static closeAll(): void {
        for (const d of Dialog.s_openDialogs) {
            d.close()
        }
    }

    /** @returns True if there is at least one dialog open */
    public static anyOpen(): boolean {
        return Dialog.s_openDialogs.length > 0
    }

    public static isOpen<T extends Dialog>(dialog: T): boolean {
        return !!Dialog.s_openDialogs.find(d => d === dialog)
    }

    /** Capitalize String */
    protected static capitalize(text: string): string {
        return text
            .split('_')
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ')
    }

    /** Automatically sets position of dialog to center screen */
    protected override setPosition(): void {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height / 2 - this.height / 2
        )
    }

    /** Close Dialog */
    public close(): void {
        Dialog.s_openDialogs = Dialog.s_openDialogs.filter(d => d !== this)

        this.emit('close')
        this.destroy()
    }

    /**
     * Add Label to Dialog
     * @description Defined in base dialog class so extensions of dialog can use it
     * @param x - Horizontal position of label from top left corner
     * @param y - Vertical position of label from top left corner
     * @param text - Text for label
     * @param style - Style of label
     * @returns Reference to Text for further usage
     */
    protected addLabel(x = 140, y = 56, text = 'Recipe:', style = styles.dialog.label): Text {
        const label = new Text({ text, style })
        label.position.set(x, y)
        this.addChild(label)

        // Return label in case extension wants to use it
        return label
    }
}
