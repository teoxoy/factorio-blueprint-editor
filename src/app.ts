
// https://github.com/parcel-bundler/parcel/issues/289#issuecomment-393106708
if (module.hot) module.hot.dispose(() => { window.location.reload(); throw new Error('Reloading') })

// tslint:disable:no-import-side-effect
import './style.styl'

import * as PIXI from 'pixi.js'

import { Book } from './factorio-data/book'
import bpString from './factorio-data/bpString'

import G from './common/globals'
import { InventoryContainer } from './panels/inventory'
import { EntityPaintContainer } from './containers/entityPaint'
import { TilePaintContainer } from './containers/tilePaint'
import { BlueprintContainer } from './containers/blueprint'
import { ToolbarContainer } from './panels/toolbar'
import { QuickbarContainer } from './panels/quickbar'
import { InfoContainer } from './panels/info'
import Blueprint from './factorio-data/blueprint'
import FileSaver from 'file-saver'
import initDoorbell from './doorbell'
import actions from './actions'
import initDatGui from './datgui'
import spritesheetsLoader from './spritesheetsLoader'
import * as Editors from './editors/factory'
import Entity from './factorio-data/entity'
import Dialog from './controls/dialog'
import * as History from './factorio-data/history'

if (PIXI.utils.isMobile.any) {
    const text = 'This application is not compatible with mobile devices.'
    document.getElementById('loadingMsg').innerHTML = text
    throw new Error(text)
}

console.log('\n%cLooking for the source?\nhttps://github.com/Teoxoy/factorio-blueprint-editor\n', 'color: #1f79aa; font-weight: bold')

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

G.app = new PIXI.Application({
    view: document.getElementById('editor') as HTMLCanvasElement,
    resolution: window.devicePixelRatio,
    roundPixels: true
    // antialias: true
})

// https://github.com/pixijs/pixi.js/issues/3928
// G.app.renderer.plugins.interaction.moveWhenInside = true
// G.app.renderer.plugins.interaction.interactionFrequency = 1

G.app.renderer.autoResize = true
G.app.renderer.resize(window.innerWidth, window.innerHeight)
window.addEventListener('resize', () => {
    G.app.renderer.resize(window.innerWidth, window.innerHeight)
    G.BPC.viewport.setSize(G.app.screen.width, G.app.screen.height)
    G.BPC.viewport.updateTransform()
    G.BPC.updateViewportCulling()
}, false)

PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH
// PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
// PIXI.settings.GC_MODE = PIXI.GC_MODES.MANUAL
PIXI.Graphics.CURVES.adaptive = true

G.BPC = new BlueprintContainer()
G.app.stage.addChild(G.BPC)

// Hack for plugging the mouse into keyboardJS
actions.attachEventsToContainer(G.BPC)

G.toolbarContainer = new ToolbarContainer()
G.app.stage.addChild(G.toolbarContainer)

G.quickbarContainer = new QuickbarContainer(G.quickbarRows)
G.app.stage.addChild(G.quickbarContainer)

Promise.all(
    [
        // Get bp from source
        bpSource ? bpString.findBPString(bpSource) : undefined,
        // Wait for fonts to get loaded
        document.fonts.ready
    ]
    // Load spritesheets
    .concat(spritesheetsLoader.getAllPromises())
)
.then(data => {
    // Load quickbarItemNames from localStorage
    if (localStorage.getItem('quickbarItemNames')) {
        const quickbarItemNames = JSON.parse(localStorage.getItem('quickbarItemNames'))
        G.quickbarContainer.generateSlots(quickbarItemNames)
    }

    if (!bpSource) {
        G.bp = new Blueprint()
        G.BPC.initBP()
        finishSetup()
    } else {
        loadBp(data[0], false).then(finishSetup)
    }

    function finishSetup() {
        G.BPC.centerViewport()

        G.gridData.update(window.innerWidth / 2, window.innerHeight / 2, G.BPC)

        G.loadingScreen.hide()
    }
})
.catch(error => console.error(error))

