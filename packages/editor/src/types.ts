import { ColorWithAlpha } from './core/factorioData'

export interface IPoint {
    x: number
    y: number
}

export type NamedDirection = 'north' | 'east' | 'south' | 'west'
export type NamedDirection8Way =
    | NamedDirection
    | 'northeast'
    | 'southeast'
    | 'southwest'
    | 'northwest'

/** Interfaces and types for blueprint string JSON structure */
export type SignalType = 'item' | 'virtual' | 'fluid'

export interface ISignal {
    name?: string
    type?: SignalType
}

export type ComparatorString = '<' | '>' | '≤' | '≥' | '=' | '≠'

export interface ICondition {
    comparator?: ComparatorString
    constant?: number
    first_signal?: ISignal
    second_signal?: ISignal
}

export interface IFilter {
    index: number
    name: string
}

export interface IWireColor {
    /** Entity number */
    entity_id: number
    /** Entity side (1 or 2) for red or green wires */
    circuit_id?: number
    /** Entity side (0 or 1) for copper wires */
    wire_id?: number
}

export interface IConnSide extends Record<string, IWireColor[]> {
    red?: IWireColor[]
    green?: IWireColor[]
    copper?: IWireColor[]
}

export interface IBPConnection extends Record<string, IConnSide | IWireColor[]> {
    1?: IConnSide
    2?: IConnSide
    Cu0?: IWireColor[]
    Cu1?: IWireColor[]
}

export interface IConstantCombinatorFilter {
    index: number
    count: number
    signal: ISignal
}

export interface BlueprintItemIDAndQualityIDPair {
    name: string
    quality?: string
}

export interface InventoryPosition {
    inventory: defines.inventory
    stack: number
    count?: number
}

export interface ItemInventoryPositions {
    in_inventory?: InventoryPosition[]
    grid_count?: number
}

export interface BlueprintInsertPlan {
    id: BlueprintItemIDAndQualityIDPair
    items: ItemInventoryPositions
}

export interface LogisticFilter {
    index: number
    type?: SignalType
    name?: string
    quality?: string
    comparator?: ComparatorString
    count: number
    max_count?: number
    minimum_delivery_count?: number
    import_from?: string
}

export interface LogisticSection {
    index: number
    filters?: LogisticFilter[]
    group?: string
    multiplier?: number
    active?: number
}

export interface LogisticSections {
    sections?: LogisticSection[]
    trash_not_requested?: boolean
    request_from_buffers?: boolean
}

export interface SlotFilter {
    index: number
    name: string
}

export interface IDeciderCondition {
    comparator?: ComparatorString
    constant?: number
    copy_count_from_input?: boolean
    first_signal?: ISignal
    second_signal?: ISignal
    output_signal?: ISignal
}

export type ArithmeticOperation =
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | '^'
    | '<<'
    | '>>'
    | 'AND'
    | 'OR'
    | 'XOR'

export interface IArithmeticCondition {
    operation?: ArithmeticOperation
    constant?: number
    first_constant?: number
    second_constant?: number
    first_signal?: ISignal
    second_signal?: ISignal
    output_signal?: ISignal
}

export type FilterPriority = 'left' | 'right'
export type FilterMode = 'whitelist' | 'blacklist'
export type DirectionType = 'input' | 'output'
export type InfinityMode = 'at-least' | 'at-most' | 'exactly'

export interface IEntity {
    entity_number: number
    name: string
    position: IPoint

    /** direction, can be ommited if 0 */
    direction?: number // 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
    /** direction type, only present if entity is of type underground-belt */
    type?: DirectionType
    /** recipe name, only present if entity is of type assembling-machine or has fixed_recipe */
    recipe?: string
    recipe_quality?: string
    /** inventory size limitation, only present if entity has inventory_size */
    bar?: number
    /**
     * pre 2.0 this has type Record<string, number>,
     * post 2.0 this has type BlueprintInsertPlan[]
     *
     * keys are item names and value nr of items, only present if entity is locomotive or has module_specification
     * for the locomotive it represents fuel and for an entity with module_specification it represents modules
     */
    items?: Record<string, number> | BlueprintInsertPlan[]

    /** splitter input priority, only present if entity is of type splitter */
    input_priority?: FilterPriority
    /** splitter input priority, only present if entity is of type splitter */
    output_priority?: FilterPriority
    /** splitter filter for output priority, only present if entity is of type splitter */
    filter?: string

    /** train stop station name, only present if entity is train-stop */
    station?: string
    /** trains limit, only present if entity is train-stop */
    manual_trains_limit?: number
    /** only present if entity is locomotive or train-stop */
    color?: ColorWithAlpha
    /** only present if entity is locomotive, cargo_wagon or fluid_wagon */
    orientation?: number
    /** only present if entity is cargo_wagon */
    inventory?: {
        filters: IFilter[]
    }

