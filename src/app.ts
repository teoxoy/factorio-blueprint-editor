// tslint:disable:no-import-side-effect
import 'normalize.css'
import './style.styl'

import LRentitySpritesheetPNG from 'factorio-data/data/graphics/LREntitySpritesheet.png'
import LRentitySpritesheetJSON from 'factorio-data/data/graphics/LREntitySpritesheet.json'
import HRentitySpritesheetPNG from 'factorio-data/data/graphics/HREntitySpritesheet.png'
import HRentitySpritesheetJSON from 'factorio-data/data/graphics/HREntitySpritesheet.json'
import iconSpritesheetPNG from 'factorio-data/data/graphics/iconSpritesheet.png'
import iconSpritesheetJSON from 'factorio-data/data/graphics/iconSpritesheet.json'
import utilitySpritesheetPNG from 'factorio-data/data/graphics/utilitySpritesheet.png'
import utilitySpritesheetJSON from 'factorio-data/data/graphics/utilitySpritesheet.json'
import tilesSpritesheetPNG from './textures/tilesSpritesheet.png'
import tilesSpritesheetJSON from './textures/tilesSpritesheet.json'

import * as PIXI from 'pixi.js'
import keyboardJS from 'keyboardjs'

import { Book } from './factorio-data/book'
import BPString from './factorio-data/BPString'

import util from './util'
import { InventoryContainer } from './containers/inventory'
import G from './globals'
import { EntityContainer } from './containers/entity'
import { EntityPaintContainer } from './containers/entityPaint'
import { BlueprintContainer } from './containers/blueprint'
import { ToolbarContainer } from './containers/toolbar'
import { Blueprint } from './factorio-data/blueprint'
import { EditEntityContainer } from './containers/editEntity'
import { InfoContainer } from './containers/info'
import FileSaver from 'file-saver'
import { TilePaintContainer } from './containers/tilePaint'

import * as dat from 'dat.gui'

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

const gui = new dat.GUI({
    autoPlace: false,
    hideable: false,
    closeOnTop: true
})
// gui.closed = true
document.body.appendChild(gui.domElement)

const guiBPIndex = gui
    .add({ bpIndex: 0 }, 'bpIndex', 0, 0, 1)
    .onFinishChange((value: number) => {
        if (G.book) {
            G.bp = G.book.getBlueprint(value)
            G.BPC.clearData()
            G.BPC.initBP()
        }
    })

if (localStorage.getItem('hr')) G.hr = localStorage.getItem('hr') === 'true'
gui.add(G, 'hr').onChange((val: boolean) => {
    loadingScreen.classList.add('active')
    localStorage.setItem('hr', val.toString())

    G.BPC.entities.children.forEach((eC: EntityContainer) => {
        eC.entitySprites.forEach(eS => eS.destroy())
        eC.entitySprites = []
    })

    Object.keys(PIXI.utils.TextureCache)
        .filter(texture => texture.includes('graphics/entity/'))
        .forEach(k => PIXI.utils.TextureCache[k].destroy(true))

    loadSpritesheet(
        G.hr ? HRentitySpritesheetPNG : LRentitySpritesheetPNG,
        G.hr ? HRentitySpritesheetJSON : LRentitySpritesheetJSON
    ).then(() => {
        G.BPC.entities.children.forEach((eC: EntityContainer) => eC.redraw(false, false))
        G.BPC.sortEntities()
        loadingScreen.classList.remove('active')
    })
})

if (localStorage.getItem('darkTheme')) G.colors.darkTheme = localStorage.getItem('darkTheme') === 'true'
gui.add(G.colors, 'darkTheme').onChange((val: boolean) => localStorage.setItem('darkTheme', val.toString()))

const guiKeybinds = gui.addFolder('Keybinds')

window.doorbellOptions = {
    id: '9657',
    appKey: 'z1scfSY8hpBNiIFWxBg50tkhjvFKhHMdhfGNMp6YCUZVttoLOqtrlhk4ca9asDCy',
    windowLoaded: true,
    onShow: () => keyboardJS.pause(),
    onHide: () => keyboardJS.resume(),
    onInitialized: () => {
        const doorbellButton = document.getElementById('doorbell-button')
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
                window.doorbellOptions.tags = tag.name
            }
            tagsDiv.appendChild(tagEl)
        })
        const fieldset = document.getElementById('doorbell-form').firstElementChild
        fieldset.insertBefore(tagsDiv, fieldset.lastElementChild)

        doorbellButton.classList.remove('closed')
    }
}
document.body.appendChild(Object.assign(document.createElement('script'), {
    id: 'doorbellScript',
    type: 'text/javascript',
    async: true,
    src: `https://embed.doorbell.io/button/${window.doorbellOptions['id']}?t=${Date.now()}`
}))

