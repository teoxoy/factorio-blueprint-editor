import { Blueprint } from './blueprint'
import Immutable from 'immutable'
import spriteDataBuilder from './spriteDataBuilder'
import FD from 'factorio-data'
import util from '../common/util'
import { Area } from './positionGrid'

export default class Entity {

    private readonly m_rawEntity: Immutable.Map<string, any>
    private readonly m_BP: Blueprint

    constructor(m_rawEntity: any, BP: Blueprint) {
        this.m_rawEntity = m_rawEntity
        this.m_BP = BP
    }

    get entity_number() { return this.m_rawEntity.get('entity_number') }
    get name() { return this.m_rawEntity.get('name') }

    get type() { return FD.entities[this.name].type }
    get entityData() { return FD.entities[this.name] }
    get recipeData() { return FD.recipes[this.name] }
    get itemData() { return FD.items[this.name] }
    get size() { return util.switchSizeBasedOnDirection(this.entityData.size, this.direction) }

    get position() { return this.m_rawEntity.get('position').toJS() }

    get direction() { return this.m_rawEntity.get('direction') || 0 }
    set direction(direction: number) {
        this.m_BP.operation(this.entity_number, `Set entity direction to ${direction}`,
            entities => entities.setIn([this.entity_number, 'direction'], direction)
        )
    }

    get directionType() { return this.m_rawEntity.get('type') }
    get recipe() { return this.m_rawEntity.get('recipe') }

    set recipe(recipeName: string) {
        if (this.recipe === recipeName) return

        this.m_BP.operation(this.entity_number, 'Changed recipe', entities => (
            entities.withMutations(map => {
                map.setIn([this.entity_number, 'recipe'], recipeName)

                const M = this.moduleArrayToImmutableMap(
                    this.modules
                        .map(k => FD.items[k])
                        .filter(item => !(item.limitation && !item.limitation.includes(recipeName)))
                        .map(item => item.name)
                )

                map.setIn([this.entity_number, 'items'], M)
            })
        ))
    }

