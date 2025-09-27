// import pixi modules first (they will register themselves as extensions)
import 'pixi.js/app'
import 'pixi.js/events'
import 'pixi.js/filters'
import 'pixi.js/sprite-tiling'
import 'pixi.js/text'
import 'pixi.js/graphics'
import 'pixi.js/basis'

import { Application, TextureSource, setBasisTranscoderPath, Assets } from 'pixi.js'
import basisTranscoderJS from './basis/transcoder.1.16.4.js?url'
import basisTranscoderWASM from './basis/transcoder.1.16.4.wasm?url'
import { loadData } from './core/factorioData'
import G, { Logger } from './common/globals'
import { Entity } from './core/Entity'
import { Blueprint, oilOutpostSettings, IOilOutpostSettings } from './core/Blueprint'
import { BlueprintContainer, GridPattern } from './containers/BlueprintContainer'
import { PaintTileContainer } from './containers/PaintTileContainer'
import { UIContainer } from './UI/UIContainer'
import { Dialog } from './UI/controls/Dialog'
import { ActionRegistry, MouseButton } from './actions'

export class Editor {
    public async init(canvas: HTMLCanvasElement, logger?: Logger): Promise<void> {
        setBasisTranscoderPath({ jsUrl: basisTranscoderJS, wasmUrl: basisTranscoderWASM })

        TextureSource.defaultOptions.scaleMode = 'linear'
        TextureSource.defaultOptions.addressMode = 'repeat'

        if (logger) {
            G.logger = logger
        }

        const app = new Application()

        await Promise.all([
            fetch('/data/data.json')
                .then(res => res.text())
                .then(modules => loadData(modules)),
            app.init({
                canvas,
                preference: 'webgpu',
                resolution: window.devicePixelRatio,
                autoDensity: true,
                skipExtensionImports: true,
                roundPixels: true,
                bezierSmoothness: 0.75,
                hello: true,
            }),
            Assets.init(),
        ])

        G.app = app

        G.app.renderer.resize(window.innerWidth, window.innerHeight)
        window.addEventListener(
            'resize',
            () => G.app.renderer.resize(window.innerWidth, window.innerHeight),
            false
        )

        this.initActions()

        G.bp = new Blueprint()
        G.BPC = new BlueprintContainer(G.bp)
        G.app.stage.addChild(G.BPC)

        G.UI = new UIContainer()
        G.app.stage.addChild(G.UI)
        G.UI.showDebuggingLayer = G.debug
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

    public get limitWireReach(): boolean {
        return G.BPC.limitWireReach
    }
    public set limitWireReach(limit: boolean) {
        G.BPC.limitWireReach = limit
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

    public haveBlueprint(): boolean {
        return !G.bp.isEmpty()
    }

    public async appendBlueprint(bp: Blueprint): Promise<void> {
        const result = bp.entities.valuesArray().map(e => new Entity(e.rawEntity, G.BPC.bp))

        G.BPC.spawnPaintContainer(result, 0)
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

    private initActions(): void {
        G.actions = new ActionRegistry({
            // NONE -> PAN
            pan: {
                trigger: {
                    button: MouseButton.Left,
                },
                callbacks: {
                    onPress: () => G.BPC.panStart(),
                    onRelease: () => G.BPC.panEnd(),
                },
            },
            // PAINT
            build: {
                trigger: {
                    button: MouseButton.Left,
                },
                callbacks: {
                    onPress: () => G.BPC.buildStart(),
                    onRelease: () => G.BPC.buildEnd(),
                },
            },
            // PAINT | EDIT
            mine: {
                trigger: {
                    button: MouseButton.Right,
                },
                callbacks: {
                    onPress: () => G.BPC.mineStart(),
                    onRelease: () => G.BPC.mineEnd(),
                },
            },
            // EDIT
            openEntityGUI: {
                trigger: {
                    button: MouseButton.Left,
                },
                callbacks: {
                    onPress: () => G.BPC.openEditor(),
                },
            },
            // EDIT
            copyEntitySettings: {
                trigger: {
                    button: MouseButton.Right,
                },
                modifiers: {
                    shift: true,
                },
                callbacks: {
                    onPress: () => G.BPC.copyEntitySettings(),
                },
            },
            // EDIT
            pasteEntitySettings: {
                trigger: {
                    button: MouseButton.Left,
                },
                modifiers: {
                    shift: true,
                },
                callbacks: {
                    onPress: () => G.BPC.pasteEntitySettingsStart(),
                    onRelease: () => G.BPC.pasteEntitySettingsEnd(),
                },
                modifierCallbacks: {
                    onPress: () => G.BPC.pasteEntitySettingsModifiersStart(),
                    onRelease: () => G.BPC.pasteEntitySettingsModifiersEnd(),
                },
            },
            // any -> COPY
            copySelection: {
                trigger: {
                    button: MouseButton.Left,
                },
                modifiers: {
                    control: true,
                },
                callbacks: {
                    onPress: () => G.BPC.enterCopyMode(),
                    onRelease: () => G.BPC.exitCopyMode(),
                },
            },
            // any -> DELETE
            deleteSelection: {
                trigger: {
                    button: MouseButton.Right,
                },
                modifiers: {
                    control: true,
                },
                callbacks: {
                    onPress: () => G.BPC.enterDeleteMode(),
                    onRelease: () => G.BPC.exitDeleteMode(),
                },
            },

            moveUp: {
                trigger: {
                    code: 'KeyW',
                },
                callbacks: {
                    onPress: () => G.BPC.moveStart('up'),
                    onRelease: () => G.BPC.moveEnd('up'),
                },
            },
            moveLeft: {
                trigger: {
                    code: 'KeyA',
                },
                callbacks: {
                    onPress: () => G.BPC.moveStart('left'),
                    onRelease: () => G.BPC.moveEnd('left'),
                },
            },
            moveDown: {
                trigger: {
                    code: 'KeyS',
                },
                callbacks: {
                    onPress: () => G.BPC.moveStart('down'),
                    onRelease: () => G.BPC.moveEnd('down'),
                },
            },
            moveRight: {
                trigger: {
                    code: 'KeyD',
                },
                callbacks: {
                    onPress: () => G.BPC.moveStart('right'),
                    onRelease: () => G.BPC.moveEnd('right'),
                },
            },
            showInfo: {
                trigger: {
                    code: 'AltLeft',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.overlayContainer.toggleEntityInfoVisibility()
                        return true
                    },
                },
            },
            closeWindow: {
                trigger: {
                    code: 'Escape',
                },
                callbacks: {
                    onPress: () => {
                        Dialog.closeLast()
                        return true
                    },
                },
            },
            inventory: {
                trigger: {
                    code: 'KeyE',
                },
                callbacks: {
                    onPress: () => {
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
                        return true
                    },
                },
            },
            focus: {
                trigger: {
                    code: 'KeyF',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.centerViewport()
                        return true
                    },
                },
            },
            rotate: {
                trigger: {
                    code: 'KeyR',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.rotate(false)
                        return true
                    },
                },
            },
            reverseRotate: {
                trigger: {
                    code: 'KeyR',
                },
                modifiers: { shift: true },
                callbacks: {
                    onPress: () => {
                        G.BPC.rotate(true)
                        return true
                    },
                },
            },
            flipHorizontal: {
                trigger: {
                    code: 'KeyF',
                },
                modifiers: { shift: true },
                callbacks: {
                    onPress: () => {
                        G.BPC.flip(false)
                        return true
                    },
                },
            },
            flipVertical: {
                trigger: {
                    code: 'KeyG',
                },
                modifiers: { shift: true },
                callbacks: {
                    onPress: () => {
                        G.BPC.flip(true)
                        return true
                    },
                },
            },
            pipette: {
                trigger: {
                    code: 'KeyQ',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.pipette()
                        return true
                    },
                },
            },
            increaseTileBuildingArea: {
                trigger: {
                    code: 'BracketRight',
                },
                callbacks: {
                    onPress: () => {
                        if (G.BPC.paintContainer instanceof PaintTileContainer) {
                            G.BPC.paintContainer.increaseSize()
                        }
                        return true
                    },
                },
            },
            decreaseTileBuildingArea: {
                trigger: {
                    code: 'BracketLeft',
                },
                callbacks: {
                    onPress: () => {
                        if (G.BPC.paintContainer instanceof PaintTileContainer) {
                            G.BPC.paintContainer.decreaseSize()
                        }
                        return true
                    },
                },
            },
            undo: {
                trigger: {
                    code: 'KeyZ',
                },
                modifiers: { control: true },
                callbacks: {
                    onPress: () => {
                        G.bp.history.undo()
                        return true
                    },
                },
            },
            redo: {
                trigger: {
                    code: 'KeyY',
                },
                modifiers: { control: true },
                callbacks: {
                    onPress: () => {
                        G.bp.history.redo()
                        return true
                    },
                },
            },
            moveEntityUp: {
                trigger: {
                    code: 'ArrowUp',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.moveEntity({ x: 0, y: -1 })
                        return true
                    },
                },
            },
            moveEntityLeft: {
                trigger: {
                    code: 'ArrowLeft',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.moveEntity({ x: -1, y: 0 })
                        return true
                    },
                },
            },
            moveEntityDown: {
                trigger: {
                    code: 'ArrowDown',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.moveEntity({ x: 0, y: 1 })
                        return true
                    },
                },
            },
            moveEntityRight: {
                trigger: {
                    code: 'ArrowRight',
                },
                callbacks: {
                    onPress: () => {
                        G.BPC.moveEntity({ x: 1, y: 0 })
                        return true
                    },
                },
            },
            quickbar1: {
                trigger: { code: 'Digit1' },
                callbacks: { onPress: () => bindKeyToSlot(0) },
            },
            quickbar2: {
                trigger: { code: 'Digit2' },
                callbacks: { onPress: () => bindKeyToSlot(1) },
            },
            quickbar3: {
                trigger: { code: 'Digit3' },
                callbacks: { onPress: () => bindKeyToSlot(2) },
            },
            quickbar4: {
                trigger: { code: 'Digit4' },
                callbacks: { onPress: () => bindKeyToSlot(3) },
            },
            quickbar5: {
                trigger: { code: 'Digit5' },
                callbacks: { onPress: () => bindKeyToSlot(4) },
            },
            quickbar6: {
                trigger: { code: 'Digit1' },
                modifiers: { shift: true },
                callbacks: { onPress: () => bindKeyToSlot(5) },
            },
            quickbar7: {
                trigger: { code: 'Digit2' },
                modifiers: { shift: true },
                callbacks: { onPress: () => bindKeyToSlot(6) },
            },
            quickbar8: {
                trigger: { code: 'Digit3' },
                modifiers: { shift: true },
                callbacks: { onPress: () => bindKeyToSlot(7) },
            },
            quickbar9: {
                trigger: { code: 'Digit4' },
                modifiers: { shift: true },
                callbacks: { onPress: () => bindKeyToSlot(8) },
            },
            quickbar10: {
                trigger: { code: 'Digit5' },
                modifiers: { shift: true },
                callbacks: { onPress: () => bindKeyToSlot(9) },
            },
            changeActiveQuickbar: {
                trigger: { code: 'KeyX' },
                callbacks: {
                    onPress: () => {
                        G.UI.quickbarPanel.changeActiveQuickbar()
                        return true
                    },
                },
            },
        })

        const bindKeyToSlot = (slot: number): boolean => {
            G.UI.quickbarPanel.bindKeyToSlot(slot)
            return true
        }

        const pointerup = (e: PointerEvent): void => {
            G.actions.releaseButton(e)
        }

        window.addEventListener('pointerup', pointerup)

        const keydown = (e: KeyboardEvent): void => {
            if (e.repeat) return
            if (e.target instanceof HTMLInputElement) return
            G.actions.pressKey(e)
        }

        const keyup = (e: KeyboardEvent): void => {
            if (e.target instanceof HTMLInputElement) return
            G.actions.releaseKey(e)
        }

        const releaseAll = (): void => {
            G.actions.releaseAll()
        }

        window.addEventListener('keydown', keydown)
        window.addEventListener('keyup', keyup)
        window.addEventListener('blur', releaseAll)
    }
}
