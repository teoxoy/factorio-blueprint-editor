import './style.styl'

import * as PIXI from 'pixi.js'

import FileSaver from 'file-saver'
import { Book } from './factorio-data/book'
import bpString from './factorio-data/bpString'

import G from './common/globals'
import { InventoryContainer } from './panels/inventory'
import { TilePaintContainer } from './containers/paintTile'
import { BlueprintContainer } from './containers/blueprint'
import { ToolbarContainer } from './panels/toolbar'
import { QuickbarContainer } from './panels/quickbar'
import { InfoEntityPanel } from './panels/infoEntityPanel'
import { InfoContainer } from './panels/info'
import Blueprint from './factorio-data/blueprint'
import initDoorbell from './doorbell'
import actions from './actions'
import initDatGui from './datgui'
import spritesheetsLoader from './spritesheetsLoader'
import * as Editors from './editors/factory'
import Entity from './factorio-data/entity'
import Dialog from './controls/dialog'
import * as History from './factorio-data/history'

if (PIXI.utils.isMobile.any) {
    document.getElementById('loadingScreen').classList.add('mobileError')
    throw new Error('MOBILE DEVICE DETECTED')
}

console.log(
    '\n%cLooking for the source?\nhttps://github.com/Teoxoy/factorio-blueprint-editor\n',
    'color: #1f79aa; font-weight: bold'
)

const params = window.location.search.slice(1).split('&')

G.renderOnly = params.includes('renderOnly')

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

const { guiBPIndex } = initDatGui()
initDoorbell()

PIXI.settings.MIPMAP_TEXTURES = PIXI.MIPMAP_MODES.ON
PIXI.settings.ROUND_PIXELS = true
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR
PIXI.settings.WRAP_MODE = PIXI.WRAP_MODES.REPEAT
PIXI.settings.RENDER_OPTIONS.antialias = true // for wires
PIXI.settings.RENDER_OPTIONS.resolution = window.devicePixelRatio
PIXI.settings.RENDER_OPTIONS.autoResize = true
PIXI.GRAPHICS_CURVES.adaptive = true
// PIXI.settings.PREFER_ENV = 1
// PIXI.settings.PRECISION_VERTEX = PIXI.PRECISION.HIGH
// PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH

function getMonitorRefreshRate(iterations = 10) {
    return new Promise(resolve => {
        const results: number[] = []
        let lastTimestamp = 0
        let i = 0

        const fn = (timestamp: number) => {
            results.push(1000 / (timestamp - lastTimestamp))
            lastTimestamp = timestamp
            i += 1
            if (i < iterations) {
                requestAnimationFrame(fn)
            } else {
                resolve(Math.ceil(Math.max(...results)))
            }
        }
        requestAnimationFrame(fn)
    })
}
getMonitorRefreshRate().then((fps: number) => {
    PIXI.settings.TARGET_FPMS = fps / 1000
})

G.app = new PIXI.Application({ view: document.getElementById('editor') as HTMLCanvasElement })

// https://github.com/pixijs/pixi.js/issues/3928
// G.app.renderer.plugins.interaction.moveWhenInside = true
// G.app.renderer.plugins.interaction.interactionFrequency = 1

G.app.renderer.resize(window.innerWidth, window.innerHeight)
window.addEventListener(
    'resize',
    () => {
        G.app.renderer.resize(window.innerWidth, window.innerHeight)
        G.BPC.viewport.setSize(G.app.screen.width, G.app.screen.height)
        G.BPC.viewport.updateTransform()
    },
    false
)

G.BPC = new BlueprintContainer()
G.app.stage.addChild(G.BPC)

G.toolbarContainer = new ToolbarContainer()
G.app.stage.addChild(G.toolbarContainer)

G.quickbarContainer = new QuickbarContainer(G.quickbarRows)
G.app.stage.addChild(G.quickbarContainer)

G.infoEntityPanel = new InfoEntityPanel()
G.app.stage.addChild(G.infoEntityPanel)

G.dialogsContainer = new PIXI.Container()
G.app.stage.addChild(G.dialogsContainer)

G.paintIconContainer = new PIXI.Container()
G.app.stage.addChild(G.paintIconContainer)

