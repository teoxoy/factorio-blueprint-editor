import { TilingSprite } from '@pixi/sprite-tiling'
import { Rectangle } from '@pixi/math'
import { Container, Bounds } from '@pixi/display'
import { Graphics } from '@pixi/graphics'
import { MIPMAP_MODES, SCALE_MODES } from '@pixi/constants'
import { Renderer, RenderTexture } from '@pixi/core'
import { EventBoundary, FederatedPointerEvent } from '@pixi/events'
import FD from '../core/factorioData'
import G from '../common/globals'
import { Tile } from '../core/Tile'
import { Entity } from '../core/Entity'
import { Blueprint } from '../core/Blueprint'
import { IConnection } from '../core/WireConnections'
import { IPoint } from '../types'
import { Dialog } from '../UI/controls/Dialog'
import { Viewport } from './Viewport'
import { EntitySprite } from './EntitySprite'
import { WiresContainer } from './WiresContainer'
import { UnderlayContainer } from './UnderlayContainer'
import { EntityContainer } from './EntityContainer'
import { OverlayContainer } from './OverlayContainer'
import { PaintEntityContainer } from './PaintEntityContainer'
import { TileContainer } from './TileContainer'
import { PaintTileContainer } from './PaintTileContainer'
import { PaintWireContainer } from './PaintWireContainer'
import { Axis, IllegalFlipError, PaintContainer } from './PaintContainer'
import { PaintBlueprintContainer } from './PaintBlueprintContainer'
import { OptimizedContainer } from './OptimizedContainer'
import { GridData } from './GridData'

export enum GridPattern {
    CHECKER = 'checker',
    GRID = 'grid',
}

export enum EditorMode {
    /** Default */
    NONE,
    /** Active when an entity is being hovered */
    EDIT,
    /** Active when "painting" */
    PAINT,
    /** Active when panning */
    PAN,
    /** Active when selecting multiple entities for copy/stamp */
    COPY,
    /** Active when selecting multiple entities for deletion */
    DELETE,
}

export class BlueprintContainer extends Container {
    private static _moveSpeed = 10
    private static _gridColor = 0x303030
    private static _gridPattern = GridPattern.GRID
    private static _limitWireReach = true

    /** Nr of cunks needs to be odd because the chunk grid is offset */
    private readonly chunks = 32 - 1
    /** Chunk offset - from 0,0 - Measured in tiles */
    private readonly chunkOffset = 16
    private readonly size: IPoint = {
        x: this.chunks * 32 * 32,
        y: this.chunks * 32 * 32,
    }
    private readonly anchor: IPoint = {
        x: 0.5,
        y: 0.5,
    }
    private readonly viewport: Viewport = new Viewport(
        this.size,
        {
            x: G.app.screen.width,
            y: G.app.screen.height,
        },
        this.anchor,
        3
    )

    private _mode: EditorMode = EditorMode.NONE
    public readonly bp: Blueprint
    public readonly gridData: GridData

    // Children
    private grid: TilingSprite
    private readonly chunkGrid: TilingSprite
    private readonly tileSprites: OptimizedContainer
    private readonly tilePaintSlot: Container
    public readonly underlayContainer: UnderlayContainer
    private readonly entitySprites: OptimizedContainer
    public readonly wiresContainer: WiresContainer
    public readonly overlayContainer: OverlayContainer
    private readonly entityPaintSlot: Container
    private readonly wirePaintSlot: Container

    public hoverContainer: EntityContainer
    public paintContainer: PaintContainer

    private _entityForCopyData: Entity
    private copyModeEntities: Entity[] = []
    private deleteModeEntities: Entity[] = []
    private copyModeUpdateFn: (endX: number, endY: number) => void
    private deleteModeUpdateFn: (endX: number, endY: number) => void
    private copySettingsActive = false

    public viewportCulling = true

    // PIXI properties
    public readonly interactive = true
    public readonly interactiveChildren = false
    public readonly hitArea = new Rectangle(
        -this.size.x * this.anchor.x,
        -this.size.y * this.anchor.y,
        this.size.x,
        this.size.y
    )