    /** only present if entity is power-switch */
    switch_state?: boolean
    /** pre 2.0 - auto launch, only present if entity is rocket-silo */
    auto_launch?: boolean
    /** post 2.0 - auto launch, only present if entity is rocket-silo */
    launch_to_orbit_automatically?: boolean
    use_transitional_requests?: boolean
    /** override stack size, only present if entity is of type inserter */
    override_stack_size?: number
    /** only present if entity is requester-chest */
    request_from_buffers?: boolean
    /** only present if entity is of type inserter */
    filter_mode?: FilterMode
    /** only present if entity is of type inserter */
    use_filters?: boolean
    /** only present if entity is of type inserter or loader */
    filters?: IFilter[]
    /** only present if entity is storage-chest, buffer-chest or requester-chest */
    request_filters?: {
        index: number
        name: string
        count?: number
    }[]

    /** only present if entity is programmable-speaker */
    alert_parameters?: {
        alert_message?: string
        icon_signal_id?: ISignal
        show_alert?: boolean
        show_on_map?: boolean
    }
    /** only present if entity is programmable-speaker */
    parameters?: {
        playback_volume?: number
        /** pre 2.0 */
        playback_globally?: boolean
        /** post 2.0 */
        playback_mode?: 'global' | 'surface' | 'local'
        volume_controlled_by_signal?: boolean
        volume_signal_id?: ISignal
        allow_polyphony?: boolean
    }

    /** only present if entity is electric_energy_interface */
    buffer_size?: number
    /** only present if entity is electric_energy_interface */
    power_production?: number
    /** only present if entity is electric_energy_interface */
    power_usage?: number

    /** only present if entity is heat_interface */
    mode?: InfinityMode
    /** only present if entity is heat_interface */
    temperature?: number

    /** only present if entity is ammo-turret, electric-turret, fluid-turret or turret */
    'priority-list'?: SlotFilter[]
    /** only present if entity is ammo-turret, electric-turret, fluid-turret or turret */
    'ignore-unprioritised'?: boolean
    /** only present if entity is artillery-turret */
    artillery_auto_targeting?: boolean

    /** only present if entity is infinity_chest or infinity_pipe */
    infinity_settings?: {
        /** only present if entity is infinity_pipe */
        name?: string
        /** only present if entity is infinity_pipe */
        mode?: InfinityMode
        /** only present if entity is infinity_pipe */
        percentage?: number
        /** only present if entity is infinity_pipe */
        temperature?: number

        /** only present if entity is infinity_chest */
        filters?: {
            name: string
            mode: InfinityMode
            index: number
            count: number
        }[]
        /** only present if entity is infinity_chest */
        remove_unfiltered_items?: boolean
    }

    /** pre 2.0 - power pole wire connections */
    neighbours?: number[]

    /** pre 2.0 - wire connections */
    connections?: IBPConnection

