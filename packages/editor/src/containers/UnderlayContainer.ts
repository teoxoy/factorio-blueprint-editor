import * as PIXI from 'pixi.js'
import FD from '@fbe/factorio-data'
import { VisualizationArea } from './VisualizationArea'

type Type = 'logistics0' | 'logistics1' | 'poles' | 'beacons' | 'drills'

interface IVisualizationData {
    type: Type
    radius: number
    color: number
    alpha: number
}

export class UnderlayContainer extends PIXI.Container {
    private active: Type[] = []
    private readonly logistics0 = new PIXI.Container()
    private readonly logistics1 = new PIXI.Container()
    private readonly poles = new PIXI.Container()
    private readonly beacons = new PIXI.Container()
    private readonly drills = new PIXI.Container()
    private readonly dummyVisualizationArea = new VisualizationArea([])

    public constructor() {
        super()

        const filter = new PIXI.filters.AlphaFilter(VisualizationArea.ALPHA)
        this.logistics0.filters = [filter]
        this.logistics1.filters = [filter]

        this.addChild(this.logistics0, this.logistics1, this.poles, this.beacons, this.drills)
    }

    private static getDataForVisualizationArea(name: string): IVisualizationData[] {
        const ed = FD.entities[name]

        if (name === 'roboport') {
            return [
                {
                    type: 'logistics0',
                    radius: ed.construction_radius,
                    color: 0x83d937,
                    alpha: 1,
                },
                {
                    type: 'logistics1',
                    radius: ed.logistics_radius,
                    color: undoBlendModeColorShift(0xff8800, 0x83d937, VisualizationArea.ALPHA),
                    alpha: 1,
                },
            ]
        }
        if (ed.type === 'electric_pole') {
            return [
                {
                    type: 'poles',
                    radius: ed.supply_area_distance,
                    color: 0x33755d9,
                    alpha: VisualizationArea.ALPHA,
                },
            ]
        }
        if (name === 'beacon') {
            return [
                {
                    type: 'beacons',
                    radius: ed.supply_area_distance,
                    color: 0xd9c037,
                    alpha: VisualizationArea.ALPHA,
                },
            ]
        }
        if (name === 'electric_mining_drill') {
            return [
                {
                    type: 'drills',
                    radius: ed.resource_searching_radius,
                    color: 0x4ead9f,
                    alpha: VisualizationArea.ALPHA,
                },
            ]
        }

        return []

        function undoBlendModeColorShift(color0: number, color1: number, alpha: number): number {
            // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFunc
            // array[BLEND_MODES.NORMAL] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA]
            return color1 - color0 * (1 - alpha)
        }
    }

    public activateRelatedAreas(entityName: string): void {
        const ed = FD.entities[entityName]

        const toActivate = new Set<Type>()
        for (const data of UnderlayContainer.getDataForVisualizationArea(entityName)) {
            toActivate.add(data.type)
        }

        if (ed.type === 'logistic_container') {
            toActivate.add('logistics0')
            toActivate.add('logistics1')
        }
        if (ed.energy_source && ed.energy_source.type === 'electric') {
            toActivate.add('poles')
        }
        if (ed.module_specification) {
            toActivate.add('beacons')
        }

        for (const type of this.active) {
            toActivate.delete(type)
        }

        for (const type of toActivate) {
            for (const s of this[type].children) {
                s.visible = true
            }
        }

        this.active.push(...toActivate)
    }

    public deactivateActiveAreas(): void {
        for (const type of this.active) {
            for (const s of this[type].children) {
                s.visible = false
            }
        }
        this.active = []
    }

    public create(entityName: string, position: IPoint): VisualizationArea {
        const sprites = UnderlayContainer.getDataForVisualizationArea(entityName).map(data => {
            const sprite = new PIXI.Sprite(PIXI.Texture.WHITE)
            sprite.tint = data.color
            sprite.alpha = data.alpha
            sprite.visible = this.active.includes(data.type)
            sprite.scale.set(data.radius * 4)
            sprite.anchor.set(0.5)
            sprite.position.set(position.x, position.y)

            this[data.type].addChild(sprite)
            return sprite
        })
        if (sprites.length === 0) return this.dummyVisualizationArea

        return new VisualizationArea(sprites)
    }
}
