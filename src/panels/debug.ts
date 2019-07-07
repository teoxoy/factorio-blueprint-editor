import * as PIXI from 'pixi.js'
import G from '../common/globals'
import { EditorMode } from '../containers/blueprint'

export class DebugContainer extends PIXI.Container {
    x = 145
    y = 5

    constructor() {
        super()

        const fpsGUIText = new PIXI.Text('', {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily
        })
        this.addChild(fpsGUIText)

        G.app.ticker.add(() => {
            fpsGUIText.text = `${String(Math.round(G.app.ticker.FPS))} FPS`
        })

        const gridposGUIText = new PIXI.Text('', {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily
        })
        gridposGUIText.position.set(0, 32)
        this.addChild(gridposGUIText)

        G.BPC.gridData.on('update', (pos: IPoint) => {
            gridposGUIText.text = `X ${pos.x} Y ${pos.y}`
        })

        const modeText = new PIXI.Text('', {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily
        })
        modeText.position.set(0, 64)
        this.addChild(modeText)

        G.BPC.on('mode', (mode: EditorMode) => {
            modeText.text = EditorMode[mode]
        })
    }
}
