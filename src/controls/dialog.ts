import G from '../globals'
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
}
