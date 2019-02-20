import actions from './actions'
import G from './common/globals'
import * as dat from 'dat.gui'
import { QuickbarContainer } from './panels/quickbar'
import spritesheetsLoader from './spritesheetsLoader'

export default function initDatGui() {
    const gui = new dat.GUI({
        autoPlace: false,
        hideable: false,
        closeOnTop: true,
        closed: localStorage.getItem('dat.gui.closed') === 'true',
        width: 300
    })

    gui.domElement.style.overflowX = 'hidden'
    gui.domElement.style.overflowY = 'auto'
    gui.domElement.style.maxHeight = window.innerHeight + 'px'
    window.addEventListener('resize', () => gui.domElement.style.maxHeight = window.innerHeight + 'px')

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

    if (localStorage.getItem('oilOutpostSettings')) G.oilOutpostSettings = JSON.parse(localStorage.getItem('oilOutpostSettings'))
    window.addEventListener('unload', () => localStorage.setItem('oilOutpostSettings', JSON.stringify(G.oilOutpostSettings)))

    const oilOutpostFolder = gui.addFolder('Oil Outpost Generator Settings')
    oilOutpostFolder
        .add(G.oilOutpostSettings, 'DEBUG')
        .name('Debug')
    oilOutpostFolder
        .add(G.oilOutpostSettings, 'PUMPJACK_MODULE', [
            'none',
            'speed_module_3', 'speed_module_2', 'speed_module',
            'productivity_module_3', 'productivity_module_2', 'productivity_module',
            'effectivity_module_3', 'effectivity_module_2', 'effectivity_module'
        ])
        .name('Pumpjack Modules')
    oilOutpostFolder
        .add(G.oilOutpostSettings, 'MIN_GAP_BETWEEN_UNDERGROUNDS', 1, 9, 1)
        .name('Min Gap > < UPipes')
    oilOutpostFolder
        .add(G.oilOutpostSettings, 'BEACONS')
        .name('Beacons')
    oilOutpostFolder
        .add(G.oilOutpostSettings, 'MIN_AFFECTED_ENTITIES', 1, 12, 1)
        .name('Min Affect. Pumpjacks')
    oilOutpostFolder
        .add(G.oilOutpostSettings, 'BEACON_MODULE', [
            'speed_module_3', 'speed_module_2', 'speed_module',
            'effectivity_module_3', 'effectivity_module_2', 'effectivity_module'
        ])
        .name('Beacon Modules')
    oilOutpostFolder
        .add(actions.generateOilOutpost, 'call')
        .name('Generate (g)')

    // Keybinds folder
    const keybindsFolder = gui.addFolder('Keybinds')

    actions.forEachAction((action, actionName) => {
        const name = actionName.split(/(?=[A-Z1-9])/).join(' ').replace(/(\b\w)/, c => c.toUpperCase())
        if (name.includes('Quickbar')) return
        keybindsFolder
            .add(action, 'keyCombo')
            .name(name)
            .listen()
    })

    const quickbarFolder = keybindsFolder.addFolder('Quickbar')

    actions.forEachAction((action, actionName) => {
        const name = actionName.split(/(?=[A-Z1-9])/).join(' ').replace(/(\b\w)/, c => c.toUpperCase())
        if (!name.includes('Quickbar')) return
        quickbarFolder
            .add(action, 'keyCombo')
            .name(name)
            .listen()
    })

    keybindsFolder
        .add({
            resetDefaults: () => actions.forEachAction(action => action.resetKeyCombo())
        }, 'resetDefaults')
        .name('Reset Defaults')

    return {
        guiBPIndex
    }
}
