import G from '../common/globals'
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

    /** Capitalize String */
    protected static capitalize(text: string): string {
        return text.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    }

    /** Private field to hold dialog index */
    private m_OpenDialogIndex: number

    constructor(width: number, height: number) {
        super(width, height, G.colors.dialog.background, 0.7, 2)

        this.visible = false
        this.interactive = true
        this.interactiveChildren = true
    }

    /**
     * Automatically sets position of  dialog to center screen
     */
    setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height / 2 - this.height / 2
        )
    }

    /** Show Dialog */
    public show(): void {
        this.m_OpenDialogIndex = G.openDialogs.push(this)
        G.app.stage.addChild(this)
        this.visible = true
    }

    /** Close Dialog */
    public close(): void {
        this.visible = false
        G.app.stage.removeChild(this)
        G.openDialogs.splice(this.m_OpenDialogIndex - 1, 1)
        this.destroy()
    }
}