    control_behavior?: {
        /** only present if entity is constant-combinator */
        is_on?: boolean
        /** pre 2.0, only present if entity is constant-combinator */
        filters?: IConstantCombinatorFilter[]
        /** post 2.0, only present if entity is constant-combinator */
        sections?: LogisticSections

        /** only present if entity is small-lamp */
        use_colors?: boolean
        /** only present if entity is of type mining-drill or transport-belt or train-stop */
        circuit_enable_disable?: boolean

        /** only present if entity is of type inserter */
        circuit_set_filters?: boolean
        /** only present if entity is of type inserter or transport-belt */
        circuit_read_hand_contents?: boolean
        /** 0 = pulse, 1 = hold, only present if entity is of type inserter and circuit_read_hand_contents is true */
        circuit_hand_read_mode?: defines.control_behavior.inserter.hand_read_mode
        /** only present if entity is of type inserter and override_stack_size is not set */
        circuit_set_stack_size?: boolean
        stack_control_input_signal?: ISignal
        /** 0 = pulse, 1 = hold, only present if entity is of type transport-belt and circuit_read_hand_contents is true */
        circuit_contents_read_mode?: defines.control_behavior.transport_belt.content_read_mode

        /** only present if entity is cargo landing pad, buffer-chest or requester-chest */
        circuit_mode_of_operation?:
            | defines.control_behavior.cargo_landing_pad.exclusive_mode
            | defines.control_behavior.logistic_container.exclusive_mode

        // only present if entity is roboport
        /** pre 2.0 */
        read_logistics?: boolean
        /** post 2.0 */
        read_items_mode?:
            | defines.control_behavior.roboport.read_items_mode
            | defines.control_behavior.rocket_silo.read_mode
        read_robot_stats?: boolean
        available_logistic_output_signal?: ISignal
        total_logistic_output_signal?: ISignal
        available_construction_output_signal?: ISignal
        total_construction_output_signal?: ISignal
        roboport_count_output_signal?: ISignal

        /** only present if entity is of type mining-drill */
        circuit_read_resources?: boolean
        /** only present if entity is burner-mining-drill or electric-mining-drill and circuit_read_resources is true */
        circuit_resource_read_mode?: defines.control_behavior.mining_drill.resource_read_mode

        /** only present if entity is stone-wall */
        circuit_open_gate?: boolean
        /** only present if entity is stone-wall */
        circuit_read_sensor?: boolean

        /** only present if entity is train-stop */
        send_to_train?: boolean
        /** only present if entity is train-stop */
        read_from_train?: boolean
        /** only present if entity is train-stop */
        read_stopped_train?: boolean
        /** only present if entity is train-stop */
        train_stopped_signal?: ISignal
        /** only present if entity is train-stop */
        set_trains_limit?: boolean
        /** only present if entity is train-stop */
        trains_limit_signal?: ISignal
        /** only present if entity is train-stop */
        read_trains_count?: boolean
        /** only present if entity is train-stop */
        trains_count_signal?: ISignal

        /** only present if entity is rail-signal */
        circuit_close_signal?: boolean
        /** only present if entity is rail-signal, for chain signals: you have the same signals */
        circuit_read_signal?: boolean
        red_output_signal?: ISignal
        orange_output_signal?: ISignal
        green_output_signal?: ISignal
        blue_output_signal?: ISignal

        /** only present if entity is stone-wall or accumulator */
        output_signal?: ISignal

        /** only present if entity is programmable-speaker */
        circuit_parameters?: {
            instrument_id?: number
            note_id?: number
            signal_value_is_pitch?: boolean
            stop_playing_sounds?: boolean
        }

        /** only present if entity is decider-combinator */
        decider_conditions?: IDeciderCondition

        /** only present if entity is arithmetic-combinator */
        arithmetic_conditions?: IArithmeticCondition

        /**
         *  only present if entity is pump, offshore-pump, rail-signal, train-stop, small-lamp,
         *  power-switch, stone-wall, programmable-speaker or of type: inserter, transport-belt or mining-drill
         */
        circuit_condition?: ICondition

        /**
         * only present if entity is pump, offshore-pump, train-stop, small-lamp, power-switch
         * or of type: inserter, transport-belt or mining-drill
         */
        connect_to_logistic_network?: boolean
        /**
         * only present if entity is pump, offshore-pump, train-stop, small-lamp, power-switch
         * or of type: inserter, transport-belt or mining-drill
         */
        logistic_condition?: ICondition
    }
}

export interface ITile {
    name: string
    position: IPoint
}

export type CompareType = 'and' | 'or'

export type WaitConditionType =
    | 'time'
    | 'inactivity'
    | 'full'
    | 'empty'
    | 'item-count'
    | 'fluid-count'
    | 'circuit'
    | 'passenger-present'
    | 'passenger-not-present'

export interface ISchedule {
    locomotives: number[]
    schedule: {
        station: string
        wait_conditions: {
            compare_type: CompareType
            type: WaitConditionType

            ticks?: number
            condition?: ICondition
        }[]
    }[]
}

export interface IIcon {
    index: 1 | 2 | 3 | 4
    signal: ISignal
}

export interface IBlueprint {
    version: number
    item: 'blueprint'
    icons: IIcon[]

    label?: string
    description?: string
    entities?: IEntity[]
    tiles?: ITile[]
    schedules?: ISchedule[]
    'absolute-snapping'?: boolean
    'snap-to-grid'?: IPoint
    'position-relative-to-grid'?: IPoint

    /** post 2.0 */
    wires?: BlueprintWire[]
}

export type BlueprintWire = [
    source_entity_number: number,
    source_wire_connector_id: defines.wire_connector_id,
    target_entity_number: number,
    target_wire_connector_id: defines.wire_connector_id,
]

export interface IBlueprintBookEntry {
    index: number
    blueprint?: IBlueprint
    blueprint_book?: IBlueprintBook
    upgrade_planner?: Record<string, unknown>
    deconstruction_planner?: Record<string, unknown>
}

export interface IBlueprintBook {
    version: number
    item: 'blueprint-book'
    active_index: number
    blueprints?: IBlueprintBookEntry[]

    label?: string
    description?: string
    icons?: IIcon[]
}
