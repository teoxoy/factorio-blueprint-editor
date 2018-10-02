import G from '../globals'

export class ToolbarContainer extends PIXI.Container {

    info: PIXI.Text
    logo: PIXI.Text
    fpsGUIText: PIXI.Text
    gridposGUIText: PIXI.Text

    constructor() {
        super()

        this.interactive = false
        this.interactiveChildren = false

        const background = new PIXI.Sprite(PIXI.Texture.WHITE)
        background.width = G.app.screen.width
        window.addEventListener('resize', () => {
            background.width = G.app.screen.width
            this.fpsGUIText.position.set(G.app.screen.width, background.height / 2)
            this.logo.position.set(G.app.screen.width / 2, background.height / 2)
            this.info.position.set(G.app.screen.width - 100, background.height)
        }, false)
        background.height = 32
        background.tint = G.UIColors.primary
        this.addChild(background)

        this.gridposGUIText = new PIXI.Text('', {
            fill: G.UIColors.text,
            fontFamily: G.fontFamily
        })
        this.gridposGUIText.anchor.set(0, 0.5)
        this.gridposGUIText.position.set(0, background.height / 2)
        this.addChild(this.gridposGUIText)

        this.fpsGUIText = new PIXI.Text('', {
            fill: G.UIColors.text,
            fontFamily: G.fontFamily
        })
        this.fpsGUIText.anchor.set(1, 0.5)
        this.fpsGUIText.position.set(G.app.screen.width, background.height / 2)
        this.addChild(this.fpsGUIText)

        this.logo = new PIXI.Text('Factorio Blueprint Editor', {
            fill: G.UIColors.text,
            fontFamily: G.fontFamily
        })
        this.logo.anchor.set(0.5, 0.5)
        this.logo.position.set(G.app.screen.width / 2, background.height / 2)
        this.addChild(this.logo)

        this.info = new PIXI.Text('Press I for info', {
            fill: G.UIColors.text,
            fontFamily: G.fontFamily,
            fontSize: 13
        })
        this.info.anchor.set(1, 1)
        this.info.position.set(G.app.screen.width - 100, background.height)
        this.addChild(this.info)

        G.app.ticker.add(() => this.fpsGUIText.text = String(Math.round(G.app.ticker.FPS)) + ' FPS')

        G.gridData.onUpdate(() => this.gridposGUIText.text = `X ${G.gridData.x} Y ${G.gridData.y}`)
    }
}
