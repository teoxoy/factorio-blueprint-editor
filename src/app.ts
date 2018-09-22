// tslint:disable:no-import-side-effect
import 'normalize.css'
import './style.styl'

import entitySpritesheetPNG from 'factorio-data/data/graphics/HREntitySpritesheet.png'
import entitySpritesheetJSON from 'factorio-data/data/graphics/HREntitySpritesheet.json'
import iconSpritesheetPNG from 'factorio-data/data/graphics/iconSpritesheet.png'
import iconSpritesheetJSON from 'factorio-data/data/graphics/iconSpritesheet.json'
import utilitySpritesheetPNG from 'factorio-data/data/graphics/utilitySpritesheet.png'
import utilitySpritesheetJSON from 'factorio-data/data/graphics/utilitySpritesheet.json'

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
import { Blueprint } from './factorio-data/blueprint'
import { EditEntityContainer } from './containers/editEntity'
import { InfoContainer } from './containers/info'
import FileSaver from 'file-saver'

let doorbellButton: HTMLElement
window.doorbellOptions = {
    id: '9657',
    appKey: 'z1scfSY8hpBNiIFWxBg50tkhjvFKhHMdhfGNMp6YCUZVttoLOqtrlhk4ca9asDCy',
    windowLoaded: true,
    onShow: () => keyboardJS.pause(),
    onHide: () => keyboardJS.resume(),
    onInitialized: () => {
        doorbellButton = document.getElementById('doorbell-button')
        doorbellButton.classList.add('closed')

        let activeTag: HTMLElement
        const tagsDiv = document.createElement('div')
        tagsDiv.id = 'doorbell-tags';
        [
            { name: 'Other', color: '#757575' },
            { name: 'Bug', color: '#e53935' },
            { name: 'Enhancement', color: '#00ACC1' },
            { name: 'Feature Request', color: '#FFB300' }
        ]
        .forEach((tag, i) => {
            const tagEl = document.createElement('div')
            tagEl.innerHTML = tag.name
            tagEl.style.backgroundColor = tag.color
            tagEl.onclick = () => {
                activeTag.classList.remove('active')
                activeTag = tagEl
                tagEl.classList.add('active')
                window.doorbellOptions.tags = tag.name
            }
            if (i === 0) {
                activeTag = tagEl
                tagEl.classList.add('active')
            }
            tagsDiv.appendChild(tagEl)
        })
        const fieldset = document.getElementById('doorbell-form').firstElementChild
        fieldset.insertBefore(tagsDiv, fieldset.lastElementChild)
    }
}
document.body.appendChild(Object.assign(document.createElement('script'), {
    id: 'doorbellScript',
    type: 'text/javascript',
    async: true,
    src: `https://embed.doorbell.io/button/${window.doorbellOptions['id']}?t=${Date.now()}`
}))

if (PIXI.utils.isMobile.any) {
    const text = 'This application is not compatible with mobile devices.'
    document.getElementById('loadingMsg').innerHTML = text
    throw new Error(text)
}

const keybinds = {
    rotate: 'r',
    pippete: 'q',
    undo: 'modifier+z',
    redo: 'modifier+y',
    picture: 'shift+s',
    clear: 'shift+n',
    overlay: 'alt',
    closeWindow: 'esc',
    inventory: 'e',
    focus: 'f',
    w: 'w',
    a: 'a',
    s: 's',
    d: 'd'
}

const params = window.location.search.slice(1).split('&')

G.renderOnly = params.includes('renderOnly')

if (params.includes('lightTheme')) {
    G.UIColors.primary = 0xAAAAAA
    G.UIColors.secondary = 0xCCCCCC
}

let bpSource = sampleBP
let bpIndex = 0
for (const p of params) {
    if (p.includes('source')) {
        bpSource = p.split('=')[1]
    }
    if (p.includes('index')) {
        bpIndex = Number(p.split('=')[1])
    }
    if (p.includes('keybinds')) {
        const parts = p.split(':')[1].split(',')
        for (const part of parts) {
            const pa = part.split('=')
            keybinds[pa[0]] = pa[1]
        }
    }
}

G.app = new PIXI.Application({
    resolution: window.devicePixelRatio,
    roundPixels: true
    // antialias: true
})

// https://github.com/pixijs/pixi.js/issues/3928
G.app.renderer.plugins.interaction.moveWhenInside = true

G.app.renderer.view.style.position = 'absolute'
G.app.renderer.view.style.display = 'none'
G.app.renderer.autoResize = true
G.app.renderer.resize(window.innerWidth, window.innerHeight)
window.addEventListener('resize', () => {
    G.app.renderer.resize(window.innerWidth, window.innerHeight)
    G.BPC.zoomPan.setViewPortSize(G.app.screen.width, G.app.screen.height)
    G.BPC.zoomPan.updateTransform()
    G.BPC.updateViewportCulling()
}, false)
document.body.appendChild(G.app.view)

PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH
// PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
// PIXI.settings.GC_MODE = PIXI.GC_MODES.MANUAL
PIXI.Graphics.CURVES.adaptive = true

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

