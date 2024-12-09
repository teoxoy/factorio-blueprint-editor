import { EventEmitter } from 'eventemitter3'
import util from '../common/util'
import { IllegalFlipError } from '../containers/PaintContainer'
import G from '../common/globals'
import FD, { Entity as FD_Entity } from './factorioData'
import { Blueprint } from './Blueprint'
import { getBeltWireConnectionIndex } from './spriteDataBuilder'
import U from './generators/util'

export interface IFilter {
    /** Slot index (1 based ... not 0 like arrays) */
    index: number
    /** Name of entity to be filtered */
    name: string
    /** If stacking is allowed, how many shall be stacked */
    count?: number
}

// TODO: Handle the modules within the class differently so that modules would stay in the same place during editing the blueprint

/** Entity Base Class */
export class Entity extends EventEmitter {
    /** Field to hold raw entity */
    private readonly m_rawEntity: BPS.IEntity

    /** Field to hold reference to blueprint */
    private readonly m_BP: Blueprint

    /**
     * Construct Entity Base Class
     * @param rawEntity Raw entity object
     * @param blueprint Reference to blueprint
     */
    public constructor(rawEntity: BPS.IEntity, blueprint: Blueprint) {
        super()
        this.m_BP = blueprint
        this.m_rawEntity = rawEntity
    }

    public static getItemName(name: string): string {
        return FD.entities[name].minable.result
    }

    public destroy(): void {
        this.emit('destroy')
        this.removeAllListeners()
    }

    /** Return reference to blueprint */
    public get Blueprint(): Blueprint {
        return this.m_BP
    }

    /** Entity Number */
    public get entityNumber(): number {
        return this.m_rawEntity.entity_number
    }

    /** Entity Name */
    public get name(): string {
        return this.m_rawEntity.name
    }

    /** Entity Type */
    public get type(): string {
        return FD.entities[this.name].type
    }

    /** Direct access to entity meta data from core */
    public get entityData(): FD_Entity {
        return FD.entities[this.name]
    }

    public get rawEntity(): BPS.IEntity {
        return this.m_rawEntity
    }

    /** Entity size */
    public get size(): IPoint {
        return util.switchSizeBasedOnDirection(this.entityData.size, this.direction)
    }

    /** Entity position */
    public get position(): IPoint {
        return this.m_rawEntity.position
    }

