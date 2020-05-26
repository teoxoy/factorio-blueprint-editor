declare module '*.png' {
    const path: string
    export default path
}

interface IPoint {
    x: number
    y: number
}

interface IFilter {
    /** Slot index (1 based ... not 0 like arrays) */
    index: number
    /** Name of entity to be filtered */
    name: string
    /** If stacking is allowed, how many shall be stacked */
    count?: number
}

interface IConnection {
    color: string
    entityNumber1: number
    entityNumber2: number
    entitySide1: number
    entitySide2: number
}

interface ISpriteData {
    filename: string
    // filenames?: string[]
    // stripes?: Stripes[]

    width: number
    height: number

    scale?: number
    x?: number
    y?: number
    // priority?: string
    // frame_count?: number
    // line_length?: number
    // direction_count?: number
    // axially_symmetrical?: boolean
    shift?: number[]
    // draw_as_shadow?: boolean
    // repeat_count?: number
    // blend_mode?: string
    // animation_speed?: number
    // run_mode?: string
    // apply_runtime_tint?: boolean
    // apply_projection?: boolean
    // flags?: string[]
    // counterclockwise?: boolean
    tint?: {
        r: number
        g: number
        b: number
        a: number
    }
    // lines_per_file?: number

    anchorX?: number
    anchorY?: number
    divW?: number
    divH?: number
    squishY?: number
    rotAngle?: number
}

/** Namespace for blueprint string interfaces */
declare namespace BPS {
    interface IColor {
        r: number
        g: number
        b: number
        a: number
    }

    type SignalType = 'item' | 'virtual' | 'fluid'

    interface ISignal {
        name: string
        type: SignalType
    }

    interface ICondition {
        comparator?: '<' | '>' | '≤' | '≥' | '=' | '≠'
        constant?: number
        first_signal?: ISignal
        second_signal?: ISignal
    }

    interface IFilter {
        index: number
        name: string
    }

    interface IWireColor {
        /** Entity number */
        entity_id: number
        /** Entity side */
        circuit_id?: number
        wire_id?: number
    }

    interface IConnSide extends Record<string, IWireColor[]> {
        red?: IWireColor[]
        green?: IWireColor[]
        copper?: IWireColor[]
    }

    interface IConnection extends Record<string, IConnSide | IWireColor[]> {
        1?: IConnSide
        2?: IConnSide
        Cu0?: IWireColor[]
        Cu1?: IWireColor[]
    }

    interface IConstantCombinatorFilter {
        index: number
        count: number
        signal: ISignal
    }

    interface IDeciderCondition {
        comparator?: string
        constant?: number
        copy_count_from_input?: boolean
        first_signal?: ISignal
        second_signal?: ISignal
        output_signal?: ISignal
    }

    interface IArithmeticCondition {
        operation?: '+' | '-' | '*' | '/' | '%' | '^' | '<<' | '>>' | 'AND' | 'OR' | 'XOR'
        constant?: number
        first_constant?: number
        second_constant?: number
        first_signal?: ISignal
        second_signal?: ISignal
        output_signal?: ISignal
    }

    interface IEntity {
        entity_number: number
        name: string
        position: IPoint

        /** direction, can be ommited if 0 */
        direction?: number // 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
        /** direction type, only present if entity is of type underground-belt */
        type?: 'input' | 'output'
        /** recipe name, only present if entity is of type assembling-machine or has fixed_recipe */
        recipe?: string
        /** inventory size limitation, only present if entity has inventory_size */
        bar?: number
        /**
         * keys are item names and value nr of items, only present if entity is locomotive or has module_specification
         * for the locomotive it represents fuel and for an eintity with module_specification it represents modules
         */
        items?: Record<string, number>

        /** splitter input priority, only present if entity is of type splitter */
        input_priority?: 'left' | 'right'
        /** splitter input priority, only present if entity is of type splitter */
        output_priority?: 'left' | 'right'
        /** splitter filter for output priority, only present if entity is of type splitter */
        filter?: string

        /** train stop station name, only present if entity is train-stop */
        station?: string
        /** only present if entity is locomotive or train-stop */
        color?: IColor
        /** only present if entity is locomotive, cargo_wagon or fluid_wagon */
        orientation?: number
        /** only present if entity is cargo_wagon */
        inventory?: {
            filters: IFilter[]
        }

