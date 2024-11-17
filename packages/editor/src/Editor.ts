import './pixi'
import { Application } from '@pixi/app'
import { BaseTexture } from '@pixi/core'
import { settings } from '@pixi/settings'
import { Graphics } from '@pixi/graphics'
import { MIPMAP_MODES, SCALE_MODES, WRAP_MODES } from '@pixi/constants'
import { BasisParser } from '@pixi/basis'
import basisTranscoderJS from './basis/transcoder.7f0a00a.js?url'
import basisTranscoderWASM from './basis/transcoder.7f0a00a.wasm?url'
import { loadData } from './core/factorioData'
import G, { Logger } from './common/globals'
import { Entity } from './core/Entity'
import { Blueprint, oilOutpostSettings, IOilOutpostSettings } from './core/Blueprint'
import { BlueprintContainer, GridPattern } from './containers/BlueprintContainer'
import { UIContainer } from './UI/UIContainer'
import { Dialog } from './UI/controls/Dialog'
import { initActions } from './actions'

export class Editor {
    public async init(canvas: HTMLCanvasElement, logger?: Logger): Promise<void> {
        await Promise.all([
            fetch(`${import.meta.env.VITE_DATA_PATH}/data.json`)
                .then(res => res.text())
                .then(modules => loadData(modules)),
            BasisParser.loadTranscoder(basisTranscoderJS, basisTranscoderWASM),
        ])

        BasisParser.TRANSCODER_WORKER_POOL_LIMIT = 2

        BaseTexture.defaultOptions.mipmap = MIPMAP_MODES.ON
        BaseTexture.defaultOptions.scaleMode = SCALE_MODES.LINEAR
        BaseTexture.defaultOptions.wrapMode = WRAP_MODES.REPEAT
        Graphics.curves.adaptive = true
        settings.ROUND_PIXELS = true
        // settings.ANISOTROPIC_LEVEL = 16
        // settings.PREFER_ENV = 1
        // settings.PRECISION_VERTEX = PRECISION.HIGH
        // settings.PRECISION_FRAGMENT = PRECISION.HIGH

        if (logger) {
            G.logger = logger
        }

        G.app = new Application({
            view: canvas,
            resolution: window.devicePixelRatio,
            autoDensity: true,
            antialias: true, // for wires
        })

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
}
