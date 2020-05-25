import './index.styl'

import { utils as pixiUtils } from 'pixi.js'
import EDITOR, { Blueprint, Book, TrainBlueprintError, ModdedBlueprintError } from '@fbe/editor'
import FileSaver from 'file-saver'
import initToasts from './toasts'
import initFeedbackButton from './feedbackButton'
import initSettingsPane from './settingsPane'

const CANVAS = document.getElementById('editor') as HTMLCanvasElement

let bp: Blueprint
let book: Book

const loadingScreen = {
    el: document.getElementById('loadingScreen'),
    show() {
        this.el.classList.add('active')
    },
    hide() {
        this.el.classList.remove('active')
    }
}

console.log(
    '\n%cLooking for the source?\nhttps://github.com/Teoxoy/factorio-blueprint-editor\n',
    'color: #1f79aa; font-weight: bold'
)

initFeedbackButton()
const createToast = initToasts()

if (pixiUtils.isMobile.any) {
    createToast({
        text:
            'Application is not compatible with mobile devices.<br>' +
            'If you think this is a mistake, feel free to report this bug on github or using the feedback button.',
        type: 'error',
        timeout: Infinity
    })
    loadingScreen.el.classList.add('error')
    throw new Error('MOBILE_DEVICE_NOT_SUPPORTED')
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

EDITOR.initEditor(CANVAS)
    .then(() => {
        if (localStorage.getItem('quickbarItemNames')) {
            const quickbarItems = JSON.parse(localStorage.getItem('quickbarItemNames'))
            EDITOR.setQuickbarItems(quickbarItems)
        }

        registerActions()

        const changeBookIndex = (index: number): void => {
            bp = book.getBlueprint(index)
            EDITOR.loadBlueprint(bp)
        }
        changeBookForIndexSelector = initSettingsPane(changeBookIndex).changeBook

        EDITOR.bpStringEncodeDecode
            .getBlueprintOrBookFromSource(bpSource)
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

window.addEventListener('unload', () => {
    localStorage.setItem('quickbarItemNames', JSON.stringify(EDITOR.getQuickbarItems()))
})

function loadBp(bpOrBook: Blueprint | Book): void {
    if (bpOrBook instanceof Book) {
        book = bpOrBook
        bp = book.getBlueprint(bpIndex ? bpIndex : undefined)
    } else {
        bp = bpOrBook
    }

    EDITOR.loadBlueprint(bp)
    changeBookForIndexSelector(bpOrBook)

    loadingScreen.hide()

    const bpIsEmpty = bpOrBook instanceof Blueprint && bpOrBook.isEmpty()
    if (!bpIsEmpty) {
        createToast({ text: 'Blueprint string loaded successfully', type: 'success' })
    }
}

document.addEventListener('copy', (e: ClipboardEvent) => {
    if (document.activeElement !== CANVAS) {
        return
    }
    e.preventDefault()

    if (bp.isEmpty()) {
        return
    }

    const onSuccess = (): void => {
        createToast({ text: 'Blueprint string copied to clipboard', type: 'success' })
    }

    const onError = (error: Error): void => {
        createErrorMessage('Blueprint string could not be generated.', error)
    }

    const bpOrBook = book ? book : bp
    if (navigator.clipboard && navigator.clipboard.writeText) {
        EDITOR.bpStringEncodeDecode
            .encode(bpOrBook)
            .then(s => navigator.clipboard.writeText(s))
            .then(onSuccess)
            .catch(onError)
    } else {
        const data = EDITOR.bpStringEncodeDecode.encodeSync(bpOrBook)
        if (data.value) {
            e.clipboardData.setData('text/plain', data.value)
            onSuccess()
        } else {
            onError(data.error)
        }
    }
})

document.addEventListener('paste', (e: ClipboardEvent) => {
    if (document.activeElement !== CANVAS) {
        return
    }
    e.preventDefault()

    loadingScreen.show()

    const promise =
        navigator.clipboard && navigator.clipboard.readText
            ? navigator.clipboard.readText()
            : Promise.resolve(e.clipboardData.getData('text'))

    promise
        .then(EDITOR.bpStringEncodeDecode.getBlueprintOrBookFromSource)
        .then(loadBp)
        .catch(error => {
            loadingScreen.hide()
            createBPImportError(error)
        })
})

function registerActions(): void {
    EDITOR.registerAction('clear', 'shift+n').bind({
        press: () => {
            loadBp(new Blueprint())
        }
    })

    EDITOR.registerAction('generateOilOutpost', 'g').bind({
        press: () => {
            const errorMessage = bp.generatePipes()
            if (errorMessage) {
                createToast({ text: errorMessage, type: 'warning' })
            }
        }
    })

    EDITOR.registerAction('info', 'i').bind({
        press: () => {
            const infoPanel = document.getElementById('info-panel')
            if (infoPanel.classList.contains('active')) {
                infoPanel.classList.remove('active')
            } else {
                infoPanel.classList.add('active')
            }
        }
    })

    EDITOR.registerAction('takePicture', 'modifier+s').bind({
        press: () => {
            if (bp.isEmpty()) {
                return
            }

            EDITOR.getPicture().then(blob => {
                FileSaver.saveAs(blob, `${bp.name}.png`)
                createToast({ text: 'Blueprint image successfully generated', type: 'success' })
            })
        }
    })

    EDITOR.importKeybinds(JSON.parse(localStorage.getItem('keybinds')))

    window.addEventListener('unload', () => {
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
    if (notFirstRun) {
        return
    }
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
            timeout: 30000
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
        timeout
    })
}
function createBPImportError(error: Error | TrainBlueprintError | ModdedBlueprintError): void {
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

    createErrorMessage('Blueprint string could not be loaded.', error)
}
