import G from '../globals'

export class InfoContainer extends PIXI.Container {

    iWidth = 32 * 18
    iHeight = 32 * 27

    constructor() {
        super()

        this.visible = false
        this.interactive = false
        this.interactiveChildren = true

        this.setPosition()
        window.addEventListener('resize', () => this.setPosition(), false)

        const background = new PIXI.Sprite(PIXI.Texture.WHITE)
        background.width = this.iWidth
        background.height = this.iHeight
        background.tint = 0x3A3A3A
        background.alpha = 0.9
        this.addChild(background)

        const text = new PIXI.Text('KEYBINDS')
        text.position.set(this.iWidth / 2, 4)
        text.style.fontSize = 24
        text.style.fontWeight = 'bold'
        text.style.fill = 0xFFFFFF
        text.anchor.set(0.5, 0)
        this.addChild(text)

        this.writeColumn([
            'While hovering over an entity',
            '',
            '',
            '',
            '',
            '',
            'In editor window',
            '',
            '',
            'Others'
        ], { x: this.iWidth / 2, y: 40 }, 0.5, true)

        this.writeColumn([
            '',
            'left click',
            'middle click',
            'right click',
            'R',
            'Q',
            '',
            'left click recipe/module',
            'right click recipe/module',
            '',
            'ctrl + Z/Y',
            'ctrl + C/V',
            'ctrl + S',
            'shift + N',
            'shift + right/left click',
            'alt',
            'esc',
            'E',
            'F',
            'W/A/S/D',
            'click + drag in blueprint area',
            'mouse wheel'
        ], { x: this.iWidth / 2 - 4, y: 40 }, 1)

        this.writeColumn([
            '',
            'open editor window',
            'move',
            'remove',
            'rotate',
            'pippete tool/clear cursor',
            '',
            'choose',
            'remove',
            '',
            'undo/redo changes',
            'copy/paste bpstring',
            'generate bp picture',
            'clear bp',
            'copy/paste recipe and modules',
            'toggle overlay',
            'close active window',
            'open inventory or close active window',
            'focuses viewport on blueprint',
            'move',
            'move',
            'zoom in/out'
        ], { x: this.iWidth / 2 + 4, y: 40 })

        this.writeColumn([
            'If you want to rebind the keybinds, check out the readme on github',
            'You can load a blueprint from a bp string, pastebin, hastebin, gist, gitlab,',
            '    factorioprints, google docs or text webpages.',
            'You can also add ?source=<BPSTRING_OR_URL_TO_BPSTRING> to the url',
            '    to make sharing easier.',
            'Adding renderOnly as an url query parameter will only render the bp.',
            'I don\'t show network or parsing errors in the app yet, you can open the console',
            '    (F12) to check if something is wrong.',
            'Entities with placeable-off-grid flag will not be added to the positionGrid',
            '    (ex. landmine).'
        ], { x: 4, y: 500 })

        this.writeColumn([
            'Please leave your suggestions, ideas, new features or bug reports here:'
        ], { x: this.iWidth / 2, y: 710 }, 0.5, true)

        const link = new PIXI.Text('Reddit Post')
        link.interactive = true
        link.buttonMode = true
        link.on('click', () => window.open('https://redd.it/87zysk', '_blank'))
        link.position.set(this.iWidth / 2, 730)
        link.style.fontSize = 16
        link.style.fill = 0x079DD8
        link.anchor.set(0.5, 0)
        this.addChild(link)

        const link2 = new PIXI.Text('Github Page')
        link2.interactive = true
        link2.buttonMode = true
        link2.on('click', () => window.open('https://github.com/Teoxoy/factorio-blueprint-editor', '_blank'))
        link2.position.set(this.iWidth / 2, 750)
        link2.style.fontSize = 16
        link2.style.fill = 0x0AA0DB
        link2.anchor.set(0.5, 0)
        this.addChild(link2)

        this.writeColumn([
            'Copyright © 2018 Tanasoaia Teodor Andrei',
            'All art assets, spritesheets and other Factorio game data used in this project',
            'belong to Wube Software Ltd and are not for redistribution.'
        ], { x: this.iWidth / 2, y: 790 }, 0.5, true, 14)
    }

    writeColumn(data: string[], offset: IPoint, anchorX = 0, bold = false, fontSize = 16) {
        let nextY = 0
        for (const str of data) {
            const text = new PIXI.Text(str)
            text.position.set(offset.x, nextY++ * 20 + offset.y)
            text.style.fontSize = fontSize
            if (bold) text.style.fontWeight = 'bold'
            text.style.fill = 0xFFFFFF
            text.anchor.set(anchorX, 0)
            this.addChild(text)
        }
    }

    setPosition() {
        this.position.set(
            G.app.renderer.width / 2 - this.iWidth / 2,
            G.app.renderer.height / 2 - this.iHeight / 2
        )
    }

    toggle() {
        this.visible = !this.visible
    }
}
