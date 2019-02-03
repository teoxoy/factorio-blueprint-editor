import FD from 'factorio-data'
import EventEmitter from 'eventemitter3'
import util from '../common/util'
import Blueprint from './blueprint'
import spriteDataBuilder from './spriteDataBuilder'
import { Area } from './positionGrid'
import * as History from './history'
import U from './generators/util'
import G from '../common/globals'

// TODO: Handle the modules within the class differently so that modules would stay in the same place during editing the blueprint
// TODO: Optimize within connections property the way how the connections to other entities are found (Try Counter: 0)

/** Entity Base Class */
export default class Entity extends EventEmitter {

    /** Field to hold raw entity */
    private readonly m_rawEntity: BPS.IEntity

    /** Field to hold reference to blueprint */
    private readonly m_BP: Blueprint

    /**
     * Construct Entity Base Class
     * @param rawEntity Raw entity object
     * @param blueprint Reference to blueprint
     */
    constructor(rawEntity: BPS.IEntity, blueprint: Blueprint) {
        super()
        this.m_BP = blueprint
        this.m_rawEntity = rawEntity
    }

    destroy() {
        this.emit('destroy')

        this.removeAllListeners()
    }

    removeConnectionsToOtherEntities() {
        const entitiesToModify = this.hasConnections ? this.m_BP.connectionsManager.removeConnectionData(this.entity_number) : []
        for (const entityToModify of entitiesToModify) {
            const ent = this.m_BP.entities.get(entityToModify.entity_number)
            const connections = ent.connections
            const a = connections.size === 1
            const b = connections[entityToModify.side].size === 1
            const c = connections[entityToModify.side][entityToModify.color].size === 1
            if (a && b && c) {
                History.updateValue(ent,
                    ['connections'], undefined, undefined, true)
            } else if (b && c) {
                History.updateValue(ent,
                    ['connections', entityToModify.side], undefined, undefined, true)
            } else if (c) {
                History.updateValue(ent,
                    ['connections', entityToModify.side, entityToModify.color], undefined, undefined, true)
            } else {
                History.updateValue(ent,
                    ['connections', entityToModify.side, entityToModify.color, entityToModify.index.toString()], undefined, undefined, true)
            }

            ent.emit('redraw')
        }
    }

    /** Return reference to blueprint */
    public get Blueprint(): Blueprint { return this.m_BP }

    /** Entity Number */
    get entity_number(): number { return this.m_rawEntity.entity_number }

    /** Entity Name */
    get name(): string { return this.m_rawEntity.name }
    set name(name: string) {
        if (this.m_rawEntity.name === name) { return }

        History
            .updateValue(this.m_rawEntity, ['name'], name, `Changed name to '${name}'`)
            .emit(() => this.emit('name'))
            .commit()
    }

    /** Entity Type */
    get type(): string { return FD.entities[this.name].type }

    /** Direct access to entity meta data from factorio-data */
    get entityData(): FD.Entity { return FD.entities[this.name] }

    /** Direct access to recipe meta data from factorio-data */
    get recipeData(): FD.Recipe { return FD.recipes[this.name] }

    /** Direct access to item meta data from factorio-data */
    get itemData(): FD.Item { return FD.items[this.name] }

    /** Entity size */
    get size(): IPoint { return util.switchSizeBasedOnDirection(this.entityData.size, this.direction) }

    /** Entity position */
    get position(): IPoint { return this.m_rawEntity.position }
    set position(position: IPoint) {
        if (util.areObjectsEquivalent(this.m_rawEntity.position, position)) return

        if (!this.m_BP.entityPositionGrid.canMoveTo(this, position)) return

        this.m_BP.entityPositionGrid.removeTileData(this)

        History
            .updateValue(this.m_rawEntity, ['position'], position, `Changed position to 'x: ${Math.floor(position.x)}, y: ${Math.floor(position.y)}'`)
            .emit((newValue, oldValue) => {
                this.emit('position', newValue, oldValue)
            })
            .commit()

        this.m_BP.entityPositionGrid.setTileData(this)
    }

