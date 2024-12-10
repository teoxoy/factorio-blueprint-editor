import './index.styl'

import { isMobile } from '@pixi/settings'
import FileSaver from 'file-saver'
import EDITOR, {
    Editor,
    Blueprint,
    Book,
    TrainBlueprintError,
    ModdedBlueprintError,
    CorruptedBlueprintStringError,
    BookWithNoBlueprintsError,
    encode,
    getBlueprintOrBookFromSource,
} from '@fbe/editor'
import { initToasts } from './toasts'
import { initFeedbackButton } from './feedbackButton'
import { initSettingsPane } from './settingsPane'

document.addEventListener('contextmenu', e => e.preventDefault())

const editor = new Editor()

let t0 = performance.now()

const CANVAS = document.getElementById('editor') as HTMLCanvasElement

let bp: Blueprint
let book: Book

const loadingScreen = {
    el: document.getElementById('loadingScreen'),
    show() {
        this.el.classList.add('active')
        t0 = performance.now()
    },
    hide() {
        this.el.classList.remove('active')
        const t1 = performance.now()
        if (editor.debug) {
            console.log('Load time:', t1 - t0)
        }
    },
}

console.log(
    '\n%cLooking for the source?\nhttps://github.com/Teoxoy/factorio-blueprint-editor\n',
    'color: #1f79aa; font-weight: bold'
)

initFeedbackButton()
const createToast = initToasts()

if (isMobile.any) {
    createToast({
        text:
            'Application is not compatible with mobile devices.<br>' +
            'If you think this is a mistake, feel free to report this bug on github or using the feedback button.',
        type: 'error',
        timeout: Infinity,
    })
    loadingScreen.el.classList.add('error')
    throw new Error('MOBILE_DEVICE_NOT_SUPPORTED')
}

if (typeof WebAssembly !== 'object' && typeof WebAssembly.instantiate !== 'function') {
    createToast({
        text:
            "Current browser doesn't support WebAssembly.<br>" +
            'If you think this is a mistake, feel free to report this bug on github or using the feedback button.',
        type: 'error',
        timeout: Infinity,
    })
    loadingScreen.el.classList.add('error')
    throw new Error('WEB_ASSEMBLY_NOT_SUPPORTED')
}

const params = window.location.search.slice(1).split('&')

let bpSource: string
let bpIndex = 0
for (const p of params) {
    if (p.includes('source')) {
        bpSource = p.split('=')[1]
    }
    if (p.includes('index')) {
        bpIndex = Number(p.split('=')[1])
    }
}

let changeBookForIndexSelector: (bpOrBook: Book | Blueprint) => void

editor
    .init(CANVAS, (text: string) => createToast({ text, type: 'error', timeout: 3000 }))
    .then(() => {
        if (localStorage.getItem('quickbarItemNames')) {
            const quickbarItems = JSON.parse(localStorage.getItem('quickbarItemNames'))
            editor.quickbarItems = quickbarItems
        }

        registerActions()

        const changeBookIndex = async (index: number): Promise<void> => {
            bp = book.selectBlueprint(index)
            await editor.loadBlueprint(bp)
        }
        changeBookForIndexSelector = initSettingsPane(editor, changeBookIndex).changeBook

        getBlueprintOrBookFromSource(bpSource)
            .catch(error => createBPImportError(error))

            .then(bpOrBook => loadBp(bpOrBook || new Blueprint()))

            .then(() => createWelcomeMessage())
            .catch(error => createBPImportError(error))
    })
    .catch(error => {
        createErrorMessage('Something went wrong.', error, Infinity)
        loadingScreen.el.classList.add('error')
        throw new Error('UNRECOVERABLE_ERROR')
    })

window.addEventListener('visibilitychange', () => {
    localStorage.setItem('quickbarItemNames', JSON.stringify(editor.quickbarItems))
})

async function loadBp(bpOrBook: Blueprint | Book): Promise<void> {
    if (bpOrBook instanceof Book) {
        book = bpOrBook
        bp = book.selectBlueprint(bpIndex ? bpIndex : undefined)
    } else {
        book = undefined
        bp = bpOrBook
    }

    await editor.loadBlueprint(bp)
    changeBookForIndexSelector(bpOrBook)

    loadingScreen.hide()

    const bpIsEmpty = bpOrBook instanceof Blueprint && bpOrBook.isEmpty()
    if (!bpIsEmpty) {
        createToast({ text: 'Blueprint string loaded successfully', type: 'success' })
    }
}

