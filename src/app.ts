// tslint:disable:no-import-side-effect
import 'normalize.css'

import * as PIXI from 'pixi.js'
import keyboardJS from 'keyboardjs'

import { Book } from './factorio-data/book'
import BPString from './factorio-data/BPString'
import sampleBP from './sample-blueprint'

import util from './util'
import { InventoryContainer } from './containers/inventory'
import G from './globals'
import { EntityContainer } from './containers/entity'
import { PaintContainer } from './containers/paint'
import { BlueprintContainer } from './containers/blueprint'
import { ToolbarContainer } from './containers/toolbar'
import { isNumber } from 'util'
import { Blueprint } from './factorio-data/blueprint'
import { EditEntityContainer } from './containers/editEntity'
import { InfoContainer } from './containers/info'

G.renderOnly = window.location.search.slice(1).split('&').includes('renderOnly')

G.app = new PIXI.Application({
    autoStart: false,
    antialias: true,
    resolution: window.devicePixelRatio
    // roundPixels: true
})

// https://github.com/pixijs/pixi.js/issues/3928
G.app.renderer.plugins.interaction.moveWhenInside = true

G.app.renderer.view.style.position = 'absolute'
G.app.renderer.view.style.display = 'none'
G.app.renderer.autoResize = true
G.app.renderer.resize(window.innerWidth, window.innerHeight)
window.addEventListener('resize', () => {
    G.app.renderer.resize(window.innerWidth, window.innerHeight)
    G.BPC.zoomPan.setViewPortSize(G.app.renderer.width, G.app.renderer.height)
    G.BPC.zoomPan.updateTransform()
    G.BPC.updateViewportCulling()
}, false)
document.body.appendChild(G.app.view)

// PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
// PIXI.settings.GC_MODE = PIXI.GC_MODES.MANUAL

G.BPC = new BlueprintContainer()
G.app.stage.addChild(G.BPC)

G.editEntityContainer = new EditEntityContainer()
G.app.stage.addChild(G.editEntityContainer)

G.inventoryContainer = new InventoryContainer()
G.app.stage.addChild(G.inventoryContainer)

G.toolbarContainer = new ToolbarContainer()
G.app.stage.addChild(G.toolbarContainer)

const infoContainer = new InfoContainer()
G.app.stage.addChild(infoContainer)

PIXI.loader
.add([
    { name: 'extra_iconSprites', url: 'spritesheets/extra_iconSpritesheet.json' },
    { name: 'iconSprites', url: 'spritesheets/iconSpritesheet.json' },
    { name: 'entitySprites', url: 'spritesheets/entitySpritesheet.json' }
])
.load((_: any, resources: any) => {
    G.app.renderer.plugins.prepare
    .add(resources.extra_iconSprites.spritesheet.baseTexture)
    .add(resources.iconSprites.spritesheet.baseTexture)
    .add(resources.entitySprites.spritesheet.baseTexture)
    .upload(setup)
})

function setup() {
    let initialSource: string
    for (const a of window.location.search.slice(1).split('&')) {
        if (a.includes('source')) {
            initialSource = a.split('=')[1]
            break
        }
    }
    loadBpFromSource(initialSource ? initialSource : sampleBP).then(() => {

        if (!G.bp) G.bp = new Blueprint()
        G.BPC.centerViewport()
        G.BPC.updateCursorPosition({
            x: G.app.renderer.width / 2,
            y: G.app.renderer.height / 2
        })

        G.app.start()
        G.app.renderer.view.style.display = 'block'
    })
}

function loadBpFromSource(source: string) {
    return util.findBPString(source).then(loadBp).catch(error => {
        console.error(error)
    })

    function loadBp(bpString: string) {
        const res = BPString.decode(bpString)
        // TODO: Handle decode errors
        if ((res as {error: any}).error) throw (res as {error: any}).error
        G.bp = res instanceof Book ? res.getBlueprint() : res

        G.BPC.clearData()
        G.BPC.initBP()
        console.log('Loaded BP String')
    }
}

window.addEventListener('copy', e => {
    e.preventDefault()

    e.clipboardData.setData('text/plain', BPString.encode(G.bp))

    console.log('Copied BP String')
})

window.addEventListener('paste', e => {
    e.preventDefault()

    G.app.renderer.view.style.display = 'none'
    loadBpFromSource(e.clipboardData.getData('text')).then(() => G.app.renderer.view.style.display = 'block')
})