    moveBy(offset: IPoint) {
        this.position = {
            x: this.position.x + offset.x,
            y: this.position.y + offset.y
        }
    }

    /** Entity direction */
    get direction(): number {
        // TODO: find a better way of handling passive wires
        // maybe generate the connections in blueprint.ts and
        // store them in the entity.
        if (this.type === 'electric_pole') {
            if (!G.BPC.wiresContainer.entNrToConnectedEntNrs) return 0
            const entNrArr = G.BPC.wiresContainer.entNrToConnectedEntNrs.get(this.entity_number)
            if (!entNrArr) return 0
            return getPowerPoleRotation(
                this.position,
                entNrArr
                    .map(entNr => this.m_BP.entities.get(entNr))
                    .filter(e => !!e)
                    .map(ent => ent.position)
            )
        }

        return this.m_rawEntity.direction !== undefined ? this.m_rawEntity.direction : 0

        function getPowerPoleRotation(centre: IPoint, points: IPoint[]) {
            const sectorSum = points
                .map(p => U.getAngle(0, 0, p.x - centre.x, (p.y - centre.y) * -1 /* invert Y axis */))
                .map(angleToSector)
                .reduce((acc, sec) => acc + sec, 0)

            return Math.floor(sectorSum / points.length) * 2

            function angleToSector(angle: number) {
                const cwAngle = 360 - angle
                const sectorAngle = 360 / 8
                const offset = sectorAngle * 1.5
                let newAngle = cwAngle - offset
                if (Math.sign(newAngle) === -1) newAngle = 360 + newAngle
                const sector = Math.floor(newAngle / sectorAngle)
                return (sector % 4) as 0 | 1 | 2 | 3
            }
        }
    }
    set direction(direction: number) {
        if (this.m_rawEntity.direction === direction) { return }

        History
            .updateValue(this.m_rawEntity, ['direction'], direction, `Changed direction to '${direction}'`)
            .emit(() => this.emit('direction'))
            .commit()
    }

    /** Direction Type (input|output) for underground belts */
    get directionType() { return this.m_rawEntity.type }
    set directionType(type: 'input' | 'output') {
        if (this.m_rawEntity.type === type) { return }

        History
            .updateValue(this.m_rawEntity, ['type'], type, `Changed direction type to '${type}'`)
            .emit(() => this.emit('directionType'))
            .commit()
    }

    /** Entity recipe */
    get recipe() { return this.m_rawEntity.recipe }
    set recipe(recipe: string) {
        if (this.m_rawEntity.recipe === recipe) { return }

        History.startTransaction(`Changed recipe to '${recipe}'`)

        History.updateValue(this.m_rawEntity, ['recipe'], recipe).emit(r => this.emit('recipe', r))

        if (recipe !== undefined) {
            // Some modules on the entity may not be compatible with the new selected recipe, filter those out
            this.modules = this.modules
                .map(k => FD.items[k])
                .filter(item => !(item.limitation !== undefined && !item.limitation.includes(recipe)))
                .map(item => item.name)
        }

        History.commitTransaction()
    }

    /** Recipes this entity can accept */
    get acceptedRecipes(): string[] {
        if (this.entityData.crafting_categories === undefined) { return [] }

        return Object.keys(FD.recipes)
            .map(k => FD.recipes[k])
            .filter(recipe => this.entityData.crafting_categories.includes(recipe.category))
            // filter recipes based on entity ingredient_count
            .filter(recipe =>
                !this.entityData.ingredient_count ||
                this.entityData.ingredient_count >= recipe.ingredients.length
            )
            .map(recipe => recipe.name)
    }

    /** Count of module slots */
    get moduleSlots(): number {
        if (this.entityData.module_specification === undefined) { return 0 }
        return this.entityData.module_specification.module_slots
    }

