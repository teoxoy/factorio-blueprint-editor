import * as PIXI from 'pixi.js'
import G from './common/globals'
import U from './common/util'
import { Book } from './core/Book'
import { Entity } from './core/Entity'
import { Blueprint, oilOutpostSettings, IOilOutpostSettings } from './core/Blueprint'
import * as bpString from './core/bpString'
import { ModdedBlueprintError, TrainBlueprintError } from './core/bpString'
import { EntityContainer } from './containers/EntityContainer'
import { PaintTileContainer } from './containers/PaintTileContainer'
import { BlueprintContainer, EditorMode, GridPattern } from './containers/BlueprintContainer'
import { UIContainer } from './UI/UIContainer'
import { Dialog } from './UI/controls/Dialog'
import {
    initActions,
    registerAction,
    callAction,
    forEachAction,
    resetKeybinds,
    importKeybinds,
    exportKeybinds
} from './actions'
import { spritesheetsLoader } from './spritesheetsLoader'

function initEditor(canvas: HTMLCanvasElement): Promise<void[]> {
    PIXI.settings.MIPMAP_TEXTURES = PIXI.MIPMAP_MODES.ON
    PIXI.settings.ROUND_PIXELS = true
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR
    PIXI.settings.WRAP_MODE = PIXI.WRAP_MODES.REPEAT
    PIXI.settings.RENDER_OPTIONS.antialias = true // for wires
    PIXI.settings.RENDER_OPTIONS.resolution = window.devicePixelRatio
    PIXI.settings.RENDER_OPTIONS.autoDensity = true
    PIXI.GRAPHICS_CURVES.adaptive = true
    PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
    PIXI.settings.ANISOTROPIC_LEVEL = 16
    // PIXI.settings.PREFER_ENV = 1
    // PIXI.settings.PRECISION_VERTEX = PIXI.PRECISION.HIGH
    // PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH

    G.app = new PIXI.Application({ view: canvas })

    // https://github.com/pixijs/pixi.js/issues/3928
    // G.app.renderer.plugins.interaction.moveWhenInside = true
    // G.app.renderer.plugins.interaction.interactionFrequency = 1

    G.app.renderer.resize(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', () => G.app.renderer.resize(window.innerWidth, window.innerHeight), false)

    G.BPC = new BlueprintContainer()
    G.app.stage.addChild(G.BPC)

    G.UI = new UIContainer()
    G.app.stage.addChild(G.UI)
    G.UI.showDebuggingLayer = G.debug

    initActions(canvas)
    registerActions()

    window.addEventListener('unload', () => {
        G.app.stop()
        G.app.renderer.textureGC.unload(G.app.stage)
        G.app.destroy()
    })

    return Promise.all(
        // Load spritesheets
        spritesheetsLoader.getAllPromises()
    )
}

function loadBlueprint(bp: Blueprint): void {
    G.bp = bp

    G.BPC.clearData()
    G.BPC.initBP()
    Dialog.closeAll()
}

function registerActions(): void {
    registerAction('moveUp', 'w')
    registerAction('moveLeft', 'a')
    registerAction('moveDown', 's')
    registerAction('moveRight', 'd')

    registerAction('showInfo', 'alt').bind({
        press: () => G.BPC.overlayContainer.toggleEntityInfoVisibility()
    })

    registerAction('closeWindow', 'esc').bind({
        press: () => {
            Dialog.closeLast()
        }
    })

    registerAction('inventory', 'e').bind({
        press: () => {
            // If there is a dialog open, assume user wants to close it
            if (Dialog.anyOpen()) {
                Dialog.closeLast()
            } else {
                G.UI.createInventory('Inventory', undefined, G.BPC.spawnPaintContainer.bind(G.BPC))
            }
        }
    })

    registerAction('focus', 'f').bind({ press: () => G.BPC.centerViewport() })

    registerAction('rotate', 'r').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.BPC.hoverContainer.entity.rotate(false, true)
            } else if (G.BPC.mode === EditorMode.PAINT) {
                G.BPC.paintContainer.rotate()
            }
        }
    })

    registerAction('reverseRotate', 'shift+r').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.BPC.hoverContainer.entity.rotate(true, true)
            } else if (G.BPC.mode === EditorMode.PAINT) {
                G.BPC.paintContainer.rotate(true)
            }
        }
    })

    registerAction('pipette', 'q').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                const entity = G.BPC.hoverContainer.entity
                const itemName = Entity.getItemName(entity.name)
                const direction = entity.directionType === 'output' ? (entity.direction + 4) % 8 : entity.direction
                G.BPC.spawnPaintContainer(itemName, direction)
            } else if (G.BPC.mode === EditorMode.PAINT) {
                G.BPC.paintContainer.destroy()
            }
            G.BPC.exitCopyMode(true)
            G.BPC.exitDeleteMode(true)
        }
    })

    registerAction('increaseTileBuildingArea', ']').bind({
        press: () => {
            if (G.BPC.paintContainer instanceof PaintTileContainer) {
                G.BPC.paintContainer.increaseSize()
            }
        }
    })

    registerAction('decreaseTileBuildingArea', '[').bind({
        press: () => {
            if (G.BPC.paintContainer instanceof PaintTileContainer) {
                G.BPC.paintContainer.decreaseSize()
            }
        }
    })

    registerAction('undo', 'modifier+z').bind({
        press: () => {
            G.bp.history.undo()
        },
        repeat: true
    })

    registerAction('redo', 'modifier+y').bind({
        press: () => {
            G.bp.history.redo()
        },
        repeat: true
    })

    registerAction('copySelection', 'modifier+lclick').bind({
        press: () => G.BPC.enterCopyMode(),
        release: () => G.BPC.exitCopyMode()
    })
    registerAction('deleteSelection', 'modifier+rclick').bind({
        press: () => G.BPC.enterDeleteMode(),
        release: () => G.BPC.exitDeleteMode()
    })

    registerAction('pan', 'lclick').bind({
        press: () => G.BPC.enterPanMode(),
        release: () => G.BPC.exitPanMode()
    })

    registerAction('zoomIn', 'wheelNeg').bind({
        press: () => {
            G.BPC.zoom(true)
        }
    })

    registerAction('zoomOut', 'wheelPos').bind({
        press: () => {
            G.BPC.zoom(false)
        }
    })

    registerAction('build', 'lclick').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.PAINT) {
                G.BPC.paintContainer.placeEntityContainer()
            }
        },
        repeat: true
    })

    registerAction('mine', 'rclick').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.bp.removeEntity(G.BPC.hoverContainer.entity)
            }
            if (G.BPC.mode === EditorMode.PAINT) {
                G.BPC.paintContainer.removeContainerUnder()
            }
        },
        repeat: true
    })

    registerAction('moveEntityUp', 'up').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.BPC.hoverContainer.entity.moveBy({ x: 0, y: -1 })
            }
        }
    })
    registerAction('moveEntityLeft', 'left').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.BPC.hoverContainer.entity.moveBy({ x: -1, y: 0 })
            }
        }
    })
    registerAction('moveEntityDown', 'down').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.BPC.hoverContainer.entity.moveBy({ x: 0, y: 1 })
            }
        }
    })
    registerAction('moveEntityRight', 'right').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                G.BPC.hoverContainer.entity.moveBy({ x: 1, y: 0 })
            }
        }
    })

    registerAction('openEntityGUI', 'lclick').bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                if (G.debug) {
                    console.log(G.BPC.hoverContainer.entity.serialize())
                }

                Dialog.closeAll()
                G.UI.createEditor(G.BPC.hoverContainer.entity)
            }
        }
    })

    let entityForCopyData: Entity | undefined
    const copyEntitySettingsAction = registerAction('copyEntitySettings', 'shift+rclick')
    copyEntitySettingsAction.bind({
        press: () => {
            if (G.BPC.mode === EditorMode.EDIT) {
                // Store reference to source entity
                entityForCopyData = G.BPC.hoverContainer.entity
            }
        }
    })
    registerAction('pasteEntitySettings', 'shift+lclick').bind({
        press: () => {
            if (entityForCopyData && G.BPC.mode === EditorMode.EDIT) {
                // Hand over reference of source entity to target entity for pasting data
                G.BPC.hoverContainer.entity.pasteSettings(entityForCopyData)
            }
        },
        repeat: true
    })
    // TODO: Move this somewhere else - I don't think this is the right place for it
    {
        let copyCursorBox: PIXI.Container | undefined
        const deferred = new U.Deferred()
        const createCopyCursorBox = (): void => {
            if (
                copyCursorBox === undefined &&
                G.BPC.mode === EditorMode.EDIT &&
                entityForCopyData &&
                EntityContainer.mappings.has(entityForCopyData.entityNumber) &&
                G.BPC.hoverContainer.entity.canPasteSettings(entityForCopyData)
            ) {
                const srcEnt = EntityContainer.mappings.get(entityForCopyData.entityNumber)
                copyCursorBox = G.BPC.overlayContainer.createCursorBox(srcEnt.position, entityForCopyData.size, 'copy')
                Promise.race([
                    deferred.promise,
                    new Promise(resolve => copyEntitySettingsAction.bind({ press: resolve, once: true })),
                    new Promise(resolve => G.BPC.once('removeHoverContainer', resolve))
                ]).then(() => {
                    deferred.reset()
                    copyCursorBox.destroy()
                    copyCursorBox = undefined
                })
            }
        }
        const action = registerAction('tryPasteEntitySettings', 'shift')
        action.bind({ press: createCopyCursorBox, release: () => deferred.resolve() })
        G.BPC.on('createHoverContainer', () => {
            if (action.pressed) {
                createCopyCursorBox()
            }
        })
    }

    registerAction('quickbar1', '1').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(0) })
    registerAction('quickbar2', '2').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(1) })
    registerAction('quickbar3', '3').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(2) })
    registerAction('quickbar4', '4').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(3) })
    registerAction('quickbar5', '5').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(4) })
    registerAction('quickbar6', 'shift+1').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(5) })
    registerAction('quickbar7', 'shift+2').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(6) })
    registerAction('quickbar8', 'shift+3').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(7) })
    registerAction('quickbar9', 'shift+4').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(8) })
    registerAction('quickbar10', 'shift+5').bind({ press: () => G.UI.quickbarContainer.bindKeyToSlot(9) })
    registerAction('changeActiveQuickbar', 'x').bind({ press: () => G.UI.quickbarContainer.changeActiveQuickbar() })
}

