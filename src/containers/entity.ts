import FD from 'factorio-data'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import { EntitySprite } from '../entitySprite'
import util from '../common/util'
import Entity from '../factorio-data/entity'
import { UnderlayContainer } from './underlay'
import { CursorBoxType } from './overlay'

const updateGroups = [
    {
        is: [
            'transport_belt',
            'fast_transport_belt',
            'express_transport_belt',
            'splitter',
            'fast_splitter',
            'express_splitter',
            'underground_belt',
            'fast_underground_belt',
            'express_underground_belt',
            'loader',
            'fast_loader',
            'express_loader'
        ],
        updates: [
            'transport_belt',
            'fast_transport_belt',
            'express_transport_belt',
            'splitter',
            'fast_splitter',
            'express_splitter',
            'underground_belt',
            'fast_underground_belt',
            'express_underground_belt',
            'loader',
            'fast_loader',
            'express_loader'
        ]
    },
    {
        is: ['heat_pipe', 'nuclear_reactor', 'heat_exchanger', 'heat_interface'],
        updates: ['heat_pipe', 'nuclear_reactor', 'heat_exchanger', 'heat_interface']
    },
    {
        has: ['fluid_box', 'output_fluid_box', 'fluid_boxes'],
        updates: ['fluid_box', 'output_fluid_box', 'fluid_boxes']
    },
    {
        is: ['stone_wall', 'gate', 'straight_rail'],
        updates: ['stone_wall', 'gate', 'straight_rail']
    }
]
    .map(uG => {
        if (!uG.has) {
            return uG
        }
        const entities = Object.values(FD.entities)
        return {
            is: entities.filter(e => Object.keys(e).find(k => uG.has.includes(k))).map(e => e.name),
            updates: entities.filter(e => Object.keys(e).find(k => uG.updates.includes(k))).map(e => e.name)
        }
    })
    .reduce(
        (pV: Record<string, string[]>, cV) => {
            cV.is.forEach(k => {
                pV[k] = pV[k] ? util.uniqueInArray(pV[k].concat(cV.updates)) : cV.updates
            })
            return pV
        },
        {} as Record<string, string[]>
    )

export class EntityContainer {
    public static readonly mappings: Map<number, EntityContainer> = new Map()

    private areaVisualization: PIXI.Sprite | PIXI.Sprite[]
    private entityInfo: PIXI.Container
    private entitySprites: EntitySprite[] = []
    /** This is only a reference */
    private cursorBoxContainer: PIXI.Container
    /** This is only a reference */
    private undergroundLine: PIXI.Container

    private readonly m_Entity: Entity

    public constructor(entity: Entity, sort = true) {
        this.m_Entity = entity

        EntityContainer.mappings.set(this.m_Entity.entityNumber, this)

        this.areaVisualization = G.BPC.underlayContainer.createNewArea(this.m_Entity.name, this.position)
        this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity.entityNumber, this.position)

        this.redraw(false, sort)
        if (sort) {
            this.redrawSurroundingEntities()
        }

        this.m_Entity.on('recipe', () => {
            this.redrawEntityInfo()
            if (this.m_Entity.name === 'chemical_plant' || this.m_Entity.assemblerCraftsWithFluid) {
                this.redraw()
                this.redrawSurroundingEntities()
            }
        })

        this.m_Entity.on('direction', () => {
            this.redraw()
            this.redrawSurroundingEntities()

            this.updateUndergroundLine()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
        })

        this.m_Entity.on('directionType', () => {
            this.redraw()
            this.redrawSurroundingEntities()

            this.updateUndergroundLine()
        })

        this.m_Entity.on('modules', () => this.redrawEntityInfo())
        this.m_Entity.on('filters', () => this.redrawEntityInfo())
        this.m_Entity.on('splitterInputPriority', () => this.redrawEntityInfo())
        this.m_Entity.on('splitterOutputPriority', () => this.redrawEntityInfo())

