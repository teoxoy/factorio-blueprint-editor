import keyboard from './keyboard'
import G from './common/globals'
import * as dat from 'dat.gui'
import { QuickbarContainer } from './panels/quickbar'
import spritesheetsLoader from './spritesheetsLoader'

export default function initDatGui() {
    const gui = new dat.GUI({
        autoPlace: false,
        hideable: false,
        closeOnTop: true
    })

    gui.closed = localStorage.getItem('dat.gui.closed') === 'true'
    window.addEventListener('unload', () => localStorage.setItem('dat.gui.closed', String(gui.closed)))

    document.body.appendChild(gui.domElement)

    const guiBPIndex = gui
        .add({ bpIndex: 0 }, 'bpIndex', 0, 0, 1)
        .name('BP Index')
        .onFinishChange((value: number) => {
            if (G.book) {
                G.bp = G.book.getBlueprint(value)
                G.BPC.clearData()
                G.BPC.initBP()
            }
        })

    if (localStorage.getItem('hr')) G.hr = localStorage.getItem('hr') === 'true'
    gui
        .add(G, 'hr')
        .name('HR Entities')
        .onChange((val: boolean) => {
            localStorage.setItem('hr', val.toString())
            spritesheetsLoader.changeQuality(G.hr)
        })

    if (localStorage.getItem('moveSpeed')) G.moveSpeed = Number(localStorage.getItem('moveSpeed'))
    gui
        .add(G, 'moveSpeed', 5, 20)
        .name('Move Speed')
        .onChange((val: boolean) => localStorage.setItem('moveSpeed', val.toString()))

    if (localStorage.getItem('quickbarRows')) G.quickbarRows = Number(localStorage.getItem('quickbarRows'))
    gui
        .add(G, 'quickbarRows', 1, 5, 1)
        .name('Quickbar Rows')
        .onChange((val: number) => {
            localStorage.setItem('quickbarRows', val.toString())

            const index = G.app.stage.getChildIndex(G.quickbarContainer)
            const itemNames = G.quickbarContainer.getAllItemNames()
            G.quickbarContainer.destroy()
            G.quickbarContainer = new QuickbarContainer(val, itemNames)
            G.app.stage.addChildAt(G.quickbarContainer, index)
        })

    window.addEventListener('unload', () => {
        localStorage.setItem('quickbarItemNames', JSON.stringify(G.quickbarContainer.getAllItemNames()))
    })

    // Theme folder
    const themeFolder = gui.addFolder('Theme')

    if (localStorage.getItem('darkTheme')) G.colors.darkTheme = localStorage.getItem('darkTheme') === 'true'
    themeFolder
        .add(G.colors, 'darkTheme')
        .name('Dark Mode')
        .onChange((val: boolean) => localStorage.setItem('darkTheme', val.toString()))

    if (localStorage.getItem('pattern')) G.colors.pattern = localStorage.getItem('pattern')
    themeFolder
        .add(G.colors, 'pattern', ['checker', 'grid'])
        .name('Pattern')
        .onChange((val: 'checker' | 'grid') => {
            G.BPC.generateGrid(val)
            localStorage.setItem('pattern', val)
        })

    // Keybinds folder
    const keybindsFolder = gui.addFolder('Keybinds')

    const keybinds = JSON.parse(localStorage.getItem('keybinds')) || {
        rotate: 'r',
        pippete: 'q',
        undo: 'modifier+z',
        redo: 'modifier+y',
        picture: 'shift+s',
        clear: 'shift+n',
        overlay: 'alt',
        closeWindow: 'esc',
        inventory: 'e',
        focus: 'f',
        w: 'w',
        a: 'a',
        s: 's',
        d: 'd',
        increaseTileArea: ']',
        decreaseTileArea: '[',
        quickbarSlot01: '1',
        quickbarSlot02: '2',
        quickbarSlot03: '3',
        quickbarSlot04: '4',
        quickbarSlot05: '5',
        quickbarSlot06: 'shift+1',
        quickbarSlot07: 'shift+2',
        quickbarSlot08: 'shift+3',
        quickbarSlot09: 'shift+4',
        quickbarSlot10: 'shift+5',
        changeActiveQuickbar: 'x'
    }

    const keybindsProxy = new Proxy(keybinds, {
        set(obj: any, prop: string, value: string) {
            if (!value) return true
            keyboard.changeKeyCombo(obj[prop], value)
            obj[prop] = value
            localStorage.setItem('keybinds', JSON.stringify(keybinds))
            return true
        }
    })
    Object.keys(keybinds).forEach(k => keybindsFolder.add(keybindsProxy, k))

    // Disables the keyboard shortcuts on mouseover
    gui.domElement.addEventListener('mouseover', () => keyboard.pause())
    gui.domElement.addEventListener('mouseout', () => keyboard.resume())

    return {
        guiBPIndex,
        keybinds
    }
}