    /** Modules this entity can accept */
    get acceptedModules(): string[] {
        if (this.entityData.module_specification === undefined) { return [] }

        return Object.keys(FD.items)
            .map(k => FD.items[k])
            .filter(item => item.type === 'module')
            // filter modules based on module limitation
            .filter(item =>
                !this.recipe ||
                !(item.limitation && !item.limitation.includes(this.recipe))
            )
            // filter modules based on entity allowed_effects (ex: beacons don't accept productivity effect)
            .filter(item =>
                !this.entityData.allowed_effects ||
                Object.keys(item.effect).every(effect => this.entityData.allowed_effects.includes(effect))
            )
            .map(item => item.name)
    }

    /** Filters this entity can accept (only splitters, inserters and logistic chests) */
    get acceptedFilters(): string[] {
        if (this.filterSlots === 0) { return [] }

        return Object.keys(FD.items)
            .map(k => FD.items[k])
            .filter(item => !['fluid', 'recipe', 'virtual_signal'].includes(item.type))
            .map(item => item.name)
    }

    /** List of all modules */
    get modules(): string[] {
        const modulesObj = this.m_rawEntity.items
        if (modulesObj === undefined || Object.keys(modulesObj).length === 0) return []
        return Object.keys(modulesObj).reduce((acc, k) => acc.concat(Array(modulesObj[k]).fill(k)), [])
    }
    set modules(modules: string[]) {
        if (util.equalArrays(this.modules, modules)) { return }

        const ms: { [key: string]: number } = {}
        for (const m of modules) {
            if (m) ms[m] = ms[m] ? ms[m] + 1 : 1
        }

        History
            .updateValue(this.m_rawEntity, ['items'], ms, `Changed modules to '${modules}'`)
            .emit(() => this.emit('modules', this.modules))
            .commit()
    }

    /** Count of filter slots */
    get filterSlots(): number {
        if (this.name.includes('splitter')) { return 1 }
        if (this.entityData.filter_count !== undefined) { return this.entityData.filter_count }
        if (this.entityData.logistic_slots_count !== undefined) { return this.entityData.logistic_slots_count }
        return 0
    }

