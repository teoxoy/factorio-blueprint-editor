import * as PIXI from 'pixi.js'
import G from '../common/globals'
import Dialog from '../controls/dialog'

/** Info Dialog will be displayed to user to show important information about Factorio Blueprint Editor */
export class InfoContainer extends Dialog {
    static toggle() {
        const wasOpen = Dialog.s_openDialogs[0] instanceof InfoContainer
        Dialog.closeAll()
        if (!wasOpen) {
            new InfoContainer().show()
        }
    }

    constructor() {
        super(580, 860)

        const text = new PIXI.Text('KEYBINDS', {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily,
            fontWeight: '500',
            fontSize: 24
        })
        text.position.set(this.width / 2, 4)
        text.anchor.set(0.5, 0)
        this.addChild(text)

        this.writeColumn(
            ['While hovering over an entity', '', '', '', '', '', '', 'Others'],
            { x: this.width / 2, y: 40 },
            0.5,
            true
        )

        this.writeColumn(
            [
                '',
                'left click',
                'right click',
                'arrow keys',
                '(shift +) R',
                'Q',
                '',
                '',
                'ctrl / cmd + Z / Y',
                ['ctrl / cmd + C / V', G.colors.text.accent],
                'shift + S',
                'shift + N',
                'shift + right / left click',
                'alt',
                'esc',
                'E',
                'F',
                'W / A / S / D',
                'click + drag in blueprint area',
                'mouse wheel',
                '[ / ]',
                '(shift +) 1-5',
                'x'
            ],
            { x: this.width / 2 - 4, y: 40 },
            1
        )

        this.writeColumn(
            [
                '',
                'open editor window',
                'remove',
                'move',
                'rotate',
                'pipette tool / clear cursor',
                '',
                '',
                'undo / redo changes',
                ['copy / paste BP string', G.colors.text.accent],
                'generate BP picture',
                'clear BP',
                'copy / paste recipe and modules',
                'toggle overlay',
                'close active window',
                'open inventory or close active window',
                'focuses viewport on blueprint',
                'move',
                'move',
                'zoom in / out',
                'decrease / increase tile area',
                'select quickbar item',
                'change active quickbar row'
            ],
            { x: this.width / 2 + 4, y: 40 }
        )

        this.writeColumn(
            [
                'All keybinds can be changed in the settings pannel and are saved in localStorage.',
                'You can load a blueprint from a BP string, pastebin, hastebin, gist, gitlab,',
                '    factorioprints, google docs or text webpages.',
                'Avalible url query parameters:',
                '        source=<BPSTRING_OR_URL_TO_BPSTRING>',
                '        index=<INDEX_OF_BP_IN_BOOK>',
                '        renderOnly',
                "I don't show network or parsing errors in the app yet, you can open the console",
                '    (F12) to check if something is wrong.'
            ],
            { x: 4, y: 550 }
        )

        this.writeColumn(
            [
                ['Please leave your suggestions, ideas, new features or bug reports', G.colors.text.accent],
                ['inside the app via the Feedback button or on Github.', G.colors.text.accent]
            ],
            { x: this.width / 2, y: 750 },
            0.5
        )

        this.writeColumn(
            [
                'All art assets, spritesheets and other Factorio game data used in this project',
                'belong to Wube Software Ltd and are not for redistribution.'
            ],
            { x: this.width / 2, y: 810 },
            0.5,
            false,
            12
        )
    }

    writeColumn(data: (string | [string, number])[], offset: IPoint, anchorX = 0, bold = false, fontSize = 16) {
        let nextY = 0
        for (const obj of data) {
            const str = obj instanceof Array ? obj[0] : obj
            const text = new PIXI.Text(str, {
                fill: obj instanceof Array ? obj[1] : G.colors.text.normal,
                fontFamily: G.fontFamily,
                fontSize,
                fontWeight: bold ? '500' : 'normal'
            })
            text.position.set(offset.x, nextY * 20 + offset.y)
            nextY += 1
            text.anchor.set(anchorX, 0)
            this.addChild(text)
        }
    }
}
