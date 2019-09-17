import FD from 'factorio-data'
import EDITOR, { Blueprint, Book, GridPattern } from '@fbe/editor'
import { GUI, GUIController } from 'dat.gui'

GUI.TEXT_CLOSED = 'Close Settings'
GUI.TEXT_OPEN = 'Open Settings'

const COLOR_DARK = 0x303030
const COLOR_LIGHT = 0xc9c9c9
const isDarkColor = (color: number): boolean => color === COLOR_DARK

export default function initSettingsPane(shared: {
    bp: Blueprint
    book: Book
}): {
    guiBPIndex: GUIController
} {
    const gui = new GUI({
        autoPlace: false,
        hideable: false,
        closeOnTop: true,
        closed: localStorage.getItem('dat.gui.closed') === 'true',
        width: 320
    })

    gui.domElement.style.overflowX = 'hidden'
    gui.domElement.style.overflowY = 'auto'
    gui.domElement.style.maxHeight = `${window.innerHeight}px`
    window.addEventListener('resize', () => {
        gui.domElement.style.maxHeight = `${window.innerHeight}px`
    })

    window.addEventListener('unload', () => localStorage.setItem('dat.gui.closed', String(gui.closed)))

    document.body.appendChild(gui.domElement)

    const guiBPIndex = gui
        .add({ bpIndex: 0 }, 'bpIndex', 0, 0, 1)
        .name('BP Index')
        .onFinishChange((value: number) => {
            if (shared.book) {
                shared.bp = shared.book.getBlueprint(value)
                EDITOR.loadBlueprint(shared.bp)
            }
        })

    if (localStorage.getItem('moveSpeed')) {
        const moveSpeed = Number(localStorage.getItem('moveSpeed'))
        EDITOR.setMoveSpeed(moveSpeed)
    }
    gui.add({ moveSpeed: EDITOR.getMoveSpeed() }, 'moveSpeed', 5, 20)
        .name('Move Speed')
        .onChange((speed: number) => {
            localStorage.setItem('moveSpeed', speed.toString())
            EDITOR.setMoveSpeed(speed)
        })

    if (localStorage.getItem('debug')) {
        const debug = Boolean(localStorage.getItem('debug'))
        EDITOR.setDebugging(debug)
    }
    gui.add(
        {
            debug: EDITOR.isDebuggingOn()
        },
        'debug'
    )
        .name('Debug')
        .onChange((debug: boolean) => {
            if (debug) {
                localStorage.setItem('debug', 'true')
            } else {
                localStorage.removeItem('debug')
            }
            EDITOR.setDebugging(debug)
        })

    // Grid theme folder
    const themeFolder = gui.addFolder('Grid Theme')

    if (localStorage.getItem('darkTheme')) {
        const darkTheme = localStorage.getItem('darkTheme') === 'true'
        EDITOR.setGridColor(darkTheme ? COLOR_DARK : COLOR_LIGHT)
    }
    themeFolder
        .add({ darkTheme: isDarkColor(EDITOR.getGridColor()) }, 'darkTheme')
        .name('Dark Mode')
        .onChange((darkTheme: boolean) => {
            localStorage.setItem('darkTheme', darkTheme.toString())
            EDITOR.setGridColor(darkTheme ? COLOR_DARK : COLOR_LIGHT)
        })

    if (localStorage.getItem('pattern')) {
        const pattern = localStorage.getItem('pattern') as GridPattern
        EDITOR.setGridPattern(pattern)
    }
    themeFolder
        .add({ pattern: EDITOR.getGridPattern() }, 'pattern', ['checker', 'grid'])
        .name('Pattern')
        .onChange((pattern: GridPattern) => {
            localStorage.setItem('pattern', pattern)
            EDITOR.setGridPattern(pattern)
        })

    if (localStorage.getItem('oilOutpostSettings')) {
        const settings = JSON.parse(localStorage.getItem('oilOutpostSettings'))
        EDITOR.setOilOutpostSettings(settings)
    }
    window.addEventListener('unload', () =>
        localStorage.setItem('oilOutpostSettings', JSON.stringify(EDITOR.getOilOutpostSettings()))
    )

    const oilOutpostSettings = new Proxy(EDITOR.getOilOutpostSettings(), {
        set: (settings, key, value) => {
            settings[key as string] = value
            EDITOR.setOilOutpostSettings(settings)
            return true
        }
    })

    const oilOutpostFolder = gui.addFolder('Oil Outpost Generator Settings')
    oilOutpostFolder.add(oilOutpostSettings, 'DEBUG').name('Debug')
    oilOutpostFolder.add(oilOutpostSettings, 'PUMPJACK_MODULE', getModulesObjFor('pumpjack')).name('Pumpjack Modules')
    oilOutpostFolder.add(oilOutpostSettings, 'MIN_GAP_BETWEEN_UNDERGROUNDS', 1, 9, 1).name('Min Gap > < UPipes')
    oilOutpostFolder.add(oilOutpostSettings, 'BEACONS').name('Beacons')
    oilOutpostFolder.add(oilOutpostSettings, 'MIN_AFFECTED_ENTITIES', 1, 12, 1).name('Min Affect. Pumpjacks')
    oilOutpostFolder.add(oilOutpostSettings, 'BEACON_MODULE', getModulesObjFor('beacon')).name('Beacon Modules')
    oilOutpostFolder
        .add(
            {
                generate: () => EDITOR.callAction('generateOilOutpost')
            },
            'generate'
        )
        .name('Generate')
    function getModulesObjFor(entityName: string): Record<string, string> {
        return (
            Object.keys(FD.items)
                .map(k => FD.items[k])
                .filter(item => item.type === 'module')
                // filter modules based on entity allowed_effects (ex: beacons don't accept productivity effect)
                .filter(
                    item =>
                        !FD.entities[entityName].allowed_effects ||
                        Object.keys(item.effect).every(effect =>
                            FD.entities[entityName].allowed_effects.includes(effect)
                        )
                )
                .reduce(
                    (obj, item) => {
                        obj[item.ui_name] = item.name
                        return obj
                    },
                    { None: 'none' } as Record<string, string>
                )
        )
    }

    // Keybinds folder
    const keybindsFolder = gui.addFolder('Keybinds')

    EDITOR.forEachAction(action => {
        const name = action.prettyName
        if (name.includes('Quickbar')) {
            return
        }
        keybindsFolder
            .add(action, 'keyCombo')
            .name(name)
            .listen()
    })

    const quickbarFolder = keybindsFolder.addFolder('Quickbar')

    EDITOR.forEachAction(action => {
        const name = action.prettyName
        if (!name.includes('Quickbar')) {
            return
        }
        quickbarFolder
            .add(action, 'keyCombo')
            .name(name)
            .listen()
    })

    keybindsFolder
        .add(
            {
                resetDefaults: () => EDITOR.resetKeybinds()
            },
            'resetDefaults'
        )
        .name('Reset Defaults')

    return {
        guiBPIndex
    }
}
