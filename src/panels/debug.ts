import * as PIXI from 'pixi.js'
import G from '../common/globals'
import { EditorMode } from '../containers/blueprint'

export class DebugContainer extends PIXI.Container {
    public x = 145
    public y = 5

    public constructor() {
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

        G.BPC.gridData.on('update32', (x: number, y: number) => {
            gridposGUIText.text = `X ${x} Y ${y}`
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