const loadingScreen = document.getElementById('loadingScreen')

const keybinds = JSON.parse(localStorage.getItem('keybinds')) || {
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
    d: 'd',
    increaseTileArea: ']',
    decreaseTileArea: '['
}

const keybindsProxy = new Proxy(keybinds, {
    set(obj: any, prop: string, value: string) {
        if (!value) return true
        changeKeybind(obj[prop], value)
        obj[prop] = value
        localStorage.setItem('keybinds', JSON.stringify(keybinds))
        return true

        function changeKeybind(old: string, val: string) {
            keyboardJS._listeners.filter((k: any) => k.keyCombo.sourceStr === old).forEach((k: any) => {
                keyboardJS.unbind(old, k.pressHandler, k.releaseHandler)
                keyboardJS.bind(val, k.pressHandler, k.releaseHandler)
            })
        }
    }
})
Object.keys(keybinds).forEach(k => guiKeybinds.add(keybindsProxy, k))

G.app = new PIXI.Application({
    resolution: window.devicePixelRatio,
    roundPixels: true
    // antialias: true
})

// https://github.com/pixijs/pixi.js/issues/3928
G.app.renderer.plugins.interaction.moveWhenInside = true

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

function loadSpritesheet(src: string, json: any) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.src = src
        image.onload = () => {
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = util.nearestPowerOf2(image.width)
            tempCanvas.height = util.nearestPowerOf2(image.height)
            tempCanvas.getContext('2d').drawImage(image, 0, 0)
            const baseTexture = PIXI.BaseTexture.fromCanvas(tempCanvas)
            new PIXI.Spritesheet(baseTexture, json)
                .parse(() => G.app.renderer.plugins.prepare.upload(baseTexture, resolve))
        }
        image.onerror = reject
    })
}

Promise.all([bpSource ? util.findBPString(bpSource) : undefined]
.concat([
    G.hr ? [ HRentitySpritesheetPNG, HRentitySpritesheetJSON ] :
    [ LRentitySpritesheetPNG, LRentitySpritesheetJSON ],
    [ iconSpritesheetPNG, iconSpritesheetJSON ],
    [ utilitySpritesheetPNG, utilitySpritesheetJSON ],
    [ tilesSpritesheetPNG, tilesSpritesheetJSON ]
].map(data => loadSpritesheet(data[0], data[1]))))
.then(data => {
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

        loadingScreen.classList.remove('active')
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

document.addEventListener('mousemove', e => {
    G.gridData.update(e.clientX, e.clientY, G.BPC)

    if (G.keyboard.movingViaWASD()) return

    if (G.currentMouseState === G.mouseStates.PANNING) {
        G.BPC.zoomPan.translateBy(e.movementX, e.movementY)
        G.BPC.zoomPan.updateTransform()
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

    loadingScreen.classList.add('active')

    const promise = navigator.clipboard && navigator.clipboard.writeText ?
        navigator.clipboard.readText() :
        Promise.resolve(e.clipboardData.getData('text'))

    promise
        .then(util.findBPString)
        .then(loadBp)
        .then(() => loadingScreen.classList.remove('active'))
        .catch(error => console.error(error))
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

    texture.frame = G.BPC.getBlueprintBounds()
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
        G.BPC.paintContainer = new EntityPaintContainer(entity.name,
            entity.directionType === 'output' ? (entity.direction + 4) % 8 : entity.direction,
            hoverContainer.position)
        G.BPC.paintContainer.moveAtCursor()
        G.BPC.addChild(G.BPC.paintContainer)
    } else if (G.currentMouseState === G.mouseStates.PAINTING) {
        G.BPC.paintContainer.destroy()
        G.BPC.paintContainer = undefined

        G.currentMouseState = G.mouseStates.NONE
    }
})

keyboardJS.bind(keybinds.increaseTileArea, () => {
    if (G.BPC.paintContainer instanceof TilePaintContainer) {
        G.BPC.paintContainer.increaseSize()
    }
})

keyboardJS.bind(keybinds.decreaseTileArea, () => {
    if (G.BPC.paintContainer instanceof TilePaintContainer) {
        G.BPC.paintContainer.decreaseSize()
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

// hack for calling preventDefault() on all bound keys
const keyCombos = keyboardJS._listeners.map((l: any) => l.keyCombo.sourceStr)
keyboardJS.bind(keyCombos, e => e.preventDefault())
