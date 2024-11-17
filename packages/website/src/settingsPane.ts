import { GUI } from 'dat.gui'
import { NumberInputParams, Pane } from 'tweakpane'
import * as TweakpaneTablePlugin from 'tweakpane-table'
import EDITOR, { Blueprint, Book, GridPattern, Editor, FD } from '@fbe/editor'

// GUI.TEXT_CLOSED = 'Close Settings'
// GUI.TEXT_OPEN = 'Open Settings'

const COLOR_DARK = 0x303030
const COLOR_LIGHT = 0xc9c9c9
const isDarkColor = (color: number): boolean => color === COLOR_DARK

export function initSettingsPane(
    editor: Editor,
    changeBookIndex: (index: number) => void
): {
    changeBook: (bpOrBook: Book | Blueprint) => void
} {
    const style = document.createElement('style')
    style.innerHTML = `
        :root {
            --tp-base-background-color: hsla(0, 0%, 10%, 0.80);
            --tp-base-shadow-color: hsla(0, 0%, 0%, 0.20);
            --tp-button-background-color: hsla(0, 0%, 80%, 1.00);
            --tp-button-background-color-active: hsla(0, 0%, 100%, 1.00);
            --tp-button-background-color-focus: hsla(0, 0%, 95%, 1.00);
            --tp-button-background-color-hover: hsla(0, 0%, 85%, 1.00);
            --tp-button-foreground-color: hsla(0, 0%, 0%, 0.80);
            --tp-container-background-color: hsla(0, 0%, 0%, 0.30);
            --tp-container-background-color-active: hsla(0, 0%, 0%, 0.60);
            --tp-container-background-color-focus: hsla(0, 0%, 0%, 0.50);
            --tp-container-background-color-hover: hsla(0, 0%, 0%, 0.40);
            --tp-container-foreground-color: hsla(0, 0%, 100%, 0.50);
            --tp-groove-foreground-color: hsla(0, 0%, 0%, 0.20);
            --tp-input-background-color: hsla(0, 0%, 0%, 0.30);
            --tp-input-background-color-active: hsla(0, 0%, 0%, 0.60);
            --tp-input-background-color-focus: hsla(0, 0%, 0%, 0.50);
            --tp-input-background-color-hover: hsla(0, 0%, 0%, 0.40);
            --tp-input-foreground-color: hsla(0, 0%, 100%, 0.50);
            --tp-label-foreground-color: hsla(0, 0%, 100%, 0.50);
            --tp-monitor-background-color: hsla(0, 0%, 0%, 0.30);
            --tp-monitor-foreground-color: hsla(0, 0%, 100%, 0.30);
        }
        .paneContainer {
            width: 350px;
            margin: 0 auto;
        }
        .paneContainer .tp-lblv_v {
            min-width: fit-content;
        }
    `
    document.head.appendChild(style)

    const container = document.createElement('div')
    container.classList.add('paneContainer')
    document.body.appendChild(container)

    const pane = new Pane({
        expanded: localStorage.getItem('dat.gui.closed') !== 'true',
        title: 'Settings',
        container,
    })
    pane.registerPlugin(TweakpaneTablePlugin)

    const PARAMS = {
        bpIndex: 0,
    }

    const bpIndex = pane.addInput(PARAMS, 'bpIndex', {
        label: 'BP Book Index',
        min: 0,
        max: 0,
        step: 1,
    } as NumberInputParams)

    const gui = new GUI({
        autoPlace: false,
        hideable: false,
        closeOnTop: true,
        closed: localStorage.getItem('dat.gui.closed') === 'true',
        width: 320,
    })

    gui.domElement.style.overflowX = 'hidden'
    gui.domElement.style.overflowY = 'auto'
    gui.domElement.style.maxHeight = `${window.innerHeight}px`
    window.addEventListener('resize', () => {
        gui.domElement.style.maxHeight = `${window.innerHeight}px`
    })

    window.addEventListener('visibilitychange', () =>
        localStorage.setItem('dat.gui.closed', String(!pane.expanded))
    )

    document.body.appendChild(gui.domElement)

    const guiBPIndex = gui
        .add({ bpIndex: 0 }, 'bpIndex', 0, 0, 1)
        .name('BP Book Index')
        .onFinishChange(changeBookIndex)

    const changeBook = (bpOrBook: Book | Blueprint): void => {
        if (bpOrBook instanceof Book) {
            guiBPIndex.max(bpOrBook.lastBookIndex).setValue(bpOrBook.activeIndex)
            guiBPIndex.domElement.style.visibility = 'visible'
        } else {
            guiBPIndex.domElement.style.visibility = 'hidden'
        }
    }

    if (localStorage.getItem('moveSpeed')) {
        const moveSpeed = Number(localStorage.getItem('moveSpeed'))
        editor.moveSpeed = moveSpeed
    }
    gui.add({ moveSpeed: editor.moveSpeed }, 'moveSpeed', 5, 20)
        .name('Move Speed')
        .onChange((moveSpeed: number) => {
            localStorage.setItem('moveSpeed', moveSpeed.toString())
            editor.moveSpeed = moveSpeed
        })

    if (localStorage.getItem('pattern')) {
        const pattern = localStorage.getItem('pattern') as GridPattern
        editor.gridPattern = pattern
    }
    gui.add({ pattern: editor.gridPattern }, 'pattern', ['checker', 'grid'])
        .name('Grid Pattern')
        .onChange((pattern: GridPattern) => {
            localStorage.setItem('pattern', pattern)
            editor.gridPattern = pattern
        })

    if (localStorage.getItem('darkTheme')) {
        const darkTheme = localStorage.getItem('darkTheme') === 'true'
        editor.gridColor = darkTheme ? COLOR_DARK : COLOR_LIGHT
    }
    gui.add({ darkTheme: isDarkColor(editor.gridColor) }, 'darkTheme')
        .name('Dark Mode')
        .onChange((darkTheme: boolean) => {
            localStorage.setItem('darkTheme', darkTheme.toString())
            editor.gridColor = darkTheme ? COLOR_DARK : COLOR_LIGHT
        })

    if (localStorage.getItem('debug')) {
        const debug = Boolean(localStorage.getItem('debug'))
        editor.debug = debug
    }
    gui.add({ debug: editor.debug }, 'debug')
        .name('Debug')
        .onChange((debug: boolean) => {
            if (debug) {
                localStorage.setItem('debug', 'true')
            } else {
                localStorage.removeItem('debug')
            }
            editor.debug = debug
        })

    if (localStorage.getItem('limitWireReach')) {
        const limitWireReach = localStorage.getItem('limitWireReach') === 'true'
        editor.limitWireReach = limitWireReach
    }
    gui.add({ limitWireReach: editor.limitWireReach }, 'limitWireReach')
        .name('Limit Wires Length')
        .onChange((limitWireReach: boolean) => {
            localStorage.setItem('limitWireReach', limitWireReach.toString())
            editor.limitWireReach = limitWireReach
        })

    if (localStorage.getItem('oilOutpostSettings')) {
        const settings = JSON.parse(localStorage.getItem('oilOutpostSettings'))
        editor.oilOutpostSettings = settings
    }
    window.addEventListener('visibilitychange', () =>
        localStorage.setItem('oilOutpostSettings', JSON.stringify(editor.oilOutpostSettings))
    )

    const oilOutpostSettings = new Proxy(editor.oilOutpostSettings, {
        set: (settings, key, value) => {
            settings[key as string] = value
            editor.oilOutpostSettings = settings
            return true
        },
    })

    function getModulesObjFor(entityName: string): Record<string, string> {
        return FD.getModulesFor(entityName)
            .sort((a, b) => a.order.localeCompare(b.order))
            .reduce<Record<string, string>>(
                (obj, item) => {
                    obj[item.localised_name] = item.name
                    return obj
                },
                { None: 'none' }
            )
    }

    const oilOutpostFolder = gui.addFolder('Oil Outpost Generator Settings')
    oilOutpostFolder.add(oilOutpostSettings, 'DEBUG').name('Debug')
    oilOutpostFolder
        .add(oilOutpostSettings, 'PUMPJACK_MODULE', getModulesObjFor('pumpjack'))
        .name('Pumpjack Modules')
    oilOutpostFolder
        .add(oilOutpostSettings, 'MIN_GAP_BETWEEN_UNDERGROUNDS', 1, 9, 1)
        .name('Min Gap > < UPipes')
    oilOutpostFolder.add(oilOutpostSettings, 'BEACONS').name('Beacons')
    oilOutpostFolder
        .add(oilOutpostSettings, 'MIN_AFFECTED_ENTITIES', 1, 12, 1)
        .name('Min Affect. Pumpjacks')
    oilOutpostFolder
        .add(oilOutpostSettings, 'BEACON_MODULE', getModulesObjFor('beacon'))
        .name('Beacon Modules')

    // Keybinds folder
    const keybindsFolder = gui.addFolder('Keybinds')

    EDITOR.forEachAction(action => {
        const name = action.prettyName
        if (name.includes('Quickbar')) return
        keybindsFolder.add(action, 'keyCombo').name(name).listen()
    })

    const quickbarFolder = keybindsFolder.addFolder('Quickbar')

    EDITOR.forEachAction(action => {
        const name = action.prettyName
        if (!name.includes('Quickbar')) return
        quickbarFolder.add(action, 'keyCombo').name(name).listen()
    })

    keybindsFolder
        .add({ resetDefaults: () => EDITOR.resetKeybinds() }, 'resetDefaults')
        .name('Reset Defaults')

    return { changeBook }
}