    public constructor(bp: Blueprint) {
        super()
        this.bp = bp
        this.gridData = new GridData(this)

        this.grid = this.generateGrid()
        this.chunkGrid = this.generateChunkGrid(this.chunkOffset)
        this.tileSprites = new OptimizedContainer(this)
        this.tilePaintSlot = new Container()
        this.underlayContainer = new UnderlayContainer()
        this.entitySprites = new OptimizedContainer(this)
        this.wiresContainer = new WiresContainer(this.bp)
        this.overlayContainer = new OverlayContainer(this)
        this.entityPaintSlot = new Container()
        this.wirePaintSlot = new Container()

        this.addChild(
            this.grid,
            this.chunkGrid,
            this.tileSprites,
            this.tilePaintSlot,
            this.underlayContainer,
            this.entitySprites,
            this.wiresContainer,
            this.overlayContainer,
            this.entityPaintSlot,
            this.wirePaintSlot
        )

        this.on('pointerover', () => {
            if (this.mode === EditorMode.PAINT) {
                this.paintContainer.show()
            }
            this.updateHoverContainer()
        })
        this.on('pointerout', () => {
            if (this.mode === EditorMode.PAINT) {
                this.paintContainer.hide()
            }
            this.updateHoverContainer()
        })

        const onUpdate32 = (): void => {
            // Instead of decreasing the global interactionFrequency, call the over and out entity events here
            this.updateHoverContainer()
        }

        this.gridData.on('update32', onUpdate32)

        this.on('destroyed', () => {
            this.gridData.off('update32', onUpdate32)
            this.gridData.destroy()
        })

        {
            const onResize = (): void => {
                this.viewport.setSize(G.app.screen.width, G.app.screen.height)
            }

            window.addEventListener('resize', onResize, false)
            this.on('destroyed', () => {
                window.removeEventListener('resize', onResize, false)
            })
        }

        const panModule = {
            _onPan: (e: FederatedPointerEvent): void => {
                this.viewport.translateBy(e.movement.x, e.movement.y)
            },
            panStart: (): boolean => {
                if (this.mode === EditorMode.NONE) {
                    this.cursor = 'move'
                    this.setMode(EditorMode.PAN)
                    G.app.stage.on('pointermove', panModule._onPan)
                    return true
                }
            },
            panEnd: (): void => {
                if (this.mode === EditorMode.PAN) {
                    G.app.stage.off('pointermove', panModule._onPan)
                    this.setMode(EditorMode.NONE)
                    this.cursor = null
                }
            },
        }

        type Directions = {
            up: boolean
            left: boolean
            down: boolean
            right: boolean
        }

        const moveTracker = {
            directions: {
                up: false,
                left: false,
                down: false,
                right: false,
            },
            start: (dir: keyof Directions): boolean => {
                moveTracker.directions[dir] = true
                return true
            },
            end: (dir: keyof Directions): void => {
                moveTracker.directions[dir] = false
            },
        }

        {
            const panCb = (): void => {
                if (this.mode !== EditorMode.PAN) {
                    const WSXOR = moveTracker.directions.up !== moveTracker.directions.down
                    const ADXOR = moveTracker.directions.left !== moveTracker.directions.right
                    if (WSXOR || ADXOR) {
                        const finalSpeed = this.moveSpeed / (WSXOR && ADXOR ? 1.4142 : 1)
                        this.viewport.translateBy(
                            (ADXOR ? (moveTracker.directions.left ? 1 : -1) : 0) * finalSpeed,
                            (WSXOR ? (moveTracker.directions.up ? 1 : -1) : 0) * finalSpeed
                        )
                    }
                }
            }

            G.app.ticker.add(panCb)
            this.on('destroyed', () => {
                G.app.ticker.remove(panCb)
            })
        }

        let constraint: boolean
        const build = (_x: number, _y: number, dx: number, dy: number): void => {
            if (constraint === undefined) {
                const cX = Math.abs(Math.sign(dx))
                const cY = Math.abs(Math.sign(dy))
                if (cX !== cY) {
                    constraint = true
                    if (cX === 1) {
                        this.paintContainer.setPosConstraint(Axis.X)
                    } else {
                        this.paintContainer.setPosConstraint(Axis.Y)
                    }
                }
            }
            this.paintContainer.placeEntityContainer()
        }

        let draggingCreateMode = false
        const buildStart = (): boolean => {
            if (this.mode !== EditorMode.PAINT) return false

            draggingCreateMode = true

            this.paintContainer.placeEntityContainer()

            this.gridData.on('update32', build)

            return true
        }

        const buildEnd = (): void => {
            if (!draggingCreateMode) return

            draggingCreateMode = false

            constraint = undefined
            this.paintContainer.setPosConstraint(undefined)

            this.gridData.off('update32', build)
        }

        const openEditor = (): boolean => {
            if (this.mode === EditorMode.EDIT) {
                if (G.debug) {
                    console.log(this.hoverContainer.entity.serialize())
                }

                Dialog.closeAll()
                G.UI.createEditor(this.hoverContainer.entity)
                return true
            }
            return false
        }

        let remove = false
        const mineStart = (): boolean => {
            remove = true
            this.gridData.on('update32', mine)
            mine()
            return true
        }
        const mine = (): void => {
            if (remove) {
                if (this.mode === EditorMode.EDIT) {
                    this.bp.removeEntity(this.hoverContainer.entity)
                }
                if (this.mode === EditorMode.PAINT) {
                    this.paintContainer.removeContainerUnder()
                }
            }
        }
        const mineEnd = (): void => {
            remove = false
            this.gridData.off('update32', mine)
        }

        const copyEntitySettings = (): boolean => {
            const copied = this.copyEntitySettings()
            if (copied) this.updateCopyCursorBox()
            return copied
        }

        const pasteEntitySettingsStart = (): boolean => {
            const isValid = this.pasteEntitySettings()
            if (isValid) this.gridData.on('update32', this.pasteEntitySettings, this)
            return isValid
        }
        const pasteEntitySettingsEnd = (): void => {
            this.gridData.off('update32', this.pasteEntitySettings, this)
        }
        const pasteEntitySettingsModifiersStart = (): boolean => {
            this.copySettingsActive = true
            this.updateCopyCursorBox()
            return true
        }
        const pasteEntitySettingsModifiersEnd = (): void => {
            this.copySettingsActive = false
            this.updateCopyCursorBox()
        }

        enum MouseButton {
            Left = 0,
            Middle = 1,
            Right = 2,
            Fourth = 3,
            Fifth = 4,
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
        type ModifierKey = 'Control' | 'Shift' | 'Alt'
        // type WhitespaceKey = 'Enter' | 'Tab' | ' '
        // type NavigationKey =
        //     | 'ArrowDown'
        //     | 'ArrowLeft'
        //     | 'ArrowRight'
        //     | 'ArrowUp'
        //     | 'End'
        //     | 'Home'
        //     | 'PageDown'
        //     | 'PageUp'
        // type EditingKey = 'Backspace' | 'Clear' | 'Delete' | 'Insert'
        // type UIKey = 'Escape'
        // type FunctionKey =
        //     | 'F1'
        //     | 'F2'
        //     | 'F3'
        //     | 'F4'
        //     | 'F5'
        //     | 'F6'
        //     | 'F7'
        //     | 'F8'
        //     | 'F9'
        //     | 'F10'
        //     | 'F11'
        //     | 'F12'
        // type SpecialKey =
        //     | ModifierKey
        //     | WhitespaceKey
        //     | NavigationKey
        //     | EditingKey
        //     | UIKey
        //     | FunctionKey

        /**
         * Intersection of codes emitted by Firefox and Chrome on all platforms listed on
         * https://github.com/mdn/content/blob/16ab3138acadc039e018361916a8264a359be774/files/en-us/web/api/ui_events/keyboard_event_code_values/index.md
         */
        type KeyCode =
            | 'AltLeft'
            | 'AltRight'
            | 'ArrowDown'
            | 'ArrowLeft'
            | 'ArrowRight'
            | 'ArrowUp'
            | 'Backquote'
            | 'Backslash'
            | 'Backspace'
            | 'BracketLeft'
            | 'BracketRight'
            | 'CapsLock'
            | 'Comma'
            | 'ContextMenu'
            | 'ControlLeft'
            | 'ControlRight'
            | 'Delete'
            | 'Digit0'
            | 'Digit1'
            | 'Digit2'
            | 'Digit3'
            | 'Digit4'
            | 'Digit5'
            | 'Digit6'
            | 'Digit7'
            | 'Digit8'
            | 'Digit9'
            | 'End'
            | 'Enter'
            | 'Equal'
            | 'Escape'
            | 'F1'
            | 'F10'
            | 'F11'
            | 'F12'
            | 'F13'
            | 'F14'
            | 'F15'
            | 'F16'
            | 'F17'
            | 'F18'
            | 'F19'
            | 'F2'
            | 'F20'
            | 'F3'
            | 'F4'
            | 'F5'
            | 'F6'
            | 'F7'
            | 'F8'
            | 'F9'
            | 'Home'
            | 'IntlBackslash'
            | 'IntlRo'
            | 'IntlYen'
            | 'KeyA'
            | 'KeyB'
            | 'KeyC'
            | 'KeyD'
            | 'KeyE'
            | 'KeyF'
            | 'KeyG'
            | 'KeyH'
            | 'KeyI'
            | 'KeyJ'
            | 'KeyK'
            | 'KeyL'
            | 'KeyM'
            | 'KeyN'
            | 'KeyO'
            | 'KeyP'
            | 'KeyQ'
            | 'KeyR'
            | 'KeyS'
            | 'KeyT'
            | 'KeyU'
            | 'KeyV'
            | 'KeyW'
            | 'KeyX'
            | 'KeyY'
            | 'KeyZ'
            | 'Minus'
            | 'NumLock'
            | 'Numpad0'
            | 'Numpad1'
            | 'Numpad2'
            | 'Numpad3'
            | 'Numpad4'
            | 'Numpad5'
            | 'Numpad6'
            | 'Numpad7'
            | 'Numpad8'
            | 'Numpad9'
            | 'NumpadAdd'
            | 'NumpadComma'
            | 'NumpadDecimal'
            | 'NumpadDivide'
            | 'NumpadEnter'
            | 'NumpadEqual'
            | 'NumpadMultiply'
            | 'NumpadSubtract'
            | 'PageDown'
            | 'PageUp'
            | 'Period'
            | 'Quote'
            | 'Semicolon'
            | 'ShiftLeft'
            | 'ShiftRight'
            | 'Slash'
            | 'Space'
            | 'Tab'

        interface Modifiers {
            control?: boolean
            shift?: boolean
            alt?: boolean
        }

        interface Callbacks {
            /**
             * Return `true` to indicate that the action succeeded.
             *
             * Note that `onRelease` won't be called if this callback hasn't succeeded.
             */
            onPress: () => boolean
            onRelease?: () => void
        }

        interface IMouseTrigger {
            button: MouseButton // | number
        }

        interface IKeyboardTrigger {
            code: KeyCode // | string
        }

        type ITrigger = IMouseTrigger | IKeyboardTrigger

        type TriggerEvent = PointerEvent | KeyboardEvent

        interface IAction<T extends ITrigger> {
            // name: MouseActionName
            trigger: T
            modifiers?: Modifiers
            pressCb: Callbacks
            modifiersCb?: Callbacks
        }

        const objectMap = <InValue, OutValue>(
            obj: Record<string, InValue>,
            fn: (value: InValue, key: string, index: number) => OutValue
        ): Record<string, OutValue> =>
            Object.fromEntries(Object.entries(obj).map(([k, v], i) => [k, fn(v, k, i)]))

        class ActionRegistry {
            private registry: Action<ITrigger>[]
            private modifiers = {
                control: false,
                shift: false,
                alt: false,
            }

            public constructor(actions: Record<ActionName, IAction<ITrigger>>) {
                this.registry = Object.values(objectMap(actions, v => new Action(v)))
                this.registry.sort((a, b) => b.nrOfModifiers() - a.nrOfModifiers())
            }

            public pressButton(e: PointerEvent): void {
                this.press(e)
            }
            public releaseButton(e: PointerEvent): void {
                this.release(e)
            }

            public pressKey(e: KeyboardEvent): void {
                if (this.isModifier(e.key)) {
                    this.setModifiers(e.key, true)

                    for (const action of this.registry) {
                        if (action.pressMod(this.modifiers, e.key)) return
                    }
                }
                // else {
                this.press(e)
                // }
            }
            public releaseKey(e: KeyboardEvent): void {
                if (this.isModifier(e.key)) {
                    for (const action of this.registry) {
                        action.releaseMod(e.key)
                    }

                    this.setModifiers(e.key, false)
                }
                // else {
                this.release(e)
                // }
            }

            private press(e: TriggerEvent): void {
                for (const action of this.registry) {
                    if (action.press(this.modifiers, e)) {
                        if (e instanceof KeyboardEvent) {
                            e.preventDefault()
                        }
                        return
                    }
                }
            }
            private release(e: TriggerEvent): void {
                // e.preventDefault()

                for (const action of this.registry) {
                    action.release(e)
                }
            }

            private isModifier(key: string): key is ModifierKey {
                return key === 'Control' || key === 'Shift' || key === 'Alt'
            }
            private setModifiers(key: ModifierKey, value: boolean): void {
                switch (key) {
                    case 'Control':
                        this.modifiers.control = value
                        break
                    case 'Shift':
                        this.modifiers.shift = value
                        break
                    case 'Alt':
                        this.modifiers.alt = value
                        break
                }
            }

            public releaseAll(): void {
                this.modifiers.control = false
                this.modifiers.shift = false
                this.modifiers.alt = false

                for (const action of this.registry) {
                    action.forceRelease()
                }
            }
        }

        class Action<T extends ITrigger> {
            // public readonly name: MouseActionName
            private trigger: T
            private modifiers?: Modifiers
            private pressCb: Callbacks
            private modifiersCb?: Callbacks
            private isActive = false
            private isActiveModifiers = false

            public constructor(data: IAction<T>) {
                // this.name = data.name
                this.trigger = data.trigger
                this.modifiers = data.modifiers
                this.pressCb = data.pressCb
                this.modifiersCb = data.modifiersCb
            }

            private hasModifier(modifier: ModifierKey): boolean {
                if (!this.modifiers) return false
                switch (modifier) {
                    case 'Control':
                        return this.modifiers.control
                    case 'Shift':
                        return this.modifiers.shift
                    case 'Alt':
                        return this.modifiers.alt
                }
            }

            private hasModifiers(modifiers: Modifiers): boolean {
                if (!this.modifiers) return true
                if (this.modifiers.control && !modifiers.control) return false
                if (this.modifiers.shift && !modifiers.shift) return false
                if (this.modifiers.alt && !modifiers.alt) return false
                return true
            }

            public nrOfModifiers(): number {
                if (!this.modifiers) return 0
                let count = 0
                if (this.modifiers.control) count += 1
                if (this.modifiers.shift) count += 1
                if (this.modifiers.alt) count += 1
                return count
            }

            public press(modifiers: Modifiers, e: TriggerEvent): boolean {
                if (!this.triggerMatches(e)) return false
                if (!this.hasModifiers(modifiers)) return false

                // assert(!this.isActive)

                const succeeded = this.pressCb.onPress()
                this.isActive = succeeded && !!this.pressCb.onRelease
                return succeeded
            }
            public release(e: TriggerEvent): void {
                if (this.triggerMatches(e)) this.forceReleaseB()
            }
            private triggerMatches(e: TriggerEvent): boolean {
                function isMouseEvent(e: TriggerEvent): e is PointerEvent {
                    return 'button' in e
                }

                function isMouse(trigger: ITrigger): trigger is IMouseTrigger {
                    return 'button' in trigger
                }

                if (isMouseEvent(e)) {
                    return isMouse(this.trigger) && e.button === this.trigger.button
                } else {
                    return !isMouse(this.trigger) && e.code === this.trigger.code
                }
            }
            private forceReleaseB(): void {
                if (this.isActive) {
                    this.pressCb.onRelease()
                    this.isActive = false
                }
            }

            public pressMod(modifiers: Modifiers, modifier: ModifierKey): boolean {
                if (!this.modifiersCb) return false
                if (!this.hasModifier(modifier)) return false
                if (!this.hasModifiers(modifiers)) return false

                // assert(!this.isActiveModifiers)

                const succeeded = this.modifiersCb.onPress()
                this.isActiveModifiers = succeeded && !!this.modifiersCb.onRelease
                return succeeded
            }
            public releaseMod(modifier: ModifierKey): void {
                if (this.hasModifier(modifier)) this.forceReleaseM()
            }
            private forceReleaseM(): void {
                if (this.isActiveModifiers) {
                    this.modifiersCb.onRelease()
                    this.isActiveModifiers = false
                }
            }

            public forceRelease(): void {
                this.forceReleaseB()
                this.forceReleaseM()
            }
        }

        type ActionName =
            | 'pan'
            | 'build'
            | 'mine'
            | 'openEntityGUI'
            | 'copyEntitySettings'
            | 'pasteEntitySettings'
            | 'copySelection'
            | 'deleteSelection'
            | 'moveUp'
            | 'moveLeft'
            | 'moveDown'
            | 'moveRight'
            | 'showInfo'
            | 'closeWindow'
            | 'inventory'
            | 'focus'
            | 'rotate'
            | 'reverseRotate'
            | 'flipHorizontal'
            | 'flipVertical'
            | 'pipette'
            | 'increaseTileBuildingArea'
            | 'decreaseTileBuildingArea'
            | 'undo'
            | 'redo'
            | 'moveEntityUp'
            | 'moveEntityLeft'
            | 'moveEntityDown'
            | 'moveEntityRight'
            | 'quickbar1'
            | 'quickbar2'
            | 'quickbar3'
            | 'quickbar4'
            | 'quickbar5'
            | 'quickbar6'
            | 'quickbar7'
            | 'quickbar8'
            | 'quickbar9'
            | 'quickbar10'
            | 'changeActiveQuickbar'

        const reg = new ActionRegistry({
            // NONE -> PAN
            pan: {
                trigger: {
                    button: MouseButton.Left,
                },
                pressCb: {
                    onPress: panModule.panStart,
                    onRelease: panModule.panEnd,
                },
            },
            // PAINT
            build: {
                trigger: {
                    button: MouseButton.Left,
                },
                pressCb: {
                    onPress: buildStart,
                    onRelease: buildEnd,
                },
            },
            // PAINT | EDIT
            mine: {
                trigger: {
                    button: MouseButton.Right,
                },
                pressCb: {
                    onPress: mineStart,
                    onRelease: mineEnd,
                },
            },
            // EDIT
            openEntityGUI: {
                trigger: {
                    button: MouseButton.Left,
                },
                pressCb: {
                    onPress: openEditor,
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
                pressCb: {
                    onPress: copyEntitySettings,
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
                pressCb: {
                    onPress: pasteEntitySettingsStart,
                    onRelease: pasteEntitySettingsEnd,
                },
                modifiersCb: {
                    onPress: pasteEntitySettingsModifiersStart,
                    onRelease: pasteEntitySettingsModifiersEnd,
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
                pressCb: {
                    onPress: this.enterCopyMode.bind(this),
                    onRelease: this.exitCopyMode.bind(this),
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
                pressCb: {
                    onPress: this.enterDeleteMode.bind(this),
                    onRelease: this.exitDeleteMode.bind(this),
                },
            },

            moveUp: {
                trigger: {
                    code: 'KeyW',
                },
                pressCb: {
                    onPress: () => moveTracker.start('up'),
                    onRelease: () => moveTracker.end('up'),
                },
            },
            moveLeft: {
                trigger: {
                    code: 'KeyA',
                },
                pressCb: {
                    onPress: () => moveTracker.start('left'),
                    onRelease: () => moveTracker.end('left'),
                },
            },
            moveDown: {
                trigger: {
                    code: 'KeyS',
                },
                pressCb: {
                    onPress: () => moveTracker.start('down'),
                    onRelease: () => moveTracker.end('down'),
                },
            },
            moveRight: {
                trigger: {
                    code: 'KeyD',
                },
                pressCb: {
                    onPress: () => moveTracker.start('right'),
                    onRelease: () => moveTracker.end('right'),
                },
            },
            showInfo: {
                trigger: {
                    code: 'AltLeft',
                },
                pressCb: {
                    onPress: () => {
                        this.overlayContainer.toggleEntityInfoVisibility()
                        return true
                    },
                },
            },
            closeWindow: {
                trigger: {
                    code: 'Escape',
                },
                pressCb: {
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
                pressCb: {
                    onPress: () => {
                        // If there is a dialog open, assume user wants to close it
                        if (Dialog.anyOpen()) {
                            Dialog.closeLast()
                        } else {
                            G.UI.createInventory(
                                'Inventory',
                                undefined,
                                this.spawnPaintContainer.bind(this)
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
                pressCb: {
                    onPress: () => {
                        this.centerViewport()
                        return true
                    },
                },
            },
            rotate: {
                trigger: {
                    code: 'KeyR',
                },
                pressCb: {
                    onPress: () => {
                        this.rotate(false)
                        return true
                    },
                },
            },
            reverseRotate: {
                trigger: {
                    code: 'KeyR',
                },
                modifiers: { shift: true },
                pressCb: {
                    onPress: () => {
                        this.rotate(true)
                        return true
                    },
                },
            },
            flipHorizontal: {
                trigger: {
                    code: 'KeyF',
                },
                modifiers: { shift: true },
                pressCb: {
                    onPress: () => {
                        this.flip(false)
                        return true
                    },
                },
            },
            flipVertical: {
                trigger: {
                    code: 'KeyG',
                },
                modifiers: { shift: true },
                pressCb: {
                    onPress: () => {
                        this.flip(true)
                        return true
                    },
                },
            },
            pipette: {
                trigger: {
                    code: 'KeyQ',
                },
                pressCb: {
                    onPress: () => {
                        if (this.mode === EditorMode.EDIT) {
                            const entity = this.hoverContainer.entity
                            const itemName = Entity.getItemName(entity.name)
                            const direction =
                                entity.directionType === 'output'
                                    ? (entity.direction + 4) % 8
                                    : entity.direction
                            this.spawnPaintContainer(itemName, direction)
                        } else if (this.mode === EditorMode.PAINT) {
                            this.paintContainer.destroy()
                        }
                        this.exitCopyMode(true)
                        this.exitDeleteMode(true)
                        return true
                    },
                },
            },
            increaseTileBuildingArea: {
                trigger: {
                    code: 'BracketRight',
                },
                pressCb: {
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
                pressCb: {
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
                pressCb: {
                    onPress: () => {
                        this.bp.history.undo()
                        return true
                    },
                },
            },
            redo: {
                trigger: {
                    code: 'KeyY',
                },
                modifiers: { control: true },
                pressCb: {
                    onPress: () => {
                        this.bp.history.redo()
                        return true
                    },
                },
            },
            moveEntityUp: {
                trigger: {
                    code: 'ArrowUp',
                },
                pressCb: {
                    onPress: () => {
                        if (this.mode === EditorMode.EDIT) {
                            this.hoverContainer.entity.moveBy({ x: 0, y: -1 })
                        }
                        return true
                    },
                },
            },
            moveEntityLeft: {
                trigger: {
                    code: 'ArrowLeft',
                },
                pressCb: {
                    onPress: () => {
                        if (this.mode === EditorMode.EDIT) {
                            this.hoverContainer.entity.moveBy({ x: -1, y: 0 })
                        }
                        return true
                    },
                },
            },
            moveEntityDown: {
                trigger: {
                    code: 'ArrowDown',
                },
                pressCb: {
                    onPress: () => {
                        if (this.mode === EditorMode.EDIT) {
                            this.hoverContainer.entity.moveBy({ x: 0, y: 1 })
                        }
                        return true
                    },
                },
            },
            moveEntityRight: {
                trigger: {
                    code: 'ArrowRight',
                },
                pressCb: {
                    onPress: () => {
                        if (this.mode === EditorMode.EDIT) {
                            this.hoverContainer.entity.moveBy({ x: 1, y: 0 })
                        }
                        return true
                    },
                },
            },
            quickbar1: {
                trigger: { code: 'Digit1' },
                pressCb: { onPress: () => bindKeyToSlot(0) },
            },
            quickbar2: {
                trigger: { code: 'Digit2' },
                pressCb: { onPress: () => bindKeyToSlot(1) },
            },
            quickbar3: {
                trigger: { code: 'Digit3' },
                pressCb: { onPress: () => bindKeyToSlot(2) },
            },
            quickbar4: {
                trigger: { code: 'Digit4' },
                pressCb: { onPress: () => bindKeyToSlot(3) },
            },
            quickbar5: {
                trigger: { code: 'Digit5' },
                pressCb: { onPress: () => bindKeyToSlot(4) },
            },
            quickbar6: {
                trigger: { code: 'Digit1' },
                modifiers: { shift: true },
                pressCb: { onPress: () => bindKeyToSlot(5) },
            },
            quickbar7: {
                trigger: { code: 'Digit2' },
                modifiers: { shift: true },
                pressCb: { onPress: () => bindKeyToSlot(6) },
            },
            quickbar8: {
                trigger: { code: 'Digit3' },
                modifiers: { shift: true },
                pressCb: { onPress: () => bindKeyToSlot(7) },
            },
            quickbar9: {
                trigger: { code: 'Digit4' },
                modifiers: { shift: true },
                pressCb: { onPress: () => bindKeyToSlot(8) },
            },
            quickbar10: {
                trigger: { code: 'Digit5' },
                modifiers: { shift: true },
                pressCb: { onPress: () => bindKeyToSlot(9) },
            },
            changeActiveQuickbar: {
                trigger: { code: 'KeyX' },
                pressCb: {
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

        // copySelection mousebutton 'modifier+lclick'
        // deleteSelection mousebutton 'modifier+rclick'
        // pan mousebutton 'lclick'
        // build mousebutton 'lclick'
        // mine mousebutton 'rclick'
        // openEntityGUI mousebutton 'lclick'
        // copyEntitySettings mousebutton 'shift+rclick'
        // pasteEntitySettings modifier+mousebutton 'shift+lclick'

        // 'moveUp', 'w'
        // 'moveLeft', 'a'
        // 'moveDown', 's'
        // 'moveRight', 'd'
        // 'showInfo', 'alt'
        // 'closeWindow', 'esc'
        // 'inventory', 'e'
        // 'focus', 'f'
        // 'rotate', 'r'
        // 'reverseRotate', 'shift+r'
        // 'flipHorizontal', 'shift+f'
        // 'flipVertical', 'shift+g'
        // 'pipette', 'q'
        // 'increaseTileBuildingArea', ']'
        // 'decreaseTileBuildingArea', '['
        // 'undo', 'modifier+z'
        // 'redo', 'modifier+y'
        // 'moveEntityUp', 'up'
        // 'moveEntityLeft', 'left'
        // 'moveEntityDown', 'down'
        // 'moveEntityRight', 'right'
        // 'quickbar1', '1'
        // 'quickbar2', '2'
        // 'quickbar3', '3'
        // 'quickbar4', '4'
        // 'quickbar5', '5'
        // 'quickbar6', 'shift+1'
        // 'quickbar7', 'shift+2'
        // 'quickbar8', 'shift+3'
        // 'quickbar9', 'shift+4'
        // 'quickbar10', 'shift+5'
        // 'changeActiveQuickbar', 'x'

        const onWheel = (e: WheelEvent): void => {
            e.preventDefault()
            e.stopPropagation()

            if (Math.sign(e.deltaY) === 1) {
                this.zoom(false)
            } else {
                this.zoom(true)
            }
        }

        this.addEventListener('wheel', onWheel, { passive: false })
        this.on('destroyed', () => {
            this.removeEventListener('wheel', onWheel)
        })

        const pointerdown = (e: PointerEvent): void => {
            reg.pressButton(e)
        }

        const pointerup = (e: PointerEvent): void => {
            reg.releaseButton(e)
        }

        this.addEventListener('pointerdown', pointerdown)
        this.on('destroyed', () => {
            this.removeEventListener('pointerdown', pointerdown)
        })

        window.addEventListener('pointerup', pointerup)
        this.on('destroyed', () => {
            window.removeEventListener('pointerup', pointerup)
        })

        const keydown = (e: KeyboardEvent): void => {
            if (e.repeat) return
            if (e.target instanceof HTMLInputElement) return
            console.log('down', e.code)
            reg.pressKey(e)
        }

        const keyup = (e: KeyboardEvent): void => {
            if (e.target instanceof HTMLInputElement) return
            console.log('up', e.code)
            reg.releaseKey(e)
        }

        const releaseAll = (): void => {
            console.log('releaseAll')
            reg.releaseAll()
        }

        window.addEventListener('keydown', keydown)
        window.addEventListener('keyup', keyup)
        window.addEventListener('blur', releaseAll)
        this.on('destroyed', () => {
            window.removeEventListener('keydown', keydown)
            window.removeEventListener('keyup', keyup)
            window.removeEventListener('blur', releaseAll)
        })
    }

    public get entityForCopyData(): Entity {
        return this._entityForCopyData
    }

    public copyEntitySettings(): boolean {
        if (this.mode === EditorMode.EDIT) {
            // Store reference to source entity
            this._entityForCopyData = this.hoverContainer.entity
            return true
        }
        return false
    }

    public pasteEntitySettings(): boolean {
        if (this._entityForCopyData && this.mode === EditorMode.EDIT) {
            // Hand over reference of source entity to target entity for pasting data
            this.hoverContainer.entity.pasteSettings(this._entityForCopyData)
            return true
        }
        return false
    }

    public getViewportScale(): number {
        return this.viewport.getCurrentScale()
    }

    /** screen to world */
    public toWorld(x: number, y: number): [number, number] {
        const t = this.viewport.getTransform()
        return [(x - t.tx) / t.a, (y - t.ty) / t.d]
    }

    public override render(renderer: Renderer): void {
        if (this.viewport.update()) {
            this.gridData.recalculate()
        }

        const destinationFrame = renderer.screen
        const sourceFrame = destinationFrame.clone()
        const t = this.viewport.getTransform()
        sourceFrame.x -= t.tx / t.a
        sourceFrame.y -= t.ty / t.d
        sourceFrame.width /= t.a
        sourceFrame.height /= t.d

        const previous = renderer.renderTexture.current
        for (const child of this.children) {
            renderer.renderTexture.bind(null, sourceFrame, destinationFrame)
            child.render(renderer)
        }
        renderer.batch.flush()
        renderer.renderTexture.bind(previous)
    }

    public get mode(): EditorMode {
        return this._mode
    }

    private setMode(mode: EditorMode): void {
        this._mode = mode
        this.emit('mode', mode)
    }

    public rotate(ccw: boolean): void {
        if (this.mode === EditorMode.EDIT) {
            this.hoverContainer.entity.rotate(ccw, true)
        } else if (this.mode === EditorMode.PAINT) {
            if (this.paintContainer.canFlipOrRotateByCopying()) {
                const copies = this.paintContainer.rotatedEntities(ccw)
                this.paintContainer.destroy()
                this.spawnPaintContainer(copies, 0)
            } else {
                this.paintContainer.rotate(ccw)
            }
        }
    }

    public flip(vertical: boolean): void {
        if (this.mode === EditorMode.PAINT && this.paintContainer.canFlipOrRotateByCopying()) {
            try {
                const copies = this.paintContainer.flippedEntities(vertical)
                this.paintContainer.destroy()
                this.spawnPaintContainer(copies, 0)
            } catch (e) {
                if (e instanceof IllegalFlipError) {
                    G.logger({ text: e.message, type: 'warning' })
                } else {
                    throw e
                }
            }
        }
    }

    public enterCopyMode(): boolean {
        if (this.mode === EditorMode.COPY) return false
        if (this.mode === EditorMode.PAINT) this.paintContainer.destroy()

        this.updateHoverContainer(true)
        this.setMode(EditorMode.COPY)

        this.overlayContainer.showSelectionArea(0x00d400)

        const startPos = { x: this.gridData.x32, y: this.gridData.y32 }
        this.copyModeUpdateFn = (endX: number, endY: number) => {
            const X = Math.min(startPos.x, endX)
            const Y = Math.min(startPos.y, endY)
            const W = Math.abs(endX - startPos.x) + 1
            const H = Math.abs(endY - startPos.y) + 1

            for (const e of this.copyModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
            }

            this.copyModeEntities = this.bp.entityPositionGrid.getEntitiesInArea({
                x: X + W / 2,
                y: Y + H / 2,
                w: W,
                h: H,
            })

            for (const e of this.copyModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = 'copy'
            }
        }
        this.copyModeUpdateFn(startPos.x, startPos.y)
        this.gridData.on('update32', this.copyModeUpdateFn)

        return true
    }

    public exitCopyMode(cancel = false): void {
        if (this.mode !== EditorMode.COPY) return

        this.overlayContainer.hideSelectionArea()
        this.gridData.off('update32', this.copyModeUpdateFn)

        this.setMode(EditorMode.NONE)
        this.updateHoverContainer()

        if (!cancel && this.copyModeEntities.length !== 0) {
            this.spawnPaintContainer(this.copyModeEntities)
        }
        for (const e of this.copyModeEntities) {
            EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
        }
        this.copyModeEntities = []
    }

    public enterDeleteMode(): boolean {
        if (this.mode === EditorMode.DELETE) return false
        if (this.mode === EditorMode.PAINT) this.paintContainer.destroy()

        this.updateHoverContainer(true)
        this.setMode(EditorMode.DELETE)

        this.overlayContainer.showSelectionArea(0xff3200)

        const startPos = { x: this.gridData.x32, y: this.gridData.y32 }
        this.deleteModeUpdateFn = (endX: number, endY: number) => {
            const X = Math.min(startPos.x, endX)
            const Y = Math.min(startPos.y, endY)
            const W = Math.abs(endX - startPos.x) + 1
            const H = Math.abs(endY - startPos.y) + 1

            for (const e of this.deleteModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
            }

            this.deleteModeEntities = this.bp.entityPositionGrid.getEntitiesInArea({
                x: X + W / 2,
                y: Y + H / 2,
                w: W,
                h: H,
            })

            for (const e of this.deleteModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = 'not_allowed'
            }
        }
        this.deleteModeUpdateFn(startPos.x, startPos.y)
        this.gridData.on('update32', this.deleteModeUpdateFn)

        return true
    }

    public exitDeleteMode(cancel = false): void {
        if (this.mode !== EditorMode.DELETE) return

        this.overlayContainer.hideSelectionArea()
        this.gridData.off('update32', this.deleteModeUpdateFn)

        this.setMode(EditorMode.NONE)
        this.updateHoverContainer()

        if (cancel) {
            for (const e of this.deleteModeEntities) {
                EntityContainer.mappings.get(e.entityNumber).cursorBox = undefined
            }
        } else {
            this.bp.removeEntities(this.deleteModeEntities)
        }

        this.deleteModeEntities = []
    }

    public zoom(zoomIn = true): void {
        const zoomFactor = 0.1
        this.viewport.setScaleCenter(this.gridData.x, this.gridData.y)
        this.viewport.zoomBy(zoomFactor * (zoomIn ? 1 : -1))
    }

    private get isPointerInside(): boolean {
        const boundary = new EventBoundary(G.app.stage)
        const container = boundary.hitTest(this.gridData.x, this.gridData.y)
        return container === this
    }

    private updateHoverContainer(forceRemove = false): void {
        const removeHoverContainer = (): void => {
            this.hoverContainer.pointerOutEventHandler()
            this.hoverContainer = undefined
            this.setMode(EditorMode.NONE)
            this.cursor = 'inherit'
            this.updateCopyCursorBox()
        }

        if (forceRemove || !this.isPointerInside) {
            if (this.hoverContainer) {
                removeHoverContainer()
            }
            return
        }

        if (!this.bp) return

        const entity = this.bp.entityPositionGrid.getEntityAtPosition({
            x: this.gridData.x32,
            y: this.gridData.y32,
        })
        const eC = entity ? EntityContainer.mappings.get(entity.entityNumber) : undefined

        if (eC && this.hoverContainer === eC) return

        if (this.mode === EditorMode.EDIT) {
            removeHoverContainer()
        }

        if (eC && this.mode === EditorMode.NONE) {
            this.hoverContainer = eC
            this.setMode(EditorMode.EDIT)
            this.cursor = 'pointer'
            eC.pointerOverEventHandler()
            this.updateCopyCursorBox()
        }
    }

    private updateCopyCursorBox(): void {
        this.overlayContainer.updateCopyCursorBox(!this.copySettingsActive)
    }

    public get moveSpeed(): number {
        return BlueprintContainer._moveSpeed
    }

    public set moveSpeed(speed: number) {
        BlueprintContainer._moveSpeed = speed
    }

    public get gridColor(): number {
        return BlueprintContainer._gridColor
    }

    public set gridColor(color: number) {
        BlueprintContainer._gridColor = color
        this.grid.tint = color
    }

    public get gridPattern(): GridPattern {
        return BlueprintContainer._gridPattern
    }

    public set gridPattern(pattern: GridPattern) {
        BlueprintContainer._gridPattern = pattern

        const index = this.getChildIndex(this.grid)
        const old = this.grid
        this.grid = this.generateGrid()
        this.addChildAt(this.grid, index)
        old.destroy()
    }

    public get limitWireReach(): boolean {
        return BlueprintContainer._limitWireReach
    }

    public set limitWireReach(limit: boolean) {
        BlueprintContainer._limitWireReach = limit
    }

    private generateGrid(pattern = this.gridPattern): TilingSprite {
        const gridGraphics =
            pattern === 'checker'
                ? new Graphics()
                      .beginFill(0x808080)
                      .drawRect(0, 0, 32, 32)
                      .drawRect(32, 32, 32, 32)
                      .endFill()
                      .beginFill(0xffffff)
                      .drawRect(0, 32, 32, 32)
                      .drawRect(32, 0, 32, 32)
                      .endFill()
                : new Graphics()
                      .beginFill(0x808080)
                      .drawRect(0, 0, 32, 32)
                      .endFill()
                      .beginFill(0xffffff)
                      .drawRect(1, 1, 31, 31)
                      .endFill()

        const renderTexture = RenderTexture.create({
            width: gridGraphics.width,
            height: gridGraphics.height,
        })

        renderTexture.baseTexture.mipmap = MIPMAP_MODES.POW2
        G.app.renderer.render(gridGraphics, { renderTexture })

        const grid = new TilingSprite(renderTexture, this.size.x, this.size.y)
        grid.anchor.set(this.anchor.x, this.anchor.y)

        grid.tint = this.gridColor

        return grid
    }

    private generateChunkGrid(chunkOffset: number): TilingSprite {
        const W = 32 * 32
        const H = 32 * 32
        const gridGraphics = new Graphics()
            .lineStyle({ width: 2, color: 0x000000 })
            .moveTo(0, 0)
            .lineTo(W, 0)
            .lineTo(W, H)
            .lineTo(0, H)
            .lineTo(0, 0)

        const renderTexture = RenderTexture.create({
            width: W,
            height: H,
        })

        renderTexture.baseTexture.mipmap = MIPMAP_MODES.POW2
        G.app.renderer.render(gridGraphics, { renderTexture })

        // Add one more chunk to the size because of the offset
        const grid = new TilingSprite(renderTexture, this.size.x + W, this.size.y + H)
        // Offset chunk grid
        grid.position.set(chunkOffset * 32, chunkOffset * 32)
        grid.anchor.set(this.anchor.x, this.anchor.y)

        return grid
    }

    public initBP(): void {
        // Render Bp
        for (const [, e] of this.bp.entities) {
            new EntityContainer(e, false)
        }
        for (const [, t] of this.bp.tiles) {
            new TileContainer(t)
        }

        const onCreateEntity = (entity: Entity): void => {
            new EntityContainer(entity)
            this.updateHoverContainer()
        }
        const onRemoveEntity = (): void => {
            this.updateHoverContainer()
        }
        const onCreateTile = (tile: Tile): TileContainer => new TileContainer(tile)

        this.bp.on('create-entity', onCreateEntity)
        this.bp.on('remove-entity', onRemoveEntity)
        this.bp.on('create-tile', onCreateTile)

        const onConnectionCreated = (hash: string, connection: IConnection): void => {
            this.wiresContainer.connect(hash, connection)
        }
        const onConnectionRemoved = (hash: string, connection: IConnection): void => {
            this.wiresContainer.disconnect(hash, connection)
        }
        this.bp.wireConnections.on('create', onConnectionCreated)
        this.bp.wireConnections.on('remove', onConnectionRemoved)
        this.bp.wireConnections.forEach((connection, hash) =>
            this.wiresContainer.add(hash, connection)
        )

        this.on('destroyed', () => {
            this.bp.off('create-entity', onCreateEntity)
            this.bp.off('remove-entity', onRemoveEntity)
            this.bp.off('create-tile', onCreateTile)

            this.bp.wireConnections.off('create', onConnectionCreated)
            this.bp.wireConnections.off('remove', onConnectionRemoved)
        })

        this.sortEntities()
        this.centerViewport()
    }

    public destroy(): void {
        super.destroy({ children: true })
    }

    public addEntitySprites(entitySprites: EntitySprite[], sort = true): void {
        this.entitySprites.addChild(...entitySprites)
        if (sort) {
            this.sortEntities()
        }
    }

    public addTileSprites(tileSprites: EntitySprite[]): void {
        this.tileSprites.addChild(...tileSprites)
    }

    private sortEntities(): void {
        this.entitySprites.children.sort(EntitySprite.compareFn)
    }

    public transparentEntities(bool = true): void {
        const alpha = bool ? 0.5 : 1
        this.entitySprites.alpha = alpha
        this.wiresContainer.alpha = alpha
        this.overlayContainer.alpha = alpha
    }

    public centerViewport(): void {
        const bounds = this.bp.isEmpty()
            ? new Rectangle(-16 * 32, -16 * 32, 32 * 32, 32 * 32)
            : this.getBlueprintBounds()

        this.viewport.centerViewPort(
            {
                x: bounds.width,
                y: bounds.height,
            },
            {
                x: (this.size.x - bounds.width) / 2 - bounds.x,
                y: (this.size.y - bounds.height) / 2 - bounds.y,
            }
        )
    }

    public getBlueprintBounds(): Rectangle {
        const bounds = new Bounds()

        const addBounds = (sprite: EntitySprite): void => {
            const sB = new Bounds()
            sB.minX = sprite.cachedBounds[0]
            sB.minY = sprite.cachedBounds[1]
            sB.maxX = sprite.cachedBounds[2]
            sB.maxY = sprite.cachedBounds[3]
            bounds.addBounds(sB)
        }

        this.entitySprites.children.forEach(addBounds)
        this.tileSprites.children.forEach(addBounds)

        const rect = bounds.getRectangle(new Rectangle())

        const X = Math.floor(rect.x / 32) * 32
        const Y = Math.floor(rect.y / 32) * 32
        const W = Math.ceil((rect.width + rect.x - X) / 32) * 32
        const H = Math.ceil((rect.height + rect.y - Y) / 32) * 32
        return new Rectangle(X, Y, W, H)
    }

    public getPicture(): Promise<Blob> {
        if (this.bp.isEmpty()) return

        const region = this.getBlueprintBounds()
        this.viewportCulling = false
        // swap our custom render method with the original one
        const _render = this.render
        this.render = super.render
        const texture = G.app.renderer.generateTexture(this, {
            scaleMode: SCALE_MODES.LINEAR,
            resolution: 1,
            region,
        })
        this.render = _render
        this.viewportCulling = true

        const extract = G.app.renderer.extract
        // @ts-ignore - This is in fact an HTMLCanvasElement
        const canvas: HTMLCanvasElement = extract.canvas(texture)

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
                resolve(blob)
            })
        })
    }

    public spawnPaintContainer(itemNameOrEntities: string | Entity[], direction = 0): void {
        if (this.mode === EditorMode.PAINT) {
            this.paintContainer.destroy()
        }

        this.updateHoverContainer(true)
        this.setMode(EditorMode.PAINT)
        this.cursor = 'pointer'

        if (typeof itemNameOrEntities === 'string') {
            const itemData = FD.items[itemNameOrEntities]
            const wireResult = itemData.wire_count && itemNameOrEntities
            const tileResult = itemData.place_as_tile && itemData.place_as_tile.result
            const placeResult = itemData.place_result || tileResult || wireResult

            if (wireResult) {
                this.paintContainer = new PaintWireContainer(this, placeResult)
                this.wirePaintSlot.addChild(this.paintContainer)
            } else if (tileResult) {
                this.paintContainer = new PaintTileContainer(this, placeResult)
                this.tilePaintSlot.addChild(this.paintContainer)
            } else {
                this.paintContainer = new PaintEntityContainer(this, placeResult, direction)
                this.entityPaintSlot.addChild(this.paintContainer)
            }
        } else {
            this.paintContainer = new PaintBlueprintContainer(this, itemNameOrEntities)
            this.entityPaintSlot.addChild(this.paintContainer)
        }

        if (!this.isPointerInside) {
            this.paintContainer.hide()
        }

        this.paintContainer.on('destroyed', () => {
            this.paintContainer = undefined
            this.setMode(EditorMode.NONE)
            this.updateHoverContainer()
            this.cursor = 'inherit'
        })
    }
}
