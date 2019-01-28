import G from '../common/globals'
import FD from 'factorio-data'
import spriteDataBuilder from '../factorio-data/spriteDataBuilder'
import { EntitySprite } from '../entitySprite'
import { UnderlayContainer } from './underlay'
import util from '../common/util'
import Entity from '../factorio-data/entity'

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

export class EntityContainer extends PIXI.Container {
    static mappings: Map<number, EntityContainer> = new Map()

    static getGridPosition(containerPosition: IPoint) {
        return {
            x: Math.round(containerPosition.x / 32 * 10) / 10,
            y: Math.round(containerPosition.y / 32 * 10) / 10
        }
    }

    static getPositionFromData(currentPos: IPoint, size: IPoint) {
        const res = { x: 0, y: 0 }
        if (size.x % 2 === 0) {
            const npx = currentPos.x - currentPos.x % 16
            res.x = npx + (npx % 32 === 0 ? 0 : 16)
        } else {
            res.x = currentPos.x - currentPos.x % 32 + 16
        }
        if (size.y % 2 === 0) {
            const npy = currentPos.y - currentPos.y % 16
            res.y = npy + (npy % 32 === 0 ? 0 : 16)
        } else {
            res.y = currentPos.y - currentPos.y % 32 + 16
        }
        return res
    }

    static isContainerOutOfBpArea(newPos: IPoint, size: IPoint) {
        return newPos.x - size.x / 2 < 0 ||
            newPos.y - size.y / 2 < 0 ||
            newPos.x + size.x / 2 > G.bpArea.width ||
            newPos.y + size.y / 2 > G.bpArea.height
    }

    static getParts(entity: Entity, hr: boolean, ignore_connections?: boolean): EntitySprite[] {
        const anims = spriteDataBuilder.getSpriteData(entity, hr, ignore_connections ? undefined : G.bp)

        // const icon = new PIXI.Sprite(G.iconSprites['icon:' + FD.entities[entity.name].icon.split(':')[1]])
        // icon.x -= 16
        // icon.y -= 16
        // return [icon]

        const parts: EntitySprite[] = []
        for (let i = 0, l = anims.length; i < l; i++) {
            const img = new EntitySprite(anims[i])
            if (anims[i].filename.includes('circuit-connector')) {
                img.zIndex = 1
            } else if (entity.name === 'artillery_turret' && i > 0) {
                img.zIndex = 2
            } else if ((entity.name === 'rail_signal' || entity.name === 'rail_chain_signal') && i === 0) {
                img.zIndex = -8
            } else if (entity.name === 'straight_rail' || entity.name === 'curved_rail') {
                if (i < 2) {
                    img.zIndex = -10
                } else if (i < 4) {
                    img.zIndex = -9
                } else {
                    img.zIndex = -7
                }
            } else if (entity.type === 'transport_belt' || entity.name === 'heat_pipe') {
                img.zIndex = i === 0 ? -6 : -5
            } else {
                img.zIndex = 0
            }
            img.zOrder = i

            parts.push(img)
        }

        return parts
    }

    areaVisualization: PIXI.Sprite | PIXI.Sprite[] | undefined
    entityInfo: PIXI.Container
    entitySprites: EntitySprite[]

    private readonly m_Entity: Entity

    constructor(entity: Entity, sort = true) {
        super()
        this.m_Entity = entity

        EntityContainer.mappings.set(this.m_Entity.entity_number, this)

        this.position.set(
            this.m_Entity.position.x * 32,
            this.m_Entity.position.y * 32
        )

        this.interactive = true
        this.interactiveChildren = false
        this.buttonMode = true

        this.entitySprites = []

        this.areaVisualization = G.BPC.underlayContainer.createNewArea(this.m_Entity.name, this.position)
        this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity.entity_number, this.position)

