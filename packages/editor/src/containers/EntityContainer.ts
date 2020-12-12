import * as PIXI from 'pixi.js'
import FD, { CursorBoxType } from '../core/factorioData'
import G from '../common/globals'
import { Entity } from '../core/Entity'
import { EntitySprite } from './EntitySprite'
import { VisualizationArea } from './VisualizationArea'

export class EntityContainer {
    public static readonly mappings: Map<number, EntityContainer> = new Map()

    private static _updateGroups: Map<string, Set<string>>
    private static get updateGroups(): Map<string, Set<string>> {
        if (!EntityContainer._updateGroups) {
            EntityContainer._updateGroups = EntityContainer.generateUpdateGroups()
        }
        return EntityContainer._updateGroups
    }

    private visualizationArea: VisualizationArea
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

        this.visualizationArea = G.BPC.underlayContainer.create(this.m_Entity.name, this.position)
        this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity, this.position)

        this.redraw(false, sort)
        if (sort) {
            this.redrawSurroundingEntities()
        }

        const onRecipeChange = (): void => {
            this.redrawEntityInfo()
            if (this.m_Entity.name === 'chemical_plant' || this.m_Entity.assemblerCraftsWithFluid) {
                this.redraw()
                this.redrawSurroundingEntities()
            }
        }

        const onDirectionChange = (): void => {
            this.redraw()
            this.redrawSurroundingEntities()

            this.updateUndergroundLine()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
        }

        const onDirectionTypeChange = (): void => {
            this.redraw()
            this.redrawSurroundingEntities()

            this.updateUndergroundLine()
        }

        const onPositionChange = (newPos: IPoint, oldPos: IPoint): void => {
            this.redraw()
            this.redrawSurroundingEntities(oldPos)
            this.redrawSurroundingEntities(newPos)

            this.updateUndergroundLine()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
            this.visualizationArea.moveTo(this.position)
        }

        const onModulesChange = (): void => {
            this.redrawEntityInfo()
            if (this.m_Entity.name === 'beacon') {
                this.redraw()
            }
        }

        const onEntityDestroy = (): void => {
            this.redrawSurroundingEntities()

            for (const s of this.entitySprites) {
                s.destroy()
            }

            EntityContainer.mappings.delete(this.m_Entity.entityNumber)

            this.cursorBox = undefined

            this.visualizationArea.destroy()

            if (this.entityInfo !== undefined) {
                this.entityInfo.destroy()
            }
        }

        this.m_Entity.on('recipe', onRecipeChange)
        this.m_Entity.on('direction', onDirectionChange)
        this.m_Entity.on('directionType', onDirectionTypeChange)
        this.m_Entity.on('position', onPositionChange)
        this.m_Entity.on('modules', onModulesChange)

        this.m_Entity.on('filters', this.redrawEntityInfo, this)
        this.m_Entity.on('splitterInputPriority', this.redrawEntityInfo, this)
        this.m_Entity.on('splitterOutputPriority', this.redrawEntityInfo, this)

        this.m_Entity.on('destroy', onEntityDestroy)

        G.BPC.on('destroy', () => {
            this.m_Entity.off('recipe', onRecipeChange)
            this.m_Entity.off('direction', onDirectionChange)
            this.m_Entity.off('directionType', onDirectionTypeChange)
            this.m_Entity.off('position', onPositionChange)
            this.m_Entity.off('modules', onModulesChange)

            this.m_Entity.off('filters', this.redrawEntityInfo, this)
            this.m_Entity.off('splitterInputPriority', this.redrawEntityInfo, this)
            this.m_Entity.off('splitterOutputPriority', this.redrawEntityInfo, this)

            this.m_Entity.off('destroy', onEntityDestroy)
        })
    }

    private static generateUpdateGroups(): Map<string, Set<string>> {
        const mappigs = [
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
                    'express_loader',
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
                    'express_loader',
                ],
            },
            {
                is: ['heat_pipe', 'nuclear_reactor', 'heat_exchanger', 'heat_interface'],
                updates: ['heat_pipe', 'nuclear_reactor', 'heat_exchanger', 'heat_interface'],
            },
            {
                has: ['fluid_box', 'output_fluid_box', 'fluid_boxes'],
                updates: ['fluid_box', 'output_fluid_box', 'fluid_boxes'],
            },
            {
                is: ['stone_wall', 'gate', 'straight_rail'],
                updates: ['stone_wall', 'gate', 'straight_rail'],
            },
        ]

        return mappigs
            .map(uG => {
                if (!uG.has) return uG
                const entities = Object.values(FD.entities)
                return {
                    is: entities
                        .filter(e => Object.keys(e).find(k => uG.has.includes(k)))
                        .map(e => e.name),
                    updates: entities
                        .filter(e => Object.keys(e).find(k => uG.updates.includes(k)))
                        .map(e => e.name),
                }
            })
            .reduce<Map<string, Set<string>>>((map, cV) => {
                for (const k of cV.is) {
                    if (map.has(k)) {
                        for (const v of cV.updates) {
                            map.get(k).add(v)
                        }
                    } else {
                        map.set(k, new Set(cV.updates))
                    }
                }
                return map
            }, new Map())
    }

    public get entity(): Entity {
        return this.m_Entity
    }

    public get position(): IPoint {
        return {
            x: this.m_Entity.position.x * 32,
            y: this.m_Entity.position.y * 32,
        }
    }

    public set cursorBox(type: CursorBoxType) {
        if (this.cursorBoxContainer) {
            this.cursorBoxContainer.destroy()
        }
        if (type !== undefined) {
            this.cursorBoxContainer = G.BPC.overlayContainer.createCursorBox(
                this.position,
                this.m_Entity.size,
                type
            )
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
            this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity, this.position)
        }

        G.UI.updateEntityInfoPanel(this.m_Entity)
    }

    public pointerOverEventHandler(): void {
        this.cursorBox = 'regular'
        this.createUndergroundLine()

        G.UI.updateEntityInfoPanel(this.m_Entity)
        this.visualizationArea.show()
    }

    public pointerOutEventHandler(): void {
        this.cursorBox = undefined
        this.destroyUndergroundLine()

        G.UI.updateEntityInfoPanel(undefined)
        this.visualizationArea.hide()
    }

    private redrawSurroundingEntities(position: IPoint = this.m_Entity.position): void {
        const updatesEntities = EntityContainer.updateGroups.get(this.m_Entity.name)
        if (!updatesEntities) return
        const area = {
            x: position.x,
            y: position.y,
            w: this.m_Entity.size.x,
            h: this.m_Entity.size.y,
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
                        h: area.h + 2,
                    })
                )
            }

            entities
                .filter(entity => updatesEntities.has(entity.name))
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
        this.entitySprites = EntitySprite.getParts(
            this.m_Entity,
            this.position,
            ignoreConnections ? undefined : G.bp.entityPositionGrid
        )
        G.BPC.addEntitySprites(this.entitySprites, sort)
    }
}