document.addEventListener('copy', (e: ClipboardEvent) => {
    if (document.activeElement !== CANVAS) return
    e.preventDefault()

    if (bp.isEmpty()) return

    const onSuccess = (): void => {
        createToast({ text: 'Blueprint string copied to clipboard', type: 'success' })
    }

    const onError = (error: Error): void => {
        createErrorMessage('Blueprint string could not be generated.', error)
    }

    encode(book || bp)
        .then(s => navigator.clipboard.writeText(s))
        .then(onSuccess)
        .catch(onError)
})

document.addEventListener('paste', (e: ClipboardEvent) => {
    if (document.activeElement !== CANVAS) return
    e.preventDefault()

    loadingScreen.show()

    navigator.clipboard
        .readText()
        .then(getBlueprintOrBookFromSource)
        .then(loadBp)
        .catch(error => {
            loadingScreen.hide()
            createBPImportError(error)
        })
})

function registerActions(): void {
    EDITOR.registerAction('clear', 'shift+n').bind({
        press: () => loadBp(new Blueprint()),
    })

    EDITOR.registerAction('appendBlueprint', 'shift+modifier+v').bind({
        press: () => {
            navigator.clipboard
                .readText()
                .then(getBlueprintOrBookFromSource)
                .then(bp => editor.appendBlueprint(bp instanceof Book ? bp.selectBlueprint(0) : bp))
                .catch(error => {
                    createBPImportError(error)
                })
        },
    })

    EDITOR.registerAction('generateOilOutpost', 'g').bind({
        press: () => {
            const errorMessage = bp.generatePipes()
            if (errorMessage) {
                createToast({ text: errorMessage, type: 'warning' })
            }
        },
    })

    window.addEventListener('keydown', e => {
        const infoPanel = document.getElementById('info-panel')
        if (e.key === 'i') {
            if (infoPanel.classList.contains('active')) {
                infoPanel.classList.remove('active')
            } else {
                infoPanel.classList.add('active')
            }
        } else if (e.key === 'Escape') {
            infoPanel.classList.remove('active')
        }
    })

    EDITOR.registerAction('takePicture', 'modifier+s').bind({
        press: () => {
            if (bp.isEmpty()) return

            editor.getPicture().then(blob => {
                FileSaver.saveAs(blob, `${bp.name}.png`)
                createToast({ text: 'Blueprint image successfully generated', type: 'success' })
            })
        },
    })

    EDITOR.importKeybinds(JSON.parse(localStorage.getItem('keybinds')))

    window.addEventListener('visibilitychange', () => {
        const keybinds = EDITOR.exportKeybinds()
        if (Object.keys(keybinds).length) {
            localStorage.setItem('keybinds', JSON.stringify(keybinds))
        } else {
            localStorage.removeItem('keybinds')
        }
    })
}

function createWelcomeMessage(): void {
    const notFirstRun = localStorage.getItem('firstRun') === 'false'
    if (notFirstRun) return
    localStorage.setItem('firstRun', 'false')

    // Wait a bit just to capture the users attention
    // This way they will see the toast animation
    setTimeout(() => {
        createToast({
            text:
                '> To access the inventory and start building press E<br>' +
                '> To import/export a blueprint string use ctrl/cmd + C/V<br>' +
                '> For more info press I<br>' +
                '> Also check out the settings area',
            timeout: 30000,
        })
    }, 1000)
}
function createErrorMessage(text: string, error: unknown, timeout = 10000): void {
    console.error(error)
    createToast({
        text:
            `${text}<br>` +
            'Please check out the console (F12) for an error message and ' +
            'report this bug on github or using the feedback button.',
        type: 'error',
        timeout,
    })
}
function createBPImportError(
    error:
        | Error
        | TrainBlueprintError
        | ModdedBlueprintError
        | CorruptedBlueprintStringError
        | BookWithNoBlueprintsError
): void {
    if (error instanceof TrainBlueprintError) {
        createErrorMessage(
            'Blueprint with train entities not supported yet. If you think this is a mistake:',
            error.errors
        )
        return
    }

    if (error instanceof ModdedBlueprintError) {
        createErrorMessage(
            'Blueprint with modded items not supported yet. If you think this is a mistake:',
            error.errors
        )
        return
    }

    if (error instanceof CorruptedBlueprintStringError) {
        createErrorMessage(
            'Blueprint string might be corrupted. If you think this is a mistake:',
            error.error
        )
        return
    }

    if (error instanceof BookWithNoBlueprintsError) {
        createErrorMessage(`${error.error} If you think this is a mistake:`, error.error)
        return
    }

    createErrorMessage('Blueprint string could not be loaded.', error)
}
