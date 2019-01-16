import FD from 'factorio-data'
import { AdjustmentFilter } from '@pixi/filter-adjustment'

type Type = 'logistics0' | 'logistics1' | 'poles' | 'beacons' | 'drills'

export class UnderlayContainer extends PIXI.Container {

    static getDataForVisualizationArea(name: string) {
        const type = FD.entities[name].type
        function undoBlendModeColorShift(color0: number, color1: number, alpha: number) {
            // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFunc
            // array[BLEND_MODES.NORMAL] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA]
            return color1 - color0 * (1 - alpha)
        }
        if (name === 'roboport') {
            return {
                type: ['logistics0', 'logistics1'] as Type[],
                rKey: ['construction_radius', 'logistics_radius'],
                color: [0x83D937, undoBlendModeColorShift(0xFF8800, 0x83D937, 0.25)]
            }
        }
        if (type === 'electric_pole') {
            return {
                type: 'poles' as Type,
                rKey: 'supply_area_distance',
                color: 0x33755D9
            }
        }
        if (name === 'beacon') {
            return {
                type: 'beacons' as Type,
                rKey: 'supply_area_distance',
                color: 0xD9C037
            }
        }
        if (name === 'electric_mining_drill') {
            return {
                type: 'drills' as Type,
                rKey: 'resource_searching_radius',
                color: 0x4EAD9F
            }
        }
    }

    static modifyVisualizationArea(area: PIXI.Sprite | PIXI.Sprite[] | undefined, fn: (s: PIXI.Sprite) => void) {
        if (area) {
            if (area instanceof PIXI.Sprite) fn(area)
            else for (const s of area) fn(s)
        }
    }

    active: Type[]
    logistics0: PIXI.Container
    logistics1: PIXI.Container
    poles: PIXI.Container
    beacons: PIXI.Container
    drills: PIXI.Container

    constructor() {
        super()

        this.interactive = false
        this.interactiveChildren = false

        this.active = []
        this.logistics0 = new PIXI.Container()
        this.logistics1 = new PIXI.Container()
        this.poles = new PIXI.Container()
        this.beacons = new PIXI.Container()
        this.drills = new PIXI.Container()

        const filter = new AdjustmentFilter({ alpha: 0.25 })
        this.logistics0.filters = [filter]
        this.logistics1.filters = [filter]

        this.addChild(this.logistics0, this.logistics1, this.poles, this.beacons, this.drills)
    }

    activateRelatedAreas(entityName: string) {
        const ed = FD.entities[entityName]
        const data = UnderlayContainer.getDataForVisualizationArea(entityName)
        if (data) if (data.type instanceof Array) this.active.push(...data.type); else this.active.push(data.type)
        if (ed.type === 'logistic_container') this.active.push('logistics0', 'logistics1')
        if (ed.energy_source && ed.energy_source.type === 'electric') this.active.push('poles')
        if (ed.module_specification) this.active.push('beacons')

        for (const type of this.active) {
            for (const s of this[type].children) {
                s.visible = true
            }
        }
    }

    deactivateActiveAreas() {
        for (const type of this.active) {
            for (const s of this[type].children) {
                s.visible = false
            }
        }
        this.active = []
    }

    createNewArea(entityName: string, position?: PIXI.Point | PIXI.ObservablePoint) {
        const aVData = UnderlayContainer.getDataForVisualizationArea(entityName)
        if (aVData) {
            const ed = FD.entities[entityName]
            if (aVData.type instanceof Array) {
                const aVs = []
                for (let i = 0; i < aVData.type.length; i++) {
                    const areaVisualization = createVisualizationArea(ed[aVData.rKey[i]], (aVData.color as number[])[i], position, 1)
                    this[aVData.type[i]].addChild(areaVisualization)
                    aVs.push(areaVisualization)
                }
                return aVs
            } else {
                const areaVisualization = createVisualizationArea(ed[aVData.rKey as string], aVData.color as number, position)
                this[aVData.type].addChild(areaVisualization)
                return areaVisualization
            }
        }

        function createVisualizationArea(radius: number, color: number, position?: PIXI.Point | PIXI.ObservablePoint, alpha = 0.25) {
            const aV = new PIXI.Sprite(PIXI.Texture.WHITE)
            const S = radius * 64
            aV.width = S
            aV.height = S
            aV.tint = color
            aV.anchor.set(0.5, 0.5)
            aV.alpha = alpha
            if (position) {
                aV.visible = false
                aV.position.copy(position)
            }
            return aV
        }
    }
}
