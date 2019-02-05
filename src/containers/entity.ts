import G from '../common/globals'
import FD from 'factorio-data'
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
            this.position.set(newPos.x * 32, newPos.y * 32)

            this.redraw()
            this.redrawSurroundingEntities(oldPos)
            this.redrawSurroundingEntities(newPos)

            this.updateUndergroundLines()
            this.redrawEntityInfo()
            G.BPC.wiresContainer.update(this.m_Entity)
            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.position.copy(this.position))
        })

        this.m_Entity.on('destroy', () => {
            this.destroy()

            this.redrawSurroundingEntities()

            G.BPC.hoverContainer = undefined

            G.BPC.updateOverlay()

            for (const s of this.entitySprites) s.destroy()

            EntityContainer.mappings.delete(this.m_Entity.entity_number)

            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.destroy())
            G.BPC.overlayContainer.hideCursorBox()
            G.BPC.overlayContainer.hideUndergroundLines()

            if (this.entityInfo !== undefined) this.entityInfo.destroy()
        })

        G.BPC.entities.addChild(this)
    }
    public get entity(): Entity {
        return this.m_Entity
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
        if (G.currentMouseState === G.mouseStates.NONE) {
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
        if (G.currentMouseState === G.mouseStates.NONE && G.BPC.hoverContainer === this) {
            G.BPC.hoverContainer = undefined
            G.BPC.overlayContainer.hideCursorBox()
            G.BPC.overlayContainer.hideUndergroundLines()
            UnderlayContainer.modifyVisualizationArea(this.areaVisualization, s => s.visible = false)
        }
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
        for (const s of EntitySprite.getParts(this.m_Entity, G.hr, ignore_connections)) {
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
