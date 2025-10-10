import EventEmitter from 'eventemitter3'
import {
    IArithmeticCondition,
    IConstantCombinatorFilter,
    IDeciderCondition,
    IEntity,
    IPoint,
    FilterPriority,
    FilterMode,
    DirectionType,
} from '../types'
import util from '../common/util'
import { IllegalFlipError } from '../containers/PaintContainer'
import G from '../common/globals'
import FD, {
    ColorWithAlpha,
    getCircuitConnector,
    getWireConnectionPoint,
    getEntitySize,
    getModule,
    getPossibleRotations,
    isCraftingMachine,
    isInserter,
    mapBoundingBox,
    getMaxWireDistance,
    hasModuleFunctionality,
    recipeSupportsModule,
} from './factorioData'
import { Blueprint } from './Blueprint'
import { getBeltWireConnectionIndex } from './spriteDataBuilder'
import U from './generators/util'
import { EntityWithOwnerPrototype, CombinatorPrototype } from 'factorio:prototype'

export interface IFilter {
    /** Slot index (1 based ... not 0 like arrays) */
    index: number
    /** Name of entity to be filtered */
    name: string
    /** If stacking is allowed, how many shall be stacked */
    count?: number
}

// TODO: Handle the modules within the class differently so that modules would stay in the same place during editing the blueprint

export interface EntityEvents {
    destroy: []
    position: [newValue: IPoint, oldValue: IPoint]
    direction: []
    directionType: []
    recipe: [recipe: string]
    modules: [modules: string[]]
    splitterInputPriority: [priority: FilterPriority]
    splitterOutputPriority: [priority: FilterPriority]
    splitterFilter: []
    filters: []
    inserterFilters: []
    filterMode: [mode: FilterMode]
    logisticChestFilters: []
    requestFromBufferChest: []
    station: []
    manualTrainsLimit: []
}

/** Entity Base Class */
export class Entity extends EventEmitter<EntityEvents> {
    /** Field to hold raw entity */
    private readonly m_rawEntity: IEntity

    /** Field to hold reference to blueprint */
    private readonly m_BP: Blueprint

    /**
     * Construct Entity Base Class
     * @param rawEntity Raw entity object
     * @param blueprint Reference to blueprint
     */
    public constructor(rawEntity: IEntity, blueprint: Blueprint) {
        super()
        this.m_BP = blueprint
        this.m_rawEntity = rawEntity
    }

    public get rawEntity(): IEntity {
        return this.m_rawEntity
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
    public get type(): EntityWithOwnerPrototype['type'] {
        return FD.entities[this.name].type
    }

    /** Direct access to entity meta data from core */
    public get entityData(): EntityWithOwnerPrototype {
        return FD.entities[this.name]
    }

    /** Entity size */
    public get size(): IPoint {
        return getEntitySize(this.entityData, this.direction)
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
            .updateValue(this.m_rawEntity, 'position', position, 'Change position')
            .onDone((newValue, oldValue) => {
                this.m_BP.entityPositionGrid.removeTileData(this, oldValue)
                this.m_BP.entityPositionGrid.setTileData(this, newValue)
                this.emit('position', newValue, oldValue)
            })
            .commit()
    }

    public get maxWireDistance(): number {
        return getMaxWireDistance(this.entityData)
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
        if (this.type === 'electric-pole') {
            return this.m_BP.wireConnections.getPowerPoleDirection(this.entityNumber)
        }
        return this.m_rawEntity.direction === undefined ? 0 : this.m_rawEntity.direction
    }
    public set direction(direction: number) {
        if (this.m_rawEntity.direction === direction) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, 'direction', direction, 'Change direction')
            .onDone(() => this.emit('direction'))
            .commit()
    }

    /** Direction Type (input|output) for underground belts */
    public get directionType(): DirectionType {
        return this.m_rawEntity.type
    }
    public set directionType(type: DirectionType) {
        if (this.m_rawEntity.type === type) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, 'type', type, 'Change direction type')
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
            .updateValue(this.m_rawEntity, 'recipe', recipe, 'Change recipe')
            .onDone(r => this.emit('recipe', r))
            .commit()

        // Some modules on the entity may not be compatible with the new selected recipe, filter those out
        if (recipe !== undefined) {
            console.log(this.modules)
            this.modules = this.modules
                .map(m => getModule(m))
                .filter(module => recipeSupportsModule(recipe, module))
                .map(module => module.name)
            console.log(this.modules)
        }