        this.m_Entity.on('position', (newPos: IPoint, oldPos: IPoint) => {
            this.redraw()
            this.redrawSurroundingEntities(oldPos)
            this.redrawSurroundingEntities(newPos)

            this.updateUndergroundLine()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s =>
                s.position.set(this.position.x, this.position.y)
            )
        })

        this.m_Entity.on('destroy', () => {
            this.redrawSurroundingEntities()

            for (const s of this.entitySprites) {
                s.destroy()
            }

            EntityContainer.mappings.delete(this.m_Entity.entityNumber)

            this.cursorBox = undefined

            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())

            if (this.entityInfo !== undefined) {
                this.entityInfo.destroy()
            }
        })
    }

    public get entity(): Entity {
        return this.m_Entity
    }

    public get position(): IPoint {
        return {
            x: this.m_Entity.position.x * 32,
            y: this.m_Entity.position.y * 32
        }
    }

    public set cursorBox(type: CursorBoxType) {
        if (this.cursorBoxContainer) {
            this.cursorBoxContainer.destroy()
        }
        if (type !== undefined) {
            this.cursorBoxContainer = G.BPC.overlayContainer.createCursorBox(this.position, this.m_Entity.size, type)
        }
    }

    private createUndergroundLine(): void {
        this.undergroundLine = G.BPC.overlayContainer.createUndergroundLine(
            this.m_Entity.name,
            this.m_Entity.position,
            this.m_Entity.direction,
            this.m_Entity.directionType === 'output' || this.m_Entity.name === 'pipe_to_ground'
                ? (this.m_Entity.direction + 4) % 8
                : this.m_Entity.direction
        )
    }

    private destroyUndergroundLine(): void {
        if (this.undergroundLine) {
            this.undergroundLine.destroy()
            this.undergroundLine = undefined
        }
    }

    private updateUndergroundLine(): void {
        if (G.BPC.hoverContainer === this) {
            this.destroyUndergroundLine()
            this.createUndergroundLine()
        }
    }

    public showVisualizationArea(): void {
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => {
            s.visible = true
        })
    }

    public hideVisualizationArea(): void {
        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => {
            s.visible = false
        })
    }

    private redrawEntityInfo(): void {
        if (
            this.m_Entity.moduleSlots !== 0 ||
            this.m_Entity.type === 'splitter' ||
            this.m_Entity.entityData.crafting_categories !== undefined ||
            this.m_Entity.type === 'mining_drill' ||
            this.m_Entity.type === 'boiler' ||
            this.m_Entity.type === 'generator' ||
            this.m_Entity.name === 'pump' ||
            this.m_Entity.name === 'offshore_pump' ||
            this.m_Entity.name === 'arithmetic_combinator' ||
            this.m_Entity.name === 'decider_combinator' ||
            this.m_Entity.name === 'filter_inserter' ||
            this.m_Entity.name === 'stack_filter_inserter' ||
            this.m_Entity.type === 'splitter' ||
            this.m_Entity.type === 'logistic_container'
        ) {
            if (this.entityInfo !== undefined) {
                this.entityInfo.destroy()
            }
            this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity.entityNumber, this.position)
        }

        G.infoEntityPanel.updateVisualization(this.m_Entity)
    }

    public pointerOverEventHandler(): void {
        this.cursorBox = 'regular'
        this.createUndergroundLine()

        G.infoEntityPanel.updateVisualization(this.m_Entity)
        this.showVisualizationArea()
    }

    public pointerOutEventHandler(): void {
        this.cursorBox = undefined
        this.destroyUndergroundLine()

        G.infoEntityPanel.updateVisualization(undefined)
        this.hideVisualizationArea()
    }

    private redrawSurroundingEntities(position: IPoint = this.m_Entity.position): void {
        if (!updateGroups[this.m_Entity.name]) {
            return
        }
        const area = {
            x: position.x,
            y: position.y,
            w: this.m_Entity.size.x,
            h: this.m_Entity.size.y
        }
        if (this.m_Entity.name === 'straight_rail') {
            G.bp.entityPositionGrid
                .getEntitiesInArea(area)
                .filter(e => e.name === 'gate')
                .forEach(entity => EntityContainer.mappings.get(entity.entityNumber).redraw())
        } else {
            const entities = G.bp.entityPositionGrid.getSurroundingEntities(area)

            // We need to update a larger area because belt endings might change
            if (
                this.m_Entity.type === 'transport_belt' ||
                this.m_Entity.type === 'splitter' ||
                this.m_Entity.type === 'underground_belt' ||
                this.m_Entity.type === 'loader'
            ) {
                entities.push(
                    ...G.bp.entityPositionGrid.getSurroundingEntities({
                        ...area,
                        w: area.w + 2,
                        h: area.h + 2
                    })
                )
            }

            entities
                .filter(entity => updateGroups[this.m_Entity.name].includes(entity.name))
                .forEach(entity => {
                    EntityContainer.mappings.get(entity.entityNumber).redraw()
                    if (entity.type === 'transport_belt') {
                        G.BPC.wiresContainer.update(entity)
                    }
                })
        }
    }

    public redraw(ignoreConnections?: boolean, sort?: boolean): void {
        for (const s of this.entitySprites) {
            s.destroy()
        }
        this.entitySprites = []
        for (const s of EntitySprite.getParts(this.m_Entity, G.quality.hr, ignoreConnections)) {
            s.setPosition(this.position)
            this.entitySprites.push(s)
        }
        G.BPC.addEntitySprites(this.entitySprites, sort)
    }
}
