import FD from 'factorio-data'
import { EventEmitter } from 'events'
import util from '../common/util'
import Blueprint from './blueprint'
import spriteDataBuilder from './spriteDataBuilder'
import { Area } from './positionGrid'
import * as History from './history'

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
        this.m_rawEntity = rawEntity
        this.m_BP = blueprint
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
        if (this.m_rawEntity.position === position) { return }

        History
            .updateValue(this.m_rawEntity, ['position'], position, `Changed position to '${position}'`)
            .emit(() => this.emit('position'))
    }

    /** Entity direction */
    get direction(): number { return this.m_rawEntity.direction !== undefined ? this.m_rawEntity.direction : 0 }
    set direction(direction: number) {
        if (this.m_rawEntity.direction === direction) { return }

        History
            .updateValue(this.m_rawEntity, ['direction'], direction, `Changed direction to '${direction}'`)
            .emit(() => this.emit('direction'))
    }

    /** Direction Type (input|output) for underground belts */
    get directionType() { return this.m_rawEntity.type }
    set directionType(type: 'input' | 'output') {
        if (this.m_rawEntity.type === type) { return }

        History
            .updateValue(this.m_rawEntity, ['type'], type, `Changed direction type to '${type}'`)
            .emit(() => this.emit('directionType'))
    }

    /** Entity recipe */
    get recipe() { return this.m_rawEntity.recipe }
    set recipe(recipe: string) {
        if (this.m_rawEntity.recipe === recipe) { return }

        History.startTransaction(`Changed recipe to '${recipe}'`)
        History.updateValue(this.m_rawEntity, ['recipe'], recipe).emit(() => this.emit('recipe'))

        const modules = this.modules
            .map(k => FD.items[k])
            .filter(item => !(item.limitation !== undefined && !item.limitation.includes(recipe)))
            .map(item => item.name)

        if (!util.equalArrays(this.modules, modules)) {
            History.updateValue(this.m_rawEntity, ['items'], modules).emit(() => this.emit('modules'))
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
        if (modulesObj === undefined) return []
        return Object.keys(modulesObj).reduce((acc, k) => acc.concat(Array(modulesObj[k]).fill(k)), [])
    }
    set modules(modules: string[]) {
        if (util.equalArrays(this.modules, modules)) { return }

        const ms = {}
        for (const m of modules) {
            if (Object.keys(modules).includes(m)) {
                ms[m]++
            } else {
                ms[m] = 1
            }
        }

        History
            .updateValue(this.m_rawEntity, ['items'], ms, `Changed modules to '${modules}'`)
            .emit(() => this.emit('modules'))
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
            .emit(() => this.emit('splitterInputPriority'))
    }

    /** Splitter output priority */
    get splitterOutputPriority(): string { return this.m_rawEntity.output_priority }
    set splitterOutputPriority(priority: string) {
        if (this.m_rawEntity.output_priority === priority) { return }

        History
            .updateValue(this.m_rawEntity, ['output_priority'], priority, `Changed splitter output priority to '${priority}'`)
            .emit(() => this.emit('splitterOutputPriority'))
    }

    /** Splitter filter */
    get splitterFilter(): string { return this.m_rawEntity.filter }
    set splitterFilter(filter: string) {
        if (this.m_rawEntity.filter === filter) { return }

        History
            .updateValue(this.m_rawEntity, ['filter'], filter, `Changed splitter filter to '${filter}'`)
            .emit(() => this.emit('splitterFilter'))
            .emit(() => this.emit('filters'))
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
            .updateValue(this.m_rawEntity, ['filters'], filters, `Changed inserter filter${this.filterSlots === 1 ? '' : '(s)'} to '${filters}'`)
            .emit(() => this.emit('inserterFilters'))
            .emit(() => this.emit('filters'))
    }

    /** Logistic chest filters */
    get logisticChestFilters(): IFilter[] { return this.m_rawEntity.request_filters }
    set logisticChestFilters(filters: IFilter[]) {
        if (filters !== undefined &&
            this.m_rawEntity.filters !== undefined &&
            this.m_rawEntity.filters.length === filters.length &&
            this.m_rawEntity.filters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) return

        History
            .updateValue(this.m_rawEntity, ['filters'], filters, `Changed chest filter${this.filterSlots === 1 ? '' : '(s)'} to '${filters}'`)
            .emit(() => this.emit('logisticChestFilters'))
            .emit(() => this.emit('filters'))
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

            this.m_BP.rawEntities.forEach((entity, k) => {
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

    get connectedEntities() {
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

    getArea(pos?: IPoint) {
        return new Area({
            x: pos ? pos.x : this.position.x,
            y: pos ? pos.y : this.position.y,
            width: this.size.x,
            height: this.size.y
        }, true)
    }

    change(name: string, direction: number) {
        History.startTransaction(`Changed Entity: ${this.type}`)
        this.name = name
        this.direction = direction
        History.commitTransaction()
    }

    move(position: IPoint) {
        if (!this.m_BP.entityPositionGrid.checkNoOverlap(this.name, this.direction, position)) { return false }

        // In this case we cannot call the actualy property position as we action type 'mov' needs to be added
        History
            .updateValue(this.m_rawEntity, ['position'], position, `Moved entity: ${this.type}`).type('mov')
            .emit(() => this.emit('position'))

        this.m_BP.entityPositionGrid.setTileData(this.entity_number)
        return true
    }

    rotate(notMoving: boolean, offset?: IPoint, pushToHistory = true, otherEntity?: number, ccw = false) {
        if (!this.assemblerCraftsWithFluid &&
            (this.name === 'assembling_machine_2' || this.name === 'assembling_machine_3')) return false
        if (notMoving && this.m_BP.entityPositionGrid.sharesCell(this.getArea())) return false
        const pr = this.entityData.possible_rotations
        if (pr === undefined) return false
        const newDir = pr[
            (
                pr.indexOf(this.direction) +
                (notMoving && (this.size.x !== this.size.y || this.type === 'underground_belt') ? 2 : 1) * (ccw ? 3 : 1)
            ) % pr.length
        ]
        if (newDir === this.direction) return false

        History.startTransaction(`Rotated entity: ${this.type}`)
        this.direction = newDir
        if (notMoving && this.type === 'underground_belt') {
            this.directionType = this.directionType === 'input' ? 'output' : 'input'
        }
        if (!notMoving && this.size.x !== this.size.y) {
            this.position = { x: this.m_rawEntity.position.x + offset.x, y: this.m_rawEntity.position.y + offset.y }
        }
        History.commitTransaction()

        return true
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

    toJS() {
        return this.m_rawEntity.toJS()
    }
}
