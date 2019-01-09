
// https://github.com/parcel-bundler/parcel/issues/289#issuecomment-393106708
if (module.hot) module.hot.dispose(() => { window.location.reload(); throw new Error('Reloading') })

// tslint:disable:no-import-side-effect
import 'normalize.css'
import './style.styl'

import * as PIXI from 'pixi.js'

import { Book } from './factorio-data/book'
import BPString from './factorio-data/BPString'

import { InventoryContainer } from './panels/inventory'
import G from './common/globals'
import { EntityContainer } from './containers/entity'
import { EntityPaintContainer } from './containers/entityPaint'
import { BlueprintContainer } from './containers/blueprint'
import { ToolbarContainer } from './panels/toolbar'
import { QuickbarContainer } from './panels/quickbar'
import { Blueprint } from './factorio-data/blueprint'
import { EditEntityContainer } from './panels/editEntity'
import { InfoContainer } from './panels/info'
import FileSaver from 'file-saver'
import { TilePaintContainer } from './containers/tilePaint'
import initDoorbell from './doorbell'
import actions from './actions'
import initDatGui from './datgui'
import spritesheetsLoader from './spritesheetsLoader'

if (PIXI.utils.isMobile.any) {
    const text = 'This application is not compatible with mobile devices.'
    document.getElementById('loadingMsg').innerHTML = text
    throw new Error(text)
}

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
document.body.appendChild(G.app.view)

PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH
// PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
// PIXI.settings.GC_MODE = PIXI.GC_MODES.MANUAL
PIXI.Graphics.CURVES.adaptive = true

G.BPC = new BlueprintContainer()
G.app.stage.addChild(G.BPC)

// Hack for plugging the mouse into keyboardJS
actions.attachEventsToContainer(G.BPC)

G.editEntityContainer = new EditEntityContainer()
G.app.stage.addChild(G.editEntityContainer)

G.inventoryContainer = new InventoryContainer()
G.app.stage.addChild(G.inventoryContainer)

G.toolbarContainer = new ToolbarContainer()
G.app.stage.addChild(G.toolbarContainer)

G.quickbarContainer = new QuickbarContainer(G.quickbarRows)
G.app.stage.addChild(G.quickbarContainer)

const infoContainer = new InfoContainer()
G.app.stage.addChild(infoContainer)