        this.redraw(false, sort)
    }

    public get entity(): Entity {
        return this.m_Entity
    }

    destroy() {
        // TODO: Check if the following line is actually still necessary
        // if (G.editEntityContainer.visible) G.editEntityContainer.close()

        for (const s of this.entitySprites) s.destroy()

        super.destroy()
        EntityContainer.mappings.delete(this.m_Entity.entity_number)

        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())
        G.BPC.overlayContainer.hideCursorBox()
        G.BPC.overlayContainer.hideUndergroundLines()

        if (this.entityInfo !== undefined) this.entityInfo.destroy()
    }

    checkBuildable() {
        const position = EntityContainer.getGridPosition(this.position)
        if (!EntityContainer.isContainerOutOfBpArea(position, this.m_Entity.size) &&
            G.bp.entityPositionGrid.checkNoOverlap(this.m_Entity.name, this.m_Entity.direction, position)
        ) {
            G.BPC.movingEntityFilter.red = 0.4
            G.BPC.movingEntityFilter.green = 1
        } else {
            G.BPC.movingEntityFilter.red = 1
            G.BPC.movingEntityFilter.green = 0.4
        }
    }

    rotate(ccw = false) {
        let otherEntity: number
        if (G.currentMouseState === G.mouseStates.NONE && this.m_Entity.type === 'underground_belt') {
            otherEntity = G.bp.entityPositionGrid.findEntityWithSameNameAndDirection(
                this.m_Entity.name, this.m_Entity.direction, this.m_Entity.position,
                this.m_Entity.directionType === 'input' ? this.m_Entity.direction : (this.m_Entity.direction + 4) % 8,
                this.m_Entity.entityData.max_distance
            )
            if (otherEntity !== undefined) {
                const oe = G.bp.entity(otherEntity)
                if (oe.directionType === this.m_Entity.directionType) {
                    otherEntity = undefined
                } else {
                    oe.rotate(G.currentMouseState === G.mouseStates.NONE, { x: 0, y: 0 }, false)
                    EntityContainer.mappings.get(otherEntity).redraw()
                }
            }
        }

        const offset = G.gridData.calculateRotationOffset(this.position)
        if (this.m_Entity.rotate(G.currentMouseState === G.mouseStates.NONE, offset, true, otherEntity, ccw)) {
            if (G.currentMouseState === G.mouseStates.MOVING && this.m_Entity.size.x !== this.m_Entity.size.y) {
                this.x += offset.x * 32
                this.y += offset.y * 32
                const pos = EntityContainer.getPositionFromData(this.position, this.m_Entity.size)
                this.position.set(pos.x, pos.y)

                G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
            }

            this.redraw(G.currentMouseState === G.mouseStates.MOVING)
            if (G.currentMouseState === G.mouseStates.NONE) this.redrawSurroundingEntities()

            G.BPC.overlayContainer.updateCursorBoxSize(this.m_Entity.size.x, this.m_Entity.size.y)
            this.updateUndergroundLines()

            if (G.BPC.movingContainer === this) this.checkBuildable()

            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity.entity_number)
        }
    }

    updateUndergroundLines() {
        G.BPC.overlayContainer.updateUndergroundLines(
            this.m_Entity.name,
            { x: this.position.x / 32, y: this.position.y / 32 },
            this.m_Entity.direction,
            this.m_Entity.directionType === 'output' || this.m_Entity.name === 'pipe_to_ground' ?
                (this.m_Entity.direction + 4) % 8 :
                this.m_Entity.direction
        )
    }

    changeRecipe(recipeName: string) {
        this.m_Entity.recipe = recipeName
        this.redrawEntityInfo()
        if (this.m_Entity.name === 'chemical_plant' || this.m_Entity.assemblerCraftsWithFluid || this.m_Entity.assemblerCraftsWithFluid) {
            this.redraw()
            this.redrawSurroundingEntities()
        }
    }

    // TODO: this should be done in the entity class, the action of pastingData should be added as 1 action to the history
    /** Paste relevant data from source entity reference into target entity */
    pasteData(sourceEntityNumber: number) {
        const sourceEntity = G.bp.entity(sourceEntityNumber)

        // PASTE RECIPE
        const aR = this.m_Entity.acceptedRecipes
        if (aR.length > 0) {
            const RECIPE = sourceEntity.recipe !== undefined && aR.includes(sourceEntity.recipe) ? sourceEntity.recipe : undefined
            this.changeRecipe(RECIPE)
        }

        // PASTE MODULES
        const aM = this.m_Entity.acceptedModules
        if (aM.length > 0) {
            if (sourceEntity.modules.length > 0) {
                this.m_Entity.modules = sourceEntity.modules
                    .filter(m => aM.includes(m))
                    .slice(0, this.m_Entity.moduleSlots)
            } else {
                this.m_Entity.modules = []
            }
        }

        // TODO: pasting filters should be handled differently for each type of filer
        // PASTE FILTERS
        const aF = this.m_Entity.acceptedFilters
        if (aF.length > 0) {
            if (sourceEntity.filters.length > 0) {
                this.m_Entity.filters = sourceEntity.filters
                    .filter(f => aF.includes(f.name))
                    .slice(0, this.m_Entity.filterSlots)
            } else {
                this.m_Entity.filters = []
            }
        }

        this.redrawEntityInfo()
    }

    redrawEntityInfo() {
        if (this.m_Entity.moduleSlots !== 0 || this.m_Entity.type === 'splitter' ||
            this.m_Entity.entityData.crafting_categories !== undefined || this.m_Entity.type === 'mining_drill' ||
            this.m_Entity.type === 'boiler' || this.m_Entity.type === 'generator' ||
            this.m_Entity.name === 'pump' || this.m_Entity.name === 'offshore_pump' ||
            this.m_Entity.name === 'arithmetic_combinator' || this.m_Entity.name === 'decider_combinator' ||
            this.m_Entity.name === 'filter_inserter' || this.m_Entity.name === 'stack_filter_inserter' ||
            this.m_Entity.name === 'splitter' || this.m_Entity.name === 'fast_splitter' || this.m_Entity.name === 'express_splitter'
        ) {
            if (this.entityInfo !== undefined) {
                this.entityInfo.destroy()
            }
            this.entityInfo = G.BPC.overlayContainer.createEntityInfo(this.m_Entity.entity_number, this.position)
        }
    }

    updateVisualStuff() {
        for (const s of this.entitySprites) s.setPosition(this.position)

        UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.position.copy(this.position))

        if (this.entityInfo !== undefined) this.entityInfo.position = this.position

        G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
        G.BPC.overlayContainer.updateUndergroundLinesPosition(this.position)
        this.updateUndergroundLines()

        G.BPC.wiresContainer.update(this.m_Entity.entity_number)

        this.checkBuildable()
    }

    removeContainer() {
        G.BPC.wiresContainer.remove(this.m_Entity.entity_number)
        G.bp.entityPositionGrid.removeTileData(this.m_Entity.entity_number, false)
        this.redrawSurroundingEntities()
        G.bp.removeEntity(this.m_Entity.entity_number,
            entity_number => EntityContainer.mappings.get(entity_number).redraw()
        )
        G.BPC.hoverContainer = undefined

        G.BPC.wiresContainer.updatePassiveWires()

        G.BPC.updateOverlay()
        this.destroy()
    }

    moveAtCursor() {
        const position = G.gridData.position
        if (G.BPC.movingContainer === this && G.currentMouseState === G.mouseStates.MOVING) {
            switch (this.m_Entity.name) {
                case 'straight_rail':
                case 'curved_rail':
                case 'train_stop':
                    this.x = position.x - (position.x + G.railMoveOffset.x * 32) % 64 + 32
                    this.y = position.y - (position.y + G.railMoveOffset.y * 32) % 64 + 32
                    break
                default:
                    const pos = EntityContainer.getPositionFromData(position, this.m_Entity.size)
                    this.position.set(pos.x, pos.y)
            }

            this.updateVisualStuff()
        }
    }

    pointerOverEventHandler() {
        if (!G.BPC.movingContainer && !G.BPC.paintContainer) {
            G.BPC.hoverContainer = this

            G.BPC.overlayContainer.updateCursorBoxSize(this.m_Entity.size.x, this.m_Entity.size.y)
            G.BPC.overlayContainer.updateCursorBoxPosition(this.position)
            G.BPC.overlayContainer.showCursorBox()
            G.BPC.overlayContainer.updateUndergroundLinesPosition(this.position)
            this.updateUndergroundLines()

            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = true)
        }
    }

    pointerOutEventHandler() {
        if (G.BPC.hoverContainer === this) {
            G.BPC.hoverContainer = undefined
            G.BPC.overlayContainer.hideCursorBox()
            G.BPC.overlayContainer.hideUndergroundLines()
            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = false)
        }
    }

    pickUpEntityContainer() {
        G.bp.entityPositionGrid.removeTileData(this.m_Entity.entity_number, false)
        this.redraw(true)
        this.redrawSurroundingEntities()
        G.BPC.movingContainer = this
        G.currentMouseState = G.mouseStates.MOVING

        // Move container to cursor
        const pos = EntityContainer.getPositionFromData(G.gridData.position, this.m_Entity.size)
        if (this.position.x !== pos.x || this.position.y !== pos.y) {
            this.position.set(pos.x, pos.y)
            this.updateVisualStuff()
        }

        for (const s of this.entitySprites) s.moving = true
        G.BPC.sortEntities()
        G.BPC.underlayContainer.activateRelatedAreas(this.m_Entity.name)

        G.BPC.updateOverlay()
    }

    placeDownEntityContainer() {
        const position = EntityContainer.getGridPosition(this.position)
        if (EntityContainer.isContainerOutOfBpArea(position, this.m_Entity.size)) return
        if (G.currentMouseState === G.mouseStates.MOVING && this.m_Entity.move(position)) {
            G.BPC.movingContainer = undefined
            G.currentMouseState = G.mouseStates.NONE

            for (const s of this.entitySprites) s.moving = false

            this.redraw(false)
            this.redrawSurroundingEntities()

            G.BPC.underlayContainer.deactivateActiveAreas()

            G.BPC.updateOverlay()
        }
    }

    redrawSurroundingEntities() {
        if (!updateGroups[this.m_Entity.name]) return
        if (this.m_Entity.name === 'straight_rail') {
            G.bp.entityPositionGrid.foreachOverlap(this.m_Entity.getArea(), (entnr: number) => {
                const ent = G.bp.entity(entnr)
                if (ent.name === 'gate') EntityContainer.mappings.get(ent.entity_number).redraw()
            })
        } else {
            const redrawnEntities: number[] = []
            updateGroups[this.m_Entity.name].forEach((updateGroup: string[]) => {
                G.bp.entityPositionGrid.getSurroundingEntities(this.m_Entity.getArea(), (entnr: number) => {
                    const ent = G.bp.entity(entnr)
                    if (updateGroup.includes(ent.name) && !redrawnEntities.includes(entnr)) {
                        EntityContainer.mappings.get(ent.entity_number).redraw()
                        redrawnEntities.push(entnr)
                    }
                })
            })
        }
    }

    redraw(ignore_connections?: boolean, sort = true) {
        for (const s of this.entitySprites) s.destroy()
        this.entitySprites = []
        for (const s of EntityContainer.getParts(this.m_Entity, G.hr, ignore_connections)) {
            if (G.BPC.movingContainer === this) s.moving = true
            s.setPosition(this.position)
            this.entitySprites.push(s)
            G.BPC.entitySprites.addChild(s)
        }
        if (sort) G.BPC.sortEntities()

        this.hitArea = new PIXI.Rectangle(
            -this.m_Entity.size.x * 16,
            -this.m_Entity.size.y * 16,
            this.m_Entity.size.x * 32,
            this.m_Entity.size.y * 32
        )
    }
}