    public set position(position: IPoint) {
        if (util.areObjectsEquivalent(this.m_rawEntity.position, position)) return

        if (!this.m_BP.entityPositionGrid.canMoveTo(this, position)) return

        // Check if the new position breaks any valid entity connections
        const connectionsBreak = this.m_BP.wireConnections
            .getEntityConnections(this.entityNumber)
            .map(c =>
                c.cps[0].entityNumber === this.entityNumber
                    ? c.cps[1].entityNumber
                    : c.cps[0].entityNumber
            )
            .map(otherEntityNumer => this.m_BP.entities.get(otherEntityNumer))
            .some(
                e =>
                    // Make sure that a reaching connection is not broken
                    U.pointInCircle(
                        e.position,
                        this.position,
                        Math.min(e.maxWireDistance, this.maxWireDistance)
                    ) &&
                    !U.pointInCircle(
                        e.position,
                        position,
                        Math.min(e.maxWireDistance, this.maxWireDistance)
                    )
            )
        if (G.BPC.limitWireReach && connectionsBreak) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['position'], position, 'Change position')
            .onDone((newValue, oldValue) => {
                this.m_BP.entityPositionGrid.removeTileData(this, oldValue)
                this.m_BP.entityPositionGrid.setTileData(this, newValue)
                this.emit('position', newValue, oldValue)
            })
            .commit()
    }

    public get maxWireDistance(): number {
        return (
            this.entityData.circuit_wire_max_distance ||
            this.entityData.wire_max_distance ||
            this.entityData.maximum_wire_distance
        )
    }

    public connectionsReach(position?: IPoint): boolean {
        return this.m_BP.wireConnections
            .getEntityConnections(this.entityNumber)
            .map(c =>
                c.cps[0].entityNumber === this.entityNumber
                    ? c.cps[1].entityNumber
                    : c.cps[0].entityNumber
            )
            .map(otherEntityNumer => this.m_BP.entities.get(otherEntityNumer))
            .every(e =>
                U.pointInCircle(
                    e.position,
                    position ?? this.position,
                    Math.min(e.maxWireDistance, this.maxWireDistance)
                )
            )
    }

    public moveBy(offset: IPoint): void {
        this.position = util.sumprod(this.position, offset)
    }

    /** Entity direction */
    public get direction(): number {
        if (this.type === 'electric_pole') {
            return this.m_BP.wireConnections.getPowerPoleDirection(this.entityNumber)
        }
        return this.m_rawEntity.direction === undefined ? 0 : this.m_rawEntity.direction
    }
    public set direction(direction: number) {
        if (this.m_rawEntity.direction === direction) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['direction'], direction, 'Change direction')
            .onDone(() => this.emit('direction'))
            .commit()
    }

    /** Direction Type (input|output) for underground belts */
    public get directionType(): 'input' | 'output' {
        return this.m_rawEntity.type
    }
    public set directionType(type: 'input' | 'output') {
        if (this.m_rawEntity.type === type) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['type'], type, 'Change direction type')
            .onDone(() => this.emit('directionType'))
            .commit()
    }

    /** Entity recipe */
    public get recipe(): string {
        return this.m_rawEntity.recipe
    }
    public set recipe(recipe: string) {
        if (this.m_rawEntity.recipe === recipe) return

        this.m_BP.history.startTransaction()

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['recipe'], recipe, 'Change recipe')
            .onDone(r => this.emit('recipe', r))
            .commit()

        if (recipe !== undefined) {
            // Some modules on the entity may not be compatible with the new selected recipe, filter those out
            this.modules = this.modules
                .map(k => FD.items[k])
                .filter(
                    item => !(item.limitation !== undefined && !item.limitation.includes(recipe))
                )
                .map(item => item.name)
        }

        this.m_BP.history.commitTransaction()
    }

    /** Recipes this entity can accept */
    public get acceptedRecipes(): string[] {
        if (this.entityData.crafting_categories === undefined) return []

        return Object.keys(FD.recipes)
            .map(k => FD.recipes[k])
            .filter(recipe => this.entityData.crafting_categories.includes(recipe.category))
            .map(recipe => recipe.name)
    }

    /** Count of module slots */
    public get moduleSlots(): number {
        if (this.entityData.module_specification === undefined) return 0
        return this.entityData.module_specification.module_slots
    }

    /** Modules this entity can accept */
    public get acceptedModules(): string[] {
        if (this.entityData.module_specification === undefined) return []

        return (
            FD.getModulesFor(this.name)
                // filter modules based on module limitation
                .filter(
                    item =>
                        !this.recipe || !(item.limitation && !item.limitation.includes(this.recipe))
                )
                .map(item => item.name)
        )
    }

    /** Filters this entity can accept (only splitters, inserters and logistic chests) */
    public get acceptedFilters(): string[] {
        if (this.filterSlots === 0) return []

        return Object.keys(FD.items)
            .map(k => FD.items[k])
            .map(item => item.name)
    }

    /** List of all modules */
    public get modules(): string[] {
        const modulesObj = this.m_rawEntity.items
        if (modulesObj === undefined || Object.keys(modulesObj).length === 0) return []
        return Object.keys(modulesObj).flatMap(k => Array<string>(modulesObj[k]).fill(k))
    }
    public set modules(modules: string[]) {
        if (util.equalArrays(this.modules, modules)) return

        const ms: Record<string, number> = {}
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
    public get filterSlots(): number {
        if (this.name.includes('splitter')) return 1
        if (this.entityData.filter_count !== undefined) return this.entityData.filter_count
        if (this.entityData.max_logistic_slots !== undefined) {
            return this.entityData.max_logistic_slots
        }
        if (this.name === 'logistic_chest_buffer' || this.name === 'logistic_chest_requester') {
            return this.logisticChestFilters.reduce(
                (max, filter) => Math.max(max, filter.index),
                30 // TODO: find a way to fix this properly
            )
        }
        return 0
    }

    /** List of all filter(s) for splitters, inserters and logistic chests */
    public get filters(): IFilter[] {
        switch (this.name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                return this.splitterFilter
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
    public set filters(list: IFilter[]) {
        const FILTERS =
            list === undefined || list.length === 0 ? undefined : list.filter(f => !!f.name)
        switch (this.name) {
            case 'splitter':
            case 'fast_splitter':
            case 'express_splitter': {
                this.splitterFilter = FILTERS
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
    public get splitterInputPriority(): string {
        return this.m_rawEntity.input_priority
    }
    public set splitterInputPriority(priority: string) {
        if (this.m_rawEntity.input_priority === priority) return

        this.m_BP.history
            .updateValue(
                this.m_rawEntity,
                ['input_priority'],
                priority,
                'Change splitter input priority'
            )
            .onDone(() => this.emit('splitterInputPriority', this.splitterInputPriority))
            .commit()
    }

    /** Splitter output priority */
    public get splitterOutputPriority(): string {
        return this.m_rawEntity.output_priority
    }
    public set splitterOutputPriority(priority: string) {
        if (this.m_rawEntity.output_priority === priority) return

        this.m_BP.history.startTransaction()

        this.m_BP.history
            .updateValue(
                this.m_rawEntity,
                ['output_priority'],
                priority,
                'Change splitter output priority'
            )
            .onDone(() => this.emit('splitterOutputPriority', this.splitterOutputPriority))
            .commit()

        if (priority === undefined) {
            this.filters = undefined
        }

        this.m_BP.history.commitTransaction()
    }

    /** Splitter filter */
    private get splitterFilter(): IFilter[] {
        if (!this.m_rawEntity.filter) return []
        return [{ index: 1, name: this.m_rawEntity.filter }]
    }
    private set splitterFilter(filters: IFilter[]) {
        const filter = filters === undefined ? undefined : filters[0].name
        if (this.m_rawEntity.filter === filter) return

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

    public get filterMode(): 'whitelist' | 'blacklist' {
        return this.m_rawEntity.filter_mode === 'blacklist' ? 'blacklist' : 'whitelist'
    }

    public set filterMode(filterMode: 'whitelist' | 'blacklist') {
        const mode = filterMode === 'blacklist' ? 'blacklist' : undefined

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['filter_mode'], mode, 'Change filter mode')
            .onDone(() => this.emit('filterMode', this.filterMode))
            .commit()
    }

    /** Inserter filter */
    private get inserterFilters(): IFilter[] {
        return this.m_rawEntity.filters
    }
    private set inserterFilters(filters: IFilter[]) {
        if (filters === undefined && this.m_rawEntity.filters === undefined) return
        if (util.areArraysEquivalent(filters, this.m_rawEntity.filters)) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['filters'], filters, 'Change inserter filter')
            .onDone(() => this.emit('inserterFilters'))
            .onDone(() => this.emit('filters'))
            .commit()
    }

    /** Logistic chest filters */
    private get logisticChestFilters(): IFilter[] {
        return this.m_rawEntity.request_filters || []
    }
    private set logisticChestFilters(filters: IFilter[]) {
        if (filters === undefined && this.m_rawEntity.request_filters === undefined) return
        if (util.areArraysEquivalent(filters, this.m_rawEntity.request_filters)) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['request_filters'], filters, 'Change chest filter')
            .onDone(() => this.emit('logisticChestFilters'))
            .onDone(() => this.emit('filters'))
            .commit()
    }

    private get infinityChestFilters(): IFilter[] {
        if (!this.m_rawEntity.infinity_settings) return []
        return this.m_rawEntity.infinity_settings.filters
    }

    private get infinityPipeFilters(): IFilter[] {
        if (!this.m_rawEntity.infinity_settings) return []
        return [{ name: this.m_rawEntity.infinity_settings.name, index: 1 }]
    }

    /** Requester chest - request from buffer chest */
    public get requestFromBufferChest(): boolean {
        return this.m_rawEntity.request_from_buffers
    }
    public set requestFromBufferChest(request: boolean) {
        if (this.m_rawEntity.request_from_buffers === request) return

        this.m_BP.history
            .updateValue(
                this.m_rawEntity,
                ['request_from_buffers'],
                request,
                'Change request from buffer chest'
            )
            .onDone(() => this.emit('requestFromBufferChest'))
            .commit()
    }

    public get inserterStackSize(): number {
        if (this.m_rawEntity.override_stack_size) return this.m_rawEntity.override_stack_size
        if (this.name.includes('stack')) return 12
        return 3
    }

    public get constantCombinatorFilters(): BPS.IConstantCombinatorFilter[] {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.filters
    }

    public get deciderCombinatorConditions(): BPS.IDeciderCondition {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.decider_conditions
    }

    public get arithmeticCombinatorConditions(): BPS.IArithmeticCondition {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.arithmetic_conditions
    }

    public get generateConnector(): boolean {
        return this.hasConnections || this.connectToLogisticNetwork
    }

    private get connectToLogisticNetwork(): boolean {
        return (
            this.m_rawEntity.control_behavior &&
            this.m_rawEntity.control_behavior.connect_to_logistic_network
        )
    }

    private get hasConnections(): boolean {
        return this.m_BP.wireConnections.getEntityConnections(this.entityNumber).length > 0
    }

    public get chemicalPlantDontConnectOutput(): boolean {
        if (!this.recipe) return false
        return !FD.recipes[this.recipe].results.find(result => result.type === 'fluid')
    }

    public get trainStopColor(): BPS.IColor {
        return this.m_rawEntity.color
    }

    /** Entity Train Stop Station name */
    public get station(): string {
        return this.m_rawEntity.station
    }

    public set station(station: string) {
        if (this.m_rawEntity.station === station) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['station'], station, 'Change station name')
            .onDone(() => this.emit('station'))
            .commit()
    }

    /** Entity Train Stop Trains Limit */
    public get manualTrainsLimit(): number | undefined {
        return this.m_rawEntity.manual_trains_limit
    }

    public set manualTrainsLimit(limit: number | undefined) {
        if (this.m_rawEntity.manual_trains_limit === limit) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, ['manual_trains_limit'], limit, 'Change trains limit')
            .onDone(() => this.emit('manualTrainsLimit'))
            .commit()
    }

    public get operator(): string {
        if (this.name === 'decider_combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) {
                return cb.decider_conditions === undefined
                    ? undefined
                    : cb.decider_conditions.comparator
            }
        }
        if (this.name === 'arithmetic_combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) {
                return cb.arithmetic_conditions === undefined
                    ? undefined
                    : cb.arithmetic_conditions.operation
            }
        }
        return undefined
    }

    private get canBeRotated(): boolean {
        if (this.name === 'assembling_machine_2' || this.name === 'assembling_machine_3') {
            return this.assemblerCraftsWithFluid
        }
        return (
            this.entityData.possible_rotations !== undefined &&
            !this.m_BP.entityPositionGrid.sharesCell({
                x: this.position.x,
                y: this.position.y,
                w: this.size.x,
                h: this.size.y,
            })
        )
    }

    public getRotatedCopy(ccw = false): Entity {
        const position = ccw
            ? { x: this.m_rawEntity.position.y, y: -this.m_rawEntity.position.x }
            : { x: -this.m_rawEntity.position.y, y: this.m_rawEntity.position.x }
        const direction = this.constrainDirection((this.direction + (ccw ? 6 : 2)) % 8)
        const updatedRawEntity = { ...this.m_rawEntity, position, direction }
        if (direction === 0) delete updatedRawEntity.direction

        return new Entity(updatedRawEntity, this.m_BP)
    }

    private constrainDirection(direction: number): number {
        const pr = this.entityData.possible_rotations
        let canRotate = pr !== undefined

        if (this.type === 'assembling_machine') canRotate = this.assemblerCraftsWithFluid
        if (canRotate) {
            if (!pr.includes(direction)) {
                if (direction === 4 && pr.includes(0)) {
                    return 0
                } else if (direction === 6 && pr.includes(2)) {
                    return 2
                } else {
                    return this.direction
                }
            }
        } else {
            return 0
        }
        return direction
    }

    private changePriority(priority?: 'left' | 'right'): 'left' | 'right' | undefined {
        if (priority === 'left') return 'right'
        else if (priority === 'right') return 'left'
        return priority
    }

    public getFlippedCopy(vertical: boolean): Entity {
        // Curved Rail thing is (2, 4, 6, 0) down left, (7, 1, 3, 5)
        // Vert: 2-7, 6-3, 4-5, 0-1  Normal: 0-4
        // Horz: 2-3, 4-1, 6-7, 0-5  Normal: 2-6
        // Straight rail: 1, 2, 7, 0, 5, 2, 3, 0
        // Vert: 1-3, 2-2, 7-5, 0-0
        // Horz: 1-7, 3-5
        const translation_map: { [key: string]: { [vert: string]: number[] } } = {
            curved_rail: { true: [5, 4, 3, 2, 1, 0, 7, 6], false: [1, 0, 7, 6, 5, 4, 3, 2] },
            straight_rail: { true: [0, 3, 2, 1, 4, 7, 6, 5], false: [0, 7, 2, 5, 4, 3, 6, 1] },
            default: { true: [4, 1, 2, 3, 0, 5, 6, 7], false: [0, 1, 6, 3, 4, 5, 2, 7] },
        }

        const non_flip_entities = [
            'chemical_plant',
            'oil_refinery',
            'train_stop',
            'rail_chain_signal',
            'rail_signal',
        ]

        if (non_flip_entities.includes(this.name))
            throw new IllegalFlipError(`${this.name} cannot be flipped`)

        const translation =
            this.name in translation_map ? translation_map[this.name] : translation_map.default
        const direction =
            this.name === 'storage_tank'
                ? 2 - this.direction
                : this.constrainDirection(translation[String(vertical)][this.direction])

        let input_priority = this.m_rawEntity.input_priority
        let output_priority = this.m_rawEntity.output_priority

        if (
            (vertical && (direction === 2 || direction === 4)) ||
            (!vertical && (direction === 0 || direction === 6))
        ) {
            input_priority = this.changePriority(input_priority)
            output_priority = this.changePriority(output_priority)
        }

        const position = vertical
            ? { x: this.m_rawEntity.position.x, y: -this.m_rawEntity.position.y }
            : { x: -this.m_rawEntity.position.x, y: this.m_rawEntity.position.y }
        const updatedRawEntity = {
            ...this.m_rawEntity,
            direction,
            position,
            input_priority,
            output_priority,
        }
        if (direction === 0) delete updatedRawEntity.direction

        return new Entity(updatedRawEntity, this.m_BP)
    }

    private rotateDir(ccw: boolean): number {
        if (!this.canBeRotated) return this.direction
        const pr = this.entityData.possible_rotations
        return pr[
            (pr.indexOf(this.direction) +
                (this.size.x !== this.size.y || this.type === 'underground_belt' ? 2 : 1) *
                    (ccw ? 3 : 1)) %
                pr.length
        ]
    }

    public rotate(ccw = false, rotateOpposingUB = false): void {
        const newDir = this.rotateDir(ccw)

        if (newDir === this.direction) return

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

    public canPasteSettings(sourceEntity: Entity): boolean {
        return sourceEntity !== this && sourceEntity.type === this.type
    }

    /** Paste relevant data from source entity */
    public pasteSettings(sourceEntity: Entity): void {
        if (!this.canPasteSettings(sourceEntity)) return

        this.m_BP.history.startTransaction('Paste settings to entity')

        // PASTE RECIPE
        let tRecipe = this.recipe
        const aR = this.acceptedRecipes
        if (aR.length > 0 && sourceEntity.acceptedRecipes) {
            tRecipe =
                sourceEntity.recipe !== undefined && aR.includes(sourceEntity.recipe)
                    ? sourceEntity.recipe
                    : undefined
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
        if (aF.length > 0 && sourceEntity.acceptedFilters) {
            if (sourceEntity.filters && sourceEntity.filters.length > 0) {
                this.filters = sourceEntity.filters
                    .filter(f => aF.includes(f.name))
                    .slice(0, this.filterSlots)
            } else {
                this.filters = []
            }
        }

        // PASTE REQUESTER CHEST SETTINGS
        if (
            this.type === 'logistic_chest_requester' &&
            sourceEntity.type === 'logistic_chest_requester'
        ) {
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

    public get assemblerCraftsWithFluid(): boolean {
        return (
            this.recipe &&
            FD.recipes[this.recipe].category === 'crafting_with_fluid' &&
            this.mayCraftWithFluid
        )
    }

    public get mayCraftWithFluid(): boolean {
        return (
            this.entityData.crafting_categories &&
            this.entityData.crafting_categories.includes('crafting_with_fluid')
        )
    }

    public get assemblerPipeDirection(): 'input' | 'output' {
        if (!this.recipe) return undefined
        const recipe = FD.recipes[this.recipe]
        if (recipe.ingredients.find(ingredient => ingredient.type === 'fluid')) return 'input'
        if (recipe.results.find(result => result.type === 'fluid')) return 'output'
        return undefined
    }

    public getWireConnectionPoint(
        color: string,
        side: number,
        direction = this.direction
    ): number[] {
        const e = this.entityData
        // poles
        if (e.connection_points) return e.connection_points[direction / 2].wire[color]
        // combinators
        if (e.input_connection_points) {
            if (side === 1) return e.input_connection_points[direction / 2].wire[color]
            return e.output_connection_points[direction / 2].wire[color]
        }

        if (this.name === 'power_switch' && color === 'copper') {
            return side === 1
                ? e.left_wire_connection_point.wire.copper
                : e.right_wire_connection_point.wire.copper
        }

        if (e.circuit_wire_connection_point) return e.circuit_wire_connection_point.wire[color]

        const getIndex = (): number => {
            if (this.type === 'transport_belt') {
                const i = getBeltWireConnectionIndex(
                    this.m_BP.entityPositionGrid,
                    this.position,
                    direction
                )
                return i * 4
            }
            if (e.circuit_wire_connection_points.length === 8) return direction
            return direction / 2
        }
        return e.circuit_wire_connection_points[getIndex()].wire[color]
    }

    private getWire_connection_box(
        color: string,
        side: number,
        direction = this.direction
    ): number[][] {
        const e = this.entityData
        const size_box = [
            [-e.size.width / 2, -e.size.height / 2],
            [+e.size.width / 2, +e.size.height / 2],
        ]
        // use size_box for cell-wise selection, use e.selection_box for "true" selection
        if (side === 1 && e.connection_points?.[direction / 2].wire[color]) return size_box
        if (side === 1 && e.circuit_wire_connection_point?.wire[color]) return size_box
        if (side === 1 && e.circuit_wire_connection_points?.[direction / 2].wire[color])
            return size_box
        if (side === 1 && e.input_connection_points?.[direction / 2].wire[color])
            return e.input_connection_bounding_box
        if (side === 2 && e.output_connection_points?.[direction / 2].wire[color])
            return e.output_connection_bounding_box
        if (side === 1 && e.left_wire_connection_point?.wire[color]) {
            const box = util.duplicate(size_box)
            box[1][0] = (box[0][0] + box[1][0]) / 2
            return box
        }
        if (side === 2 && e.right_wire_connection_point?.wire[color]) {
            const box = util.duplicate(size_box)
            box[0][0] = (box[0][0] + box[1][0]) / 2
            return box
        }
    }

    public getWireConnectionBoundingBox(
        color: string,
        side: number,
        direction = this.direction
    ): IPoint[] {
        const box = this.getWire_connection_box(color, side, direction)
        if (box === undefined) return undefined
        let bbox: IPoint[] = box.map(util.Point)
        bbox = bbox.map(p => util.rotatePointBasedOnDir(p, direction))
        bbox = [
            { x: Math.min(...bbox.map(p => p.x)), y: Math.min(...bbox.map(p => p.y)) },
            { x: Math.max(...bbox.map(p => p.x)), y: Math.max(...bbox.map(p => p.y)) },
        ]
        return bbox
    }

    public serialize(entNrWhitelist?: Set<number>): BPS.IEntity {
        return util.duplicate({
            ...this.m_rawEntity,
            ...this.m_BP.wireConnections.serializeConnectionData(this.entityNumber, entNrWhitelist),
        })
    }
}
