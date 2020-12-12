import * as PIXI from 'pixi.js'
import { BasisLoader } from '@pixi/basis'
import basisTranscoderJS from '@pixi/basis/assets/basis_transcoder.js'
import basisTranscoderWASM from '@pixi/basis/assets/basis_transcoder.wasm'
import { loadData } from './core/factorioData'
import G from './common/globals'
import { Entity } from './core/Entity'
import { Blueprint, oilOutpostSettings, IOilOutpostSettings } from './core/Blueprint'
import { PaintTileContainer } from './containers/PaintTileContainer'
import { BlueprintContainer, EditorMode, GridPattern } from './containers/BlueprintContainer'
import { UIContainer } from './UI/UIContainer'
import { Dialog } from './UI/controls/Dialog'
import { initActions, registerAction } from './actions'

export class Editor {
    public async init(canvas: HTMLCanvasElement): Promise<void> {
        await Promise.all([
            fetch(`${G.STATIC_URL}data.json`)
                .then(res => res.text())
                .then(modules => loadData(modules)),
            BasisLoader.loadTranscoder(basisTranscoderJS, basisTranscoderWASM),
        ])

        BasisLoader.TRANSCODER_WORKER_POOL_LIMIT = 2

        PIXI.settings.MIPMAP_TEXTURES = PIXI.MIPMAP_MODES.ON
        PIXI.settings.ROUND_PIXELS = true
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR
        PIXI.settings.WRAP_MODE = PIXI.WRAP_MODES.REPEAT
        PIXI.settings.RENDER_OPTIONS.antialias = true // for wires
        PIXI.settings.RENDER_OPTIONS.resolution = window.devicePixelRatio
        PIXI.settings.RENDER_OPTIONS.autoDensity = true
        PIXI.GRAPHICS_CURVES.adaptive = true
        PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
        // PIXI.settings.ANISOTROPIC_LEVEL = 16
        // PIXI.settings.PREFER_ENV = 1
        // PIXI.settings.PRECISION_VERTEX = PIXI.PRECISION.HIGH
        // PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH

        G.app = new PIXI.Application({ view: canvas })

        // https://github.com/pixijs/pixi.js/issues/3928
        // G.app.renderer.plugins.interaction.moveWhenInside = true
        // G.app.renderer.plugins.interaction.interactionFrequency = 1

        G.app.renderer.resize(window.innerWidth, window.innerHeight)
        window.addEventListener(
            'resize',
            () => G.app.renderer.resize(window.innerWidth, window.innerHeight),
            false
        )

        G.bp = new Blueprint()
        G.BPC = new BlueprintContainer(G.bp)
        G.app.stage.addChild(G.BPC)

        G.UI = new UIContainer()
        G.app.stage.addChild(G.UI)
        G.UI.showDebuggingLayer = G.debug

        initActions(canvas)
        this.registerActions()
    }

    public get moveSpeed(): number {
        return G.BPC.moveSpeed
    }
    public set moveSpeed(speed: number) {
        G.BPC.moveSpeed = speed
    }

    public get gridColor(): number {
        return G.BPC.gridColor
    }
    public set gridColor(color: number) {
        G.BPC.gridColor = color
    }

    public get gridPattern(): GridPattern {
        return G.BPC.gridPattern
    }
    public set gridPattern(pattern: GridPattern) {
        G.BPC.gridPattern = pattern
    }

    public get quickbarItems(): string[] {
        return G.UI.quickbarPanel.serialize()
    }
    public set quickbarItems(items: string[]) {
        G.UI.quickbarPanel.generateSlots(items)
    }

    public get oilOutpostSettings(): IOilOutpostSettings {
        return oilOutpostSettings
    }
    public set oilOutpostSettings(settings: IOilOutpostSettings) {
        for (const key in oilOutpostSettings) {
            if (settings[key]) {
                oilOutpostSettings[key] = settings[key]
            }
        }
    }

    public get debug(): boolean {
        return G.debug
    }
    public set debug(debug: boolean) {
        G.debug = debug
        G.UI.showDebuggingLayer = debug
        if (G.bp) {
            G.bp.history.logging = debug
        }
    }

    public getPicture(): Promise<Blob> {
        return G.BPC.getPicture()
    }

    public async loadBlueprint(bp: Blueprint): Promise<void> {
        const last = G.BPC
        const i = G.app.stage.getChildIndex(last)

        G.bp = bp

        G.BPC = new BlueprintContainer(bp)
        G.BPC.initBP()
        Dialog.closeAll()
        G.app.stage.addChildAt(G.BPC, i)
        last.destroy()
    }