        this.m_BP.history.commitTransaction()
    }

    /** Recipes this entity can accept */
    public get acceptedRecipes(): string[] {
        const e = this.entityData
        if (!isCraftingMachine(e)) return []

        return Object.keys(FD.recipes)
            .map(k => FD.recipes[k])
            .filter(recipe => e.crafting_categories.includes(recipe.category))
            .map(recipe => recipe.name)
    }

    /** Count of module slots */
    public get moduleSlots(): number {
        const e = this.entityData
        if (hasModuleFunctionality(e)) return e.module_slots || 0
        return 0
    }

    /** Modules this entity can accept */
    public get acceptedModules(): string[] {
        const e = this.entityData
        if (!hasModuleFunctionality(e)) return []

        return (
            FD.getModulesFor(this.name)
                // filter modules based on recipe
                .filter(module => !this.recipe || recipeSupportsModule(this.recipe, module))
                .map(module => module.name)
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
            .updateValue(this.m_rawEntity, 'items', ms, 'Change modules')
            .onDone(() => this.emit('modules', this.modules))
            .commit()
    }

    /** Count of filter slots */
    public get filterSlots(): number {
        if (this.type === 'splitter') return 1
        if (this.entityData.filter_count !== undefined) return this.entityData.filter_count
        if (this.entityData.max_logistic_slots !== undefined) {
            return this.entityData.max_logistic_slots
        }
        if (this.name === 'buffer-chest' || this.name === 'requester-chest') {
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
            case 'fast-splitter':
            case 'express-splitter': {
                return this.splitterFilter
            }
            case 'burner-inserter':
            case 'inserter':
            case 'long-handed-inserter':
            case 'fast-inserter':
            case 'bulk-inserter':
            case 'stack-inserter': {
                return this.inserterFilters
            }
            case 'storage-chest':
            case 'requester-chest':
            case 'buffer-chest':
                return this.logisticChestFilters
            case 'infinity-chest':
                return this.infinityChestFilters
            case 'infinity-pipe':
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
            case 'fast-splitter':
            case 'express-splitter': {
                this.splitterFilter = FILTERS
                return
            }
            case 'burner-inserter':
            case 'inserter':
            case 'long-handed-inserter':
            case 'fast-inserter':
            case 'bulk-inserter':
            case 'stack-inserter': {
                this.inserterFilters = FILTERS
                return
            }
            case 'storage-chest':
            case 'requester-chest':
            case 'buffer-chest': {
                this.logisticChestFilters = FILTERS
            }
        }
    }

    /** Splitter input priority */
    public get splitterInputPriority(): FilterPriority {
        return this.m_rawEntity.input_priority
    }
    public set splitterInputPriority(priority: FilterPriority) {
        if (this.m_rawEntity.input_priority === priority) return

        this.m_BP.history
            .updateValue(
                this.m_rawEntity,
                'input_priority',
                priority,
                'Change splitter input priority'
            )
            .onDone(() => this.emit('splitterInputPriority', this.splitterInputPriority))
            .commit()
    }

    /** Splitter output priority */
    public get splitterOutputPriority(): FilterPriority {
        return this.m_rawEntity.output_priority
    }
    public set splitterOutputPriority(priority: FilterPriority) {
        if (this.m_rawEntity.output_priority === priority) return

        this.m_BP.history.startTransaction()

        this.m_BP.history
            .updateValue(
                this.m_rawEntity,
                'output_priority',
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
            .updateValue(this.m_rawEntity, 'filter', filter, 'Change splitter filter')
            .onDone(() => this.emit('splitterFilter'))
            .onDone(() => this.emit('filters'))
            .commit()

        if (filter !== undefined) {
            if (this.splitterOutputPriority === undefined) {
                this.splitterOutputPriority = 'left'
            }
        }

        this.m_BP.history.commitTransaction()
    }

    public get filterMode(): FilterMode {
        return this.m_rawEntity.filter_mode === 'blacklist' ? 'blacklist' : 'whitelist'
    }

    public set filterMode(filterMode: FilterMode) {
        const mode = filterMode === 'blacklist' ? 'blacklist' : undefined

        this.m_BP.history
            .updateValue(this.m_rawEntity, 'filter_mode', mode, 'Change filter mode')
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
            .updateValue(this.m_rawEntity, 'filters', filters, 'Change inserter filter')
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
            .updateValue(this.m_rawEntity, 'request_filters', filters, 'Change chest filter')
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
                'request_from_buffers',
                request,
                'Change request from buffer chest'
            )
            .onDone(() => this.emit('requestFromBufferChest'))
            .commit()
    }

    public get inserterStackSize(): null | number {
        if (this.m_rawEntity.override_stack_size) return this.m_rawEntity.override_stack_size
        if (isInserter(this.entityData)) {
            if (this.entityData.bulk) {
                return 12
            } else {
                return 3
            }
        }
        return null
    }

    public get constantCombinatorFilters(): IConstantCombinatorFilter[] {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.filters
    }

    public get deciderCombinatorConditions(): IDeciderCondition {
        return this.m_rawEntity.control_behavior === undefined
            ? undefined
            : this.m_rawEntity.control_behavior.decider_conditions
    }

    public get arithmeticCombinatorConditions(): IArithmeticCondition {
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

    public get trainStopColor(): ColorWithAlpha {
        return this.m_rawEntity.color
    }

    /** Entity Train Stop Station name */
    public get station(): string {
        return this.m_rawEntity.station
    }

    public set station(station: string) {
        if (this.m_rawEntity.station === station) return

        this.m_BP.history
            .updateValue(this.m_rawEntity, 'station', station, 'Change station name')
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
            .updateValue(this.m_rawEntity, 'manual_trains_limit', limit, 'Change trains limit')
            .onDone(() => this.emit('manualTrainsLimit'))
            .commit()
    }

    public get operator(): string {
        if (this.type === 'decider-combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) {
                return cb.decider_conditions === undefined
                    ? undefined
                    : cb.decider_conditions.comparator
            }
        }
        if (this.type === 'arithmetic-combinator') {
            const cb = this.m_rawEntity.control_behavior
            if (cb) {
                return cb.arithmetic_conditions === undefined
                    ? undefined
                    : cb.arithmetic_conditions.operation
            }
        }
        return undefined
    }

    private get possibleRotations(): number[] {
        return getPossibleRotations(
            this.entityData,
            this.assemblerHasFluidInputs || this.assemblerHasFluidOutputs
        )
    }

    private get canBeRotated(): boolean {
        return (
            this.possibleRotations.length !== 0 &&
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
        const direction = this.constrainDirection((this.direction + (ccw ? 12 : 4)) % 16)
        const updatedRawEntity = { ...this.m_rawEntity, position, direction }
        if (direction === 0) delete updatedRawEntity.direction

        return new Entity(updatedRawEntity, this.m_BP)
    }

    private constrainDirection(direction: number): number {
        const pr = this.possibleRotations
        let canRotate = pr.length !== 0

        if (canRotate) {
            if (!pr.includes(direction)) {
                if (direction === 8 && pr.includes(0)) {
                    return 0
                } else if (direction === 12 && pr.includes(4)) {
                    return 4
                } else {
                    return this.direction
                }
            }
        } else {
            return 0
        }
        return direction
    }

    private changePriority(priority?: FilterPriority): FilterPriority | undefined {
        if (priority === 'left') return 'right'
        else if (priority === 'right') return 'left'
        return priority
    }

    public getFlippedCopy(vertical: boolean): Entity {
        const non_flip_entities: EntityWithOwnerPrototype['type'][] = [
            'train-stop',
            'rail-chain-signal',
            'rail-signal',
        ]

        if (non_flip_entities.includes(this.type))
            throw new IllegalFlipError(`${this.name} cannot be flipped`)

        const axisDir = vertical ? 12 : 8
        const direction = this.constrainDirection((axisDir * 2 - this.direction) % 16)

        let input_priority = this.m_rawEntity.input_priority
        let output_priority = this.m_rawEntity.output_priority

        if (
            (vertical && (direction === 4 || direction === 8)) ||
            (!vertical && (direction === 0 || direction === 12))
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
        const pr = this.possibleRotations
        return pr[
            (pr.indexOf(this.direction) +
                (this.size.x !== this.size.y || this.type === 'underground-belt' ? 2 : 1) *
                    (ccw ? 3 : 1)) %
                pr.length
        ]
    }

    public rotate(ccw = false, rotateOpposingUB = false): void {
        const newDir = this.rotateDir(ccw)

        if (newDir === this.direction) return

        this.m_BP.history.startTransaction('Rotate entity')

        if (this.type === 'underground-belt' || this.type === 'loader') {
            if (rotateOpposingUB) {
                const otherEntity = this.m_BP.entities.get(
                    this.m_BP.entityPositionGrid.getOpposingEntity(
                        this.name,
                        this.direction,
                        this.position,
                        this.directionType === 'input' ? this.direction : (this.direction + 8) % 16,
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
            this.type === 'assembling-machine' &&
            this.name !== 'assembling-machine' &&
            tRecipe &&
            FD.recipes[tRecipe].category === 'crafting-with-fluid'
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
        if (this.name === 'requester-chest' && sourceEntity.name === 'requester-chest') {
            this.requestFromBufferChest = sourceEntity.requestFromBufferChest
        }

        this.m_BP.history.commitTransaction()

        /*
            TODO:

            assembling machines -> filter inserters:
                filters

            assembling machines -> requester chest:
                filters
                request amount formula: Math.min(ingredientAmount, Math.ceil((ingredientAmount * newCraftingSpeed) / recipe.energy_required))

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

    public get mayCraftWithFluid(): boolean {
        const e = this.entityData
        if (!isCraftingMachine(e)) return false
        return e.crafting_categories && e.crafting_categories.includes('crafting-with-fluid')
    }

    public get assemblerHasFluidInputs(): boolean {
        if (!this.recipe) return false
        const recipe = FD.recipes[this.recipe]
        return !!recipe.ingredients.find(ingredient => ingredient.type === 'fluid')
    }

    public get assemblerHasFluidOutputs(): boolean {
        if (!this.recipe) return false
        const recipe = FD.recipes[this.recipe]
        return !!recipe.results.find(result => result.type === 'fluid')
    }

    public getWireConnectionPoint(
        color: string,
        side: number,
        direction = this.direction
    ): undefined | number[] {
        const e = this.entityData

        const getCombinatorSide = () => (side === 1 ? 'input' : 'output')
        const getPowerSwitchSide = () =>
            color === 'copper' ? (side === 1 ? 'left' : 'right') : 'circuit'
        const wcp = getWireConnectionPoint(e, direction, getCombinatorSide, getPowerSwitchSide)
        if (wcp) {
            return wcp.wire[color]
        }

        const isLoaderInputting = () => this.directionType === 'input'
        const getBeltConnectionIndex = () =>
            getBeltWireConnectionIndex(this.m_BP.entityPositionGrid, this.position, direction)
        const cc = getCircuitConnector(e, direction, isLoaderInputting, getBeltConnectionIndex)
        if (cc) {
            return cc.points.wire[color]
        }
    }

    private getWire_connection_box(
        color: string,
        side: number,
        direction = this.direction
    ): [[number, number], [number, number]] {
        const point = this.getWireConnectionPoint(color, side, direction)
        if (!point) return undefined

        const e = this.entityData
        const e_size = getEntitySize(e)
        const size_box: [[number, number], [number, number]] = [
            [-e_size.x / 2, -e_size.y / 2],
            [+e_size.x / 2, +e_size.y / 2],
        ]

        switch (e.type) {
            case 'arithmetic-combinator':
            case 'decider-combinator':
            case 'selector-combinator': {
                const e_resolved = e as CombinatorPrototype
                if (side === 1) {
                    return mapBoundingBox(e_resolved.input_connection_bounding_box)
                } else {
                    return mapBoundingBox(e_resolved.output_connection_bounding_box)
                }
            }
            case 'power-switch': {
                if (color === 'copper') {
                    if (side === 1) {
                        const box = util.duplicate(size_box)
                        box[1][0] = (box[0][0] + box[1][0]) / 2
                        return box
                    } else {
                        const box = util.duplicate(size_box)
                        box[0][0] = (box[0][0] + box[1][0]) / 2
                        return box
                    }
                }
            }
        }

        return size_box
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

    public serialize(entNrWhitelist?: Set<number>): IEntity {
        return util.duplicate({
            ...this.m_rawEntity,
            ...this.m_BP.wireConnections.serializeConnectionData(this.entityNumber, entNrWhitelist),
        })
    }
}