        /** auto launch, only present if entity is rocket-silo */
        auto_launch?: boolean
        /** override stack size, only present if entity is of type inserter */
        override_stack_size?: number
        /** only present if entity is logistic-chest-requester */
        request_from_buffers?: boolean
        /** only present if entity is filter-inserter or stack-filter-inserter */
        filter_mode?: 'blacklist'
        /** only present if entity is filter-inserter, stack-filter-inserter or of type loader */
        filters?: IFilter[]
        /** only present if entity is logistic-chest-storage, logistic-chest-buffer or logistic-chest-requester */
        request_filters?: {
            index: number
            name: string
            count: number
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
            playback_globally?: boolean
            allow_polyphony?: boolean
        }

        /** only present if entity is electric_energy_interface */
        buffer_size?: number
        /** only present if entity is electric_energy_interface */
        power_production?: number
        /** only present if entity is electric_energy_interface */
        power_usage?: number

        /** only present if entity is heat_interface */
        mode?: 'at_least' | 'at_most' | 'exactly'
        /** only present if entity is heat_interface */
        temperature?: number

        /** only present if entity is infinity_chest or infinity_pipe */
        infinity_settings?: {
            /** only present if entity is infinity_pipe */
            name?: string
            /** only present if entity is infinity_pipe */
            mode?: 'at_least' | 'at_most' | 'exactly'
            /** only present if entity is infinity_pipe */
            percentage?: number
            /** only present if entity is infinity_pipe */
            temperature?: number

            /** only present if entity is infinity_chest */
            filters?: {
                name: string
                mode: 'at_least' | 'at_most' | 'exactly'
                index: number
                count: number
            }[]
            /** only present if entity is infinity_chest */
            remove_unfiltered_items?: boolean
        }

        /** wire connections */
        connections?: IConnection

        control_behavior?: {
            /** only present if entity is constant-combinator */
            is_on?: boolean
            /** only present if entity is constant-combinator */
            filters?: IConstantCombinatorFilter[]

            /** only present if entity is small-lamp */
            use_colors?: boolean
            /** only present if entity is of type mining-drill or transport-belt or train-stop */
            circuit_enable_disable?: boolean

            /** only present if entity is of type inserter or transport-belt */
            circuit_read_hand_contents?: boolean
            /** 0 = pulse, 1 = hold, only present if entity is of type inserter and circuit_read_hand_contents is true */
            circuit_hand_read_mode?: 0 | 1
            /** only present if entity is of type inserter and override_stack_size is not set */
            circuit_set_stack_size?: boolean
            stack_control_input_signal?: ISignal
            /** 0 = pulse, 1 = hold, only present if entity is of type transport-belt and circuit_read_hand_contents is true */
            circuit_contents_read_mode?: 0 | 1

            /** only present if entity is roboport or logistic-chest-buffer or logistic-chest-requester or of type inserter(3)???????????????? */
            circuit_mode_of_operation?: number

            available_logistic_output_signal?: ISignal
            total_logistic_output_signal?: ISignal
            available_construction_output_signal?: ISignal
            total_construction_output_signal?: ISignal

            /** only present if entity is of type mining-drill */
            circuit_read_resources?: boolean
            /** only present if entity is burner-mining-drill or electric-mining-drill and circuit_read_resources is true */
            circuit_resource_read_mode?: 0 | 1

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

    interface ITile {
        name: string
        position: IPoint
    }

    interface ISchedule {
        locomotives: number[]
        schedule: {
            station: string
            wait_conditions: {
                compare_type: 'and' | 'or'
                type:
                    | 'time'
                    | 'inactivity'
                    | 'full'
                    | 'empty'
                    | 'item_count'
                    | 'fluid_count'
                    | 'circuit'
                    | 'passenger_present'
                    | 'passenger_not_present'
                ticks?: number
                condition?: ICondition
            }[]
        }[]
    }

    interface IBlueprint {
        version: number
        item: 'blueprint'
        icons: {
            index: 1 | 2 | 3 | 4
            signal: ISignal
        }[]

        label?: string
        entities?: IEntity[]
        tiles?: ITile[]
        schedules?: ISchedule[]
    }

    interface IBlueprintBook {
        version: number
        item: 'blueprint_book'
        active_index: number
        blueprints: {
            blueprint: IBlueprint
            index: number
        }[]

        label?: string
    }
}
