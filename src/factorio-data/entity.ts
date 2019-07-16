import FD from 'factorio-data'
import EventEmitter from 'eventemitter3'
import util from '../common/util'
import Blueprint from './blueprint'
import spriteDataBuilder from './spriteDataBuilder'
import { Area } from './positionGrid'
import U from './generators/util'

// TODO: Handle the modules within the class differently so that modules would stay in the same place during editing the blueprint

/** Entity Base Class */
export default class Entity extends EventEmitter {
    static getItemName(name: string) {
        return FD.entities[name].minable.result
    }

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

    /** Return reference to blueprint */
    public get Blueprint(): Blueprint {
        return this.m_BP
    }

    /** Entity Number */
    get entityNumber(): number {
        return this.m_rawEntity.entity_number
    }

    /** Entity Name */
    get name(): string {
        return this.m_rawEntity.name
    }

    /** Entity Type */
    get type(): string {
        return FD.entities[this.name].type
    }

    /** Direct access to entity meta data from factorio-data */
    get entityData(): FD.Entity {
        return FD.entities[this.name]
    }

    /** Direct access to recipe meta data from factorio-data */
    get recipeData(): FD.Recipe {
        return FD.recipes[this.name]
    }

    /** Direct access to item meta data from factorio-data */
    get itemData(): FD.Item {
        return FD.items[this.name]
    }

    /** Entity size */
    get size(): IPoint {
        return util.switchSizeBasedOnDirection(this.entityData.size, this.direction)
    }

