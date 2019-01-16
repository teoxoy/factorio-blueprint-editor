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
        // TODO: Integrate check if recipe is actually changing
        this.m_BP.operation(this.entity_number, 'Changed recipe', entities => (
            entities.withMutations(map => {
                map.setIn([this.entity_number, 'recipe'], recipeName)

                const modules = this.modules
                if (modules && recipeName && !FD.items['productivity_module'].limitation.includes(recipeName)) {
                    for (const k in modules) {
                        // tslint:disable-next-line:no-dynamic-delete
                        if (k.includes('productivity_module')) delete modules[k]
                    }
                    map.setIn([this.entity_number, 'items'], Object.keys(modules).length ? Immutable.fromJS(modules) : undefined)
                }
            })
        ))
    }

    /** Recipes this entity can accept */
    get acceptedRecipes(): string[] {
        if (!this.entityData.crafting_categories) return
        const acceptedRecipes: string[] = []
        const cc = this.entityData.crafting_categories
        for (const k in FD.recipes) {
            const recipe = FD.recipes[k]
            if (cc.includes(recipe.category)) {
                if (!((this.name === 'assembling_machine_1' && recipe.ingredients.length > 2) ||
                    (this.name === 'assembling_machine_2' && recipe.ingredients.length > 4))
                ) {
                    acceptedRecipes.push(k)
                }
            }
        }
        return acceptedRecipes
    }

    /** Modules this entity can accept */
    get acceptedModules(): string[] {
        if (!this.entityData.module_specification) return undefined
        const ommitProductivityModules = this.name === 'beacon' ||
            (this.recipe && !FD.items['productivity_module'].limitation.includes(this.recipe))
        const items = FD.items
        const acceptedModules: string[] = []
        for (const k in items) {
            if (items[k].type === 'module' && !(k.includes('productivity_module') && ommitProductivityModules)) acceptedModules.push(k)
        }
        return acceptedModules
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

    // TODO: When changing 'entity.ts' to a class (if) handle the modules within the class differently
    // >> This would be greatly helpful for improving the user experience as teh modules would stay at
    //    the same place at least as long as the blueprint is edited.
    // >> Currently not possible due to 'entity.ts' not being a real class / object
    /** List of all modules */
    get modules(): string[] {
        const list: string[] = []
        const data: Map<string, number> = this.m_rawEntity.get('items')
        if (data !== undefined && data.size > 0) {
            for (const item of data) {
                for (let index = 0; index < item[1]; index++) {
                    list.push(item[0])
                }
            }
        }
        return list
    }
    set modules(list: string[]) {
        const modules: {[k: string]: number} = {}
        for (const item of list) {
            if (item !== undefined) {
                if (Object.keys(modules).includes(item)) {
                    modules[item]++
                } else {
                    modules[item] = 1
                }
            }
        }
        this.m_BP.operation(this.entity_number, 'Changed modules',
            entities => entities.setIn([this.entity_number, 'items'], Immutable.fromJS(modules))
        )
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
        const name: string = this.name
        switch (name) {
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
        const name: string = this.name
        switch (name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                const filter: string = (list === undefined || list.length !== 1 || list[0].name === undefined) ? undefined : list[0].name
                this.m_BP.operation(this.entity_number, 'Changed splitter filter',
                    entities => entities.setIn([this.entity_number, 'filter'], Immutable.fromJS(filter))
                )
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
                this.m_BP.operation(this.entity_number, 'Changed inserter filter' + (list.length === 1 ? '' : '(s)'),
                    entities => entities.setIn([this.entity_number, 'filters'], Immutable.fromJS(filters))
                )
                return
            }
            case 'logistic_chest_storage':
            case 'logistic_chest_requester':
            case 'logistic_chest_buffer': {
                const filters = (list === undefined || list.length === 0) ? undefined : list
                this.m_BP.operation(this.entity_number, 'Changed inserter filters',
                    entities => entities.setIn([this.entity_number, 'filters'], Immutable.fromJS(filters))
                )
                return
            }
        }
    }

    get splitterInputPriority() {
        return this.m_rawEntity.get('input_priority')
    }
    set splitterInputPriority(priority: string) {
        this.m_BP.operation(this.entity_number, 'Changed splitter output priority',
            entities => entities.setIn([this.entity_number, 'input_priority'], Immutable.fromJS(priority))
        )
    }

    get splitterOutputPriority() {
        return this.m_rawEntity.get('output_priority')
    }
    set splitterOutputPriority(priority: string) {
        this.m_BP.operation(this.entity_number, 'Changed splitter output priority',
            entities => entities.setIn([this.entity_number, 'output_priority'], Immutable.fromJS(priority))
        )
    }

    get splitterFilter() {
        return this.m_rawEntity.get('filter')
    }

    get inserterFilters() {
        const f = this.m_rawEntity.get('filters')
        return f ? f.toJS() : undefined
    }

    get constantCombinatorFilters() {
        const f = this.m_rawEntity.getIn(['control_behavior', 'filters'])
        return f ? f.toJS() : undefined
    }

    get logisticChestFilters() {
        const f = this.m_rawEntity.get('request_filters')
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
            return e[(side === 1 ? 'left' : 'right') + '_wire_connection_point'].wire.copper
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