Promise.all([
    // Get bp from source
    bpString.getBlueprintOrBookFromSource(bpSource),
    // Wait for fonts to get loaded
    document.fonts.ready,
    // Load spritesheets
    ...spritesheetsLoader.getAllPromises()
])
    .then(data => {
        // Load quickbarItemNames from localStorage
        if (localStorage.getItem('quickbarItemNames')) {
            const quickbarItemNames = JSON.parse(localStorage.getItem('quickbarItemNames'))
            G.quickbarContainer.generateSlots(quickbarItemNames)
        }

        loadBp(data[0], false)
    })
    .catch(error => console.error(error))

function loadBp(bpOrBook: Blueprint | Book, clearData = true) {
    if (bpOrBook instanceof Book) {
        G.book = bpOrBook
        G.bp = G.book.getBlueprint(bpIndex ? bpIndex : undefined)

        guiBPIndex.max(G.book.blueprints.length - 1).setValue(G.book.activeIndex)
    } else {
        G.book = undefined
        G.bp = bpOrBook

        guiBPIndex.setValue(0).max(0)
    }

    if (clearData) {
        G.BPC.clearData()
    }
    G.BPC.initBP()
    G.loadingScreen.hide()

    Dialog.closeAll()
}

// If the tab is not active then stop the app
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        G.app.start()
    } else {
        G.app.stop()
    }
})

window.addEventListener('unload', () => {
    G.app.stop()
    G.app.renderer.textureGC.unload(G.app.stage)
    G.app.destroy()
})

document.addEventListener('mousemove', e => {
    if (G.currentMouseState === G.mouseStates.PANNING) {
        G.BPC.viewport.translateBy(e.movementX, e.movementY)
        G.BPC.viewport.updateTransform()
    }
})

actions.copyBPString.bind(e => {
    if (G.bp.isEmpty()) {
        return
    }

    const bpOrBook = G.book ? G.book : G.bp
    if (navigator.clipboard && navigator.clipboard.writeText) {
        bpString
            .encode(bpOrBook)
            .then(s => navigator.clipboard.writeText(s))
            .then(() => console.log('Copied BP String'))
            .catch(error => console.error(error))
    } else {
        const data = bpString.encodeSync(bpOrBook)
        if (data.value) {
            e.clipboardData.setData('text/plain', data.value)
            console.log('Copied BP String')
        } else {
            console.error(data.error)
        }
    }
})

actions.pasteBPString.bind(e => {
    G.loadingScreen.show()

    const promise =
        navigator.clipboard && navigator.clipboard.readText
            ? navigator.clipboard.readText()
            : Promise.resolve(e.clipboardData.getData('text'))

    promise.then(bpString.getBlueprintOrBookFromSource).then(bpOrBook => {
        if (bpOrBook instanceof Blueprint && bpOrBook.isEmpty()) {
            G.loadingScreen.hide()
        } else {
            loadBp(bpOrBook)
        }
    })
})

actions.clear.bind(() => {
    loadBp(new Blueprint())
})

actions.takePicture.bind(() => {
    if (G.bp.isEmpty()) {
        return
    }

    if (G.renderOnly) {
        G.BPC.cacheAsBitmap = false
    }
    G.BPC.viewportCulling = false

    const texture = G.app.renderer.generateTexture(G.BPC, PIXI.SCALE_MODES.LINEAR, 1)
    texture.frame = G.BPC.getBlueprintBounds()
    texture.updateUvs()

    G.app.renderer.plugins.extract.canvas(new PIXI.Sprite(texture)).toBlob((blob: Blob) => {
        FileSaver.saveAs(blob, `${G.bp.name}.png`)
        console.log('Saved BP Image')
    })

    if (G.renderOnly) {
        G.BPC.cacheAsBitmap = true
    }
    G.BPC.viewportCulling = true
})

actions.showInfo.bind(() => {
    G.BPC.overlayContainer.overlay.visible = !G.BPC.overlayContainer.overlay.visible
})

actions.info.bind(() => {
    InfoContainer.toggle()
})

actions.closeWindow.bind(() => {
    Dialog.closeLast()
})

actions.inventory.bind(() => {
    if (!G.renderOnly) {
        // If there is a dialog open, assume user wants to close it
        if (Dialog.anyOpen()) {
            Dialog.closeLast()
        } else {
            new InventoryContainer('Inventory', undefined, G.BPC.spawnPaintContainer.bind(G.BPC)).show()
        }
    }
})

