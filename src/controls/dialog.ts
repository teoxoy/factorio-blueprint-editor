import G from '../common/globals'
import F from './functions'
import Panel from './panel'

/**
 * Base Dialog for usage whenever a dialog shall be shown to the user
 *
 * Per default the dialog
 *  + is not visible (this.visible = false)
 *  + is interactive (this.interactive = true)
 *  + has interactive children (this.interactiveChildren = true)
 *  + automatically executes 'setDialogPosition()' on Browser Resizing
 */
export default class Dialog extends Panel {

    /** Closes last open dialog */
    static closeLast() {
        if (Dialog.anyOpen()) {
            Dialog.s_openDialogs[Dialog.s_openDialogs.length - 1].close()
        }
    }

    /** Closes all open dialogs */
    static closeAll() {
        Dialog.s_openDialogs.forEach(d => d.close())
    }

    /** @returns True if there is at least one dialog open */
    static anyOpen() {
        return Dialog.s_openDialogs.length > 0
    }

    /** Stores all open dialogs */
    protected static s_openDialogs: Dialog[] = []

    /** Capitalize String */
    protected static capitalize(text: string): string {
        return text.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    }

    constructor(width: number, height: number, title?: string) {
        super(width, height,
            G.colors.dialog.background.color,
            G.colors.dialog.background.alpha,
            G.colors.dialog.background.border)

        this.visible = false
        this.interactive = true
        this.interactiveChildren = true

        if (title !== undefined) {
            this.addLabel(12, 10, title, G.styles.dialog.title)
        }
    }

    /** Automatically sets position of dialog to center screen */
    setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height / 2 - this.height / 2
        )
    }

    /** Show Dialog */
    public show(): void {
        Dialog.s_openDialogs.push(this)
        G.app.stage.addChild(this)
        this.visible = true
    }

    /** Close Dialog */
    public close(): void {
        Dialog.s_openDialogs = Dialog.s_openDialogs
            .filter(d => d !== this)

        this.destroy()
    }

    /**
     * Add Label to Dialog
     * @description Defined in base dialog class so extensions of dialog can use it
     * @param x - Horizontal position of label from top left corner
     * @param y - Vertical position of label from top left corner
     * @param text - Text for label
     * @param style - Style of label
     * @returns Reference to PIXI.Text for further usage
     */
    protected addLabel(x: number = 140, y: number = 56, text: string = 'Recipe:', style: PIXI.TextStyle = G.styles.dialog.label): PIXI.Text {
        const label: PIXI.Text = new PIXI.Text(text, style)
        label.position.set(x, y)
        this.addChild(label)

        // Return label in case extension wants to use it
        return label
    }

    /**
     * Add Visual Line to Dialog
     * @description Defined in base dialog class so extensions of dialog can use it
     * @param x - Horizontal position of line from top left corner
     * @param y - Vertical position of line from top left corner
     * @param width - Width from left to right of line
     * @param style - Height from top to bottom of line
     * @returns Reference to PIXI.Graphics for further usage
     */
    protected addLine(x: number, y: number, width: number, height: number, border: number = G.colors.dialog.line.background.border): PIXI.Graphics {
        const line: PIXI.Graphics = F.DrawRectangle(
            width,
            height,
            G.colors.dialog.line.background.color,
            G.colors.dialog.line.background.alpha,
            border,
            true)
        line.position.set(x, y)
        this.addChild(line)

        // Return line in case extension wants to use it
        return line
    }
}
