import actions from './actions'
import G from './common/globals'
import * as dat from 'dat.gui'
import { QuickbarContainer } from './panels/quickbar'
import spritesheetsLoader from './spritesheetsLoader'
import FD from 'factorio-data'

export default function initDatGui() {
    const gui = new dat.GUI({
        autoPlace: false,
        hideable: false,
        closeOnTop: true,
        closed: localStorage.getItem('dat.gui.closed') === 'true',
        width: 320
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

    const entitiesQuality = {
        'Low. Res PNG 8 (1.50 MB)': 0,
        'High Res PNG 8 (4.88 MB)': 1,
        'Low. Res PNG 32 (5.56 MB)': 2,
        'High Res PNG 32 (15.80 MB)': 3
    }
    const setQuality = (quality: number) => {
        G.quality.hr = quality % 2 === 1
        G.quality.compressed = quality < 2
    }

    let quality = (G.quality.hr ? 1 : 0) + (G.quality.compressed ? 0 : 2)
    setQuality(quality)
    if (localStorage.getItem('quality')) quality = JSON.parse(localStorage.getItem('quality'))
    gui
        .add({ quality }, 'quality', entitiesQuality)
        .name('Entities Quality')
        .onChange((quality: number) => {
            localStorage.setItem('quality', quality.toString())
            setQuality(quality)
            spritesheetsLoader.changeQuality(G.quality.hr, G.quality.compressed)
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
        .add(G.oilOutpostSettings, 'PUMPJACK_MODULE', getModulesObjFor('pumpjack'))
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
        .add(G.oilOutpostSettings, 'BEACON_MODULE', getModulesObjFor('beacon'))
        .name('Beacon Modules')
    oilOutpostFolder
        .add(actions.generateOilOutpost, 'call')
        .name('Generate (g)')

    function getModulesObjFor(entityName: string) {
        return Object.keys(FD.items)
            .map(k => FD.items[k])
            .filter(item => item.type === 'module')
            // filter modules based on entity allowed_effects (ex: beacons don't accept productivity effect)
            .filter(item =>
                !FD.entities[entityName].allowed_effects ||
                Object.keys(item.effect).every(effect => FD.entities[entityName].allowed_effects.includes(effect))
            )
            .reduce((obj, item) => {
                obj[item.ui_name] = item.name
                return obj
            }, { None: 'none' })
    }

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
