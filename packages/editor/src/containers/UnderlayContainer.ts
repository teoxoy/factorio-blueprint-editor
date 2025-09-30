import { Sprite, Container, Texture, AlphaFilter, ColorSource } from 'pixi.js'
import FD from '../core/factorioData'
import { IPoint } from '../types'
import { VisualizationArea } from './VisualizationArea'

type Type = 'logistics0' | 'logistics1' | 'poles' | 'beacons' | 'drills'

interface IVisualizationData {
    type: Type
    radius: number
    color: ColorSource
    alpha: number
}

export class UnderlayContainer extends Container {
    private active: Type[] = []
    private readonly logistics0 = new Container()
    private readonly logistics1 = new Container()
    private readonly poles = new Container()
    private readonly beacons = new Container()
    private readonly drills = new Container()
    private readonly dummyVisualizationArea = new VisualizationArea([])

    public constructor() {
        super()

        const filter = new AlphaFilter({ alpha: VisualizationArea.ALPHA })
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
                    color: {
                        r: 0xff - 0x83 * VisualizationArea.ALPHA,
                        g: 0x88 - 0xd9 * VisualizationArea.ALPHA,
                        b: 0x00 - 0x37 * VisualizationArea.ALPHA,
                    },
                    alpha: 1,
                },
            ]
        }
        if (ed.type === 'electric-pole') {
            return [
                {
                    type: 'poles',
                    radius: ed.supply_area_distance,
                    color: 0x3755d9,
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
        if (name === 'electric-mining-drill') {
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
    }

    public activateRelatedAreas(entityName: string): void {
        const ed = FD.entities[entityName]

        const toActivate = new Set<Type>()
        for (const data of UnderlayContainer.getDataForVisualizationArea(entityName)) {
            toActivate.add(data.type)
        }

        if (ed.type === 'logistic-container') {
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
            const sprite = new Sprite(Texture.WHITE)
            sprite.tint = data.color
            sprite.alpha = data.alpha
            sprite.visible = this.active.includes(data.type)
            sprite.scale.set(data.radius * 2 * 32)
            sprite.anchor.set(0.5)
            sprite.position.set(position.x, position.y)

            this[data.type].addChild(sprite)
            return sprite
        })
        if (sprites.length === 0) return this.dummyVisualizationArea

        return new VisualizationArea(sprites)
    }
}
