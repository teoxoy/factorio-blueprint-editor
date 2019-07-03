import * as PIXI from 'pixi.js'
import G from '../common/globals'

export class DebugContainer extends PIXI.Container {
    x = 5
    y = 100

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
    }
}