    /** Recipes this entity can accept */
    get acceptedRecipes(): string[] {
        if (!this.entityData.crafting_categories) return []

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

    /* Count of module slots */
    get moduleSlots(): number {
        if (!this.entityData.module_specification) return 0
        return this.entityData.module_specification.module_slots
    }

    /** Modules this entity can accept */
    get acceptedModules(): string[] {
        if (!this.entityData.module_specification) return []

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
        const filters: string[] = []
        const items = FD.items
        for (const key in items) {
            const item = items[key]
            if (item.type !== 'fluid' &&
                item.type !== 'recipe' &&
                item.type !== 'virtual_signal') {
                    filters.push(item.name)
                }
        }

        return filters
    }

    // TODO: maybe handle the modules within the class differently so that modules
    // would stay in the same place at least as long as the blueprint is edited.
    /** List of all modules */
    get modules(): string[] {
        const modules = this.m_rawEntity.get('items')
        if (!modules) return []
        const modulesObj = modules.toJS()
        // transform the modules object into an array
        return Object.keys(modulesObj).reduce((acc, k) => acc.concat(Array(modulesObj[k]).fill(k)), [])
    }

    set modules(modules: string[]) {
        const M = this.moduleArrayToImmutableMap(modules)

        this.m_BP.operation(this.entity_number, 'Changed modules',
            entities => entities.setIn([this.entity_number, 'items'], M)
        )
    }

    /** Should be private but TSLint is going to complain about ordering */
    moduleArrayToImmutableMap(modules: string[]): Immutable.Map<string, number> | undefined {
        if (util.equalArrays(this.modules, modules)) return

        // transform the modules array into an object
        const modulesObj = modules.reduce(
            (acc: { [key: string]: number }, moduleName) => {
                if (!moduleName) return acc
                acc[moduleName] = Object.keys(acc).includes(moduleName) ?
                    acc[moduleName] + 1 :
                    1
                return acc
            },
            {}
        )

        return modules.length === 0 ? undefined : Immutable.fromJS(modulesObj)
    }

    /* Count of filter slots */
    get filterSlots(): number {
        if (this.name.includes('splitter')) return 1
        if (this.entityData.filter_count) return this.entityData.filter_count
        if (this.entityData.logistic_slots_count) return this.entityData.logistic_slots_count
        return 0
    }

    /* List of all filter(s) for splitters, inserters and logistic chests */
    get filters(): IFilter[] {
        switch (this.name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                return [ { index: 1, name: this.splitterFilter, count: 0 } ]
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
                        filters.push({index: item.index, name: item.name})
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

    get splitterInputPriority(): string {
        return this.m_rawEntity.get('input_priority')
    }
    set splitterInputPriority(priority: string) {
        this.m_BP.operation(this.entity_number, 'Changed splitter output priority',
            entities => entities.setIn([this.entity_number, 'input_priority'], Immutable.fromJS(priority))
        )
    }

    get splitterOutputPriority(): string {
        return this.m_rawEntity.get('output_priority')
    }
    set splitterOutputPriority(priority: string) {
        this.m_BP.operation(this.entity_number, 'Changed splitter output priority',
            entities => entities.setIn([this.entity_number, 'output_priority'], Immutable.fromJS(priority))
        )
    }

    get splitterFilter(): string {
        return this.m_rawEntity.get('filter')
    }

    set splitterFilter(filter: string) {
        if (this.splitterFilter === filter) return

        this.m_BP.operation(this.entity_number, 'Changed splitter filter',
            entities => entities.setIn([this.entity_number, 'filter'], Immutable.fromJS(filter))
        )
    }

    get inserterFilters(): IFilter[] {
        const f = this.m_rawEntity.get('filters')
        return f ? f.toJS() : undefined
    }

    set inserterFilters(filters: IFilter[]) {
        if (
            filters &&
            this.inserterFilters.length === filters.length &&
            this.inserterFilters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) return

        this.m_BP.operation(this.entity_number, 'Changed inserter filter' + (filters.length === 1 ? '' : '(s)'),
            entities => entities.setIn([this.entity_number, 'filters'], Immutable.fromJS(filters))
        )
    }

    get logisticChestFilters(): IFilter[] {
        const f = this.m_rawEntity.get('request_filters')
        return f ? f.toJS() : undefined
    }

    set logisticChestFilters(filters: IFilter[]) {
        if (
            filters &&
            this.inserterFilters.length === filters.length &&
            this.inserterFilters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) return

        this.m_BP.operation(this.entity_number, 'Changed inserter filters',
            entities => entities.setIn([this.entity_number, 'filters'], Immutable.fromJS(filters))
        )
    }

    get constantCombinatorFilters() {
        const f = this.m_rawEntity.getIn(['control_behavior', 'filters'])
        return f ? f.toJS() : undefined
    }

    get deciderCombinatorConditions() {
        const c = this.m_rawEntity.getIn(['control_behavior', 'decider_conditions'])
        return c ? c.toJS() : undefined
    }

    get arithmeticCombinatorConditions() {
        const c = this.m_rawEntity.getIn(['control_behavior', 'arithmetic_conditions'])
        return c ? c.toJS() : undefined
    }

    get hasConnections() {
        return this.connections !== undefined
    }

    get connections() {
        const c = this.m_rawEntity.get('connections')
        if (!c) return
        const conn = c.toJS()

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

        // TODO: Optimize this
        if (this.type === 'electric_pole') {
            const copperConn: any[] = []

            this.m_BP.rawEntities.forEach((v, k) => {
                const entity = v.toJS()
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

        return conn
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
        const c = this.m_rawEntity.get('color')
        return c ? c.toJS() : undefined
    }

    get operator() {
        if (this.name === 'decider_combinator') {
            const cb = this.m_rawEntity.get('control_behavior')
            if (cb) return cb.getIn(['decider_conditions', 'comparator'])
        }
        if (this.name === 'arithmetic_combinator') {
            const cb = this.m_rawEntity.get('control_behavior')
            if (cb) return cb.getIn(['arithmetic_conditions', 'operation'])
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
        this.m_BP.operation(this.entity_number, 'Changed Entity', entities => (
            entities.withMutations(map => {
                map.setIn([this.entity_number, 'name'], name)
                map.setIn([this.entity_number, 'direction'], direction)
            })
        ))
    }

    move(pos: IPoint) {
        const entity = this.m_BP.entity(this.entity_number)
        if (!this.m_BP.entityPositionGrid.checkNoOverlap(entity.name, entity.direction, pos)) return false
        this.m_BP.operation(this.entity_number, 'Moved entity',
            entities => entities.setIn([this.entity_number, 'position'], Immutable.fromJS(pos)),
            'mov'
        )
        this.m_BP.entityPositionGrid.setTileData(this.entity_number)
        return true
    }

    rotate(notMoving: boolean, offset?: IPoint, pushToHistory = true, otherEntity?: number, ccw = false) {
        if (!this.assemblerCraftsWithFluid &&
            (this.name === 'assembling_machine_2' || this.name === 'assembling_machine_3')) return false
        if (notMoving && this.m_BP.entityPositionGrid.sharesCell(this.getArea())) return false
        const pr = this.entityData.possible_rotations
        if (!pr) return false
        const newDir = pr[
            (
                pr.indexOf(this.direction) +
                (notMoving && (this.size.x !== this.size.y || this.type === 'underground_belt') ? 2 : 1) * (ccw ? 3 : 1)
            ) % pr.length
        ]
        if (newDir === this.direction) return false
        this.m_BP.operation(this.entity_number, 'Rotated entity',
            entities => entities.withMutations(map => {
                map.setIn([this.entity_number, 'direction'], newDir)
                if (notMoving && this.type === 'underground_belt') {
                    map.updateIn([this.entity_number, 'type'], directionType =>
                        directionType === 'input' ? 'output' : 'input'
                    )
                }
                if (!notMoving && this.size.x !== this.size.y) {
                    // tslint:disable-next-line:no-parameter-reassignment
                    map.updateIn([this.entity_number, 'position', 'x'], x => x += offset.x)
                    // tslint:disable-next-line:no-parameter-reassignment
                    map.updateIn([this.entity_number, 'position', 'y'], y => y += offset.y)
                }
            }),
            'upd',
            notMoving && pushToHistory,
            otherEntity
        )
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