    private registerActions(): void {
        registerAction('moveUp', 'w')
        registerAction('moveLeft', 'a')
        registerAction('moveDown', 's')
        registerAction('moveRight', 'd')

        registerAction('showInfo', 'alt').bind({
            press: () => G.BPC.overlayContainer.toggleEntityInfoVisibility(),
        })

        registerAction('closeWindow', 'esc').bind({
            press: () => Dialog.closeLast(),
        })

        registerAction('inventory', 'e').bind({
            press: () => {
                // If there is a dialog open, assume user wants to close it
                if (Dialog.anyOpen()) {
                    Dialog.closeLast()
                } else {
                    G.UI.createInventory(
                        'Inventory',
                        undefined,
                        G.BPC.spawnPaintContainer.bind(G.BPC)
                    )
                }
            },
        })

        registerAction('focus', 'f').bind({ press: () => G.BPC.centerViewport() })

        registerAction('rotate', 'r').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    G.BPC.hoverContainer.entity.rotate(false, true)
                } else if (G.BPC.mode === EditorMode.PAINT) {
                    G.BPC.paintContainer.rotate()
                }
            },
        })

        registerAction('reverseRotate', 'shift+r').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    G.BPC.hoverContainer.entity.rotate(true, true)
                } else if (G.BPC.mode === EditorMode.PAINT) {
                    G.BPC.paintContainer.rotate(true)
                }
            },
        })

        registerAction('pipette', 'q').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    const entity = G.BPC.hoverContainer.entity
                    const itemName = Entity.getItemName(entity.name)
                    const direction =
                        entity.directionType === 'output'
                            ? (entity.direction + 4) % 8
                            : entity.direction
                    G.BPC.spawnPaintContainer(itemName, direction)
                } else if (G.BPC.mode === EditorMode.PAINT) {
                    G.BPC.paintContainer.destroy()
                }
                G.BPC.exitCopyMode(true)
                G.BPC.exitDeleteMode(true)
            },
        })

        registerAction('increaseTileBuildingArea', ']').bind({
            press: () => {
                if (G.BPC.paintContainer instanceof PaintTileContainer) {
                    G.BPC.paintContainer.increaseSize()
                }
            },
        })

        registerAction('decreaseTileBuildingArea', '[').bind({
            press: () => {
                if (G.BPC.paintContainer instanceof PaintTileContainer) {
                    G.BPC.paintContainer.decreaseSize()
                }
            },
        })

        registerAction('undo', 'modifier+z').bind({
            press: () => G.bp.history.undo(),
            repeat: true,
        })

        registerAction('redo', 'modifier+y').bind({
            press: () => G.bp.history.redo(),
            repeat: true,
        })

        registerAction('copySelection', 'modifier+lclick').bind({
            press: () => G.BPC.enterCopyMode(),
            release: () => G.BPC.exitCopyMode(),
        })
        registerAction('deleteSelection', 'modifier+rclick').bind({
            press: () => G.BPC.enterDeleteMode(),
            release: () => G.BPC.exitDeleteMode(),
        })

        registerAction('pan', 'lclick').bind({
            press: () => G.BPC.enterPanMode(),
            release: () => G.BPC.exitPanMode(),
        })

        registerAction('zoomIn', 'wheelNeg').bind({
            press: () => G.BPC.zoom(true),
        })

        registerAction('zoomOut', 'wheelPos').bind({
            press: () => G.BPC.zoom(false),
        })

        registerAction('build', 'lclick').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.PAINT) {
                    G.BPC.paintContainer.placeEntityContainer()
                }
            },
            repeat: true,
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
            repeat: true,
        })

        registerAction('moveEntityUp', 'up').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    G.BPC.hoverContainer.entity.moveBy({ x: 0, y: -1 })
                }
            },
        })
        registerAction('moveEntityLeft', 'left').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    G.BPC.hoverContainer.entity.moveBy({ x: -1, y: 0 })
                }
            },
        })
        registerAction('moveEntityDown', 'down').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    G.BPC.hoverContainer.entity.moveBy({ x: 0, y: 1 })
                }
            },
        })
        registerAction('moveEntityRight', 'right').bind({
            press: () => {
                if (G.BPC.mode === EditorMode.EDIT) {
                    G.BPC.hoverContainer.entity.moveBy({ x: 1, y: 0 })
                }
            },
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
            },
        })

        registerAction('copyEntitySettings', 'shift+rclick').bind({
            press: () => {
                G.BPC.copyEntitySettings()
                G.BPC.overlayContainer.destroyCopyCursorBox()
            },
        })

        registerAction('pasteEntitySettings', 'shift+lclick').bind({
            press: () => G.BPC.pasteEntitySettings(),
            repeat: true,
        })

        registerAction('tryPasteEntitySettings', 'shift').bind({
            press: () => G.BPC.overlayContainer.createCopyCursorBox(),
            release: () => G.BPC.overlayContainer.destroyCopyCursorBox(),
        })

        registerAction('quickbar1', '1').bind({ press: () => G.UI.quickbarPanel.bindKeyToSlot(0) })
        registerAction('quickbar2', '2').bind({ press: () => G.UI.quickbarPanel.bindKeyToSlot(1) })
        registerAction('quickbar3', '3').bind({ press: () => G.UI.quickbarPanel.bindKeyToSlot(2) })
        registerAction('quickbar4', '4').bind({ press: () => G.UI.quickbarPanel.bindKeyToSlot(3) })
        registerAction('quickbar5', '5').bind({ press: () => G.UI.quickbarPanel.bindKeyToSlot(4) })
        registerAction('quickbar6', 'shift+1').bind({
            press: () => G.UI.quickbarPanel.bindKeyToSlot(5),
        })
        registerAction('quickbar7', 'shift+2').bind({
            press: () => G.UI.quickbarPanel.bindKeyToSlot(6),
        })
        registerAction('quickbar8', 'shift+3').bind({
            press: () => G.UI.quickbarPanel.bindKeyToSlot(7),
        })
        registerAction('quickbar9', 'shift+4').bind({
            press: () => G.UI.quickbarPanel.bindKeyToSlot(8),
        })
        registerAction('quickbar10', 'shift+5').bind({
            press: () => G.UI.quickbarPanel.bindKeyToSlot(9),
        })
        registerAction('changeActiveQuickbar', 'x').bind({
            press: () => G.UI.quickbarPanel.changeActiveQuickbar(),
        })
    }
}
