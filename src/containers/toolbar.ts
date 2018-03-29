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
        background.width = G.app.renderer.width
        window.addEventListener('resize', () => {
            background.width = G.app.renderer.width
            this.fpsGUIText.position.set(G.app.renderer.width, background.height / 2)
            this.logo.position.set(G.app.renderer.width / 2, background.height / 2)
            this.info.position.set(G.app.renderer.width - 100, background.height)
        }, false)
        background.height = 32
        background.tint = 0x303030
        this.addChild(background)

        this.gridposGUIText = new PIXI.Text('')
        this.gridposGUIText.anchor.set(0, 0.5)
        this.gridposGUIText.position.set(0, background.height / 2)
        this.gridposGUIText.style.fill = 0xFFFFFF
        this.addChild(this.gridposGUIText)

        this.fpsGUIText = new PIXI.Text('')
        this.fpsGUIText.anchor.set(1, 0.5)
        this.fpsGUIText.style.fill = 0xFFFFFF
        this.fpsGUIText.position.set(G.app.renderer.width, background.height / 2)
        this.addChild(this.fpsGUIText)

        this.logo = new PIXI.Text('Factorio Blueprint Editor')
        this.logo.anchor.set(0.5, 0.5)
        this.logo.style.fill = 0xFFFFFF
        this.logo.position.set(G.app.renderer.width / 2, background.height / 2)
        this.addChild(this.logo)

        this.info = new PIXI.Text('Press I for info')
        this.info.anchor.set(1, 1)
        this.info.style.fill = 0xFFFFFF
        this.info.style.fontSize = 13
        this.info.position.set(G.app.renderer.width - 100, background.height)
        this.addChild(this.info)

        G.app.ticker.add(() => this.fpsGUIText.text = String(Math.round(G.app.ticker.FPS)) + ' FPS')
    }

    updateGridPos(coords: IPoint) {
        this.gridposGUIText.text = `X ${coords.x} Y ${coords.y}`
    }
}