    /** List of all filter(s) for splitters, inserters and logistic chests */
    get filters(): IFilter[] {
        switch (this.name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                return [{ index: 1, name: this.splitterFilter, count: 0 }]
            }
            case 'filter_inserter':
            case 'stack_filter_inserter': {
                return this.inserterFilters
            }
            case 'logistic_chest_storage':
            case 'logistic_chest_requester':
            case 'logistic_chest_buffer':
                return this.logisticChestFilters
            default: {
                return undefined
            }
        }
    }
    set filters(list: IFilter[]) {
        switch (this.name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                this.splitterFilter = (list === undefined || list.length !== 1 || list[0].name === undefined) ? undefined : list[0].name
                return
            }
            case 'filter_inserter':
            case 'stack_filter_inserter': {
                let filters: Array<{ index: number; name: string }>
                if (list === undefined || list.length === 0) {
                    filters = undefined
                } else {
                    filters = []
                    for (const item of list) {
                        if (item.name === undefined) {
                            continue
                        }
                        filters.push({ index: item.index, name: item.name })
                    }
                }
                this.inserterFilters = filters
                return
            }
            case 'logistic_chest_storage':
            case 'logistic_chest_requester':
            case 'logistic_chest_buffer': {
                this.logisticChestFilters = (list === undefined || list.length === 0) ? undefined : list
                return
            }
        }
    }

    /** Splitter input priority */
    get splitterInputPriority(): string { return this.m_rawEntity.input_priority }
    set splitterInputPriority(priority: string) {
        if (this.m_rawEntity.input_priority === priority) { return }

        History
            .updateValue(this.m_rawEntity, ['input_priority'], priority, `Changed splitter input priority to '${priority}'`)
            .emit(() => this.emit('splitterInputPriority', this.splitterInputPriority))
            .commit()
    }

    /** Splitter output priority */
    get splitterOutputPriority(): string { return this.m_rawEntity.output_priority }
    set splitterOutputPriority(priority: string) {
        if (this.m_rawEntity.output_priority === priority) { return }

        History.startTransaction(`Changed splitter output priority to '${priority}'`)

        History
            .updateValue(this.m_rawEntity, ['output_priority'], priority)
            .emit(() => this.emit('splitterOutputPriority', this.splitterOutputPriority))
            .commit()

        if (priority === undefined) this.filters = undefined

        History.commitTransaction()
    }

    /** Splitter filter */
    get splitterFilter(): string { return this.m_rawEntity.filter }
    set splitterFilter(filter: string) {
        if (this.m_rawEntity.filter === filter) { return }

        History.startTransaction(`Changed splitter filter to '${filter}'`)

        History
            .updateValue(this.m_rawEntity, ['filter'], filter)
            .emit(() => this.emit('splitterFilter'))
            .emit(() => this.emit('filters'))
            .commit()

        if (this.splitterOutputPriority === undefined) this.splitterOutputPriority = 'left'

        History.commitTransaction()
    }

    /** Inserter filter */
    get inserterFilters(): IFilter[] { return this.m_rawEntity.filters }
    set inserterFilters(filters: IFilter[]) {
        if (filters !== undefined &&
            this.m_rawEntity.filters !== undefined &&
            this.m_rawEntity.filters.length === filters.length &&
            this.m_rawEntity.filters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) return

        History
            .updateValue(this.m_rawEntity, ['filters'], filters, `Changed inserter filter${this.filterSlots === 1 ? '' : 's'}`)
            .emit(() => this.emit('inserterFilters'))
            .emit(() => this.emit('filters'))
            .commit()
    }

    /** Logistic chest filters */
    get logisticChestFilters(): IFilter[] { return this.m_rawEntity.request_filters }
    set logisticChestFilters(filters: IFilter[]) {
        // TODO: Check if it makes sense to ignore count changes for history - which can be done with the following routine
        // if (this.m_rawEntity.request_filters === undefined && filters === undefined) return
        // if (this.m_rawEntity.request_filters !== undefined && filters !== undefined) {
        //     let equal = this.m_rawEntity.request_filters.length === filters.length
        //     if (equal) {
        //         for (let index = 0; index < this.m_rawEntity.request_filters.length; index++) {
        //             if (!equal) continue
        //             if (equal && this.m_rawEntity.request_filters[index].name !== filters[index].name) {
        //                 equal = false
        //             }
        //         }
        //     }
        //     if (equal) return
        // }

        if (filters !== undefined &&
            this.m_rawEntity.request_filters !== undefined &&
            this.m_rawEntity.request_filters.length === filters.length &&
            this.m_rawEntity.request_filters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) return

        History
            .updateValue(this.m_rawEntity, ['request_filters'], filters, `Changed chest filter${this.filterSlots === 1 ? '' : 's'}`)
            .emit(() => this.emit('logisticChestFilters'))
            .emit(() => this.emit('filters'))
            .commit()
    }

    /** Requester chest - request from buffer chest */
    get requestFromBufferChest(): boolean { return this.m_rawEntity.request_from_buffers }
    set requestFromBufferChest(request: boolean) {
        if (this.m_rawEntity.request_from_buffers === request) { return }

        History
            .updateValue(this.m_rawEntity, ['request_from_buffers'], request, `Changed request from buffer chest to '${request}'`)
            .emit(() => this.emit('requestFromBufferChest'))
            .commit()
    }

    get constantCombinatorFilters() {
        return this.m_rawEntity.control_behavior === undefined ? undefined : this.m_rawEntity.control_behavior.filters
    }

    get deciderCombinatorConditions() {
        return this.m_rawEntity.control_behavior === undefined ? undefined : this.m_rawEntity.control_behavior.decider_conditions
    }

    get arithmeticCombinatorConditions() {
        return this.m_rawEntity.control_behavior === undefined ? undefined : this.m_rawEntity.control_behavior.arithmetic_conditions
    }

    get hasConnections() {
        return this.connections !== undefined
    }

    get connections() {
        const conn = this.m_rawEntity.connections !== undefined ? this.m_rawEntity.connections : {}

        if (conn['Cu0']) {
            if (!conn['1']) conn['1'] = {}
            conn['1'].copper = conn['Cu0']
            delete conn.Cu0
        }
        if (conn['Cu1']) {
            if (!conn['2']) conn['2'] = {}
            conn['2'].copper = conn['Cu1']
            delete conn.Cu1
        }

        if (this.type === 'electric_pole') {
            const copperConn: any[] = []

            this.m_BP.entities.forEach((entity, k) => {
                if (entity.name === 'power_switch' && entity.connections) {
                    if (entity.connections.Cu0 && entity.connections.Cu0[0].entity_id === this.entity_number) {
                        copperConn.push({ entity_id: k })
                    }
                    if (entity.connections.Cu1 && entity.connections.Cu1[0].entity_id === this.entity_number) {
                        copperConn.push({ entity_id: k })
                    }
                }
            })

            if (copperConn.length !== 0) {
                if (!conn['1']) conn['1'] = {}
                conn['1'].copper = copperConn
            }
        }

        return Object.keys(conn).length ? conn : undefined
    }

    get connectedEntities(): number[] {
        const connections = this.connections
        if (!connections) return

        const entities = []
        for (const side in connections) {
            for (const color in connections[side]) {
                for (const c of connections[side][color]) {
                    entities.push(c.entity_id)
                }
            }
        }
        return entities
    }

    get chemicalPlantDontConnectOutput() {
        if (!this.recipe) return false
        return !FD.recipes[this.recipe].results.find(result => result.type === 'fluid')
    }

    get trainStopColor() {
        return this.m_rawEntity.color
    }

    get operator() {
        if (this.name === 'decider_combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) return cb.decider_conditions === undefined ? undefined : cb.decider_conditions.comparator
        }
        if (this.name === 'arithmetic_combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) return cb.arithmetic_conditions === undefined ? undefined : cb.arithmetic_conditions.operation
        }
        return undefined
    }

    getArea() {
        return new Area({
            x: this.position.x,
            y: this.position.y,
            width: this.size.x,
            height: this.size.y
        })
    }

    change(name: string, direction: number) {
        History.startTransaction(`Changed Entity: ${this.type}`)
        this.name = name
        this.direction = direction
        History.commitTransaction()
    }

    rotate(ccw = false, rotateOpposingUB = false) {
        if (!this.assemblerCraftsWithFluid &&
            (this.name === 'assembling_machine_2' || this.name === 'assembling_machine_3')) return

        if (this.m_BP.entityPositionGrid.sharesCell(this.getArea())) return

        const PR = this.entityData.possible_rotations
        if (!PR) return

        const newDir = PR[
            (
                PR.indexOf(this.direction) +
                ((this.size.x !== this.size.y || this.type === 'underground_belt') ? 2 : 1) * (ccw ? 3 : 1)
            )
            % PR.length
        ]

        if (newDir === this.direction) return

        History.startTransaction(`Rotated entity: ${this.type}`)

        this.direction = newDir

        if (this.type === 'underground_belt') {
            this.directionType = this.directionType === 'input' ? 'output' : 'input'

            if (rotateOpposingUB) {
                const otherEntity = this.m_BP.entities.get(this.m_BP.entityPositionGrid.getOpposingEntity(
                    this.name, this.direction, this.position,
                    this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
                    this.entityData.max_distance
                ))
                if (otherEntity) otherEntity.rotate()
            }
        }

        History.commitTransaction()
    }

    /** Paste relevant data from source entity */
    pasteSettings(sourceEntity: Entity) {
        History.startTransaction(`Pasted settings to entity: ${this.type}`)

        // PASTE RECIPE
        const aR = this.acceptedRecipes
        if (aR.length > 0) {
            this.recipe = sourceEntity.recipe !== undefined && aR.includes(sourceEntity.recipe) ? sourceEntity.recipe : undefined
        }

        // PASTE MODULES
        const aM = this.acceptedModules
        if (aM.length > 0) {
            if (sourceEntity.modules.length > 0) {
                this.modules = sourceEntity.modules
                    .filter(m => aM.includes(m))
                    .slice(0, this.moduleSlots)
            } else {
                this.modules = []
            }
        }

        // PASTE SPLITTER SETTINGS (Has to be before filters as otherwise business logic will overwrite)
        if (this.type === 'splitter' && sourceEntity.type === 'splitter') {
            this.splitterInputPriority = sourceEntity.splitterInputPriority
            this.splitterOutputPriority = sourceEntity.splitterOutputPriority
        }

        // PASTE FILTERS
        const aF = this.acceptedFilters
        if (aF.length > 0) {
            if (sourceEntity.filters.length > 0) {
                this.filters = sourceEntity.filters
                    .filter(f => aF.includes(f.name))
                    .slice(0, this.filterSlots)
            } else {
                this.filters = []
            }
        }

        // PASTE REQUESTER CHEST SETTINGS
        if (this.type === 'logistic_chest_requester' && sourceEntity.type === 'logistic_chest_requester') {
            this.requestFromBufferChest = sourceEntity.requestFromBufferChest
        }

        History.commitTransaction()
    }

    topLeft() {
        return { x: this.position.x - (this.size.x / 2), y: this.position.y - (this.size.y / 2) }
    }
    topRight() {
        return { x: this.position.x + (this.size.x / 2), y: this.position.y - (this.size.y / 2) }
    }
    bottomLeft() {
        return { x: this.position.x - (this.size.x / 2), y: this.position.y + (this.size.y / 2) }
    }
    bottomRight() {
        return { x: this.position.x + (this.size.x / 2), y: this.position.y + (this.size.y / 2) }
    }

    get assemblerCraftsWithFluid() {
        return this.recipe &&
            FD.recipes[this.recipe].category === 'crafting_with_fluid' &&
            this.entityData.crafting_categories &&
            this.entityData.crafting_categories.includes('crafting_with_fluid')
    }

    get assemblerPipeDirection() {
        if (!this.recipe) return
        const recipe = FD.recipes[this.recipe]
        if (recipe.ingredients.find(ingredient => ingredient.type === 'fluid')) return 'input'
        if (recipe.results.find(result => result.type === 'fluid')) return 'output'
    }

    getWireConnectionPoint(color: string, side: number) {
        const e = this.entityData
        // poles
        if (e.connection_points) return e.connection_points[this.direction / 2].wire[color]
        // combinators
        if (e.input_connection_points) {
            if (side === 1) return e.input_connection_points[this.direction / 2].wire[color]
            return e.output_connection_points[this.direction / 2].wire[color]
        }

        if (this.name === 'power_switch' && color === 'copper') {
            return side === 1 ? e.left_wire_connection_point.wire.copper : e.right_wire_connection_point.wire.copper
        }

        if (e.circuit_wire_connection_point) return e.circuit_wire_connection_point.wire[color]

        if (this.type === 'transport_belt') {
            return e.circuit_wire_connection_points[
                spriteDataBuilder.getBeltConnections2(this.m_BP, this.position, this.direction) * 4
            ].wire[color]
        }
        if (e.circuit_wire_connection_points.length === 8) {
            return e.circuit_wire_connection_points[this.direction].wire[color]
        }
        if (this.name === 'constant_combinator') {
            return e.circuit_wire_connection_points[this.direction / 2].wire[color]
        }
        return e.circuit_wire_connection_points[this.direction / 2].wire[color]
    }

    getRawData() {
        return this.m_rawEntity
    }
}
