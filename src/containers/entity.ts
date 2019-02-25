import G from '../common/globals'
import FD from 'factorio-data'
import { EntitySprite } from '../entitySprite'
import { UnderlayContainer } from './underlay'
import util from '../common/util'
import Entity from '../factorio-data/entity'
import * as PIXI from 'pixi.js'

const updateGroups = [
    {
        is: [
            'transport_belt', 'fast_transport_belt', 'express_transport_belt', 'splitter', 'fast_splitter',
            'express_splitter', 'underground_belt', 'fast_underground_belt', 'express_underground_belt'
        ],
        updates: [ 'transport_belt', 'fast_transport_belt', 'express_transport_belt' ]
    },
    {
        is: [ 'heat_pipe', 'nuclear_reactor', 'heat_exchanger' ],
        updates: [ 'heat_pipe', 'nuclear_reactor', 'heat_exchanger' ]
    },
    {
        has: [ 'fluid_box', 'output_fluid_box', 'fluid_boxes' ],
        updates: [ 'fluid_box', 'output_fluid_box', 'fluid_boxes' ]
    },
    {
        is: [ 'stone_wall', 'gate', 'straight_rail' ],
        updates: [ 'stone_wall', 'gate', 'straight_rail' ]
    }
]
.map(uG => {
    if (!uG.has) return uG
    const entities = Object.values(FD.entities)
    return {
        is: entities.filter(e => Object.keys(e).find(k => uG.has.includes(k))).map(e => e.name),
        updates: entities.filter(e => Object.keys(e).find(k => uG.updates.includes(k))).map(e => e.name)
    }
})
.reduce((pV, cV) => {
    cV.is.forEach(k => pV[k] = pV[k] ? util.uniqueInArray(pV[k].concat(cV.updates)) : cV.updates)
    return pV
}, {} as any)

export class EntityContainer {
    static mappings: Map<number, EntityContainer> = new Map()

    areaVisualization: PIXI.Sprite | PIXI.Sprite[] | undefined
    entityInfo: PIXI.Container
    entitySprites: EntitySprite[]

    private readonly m_Entity: Entity

    constructor(entity: Entity, sort = true) {
        this.m_Entity = entity

        EntityContainer.mappings.set(this.m_Entity.entity_number, this)

        this.entitySprites = []

        this.areaVisualization = G.BPC.underlayContainer.createNewArea(this.m_Entity.name, this.position)
        this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity.entity_number, this.position)

        this.redraw(false, sort)
        if (sort) this.redrawSurroundingEntities()

        this.m_Entity.on('recipe', () => {
            this.redrawEntityInfo()
            if (this.m_Entity.name === 'chemical_plant' || this.m_Entity.assemblerCraftsWithFluid) {
                this.redraw()
                this.redrawSurroundingEntities()
            }
        })

        this.m_Entity.on('removedConnection', (connection: IConnection) => {
            G.BPC.wiresContainer.remove(connection)
            this.redraw()
        })

        this.m_Entity.on('direction', () => {
            this.redraw()
            this.redrawSurroundingEntities()

            this.updateUndergroundLines()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
        })

        this.m_Entity.on('directionType', () => {
            this.redraw()
            this.redrawSurroundingEntities()
        })

        this.m_Entity.on('modules', () => this.redrawEntityInfo())
        this.m_Entity.on('filters', () => this.redrawEntityInfo())
        this.m_Entity.on('splitterInputPriority', () => this.redrawEntityInfo())
        this.m_Entity.on('splitterOutputPriority', () => this.redrawEntityInfo())

        this.m_Entity.on('position', (newPos: IPoint, oldPos: IPoint) => {
            this.redraw()
            this.redrawSurroundingEntities(oldPos)
            this.redrawSurroundingEntities(newPos)

            this.updateUndergroundLines()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.position.set(this.position.x, this.position.y))
        })

        this.m_Entity.on('destroy', () => {
            this.redrawSurroundingEntities()

            for (const s of this.entitySprites) s.destroy()

            EntityContainer.mappings.delete(this.m_Entity.entity_number)

            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())

            if (this.entityInfo !== undefined) this.entityInfo.destroy()
        })
    }

    public get entity(): Entity {
        return this.m_Entity
    }

    get position(): IPoint {
        return {
            x: this.m_Entity.position.x * 32,
            y: this.m_Entity.position.y * 32
        }
    }

    updateUndergroundLines() {
        G.BPC.overlayContainer.updateUndergroundLines(
            this.m_Entity.name,
            this.m_Entity.position,
            this.m_Entity.direction,
            this.m_Entity.directionType === 'output' || this.m_Entity.name === 'pipe_to_ground' ?
                (this.m_Entity.direction + 4) % 8 :
                this.m_Entity.direction
        )
    }

    redrawEntityInfo() {
        if (this.m_Entity.moduleSlots !== 0 || this.m_Entity.type === 'splitter' ||
            this.m_Entity.entityData.crafting_categories !== undefined || this.m_Entity.type === 'mining_drill' ||
            this.m_Entity.type === 'boiler' || this.m_Entity.type === 'generator' ||
            this.m_Entity.name === 'pump' || this.m_Entity.name === 'offshore_pump' ||
            this.m_Entity.name === 'arithmetic_combinator' || this.m_Entity.name === 'decider_combinator' ||
            this.m_Entity.name === 'filter_inserter' || this.m_Entity.name === 'stack_filter_inserter' ||
            this.m_Entity.type === 'splitter' || this.m_Entity.type === 'logistic_container'
        ) {
            if (this.entityInfo !== undefined) {
                this.entityInfo.destroy()
            }
            this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity.entity_number, this.position)
        }
    }

    pointerOverEventHandler() {
        G.BPC.overlayContainer.updateCursorBoxSize(this.m_Entity.size.x, this.m_Entity.size.y)
        G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
        G.BPC.overlayContainer.showCursorBox()
        G.BPC.overlayContainer.updateUndergroundLinesPosition(this.position)
        this.updateUndergroundLines()

        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = true)
    }

    pointerOutEventHandler() {
        G.BPC.overlayContainer.hideCursorBox()
        G.BPC.overlayContainer.hideUndergroundLines()
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = false)
    }

    redrawSurroundingEntities(position?: IPoint) {
        if (!updateGroups[this.m_Entity.name]) return
        if (this.m_Entity.name === 'straight_rail') {
            G.bp.entityPositionGrid.foreachOverlap(this.m_Entity.getArea(position), (entnr: number) => {
                const ent = G.bp.entities.get(entnr)
                if (ent.name === 'gate') EntityContainer.mappings.get(ent.entity_number).redraw()
            })
        } else {
            G.bp.entityPositionGrid.getSurroundingEntities(this.m_Entity.getArea(position))
                .filter(entity => updateGroups[this.m_Entity.name].includes(entity.name))
                .forEach(entity => EntityContainer.mappings.get(entity.entity_number).redraw())
        }
    }

    redraw(ignore_connections?: boolean, sort = true) {
        for (const s of this.entitySprites) s.destroy()
        this.entitySprites = []
        for (const s of EntitySprite.getParts(this.m_Entity, G.quality.hr, ignore_connections)) {
            s.setPosition(this.position)
            this.entitySprites.push(s)
            G.BPC.entitySprites.addChild(s)
        }
        if (sort) G.BPC.sortEntities()
    }
}