Promise.all([util.findBPString(bpSource)]
.concat([
    [ entitySpritesheetPNG, entitySpritesheetJSON ],
    [ iconSpritesheetPNG, iconSpritesheetJSON ],
    [ utilitySpritesheetPNG, utilitySpritesheetJSON ]
].map(data =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.src = data[0]
        image.onload = () => {
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = util.nearestPowerOf2(image.width)
            tempCanvas.height = util.nearestPowerOf2(image.height)
            tempCanvas.getContext('2d').drawImage(image, 0, 0)
            return new PIXI.Spritesheet(PIXI.BaseTexture.fromCanvas(tempCanvas), data[1]).parse(resolve)
        }
        image.onerror = reject
    })
)))
.then(data => {
    loadBp(data[0], false).then(() => {

        G.BPC.centerViewport()
        G.BPC.updateCursorPosition({
            x: G.app.screen.width / 2,
            y: G.app.screen.height / 2
        })
        G.app.renderer.view.style.display = 'block'
        setTimeout(() => doorbellButton.classList.remove('closed'), 30000)
    })
})
.catch(error => console.error(error))

function loadBp(bpString: string, clearData = true) {
    return BPString.decode(bpString)
        .then(data => {
            G.bp = data instanceof Book ? data.getBlueprint(bpIndex) : data

            if (clearData) G.BPC.clearData()
            G.BPC.initBP()
            console.log('Loaded BP String')
        })
        .catch(error => console.error(error))
}

document.addEventListener('copy', (e: ClipboardEvent) => {
    e.preventDefault()
    if (G.bp.isEmpty()) return

    BPString.encode(G.bp)
        .then(data => {
            e.clipboardData.setData('text/plain', data)
            console.log('Copied BP String')
        })
        .catch(error => console.error(error))
})

document.addEventListener('paste', (e: ClipboardEvent) => {
    e.preventDefault()
    G.app.renderer.view.style.display = 'none'
    doorbellButton.style.display = 'none'

    util.findBPString(e.clipboardData.getData('text'))
        .catch(error => console.error(error))
        .then(loadBp)
        .then(() => {
            G.app.renderer.view.style.display = 'block'
            doorbellButton.style.display = 'block'
        })
})

keyboardJS.bind('', e => {
    if (!(e.pressedKeys.includes('modifier') && (e.pressedKeys.includes('c') || e.pressedKeys.includes('v')))) e.preventDefault()
})

keyboardJS.bind(keybinds.clear, () => {
    G.BPC.clearData()
    G.bp = new Blueprint()
    G.BPC.initBP()
})

keyboardJS.bind(keybinds.picture, () => {
    if (G.bp.isEmpty()) return

    G.BPC.enableRenderableOnChildren()
    if (G.renderOnly) G.BPC.cacheAsBitmap = false
    const texture = G.app.renderer.generateTexture(G.BPC)
    if (G.renderOnly) G.BPC.cacheAsBitmap = true
    G.BPC.updateViewportCulling()

    texture.frame = G.BPC.getEntitySpritesBounds()
    texture._updateUvs()

    G.app.renderer.plugins.extract.canvas(new PIXI.Sprite(texture)).toBlob((blob: Blob) => {
        FileSaver.saveAs(blob, G.bp.name)
        console.log('Saved BP Image')
    })
})

keyboardJS.bind('shift', () => G.keyboard.shift = true, () => G.keyboard.shift = false)

keyboardJS.bind(keybinds.overlay, () => {
    G.BPC.overlayContainer.overlay.visible = !G.BPC.overlayContainer.overlay.visible
})

keyboardJS.bind('i', () => infoContainer.toggle())

keyboardJS.bind(keybinds.closeWindow, () => { if (G.openedGUIWindow) G.openedGUIWindow.close() })

keyboardJS.bind(keybinds.inventory, () => {
    if (G.currentMouseState !== G.mouseStates.MOVING && G.currentMouseState !== G.mouseStates.PAINTING && !G.renderOnly) {
        if (G.openedGUIWindow) {
            G.openedGUIWindow.close()
        } else {
            G.inventoryContainer.toggle()
        }
    }
})

keyboardJS.bind(keybinds.focus, () => G.BPC.centerViewport())

keyboardJS.bind(keybinds.rotate, () => {
    if (G.BPC.hoverContainer &&
        (G.currentMouseState === G.mouseStates.NONE || G.currentMouseState === G.mouseStates.MOVING)
    ) {
        G.BPC.hoverContainer.rotate()
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.rotate()
    }
})

keyboardJS.bind(keybinds.pippete, () => {
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

keyboardJS.bind(keybinds.undo, () => {
    G.bp.undo(
        hist => pre(hist, 'add'),
        hist => post(hist, 'del')
    )
})

keyboardJS.bind(keybinds.redo, () => {
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

keyboardJS.bind(keybinds.w, () => G.keyboard.w = true, () => G.keyboard.w = false)
keyboardJS.bind(keybinds.a, () => G.keyboard.a = true, () => G.keyboard.a = false)
keyboardJS.bind(keybinds.s, () => G.keyboard.s = true, () => G.keyboard.s = false)
keyboardJS.bind(keybinds.d, () => G.keyboard.d = true, () => G.keyboard.d = false)