const getPicture = (): Promise<Blob> => G.BPC.getPicture()

const getMoveSpeed = (): number => G.BPC.moveSpeed
const setMoveSpeed = (speed: number): void => {
    G.BPC.moveSpeed = speed
}
const getGridColor = (): number => G.BPC.gridColor
const setGridColor = (color: number): void => {
    G.BPC.gridColor = color
}
const getGridPattern = (): GridPattern => G.BPC.gridPattern
const setGridPattern = (pattern: GridPattern): void => {
    G.BPC.gridPattern = pattern
}

const getQuickbarItems = (): string[] => G.UI.quickbarContainer.serialize()
const setQuickbarItems = (items: string[]): void => {
    G.UI.quickbarContainer.generateSlots(items)
}

const getOilOutpostSettings = (): IOilOutpostSettings => oilOutpostSettings
const setOilOutpostSettings = (settings: IOilOutpostSettings): void => {
    Object.keys(oilOutpostSettings).forEach(k => {
        if (settings[k]) {
            oilOutpostSettings[k] = settings[k]
        }
    })
}

const isDebuggingOn = (): boolean => G.debug
const setDebugging = (on: boolean): void => {
    G.debug = on
    G.UI.showDebuggingLayer = on
    if (G.bp) {
        G.bp.history.logging = on
    }
}

export { Book, Blueprint, ModdedBlueprintError, TrainBlueprintError, GridPattern }
export default {
    initEditor,
    bpStringEncodeDecode: bpString,
    loadBlueprint,
    registerAction,
    getPicture,
    getMoveSpeed,
    setMoveSpeed,
    getGridColor,
    setGridColor,
    getGridPattern,
    setGridPattern,
    getQuickbarItems,
    setQuickbarItems,
    getOilOutpostSettings,
    setOilOutpostSettings,
    isDebuggingOn,
    setDebugging,
    callAction,
    forEachAction,
    resetKeybinds,
    importKeybinds,
    exportKeybinds
}