Promise.all(
    [bpSource ? BPString.findBPString(bpSource) : undefined]
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

function loadBp(bpString: string, clearData = true) {
    return BPString.decode(bpString)
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

document.addEventListener('copy', (e: ClipboardEvent) => {
    e.preventDefault()

    if (G.bp.isEmpty()) return

    if (navigator.clipboard && navigator.clipboard.writeText) {
        BPString.encode(G.bp)
            .then(s => navigator.clipboard.writeText(s))
            .then(() => console.log('Copied BP String'))
            .catch(error => console.error(error))
    } else {
        const data = BPString.encodeSync(G.bp)
        if (data.value) {
            e.clipboardData.setData('text/plain', data.value)
            console.log('Copied BP String')
        } else {
            console.error(data.error)
        }
    }
})

document.addEventListener('paste', (e: ClipboardEvent) => {
    e.preventDefault()

    G.loadingScreen.show()

    const promise = navigator.clipboard && navigator.clipboard.readText ?
        navigator.clipboard.readText() :
        Promise.resolve(e.clipboardData.getData('text'))

    promise
        .then(BPString.findBPString)
        .then(loadBp)
        .then(() => G.loadingScreen.hide())
        .catch(error => console.error(error))
})

actions.clear.bind(() => {
    G.BPC.clearData()
    G.bp = new Blueprint()
    G.BPC.initBP()
})

actions.picture.bind(() => {
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

actions.info.bind(() => infoContainer.toggle())

actions.closeWindow.bind(() => { if (G.openedGUIWindow) G.openedGUIWindow.close() })

actions.inventory.bind(() => {
    if (G.currentMouseState !== G.mouseStates.MOVING && !G.renderOnly) {
        if (G.openedGUIWindow) {
            G.openedGUIWindow.close()
        } else {
            G.inventoryContainer.toggle()
        }
    }
})

actions.focus.bind(() => G.BPC.centerViewport())

actions.rotate.bind(() => {
    if (G.BPC.hoverContainer &&
        (G.currentMouseState === G.mouseStates.NONE || G.currentMouseState === G.mouseStates.MOVING)
    ) {
        G.BPC.hoverContainer.rotate()
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.rotate()
    }
})

actions.reverseRotate.bind(() => {
    if (G.BPC.hoverContainer &&
        (G.currentMouseState === G.mouseStates.NONE || G.currentMouseState === G.mouseStates.MOVING)
    ) {
        G.BPC.hoverContainer.rotate(true)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.rotate(true)
    }
})

actions.pippete.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.currentMouseState = G.mouseStates.PAINTING

        const hoverContainer = G.BPC.hoverContainer
        G.BPC.hoverContainer.pointerOutEventHandler()
        const entity = G.bp.entity(hoverContainer.entity_number)
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
    G.bp.undo(
        hist => pre(hist, 'add'),
        hist => post(hist, 'del')
    )
})

actions.redo.bind(() => {
    G.bp.redo(
        hist => pre(hist, 'del'),
        hist => post(hist, 'add')
    )
})

function pre(hist: IHistoryObject, addDel: string) {
    switch (hist.type) {
        case 'mov':
        case addDel:
            const e = EntityContainer.mappings.get(hist.entity_number)
            e.redrawSurroundingEntities()
            if (hist.type === addDel) {
                G.BPC.wiresContainer.remove(hist.entity_number)
                e.destroy()
            }
            if (hist.type === 'mov') G.BPC.wiresContainer.update(hist.entity_number)
    }
}

function post(hist: IHistoryObject, addDel: string) {
    function redrawEntityAndSurroundingEntities(entnr: number) {
        const e = EntityContainer.mappings.get(entnr)
        e.redraw()
        e.redrawSurroundingEntities()
    }
    switch (hist.type) {
        case 'mov':
            redrawEntityAndSurroundingEntities(hist.entity_number)
            const entity = G.bp.entity(hist.entity_number)
            const e = EntityContainer.mappings.get(hist.entity_number)
            e.position.set(
                entity.position.x * 32,
                entity.position.y * 32
            )
            e.updateVisualStuff()
            break
        case 'upd':
            if (hist.other_entity) {
                redrawEntityAndSurroundingEntities(hist.entity_number)
                redrawEntityAndSurroundingEntities(hist.other_entity)
            } else {
                const e = EntityContainer.mappings.get(hist.entity_number)
                e.redrawEntityInfo()
                redrawEntityAndSurroundingEntities(hist.entity_number)
                G.BPC.wiresContainer.update(hist.entity_number)
                if (G.editEntityContainer.visible) {
                    if (G.inventoryContainer.visible) G.inventoryContainer.close()
                    G.editEntityContainer.create(hist.entity_number)
                }
            }
            break
        case addDel:
            const ec = new EntityContainer(hist.entity_number)
            G.BPC.entities.addChild(ec)
            ec.redrawSurroundingEntities()
            G.BPC.wiresContainer.update(hist.entity_number)
    }

    console.log(`${addDel === 'del' ? 'Undo' : 'Redo'} ${hist.entity_number} ${hist.annotation}`)
    G.BPC.updateOverlay()
    G.BPC.updateViewportCulling()
}

actions.pan.bind(() => {
    if (!G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.currentMouseState = G.mouseStates.PANNING
    }
}, () => {
    if (G.currentMouseState === G.mouseStates.PANNING) {
        G.currentMouseState = G.mouseStates.NONE
    }
})

actions.build.bind(e => {
    if (G.BPC.paintContainer && G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.placeEntityContainer()
    }
})

actions.mine.bind(() => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.removeContainer()
    }
    if (G.BPC.paintContainer && G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.removeContainerUnder()
    }
})

actions.moveEntity.bind(() => {
    if (!G.BPC.movingContainer && G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.BPC.hoverContainer.pickUpEntityContainer()
        return
    }
    if (G.BPC.movingContainer) {
        G.BPC.movingContainer.placeDownEntityContainer()
    }
})

actions.openEntityGUI.bind(() => {
    if (G.BPC.hoverContainer) {
        console.log(G.bp.entity(G.BPC.hoverContainer.entity_number).toJS())

        if (G.currentMouseState === G.mouseStates.NONE && !G.openedGUIWindow) {
            G.editEntityContainer.create(G.BPC.hoverContainer.entity_number)
        }
    }
})

actions.copyEntitySettings.bind(() => {
    if (G.BPC.hoverContainer) {
        G.copyData.recipe = G.bp.entity(G.BPC.hoverContainer.entity_number).recipe
        G.copyData.modules = G.bp.entity(G.BPC.hoverContainer.entity_number).modulesList
    }
})

actions.pasteEntitySettings.bind(() => {
    if (G.BPC.hoverContainer) G.BPC.hoverContainer.pasteData()
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