actions.focus.bind(() => G.BPC.centerViewport())

actions.rotate.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.entity.rotate(false, true)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.rotate()
    }
})

actions.reverseRotate.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.entity.rotate(true, true)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.rotate(true)
    }
})

actions.pipette.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        const entity = G.BPC.hoverContainer.entity
        const itemName = Entity.getItemName(entity.name)
        const direction = entity.directionType === 'output' ? (entity.direction + 4) % 8 : entity.direction
        G.BPC.spawnPaintContainer(itemName, direction)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.destroy()
    }
})

actions.increaseTileBuildingArea.bind(() => {
    if (G.BPC.paintContainer instanceof TilePaintContainer) {
        G.BPC.paintContainer.increaseSize()
    }
})

actions.decreaseTileBuildingArea.bind(() => {
    if (G.BPC.paintContainer instanceof TilePaintContainer) {
        G.BPC.paintContainer.decreaseSize()
    }
})

actions.undo.bind(() => {
    if (History.canUndo()) {
        History.undo()
    }
})

actions.redo.bind(() => {
    if (History.canRedo()) {
        History.redo()
    }
})

actions.generateOilOutpost.bind(() => {
    G.bp.generatePipes()
})

actions.pan.bind(
    () => {
        if (!G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
            G.currentMouseState = G.mouseStates.PANNING
            G.BPC.cursor = 'move'
        }
    },
    () => {
        if (G.currentMouseState === G.mouseStates.PANNING) {
            G.currentMouseState = G.mouseStates.NONE
            G.BPC.cursor = 'inherit'
        }
    }
)

actions.zoomIn.bind(() => {
    G.BPC.zoom(true)
})

actions.zoomOut.bind(() => {
    G.BPC.zoom(false)
})

actions.build.bind(() => {
    if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.placeEntityContainer()
    }
})

actions.mine.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.bp.removeEntity(G.BPC.hoverContainer.entity)
    }
    if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.removeContainerUnder()
    }
})

actions.moveEntityUp.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.entity.moveBy({ x: 0, y: -1 })
    }
})
actions.moveEntityLeft.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.entity.moveBy({ x: -1, y: 0 })
    }
})
actions.moveEntityDown.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.entity.moveBy({ x: 0, y: 1 })
    }
})
actions.moveEntityRight.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.entity.moveBy({ x: 1, y: 0 })
    }
})

actions.openEntityGUI.bind(() => {
    if (G.BPC.hoverContainer !== undefined) {
        // console.log(G.BPC.hoverContainer.entity.getRawData())
        if (G.currentMouseState === G.mouseStates.NONE) {
            const editor = Editors.createEditor(G.BPC.hoverContainer.entity)
            if (editor === undefined) {
                return
            }
            Dialog.closeAll()
            editor.show()
        }
    }
})

let entityForCopyData: Entity
actions.copyEntitySettings.bind(() => {
    if (G.BPC.hoverContainer !== undefined) {
        // Store reference to source entity
        entityForCopyData = G.BPC.hoverContainer.entity
    }
})
actions.pasteEntitySettings.bind(() => {
    if (G.BPC.hoverContainer !== undefined) {
        // Hand over reference of source entity to target entity for pasting data
        G.BPC.hoverContainer.entity.pasteSettings(entityForCopyData)
    }
})

actions.quickbar1.bind(() => G.quickbarContainer.bindKeyToSlot(0))
actions.quickbar2.bind(() => G.quickbarContainer.bindKeyToSlot(1))
actions.quickbar3.bind(() => G.quickbarContainer.bindKeyToSlot(2))
actions.quickbar4.bind(() => G.quickbarContainer.bindKeyToSlot(3))
actions.quickbar5.bind(() => G.quickbarContainer.bindKeyToSlot(4))
actions.quickbar6.bind(() => G.quickbarContainer.bindKeyToSlot(5))
actions.quickbar7.bind(() => G.quickbarContainer.bindKeyToSlot(6))
actions.quickbar8.bind(() => G.quickbarContainer.bindKeyToSlot(7))
actions.quickbar9.bind(() => G.quickbarContainer.bindKeyToSlot(8))
actions.quickbar10.bind(() => G.quickbarContainer.bindKeyToSlot(9))
actions.changeActiveQuickbar.bind(() => G.quickbarContainer.changeActiveQuickbar())