    /** Entity position */
    get position(): IPoint {
        return this.m_rawEntity.position
    }
    set position(position: IPoint) {
        if (util.areObjectsEquivalent(this.m_rawEntity.position, position)) {
            return
        }

        if (!this.m_BP.entityPositionGrid.canMoveTo(this, position)) {
            return
        }

        // Restrict movement of connected entities
        if (
            !this.m_BP.wireConnections
                .getEntityConnections(this.entityNumber)
                .map(c => (c.entityNumber1 === this.entityNumber ? c.entityNumber2 : c.entityNumber1))
                .map(otherEntityNumer => this.m_BP.entities.get(otherEntityNumer))
                .every(e => U.pointInCircle(e.position, position, Math.min(e.maxWireDistance, this.maxWireDistance)))
        ) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['position'], position, 'Change position')
            .onDone((newValue, oldValue) => {
                this.m_BP.entityPositionGrid.removeTileData(this, oldValue)
                this.m_BP.entityPositionGrid.setTileData(this, newValue)
                this.emit('position', newValue, oldValue)
            })
            .commit()
    }

    get maxWireDistance() {
        return (
            this.entityData.circuit_wire_max_distance ||
            this.entityData.wire_max_distance ||
            this.entityData.maximum_wire_distance
        )
    }

    moveBy(offset: IPoint) {
        this.position = {
            x: this.position.x + offset.x,
            y: this.position.y + offset.y
        }
    }

    /** Entity direction */
    get direction(): number {
        return this.m_rawEntity.direction === undefined ? 0 : this.m_rawEntity.direction
    }
    set direction(direction: number) {
        if (this.m_rawEntity.direction === direction) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['direction'], direction, 'Change direction')
            .onDone(() => this.emit('direction'))
            .commit()
    }

    /** Direction Type (input|output) for underground belts */
    get directionType() {
        return this.m_rawEntity.type
    }
    set directionType(type: 'input' | 'output') {
        if (this.m_rawEntity.type === type) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['type'], type, 'Change direction type')
            .onDone(() => this.emit('directionType'))
            .commit()
    }

    /** Entity recipe */
    get recipe() {
        return this.m_rawEntity.recipe
    }
    set recipe(recipe: string) {
        if (this.m_rawEntity.recipe === recipe) {
            return
        }

        this.m_BP.history.startTransaction()

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['recipe'], recipe, 'Change recipe')
            .onDone(r => this.emit('recipe', r))
            .commit()

        if (recipe !== undefined) {
            // Some modules on the entity may not be compatible with the new selected recipe, filter those out
            this.modules = this.modules
                .map(k => FD.items[k])
                .filter(item => !(item.limitation !== undefined && !item.limitation.includes(recipe)))
                .map(item => item.name)
        }

        this.m_BP.history.commitTransaction()
    }

    /** Recipes this entity can accept */
    get acceptedRecipes(): string[] {
        if (this.entityData.crafting_categories === undefined) {
            return []
        }

        return Object.keys(FD.recipes)
            .map(k => FD.recipes[k])
            .filter(recipe => this.entityData.crafting_categories.includes(recipe.category))
            .map(recipe => recipe.name)
    }

    /** Count of module slots */
    get moduleSlots(): number {
        if (this.entityData.module_specification === undefined) {
            return 0
        }
        return this.entityData.module_specification.module_slots
    }

    /** Modules this entity can accept */
    get acceptedModules(): string[] {
        if (this.entityData.module_specification === undefined) {
            return []
        }

        return (
            Object.keys(FD.items)
                .map(k => FD.items[k])
                .filter(item => item.type === 'module')
                // filter modules based on module limitation
                .filter(item => !this.recipe || !(item.limitation && !item.limitation.includes(this.recipe)))
                // filter modules based on entity allowed_effects (ex: beacons don't accept productivity effect)
                .filter(
                    item =>
                        !this.entityData.allowed_effects ||
                        Object.keys(item.effect).every(effect => this.entityData.allowed_effects.includes(effect))
                )
                .map(item => item.name)
        )
    }

    /** Filters this entity can accept (only splitters, inserters and logistic chests) */
    get acceptedFilters(): string[] {
        if (this.filterSlots === 0) {
            return []
        }

        return Object.keys(FD.items)
            .map(k => FD.items[k])
            .filter(item => !['fluid', 'recipe', 'virtual_signal'].includes(item.type))
            .map(item => item.name)
    }

    /** List of all modules */
    get modules(): string[] {
        const modulesObj = this.m_rawEntity.items
        if (modulesObj === undefined || Object.keys(modulesObj).length === 0) {
            return []
        }
        return Object.keys(modulesObj).reduce((acc, k) => acc.concat(Array(modulesObj[k]).fill(k)), [])
    }
    set modules(modules: string[]) {
        if (util.equalArrays(this.modules, modules)) {
            return
        }

        const ms: { [key: string]: number } = {}
        for (const m of modules) {
            if (m) {
                ms[m] = ms[m] ? ms[m] + 1 : 1
            }
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['items'], ms, 'Change modules')
            .onDone(() => this.emit('modules', this.modules))
            .commit()
    }

    /** Count of filter slots */
    get filterSlots(): number {
        if (this.name.includes('splitter')) {
            return 1
        }
        if (this.entityData.filter_count !== undefined) {
            return this.entityData.filter_count
        }
        if (this.entityData.logistic_slots_count !== undefined) {
            return this.entityData.logistic_slots_count
        }
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
            case 'infinity_chest':
                return this.infinityChestFilters
            case 'infinity_pipe':
                return this.infinityPipeFilters
            default: {
                return undefined
            }
        }
    }
    set filters(list: IFilter[]) {
        const FILTERS = list === undefined || list.length === 0 ? undefined : list.filter(f => !!f.name)
        switch (this.name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                this.splitterFilter = FILTERS === undefined ? undefined : FILTERS[0].name
                return
            }
            case 'filter_inserter':
            case 'stack_filter_inserter': {
                this.inserterFilters = FILTERS
                return
            }
            case 'logistic_chest_storage':
            case 'logistic_chest_requester':
            case 'logistic_chest_buffer': {
                this.logisticChestFilters = FILTERS
            }
        }
    }

    /** Splitter input priority */
    get splitterInputPriority(): string {
        return this.m_rawEntity.input_priority
    }
    set splitterInputPriority(priority: string) {
        if (this.m_rawEntity.input_priority === priority) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['input_priority'], priority, 'Change splitter input priority')
            .onDone(() => this.emit('splitterInputPriority', this.splitterInputPriority))
            .commit()
    }

    /** Splitter output priority */
    get splitterOutputPriority(): string {
        return this.m_rawEntity.output_priority
    }
    set splitterOutputPriority(priority: string) {
        if (this.m_rawEntity.output_priority === priority) {
            return
        }

        this.m_BP.history.startTransaction()

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['output_priority'], priority, 'Change splitter output priority')
            .onDone(() => this.emit('splitterOutputPriority', this.splitterOutputPriority))
            .commit()

        if (priority === undefined) {
            this.filters = undefined
        }

        this.m_BP.history.commitTransaction()
    }

    /** Splitter filter */
    get splitterFilter(): string {
        return this.m_rawEntity.filter
    }
    set splitterFilter(filter: string) {
        if (this.m_rawEntity.filter === filter) {
            return
        }

        this.m_BP.history.startTransaction()

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['filter'], filter, 'Change splitter filter')
            .onDone(() => this.emit('splitterFilter'))
            .onDone(() => this.emit('filters'))
            .commit()

        if (this.splitterOutputPriority === undefined) {
            this.splitterOutputPriority = 'left'
        }

        this.m_BP.history.commitTransaction()
    }

    get filterMode() {
        return this.m_rawEntity.filter_mode === 'blacklist' ? 'blacklist' : 'whitelist'
    }

    set filterMode(filterMode: 'whitelist' | 'blacklist') {
        const mode = filterMode === 'blacklist' ? 'blacklist' : undefined

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['filter_mode'], mode, 'Change filter mode')
            .onDone(() => this.emit('filterMode', this.filterMode))
            .commit()
    }

    /** Inserter filter */
    get inserterFilters(): IFilter[] {
        return this.m_rawEntity.filters
    }
    set inserterFilters(filters: IFilter[]) {
        if (filters === undefined && this.m_rawEntity.filters === undefined) {
            return
        }
        if (
            filters !== undefined &&
            this.m_rawEntity.filters !== undefined &&
            this.m_rawEntity.filters.length === filters.length &&
            this.m_rawEntity.filters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['filters'], filters, 'Change inserter filter')
            .onDone(() => this.emit('inserterFilters'))
            .onDone(() => this.emit('filters'))
            .commit()
    }

    /** Logistic chest filters */
    get logisticChestFilters(): IFilter[] {
        return this.m_rawEntity.request_filters
    }
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

        if (filters === undefined && this.m_rawEntity.request_filters === undefined) {
            return
        }
        if (
            filters !== undefined &&
            this.m_rawEntity.request_filters !== undefined &&
            this.m_rawEntity.request_filters.length === filters.length &&
            this.m_rawEntity.request_filters.every((filter, i) => util.areObjectsEquivalent(filter, filters[i]))
        ) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['request_filters'], filters, 'Change chest filter')
            .onDone(() => this.emit('logisticChestFilters'))
            .onDone(() => this.emit('filters'))
            .commit()
    }

    get infinityChestFilters(): IFilter[] {
        if (!this.m_rawEntity.infinity_settings) {
            return []
        }
        return this.m_rawEntity.infinity_settings.filters
    }

    get infinityPipeFilters(): IFilter[] {
        if (!this.m_rawEntity.infinity_settings) {
            return []
        }
        return [{ name: this.m_rawEntity.infinity_settings.name, index: 1 }]
    }

    /** Requester chest - request from buffer chest */
    get requestFromBufferChest(): boolean {
        return this.m_rawEntity.request_from_buffers
    }
    set requestFromBufferChest(request: boolean) {
        if (this.m_rawEntity.request_from_buffers === request) {
            return
        }

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['request_from_buffers'], request, 'Change request from buffer chest')
            .onDone(() => this.emit('requestFromBufferChest'))
            .commit()
    }

    get inserterStackSize() {
        if (this.m_rawEntity.override_stack_size) {
            return this.m_rawEntity.override_stack_size
        }
        if (this.name.includes('stack')) {
            return 12
        }
        return 3
    }

    get constantCombinatorFilters() {
        return this.m_rawEntity.control_behavior === undefined ? undefined : this.m_rawEntity.control_behavior.filters
    }

    get deciderCombinatorConditions() {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.decider_conditions
    }

    get arithmeticCombinatorConditions() {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.arithmetic_conditions
    }

    get generateConnector() {
        return this.hasConnections || this.connectToLogisticNetwork
    }

    get connectToLogisticNetwork() {
        return this.m_rawEntity.control_behavior && this.m_rawEntity.control_behavior.connect_to_logistic_network
    }

    get hasConnections() {
        return this.m_BP.wireConnections.getEntityConnections(this.entityNumber).length > 0
    }

    get chemicalPlantDontConnectOutput() {
        if (!this.recipe) {
            return false
        }
        return !FD.recipes[this.recipe].results.find(result => result.type === 'fluid')
    }

    get trainStopColor() {
        return this.m_rawEntity.color
    }

    get operator() {
        if (this.name === 'decider_combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) {
                return cb.decider_conditions === undefined ? undefined : cb.decider_conditions.comparator
            }
        }
        if (this.name === 'arithmetic_combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) {
                return cb.arithmetic_conditions === undefined ? undefined : cb.arithmetic_conditions.operation
            }
        }
        return undefined
    }

    getArea(position?: IPoint) {
        return new Area({
            x: position ? position.x : this.position.x,
            y: position ? position.y : this.position.y,
            width: this.size.x,
            height: this.size.y
        })
    }

    get canBeRotated() {
        if (
            ((this.name === 'assembling_machine_2' || this.name === 'assembling_machine_3') &&
                !this.assemblerCraftsWithFluid) ||
            this.m_BP.entityPositionGrid.sharesCell(this.getArea()) ||
            !this.entityData.possible_rotations
        ) {
            return false
        }

        return true
    }

    rotate(ccw = false, rotateOpposingUB = false) {
        if (!this.canBeRotated) {
            return
        }

        const pr = this.entityData.possible_rotations
        const newDir =
            pr[
                (pr.indexOf(this.direction) +
                    (this.size.x !== this.size.y || this.type === 'underground_belt' ? 2 : 1) * (ccw ? 3 : 1)) %
                    pr.length
            ]

        if (newDir === this.direction) {
            return
        }

        this.m_BP.history.startTransaction('Rotate entity')

        if (this.type === 'underground_belt' || this.type === 'loader') {
            if (rotateOpposingUB) {
                const otherEntity = this.m_BP.entities.get(
                    this.m_BP.entityPositionGrid.getOpposingEntity(
                        this.name,
                        this.direction,
                        this.position,
                        this.directionType === 'input' ? this.direction : (this.direction + 4) % 8,
                        this.entityData.max_distance
                    )
                )
                if (otherEntity) {
                    otherEntity.rotate()
                }
            }

            this.directionType = this.directionType === 'input' ? 'output' : 'input'
        }

        this.direction = newDir

        this.m_BP.history.commitTransaction()
    }

    canPasteSettings(sourceEntity: Entity) {
        return sourceEntity !== this && sourceEntity.type === this.type
    }

    /** Paste relevant data from source entity */
    pasteSettings(sourceEntity: Entity) {
        if (!this.canPasteSettings(sourceEntity)) {
            return
        }

        this.m_BP.history.startTransaction('Paste settings to entity')

        // PASTE RECIPE
        let tRecipe = this.recipe
        const aR = this.acceptedRecipes
        if (aR.length > 0 && sourceEntity.acceptedRecipes) {
            tRecipe =
                sourceEntity.recipe !== undefined && aR.includes(sourceEntity.recipe) ? sourceEntity.recipe : undefined
            this.recipe = tRecipe
        }

        // PASTE DIRECTION (only for type assembling_machine)
        if (
            this.type === 'assembling_machine' &&
            this.name !== 'assembling_machine' &&
            tRecipe &&
            FD.recipes[tRecipe].category === 'crafting_with_fluid'
        ) {
            this.direction = sourceEntity.direction
        }

        // PASTE MODULES
        const aM = this.acceptedModules
        if (aM.length > 0 && sourceEntity.acceptedModules) {
            if (sourceEntity.modules && sourceEntity.modules.length > 0) {
                this.modules = sourceEntity.modules.filter(m => aM.includes(m)).slice(0, this.moduleSlots)
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
        if (aF.length > 0 && sourceEntity.acceptedFilters) {
            if (sourceEntity.filters && sourceEntity.filters.length > 0) {
                this.filters = sourceEntity.filters.filter(f => aF.includes(f.name)).slice(0, this.filterSlots)
            } else {
                this.filters = []
            }
        }

        // PASTE REQUESTER CHEST SETTINGS
        if (this.type === 'logistic_chest_requester' && sourceEntity.type === 'logistic_chest_requester') {
            this.requestFromBufferChest = sourceEntity.requestFromBufferChest
        }

        this.m_BP.history.commitTransaction()

        /*
            TODO:

            assembling machines -> filter inserters:
                filters

            assembling machines -> requester chest:
                filters
                request amount formula: Math.min(ingredientAmount, Math.ceil((ingredientAmount * newCraftingSpeed) / recipe.time))

            Locomotive:
                Schedule
                Color

            TrainStop:
                Color
                Name

            TrainStop<->Locomotive:
                Color

            ProgrammableSpeaker:
                Parameters
                AlertParameters

            RocketSilo:
                LaunchWhenRocketHasItems

            CargoWagon:
            ContainerEntity:
                Bar
                Filters

            CREATIVE ENTITIES:
                ElectricEnergyInterface:
                    ElectricBufferSize
                    PowerProduction
                    PowerUsage

                HeatInterface:
                    temperature
                    mode

                InfinityContainer:
                    Filters
                    RemoveUnfilteredItems

                InfinityPipe:
                    Filter

                Loader:
                    Filters
        */
    }

    topLeft() {
        return { x: this.position.x - this.size.x / 2, y: this.position.y - this.size.y / 2 }
    }
    topRight() {
        return { x: this.position.x + this.size.x / 2, y: this.position.y - this.size.y / 2 }
    }
    bottomLeft() {
        return { x: this.position.x - this.size.x / 2, y: this.position.y + this.size.y / 2 }
    }
    bottomRight() {
        return { x: this.position.x + this.size.x / 2, y: this.position.y + this.size.y / 2 }
    }

    get assemblerCraftsWithFluid() {
        return (
            this.recipe &&
            FD.recipes[this.recipe].category === 'crafting_with_fluid' &&
            this.entityData.crafting_categories &&
            this.entityData.crafting_categories.includes('crafting_with_fluid')
        )
    }

    get assemblerPipeDirection() {
        if (!this.recipe) {
            return undefined
        }
        const recipe = FD.recipes[this.recipe]
        if (recipe.ingredients.find(ingredient => ingredient.type === 'fluid')) {
            return 'input'
        }
        if (recipe.results.find(result => result.type === 'fluid')) {
            return 'output'
        }
        return undefined
    }

    getWireConnectionPoint(color: string, side: number, direction = this.direction) {
        const e = this.entityData
        // poles
        if (e.connection_points) {
            return e.connection_points[direction / 2].wire[color]
        }
        // combinators
        if (e.input_connection_points) {
            if (side === 1) {
                return e.input_connection_points[direction / 2].wire[color]
            }
            return e.output_connection_points[direction / 2].wire[color]
        }

        if (this.name === 'power_switch' && color === 'copper') {
            return side === 1 ? e.left_wire_connection_point.wire.copper : e.right_wire_connection_point.wire.copper
        }

        if (e.circuit_wire_connection_point) {
            return e.circuit_wire_connection_point.wire[color]
        }

        if (this.type === 'transport_belt') {
            return e.circuit_wire_connection_points[
                spriteDataBuilder.getBeltWireConnectionIndex(this.m_BP, this.position, direction) * 4
            ].wire[color]
        }
        if (e.circuit_wire_connection_points.length === 8) {
            return e.circuit_wire_connection_points[direction].wire[color]
        }
        if (this.name === 'constant_combinator') {
            return e.circuit_wire_connection_points[direction / 2].wire[color]
        }
        return e.circuit_wire_connection_points[direction / 2].wire[color]
    }

    getRawData(): BPS.IEntity {
        return {
            ...this.m_rawEntity,
            connections: this.m_BP.wireConnections.serializeConnectionData(this.entityNumber)
        }
    }
}
