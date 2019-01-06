import G from '../common/globals'
import Dialog from './dialog'

/** Editor */
export default class Editor extends Dialog {

    onBrowserResize() {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height - this.height
        )
    }
}