function loadBp(bp: string, clearData = true) {
    return bpString.decode(bp)
        .then(data => {

            if (data instanceof Book) {
                G.book = data
                G.bp = G.book.getBlueprint(bpIndex)

                guiBPIndex
                    .max(G.book.blueprints.length - 1)
                    .setValue(bpIndex)
            } else {
                G.book = undefined
                G.bp = data

                guiBPIndex
                    .setValue(0)
                    .max(0)
            }

            if (clearData) G.BPC.clearData()
            G.BPC.initBP()

            Dialog.closeAll()

            console.log('Loaded BP String')
        })
        .catch(error => console.error(error))
}

window.addEventListener('unload', () => G.app.destroy(true, true))

document.addEventListener('mousemove', e => {
    G.gridData.update(e.clientX, e.clientY, G.BPC)

    if (G.currentMouseState === G.mouseStates.PANNING && !actions.movingViaKeyboard) {
        G.BPC.viewport.translateBy(e.movementX, e.movementY)
        G.BPC.viewport.updateTransform()
        G.BPC.updateViewportCulling()
    }
})

actions.copyBPString.bind(e => {
    if (G.bp.isEmpty()) return

    if (navigator.clipboard && navigator.clipboard.writeText) {
        bpString.encode(G.bp)
            .then(s => navigator.clipboard.writeText(s))
            .then(() => console.log('Copied BP String'))
            .catch(error => console.error(error))
    } else {
        const data = bpString.encodeSync(G.bp)
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

    const promise = navigator.clipboard && navigator.clipboard.readText ?
        navigator.clipboard.readText() :
        Promise.resolve(e.clipboardData.getData('text'))

    promise
        .then(bpString.findBPString)
        .then(loadBp)
        .then(() => G.loadingScreen.hide())
        .catch(error => console.error(error))
})

actions.clear.bind(() => {
    G.BPC.clearData()
    G.bp = new Blueprint()
    G.BPC.initBP()
})

actions.takePicture.bind(() => {
    if (G.bp.isEmpty()) return

    G.BPC.enableRenderableOnChildren()
    if (G.renderOnly) G.BPC.cacheAsBitmap = false
    const texture = G.app.renderer.generateTexture(G.BPC)
    if (G.renderOnly) G.BPC.cacheAsBitmap = true
    G.BPC.updateViewportCulling()

    texture.frame = G.BPC.getBlueprintBounds()
    texture._updateUvs()

    G.app.renderer.plugins.extract.canvas(new PIXI.Sprite(texture)).toBlob((blob: Blob) => {
        FileSaver.saveAs(blob, G.bp.name + '.png')
        console.log('Saved BP Image')
    })
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
            new InventoryContainer('Inventory', undefined, G.BPC.spawnEntityAtMouse.bind(G.BPC))
                .show()
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
        G.currentMouseState = G.mouseStates.PAINTING

        const hoverContainer = G.BPC.hoverContainer
        G.BPC.hoverContainer.pointerOutEventHandler()

        const entity = hoverContainer.entity
        G.BPC.paintContainer = new EntityPaintContainer(entity.name,
            entity.directionType === 'output' ? (entity.direction + 4) % 8 : entity.direction,
            hoverContainer.position)

        G.BPC.paintContainer.moveAtCursor()
        G.BPC.addChild(G.BPC.paintContainer)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.destroy()
        G.currentMouseState = G.mouseStates.NONE
        G.BPC.updateHoverContainer()
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
    if (History.canUndo()) History.undo()
})

actions.redo.bind(() => {
    if (History.canRedo()) History.redo()
})

actions.generateOilOutpost.bind(() => {
    G.bp.generatePipes()
})

actions.pan.bind(() => {
    if (!G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.currentMouseState = G.mouseStates.PANNING
    }
}, () => {
    if (G.currentMouseState === G.mouseStates.PANNING) {
        G.currentMouseState = G.mouseStates.NONE
    }
})

actions.zoomIn.bind(() => {
    G.BPC.zoom(true)
})

actions.zoomOut.bind(() => {
    G.BPC.zoom(false)
})

actions.build.bind(() => {
    if (G.BPC.paintContainer && G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.placeEntityContainer()
    }
})

actions.mine.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.bp.removeEntity(G.BPC.hoverContainer.entity)
    }
    if (G.BPC.paintContainer && G.currentMouseState === G.mouseStates.PAINTING) {
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
            if (editor === undefined) return
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
