import * as PIXI from 'pixi.js'
import G from '../common/globals'
import { EditorMode } from '../containers/BlueprintContainer'
import { styles } from './style'

export class DebugContainer extends PIXI.Container {
    public x = 145
    public y = 5

    public constructor() {
        super()

        const fpsGUIText = new PIXI.Text('', styles.debug.text)
        this.addChild(fpsGUIText)

        G.app.ticker.add(() => {
            fpsGUIText.text = `${Math.round(G.app.ticker.FPS)} FPS`
        })

        const gridposGUIText = new PIXI.Text('', styles.debug.text)
        gridposGUIText.position.set(0, 32)
        this.addChild(gridposGUIText)

        G.BPC.gridData.on('update32', (x: number, y: number) => {
            gridposGUIText.text = `X ${x} Y ${y}`
        })

        const modeText = new PIXI.Text('', styles.debug.text)
        modeText.position.set(0, 64)
        this.addChild(modeText)

        G.BPC.on('mode', (mode: EditorMode) => {
            modeText.text = EditorMode[mode]
        })
    }
}