keyboardJS.bind('shift + n', () => {
    G.BPC.clearData()
    G.bp = new Blueprint()
    G.BPC.initBP()
})

keyboardJS.bind('modifier + s', e => {
    e.preventDefault()

    G.BPC.centerViewport()
    if (G.renderOnly) G.BPC.cacheAsBitmap = false
    const t = G.app.renderer.generateTexture(G.BPC)
    if (G.renderOnly) G.BPC.cacheAsBitmap = true
    t.frame = G.BPC.entitySprites.getLocalBounds()
    t._updateUvs()
    const s = new PIXI.Sprite(t)
    const image = G.app.renderer.plugins.extract.image(s)
    const w = window.open()
    w.focus()
    w.document.write(image.outerHTML)

    console.log('Saved BP Image')
})

keyboardJS.bind('shift', () => G.keyboard.shift = true, () => G.keyboard.shift = false)

keyboardJS.bind('alt', e => {
    e.preventDefault()
    G.BPC.overlayContainer.overlay.visible = !G.BPC.overlayContainer.overlay.visible
})

keyboardJS.bind('i', () => infoContainer.toggle())

keyboardJS.bind('esc', () => { if (G.openedGUIWindow) G.openedGUIWindow.close() })

keyboardJS.bind('e', () => {
    if (G.currentMouseState !== G.mouseStates.MOVING && G.currentMouseState !== G.mouseStates.PAINTING && !G.renderOnly) {
        if (G.openedGUIWindow) {
            G.openedGUIWindow.close()
        } else {
            G.inventoryContainer.toggle()
        }
    }
})

keyboardJS.bind('f', () => G.BPC.centerViewport())

keyboardJS.bind('r', () => {
    if (G.BPC.hoverContainer &&
        (G.currentMouseState === G.mouseStates.NONE || G.currentMouseState === G.mouseStates.MOVING)
    ) {
        G.BPC.hoverContainer.rotate()
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.rotate()
    }
})

keyboardJS.bind('q', () => {
    if (G.BPC.hoverContainer && G.currentMouseState === G.mouseStates.NONE) {
        G.currentMouseState = G.mouseStates.PAINTING

        const hoverContainer = G.BPC.hoverContainer
        G.BPC.hoverContainer.pointerOutEventHandler()
        const entity = G.bp.entity(hoverContainer.entity_number)
        G.BPC.paintContainer = new PaintContainer(entity.name,
            entity.directionType === 'output' ? (entity.direction + 4) % 8 : entity.direction,
            hoverContainer.position)
        G.BPC.paintContainer.moveTo({
            x: G.gridCoordsOfCursor.x * 32,
            y: G.gridCoordsOfCursor.y * 32
        })
        G.BPC.addChild(G.BPC.paintContainer)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.destroy()
        G.BPC.paintContainer = undefined

        G.currentMouseState = G.mouseStates.NONE
    }
})

keyboardJS.bind('modifier + z', () => {
    G.bp.undo(
        hist => pre(hist, 'add'),
        hist => post(hist, 'del')
    )
})

keyboardJS.bind('modifier + y', () => {
    G.bp.redo(
        hist => pre(hist, 'del'),
        hist => post(hist, 'add')
    )
})

function pre(hist: any, addDel: string) {
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

function post(hist: any, addDel: string) {
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
            if (isNumber(hist.entity_number)) {
                const e = EntityContainer.mappings.get(hist.entity_number)
                e.redrawEntityInfo()
                redrawEntityAndSurroundingEntities(hist.entity_number)
                G.BPC.wiresContainer.update(hist.entity_number)
                if (G.editEntityContainer.visible) {
                    if (G.inventoryContainer.visible) G.inventoryContainer.close()
                    G.editEntityContainer.create(hist.entity_number)
                }
            } else {
                for (const entnr of hist.entity_number) {
                    redrawEntityAndSurroundingEntities(entnr)
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

keyboardJS.bind('w', () => G.keyboard.w = true, () => G.keyboard.w = false)
keyboardJS.bind('a', () => G.keyboard.a = true, () => G.keyboard.a = false)
keyboardJS.bind('s', () => G.keyboard.s = true, () => G.keyboard.s = false)
keyboardJS.bind('d', () => G.keyboard.d = true, () => G.keyboard.d = false)
