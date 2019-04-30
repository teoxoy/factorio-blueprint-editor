declare module '*.png' {
    const path: string
    export default path
}

declare module '*.json' {
    const content: any
    export default content
}

interface Navigator {
    clipboard: {
        writeText?: (s: string) => Promise<void>
        readText?: () => Promise<string>
    }
}

interface Window {
    doorbellOptions: {
        tags?: string
        id: string
        appKey: string
        windowLoaded?: boolean
        onShow?: () => void
        onHide?: () => void
        onInitialized?: () => void
    }
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

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
namespace BPS {
    interface ISignal {
        name: string
        type: 'item' | 'virtual' | 'fluid'
    }

    interface IWireColor {
        /** Entity number */
        entity_id: number
        /** Entity side */
        circuit_id?: number
        wire_id?: number
    }

    interface IConnSide {
        red?: IWireColor[]
        green?: IWireColor[]
        copper?: IWireColor[]
        [key: string]: IWireColor[]
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
        /** object, keys are module names and value nr of modules, only present if entity has module_specification */
        items?: { [key: string]: number }

        /** splitter input priority, only present if entity is of type splitter */
        input_priority?: 'left' | 'right'
        /** splitter input priority, only present if entity is of type splitter */
        output_priority?: 'left' | 'right'
        /** splitter filter for output priority, only present if entity is of type splitter */
        filter?: string

        /** train stop station name, only present if entity is train-stop */
        station?: string
        /** train stop color, only present if entity is train-stop */
        color?: {
            r: number
            g: number
            b: number
            a: number
        }

        /** auto launch, only present if entity is rocket-silo */
        auto_launch?: boolean
        /** override stack size, only present if entity is of type inserter */
        override_stack_size?: number
        /** only present if entity is logistic-chest-requester */
        request_from_buffers?: boolean
        /** only present if entity is filter-inserter, stack-filter-inserter or of type loader */
        filters?: {
            index: number
            name: string
        }[]
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
        connections?: {
            1: IConnSide
            2: IConnSide
            Cu0: IWireColor[]
            Cu1: IWireColor[]
            [key: string]: IConnSide | IWireColor[]
        }

        control_behavior?: {
            /** only present if entity is constant-combinator */
            is_on?: boolean
            /** only present if entity is constant-combinator */
            filters?: {
                index: number
                count: number
                signal: ISignal
            }[]

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
            decider_conditions?: {
                comparator?: string
                constant?: number
                copy_count_from_input?: boolean
                first_signal?: ISignal
                second_signal?: ISignal
                output_signal?: ISignal
            }

            /** only present if entity is arithmetic-combinator */
            arithmetic_conditions?: {
                operation?: string
                constant?: number
                first_constant?: number
                second_constant?: number
                first_signal?: ISignal
                second_signal?: ISignal
                output_signal?: ISignal
            }

            /**
             *  only present if entity is pump, offshore-pump, rail-signal, train-stop, small-lamp,
             *  power-switch, stone-wall, programmable-speaker or of type: inserter, transport-belt or mining-drill
             */
            circuit_condition?: {
                comparator?: string
                constant?: number
                first_signal?: ISignal
                second_signal?: ISignal
            }

            /**
             * only present if entity is pump, offshore-pump, train-stop, small-lamp, power-switch
             * or of type: inserter, transport-belt or mining-drill
             */
            connect_to_logistic_network?: boolean
            /**
             * only present if entity is pump, offshore-pump, train-stop, small-lamp, power-switch
             * or of type: inserter, transport-belt or mining-drill
             */
            logistic_condition?: {
                comparator?: string
                constant?: number
                first_signal?: ISignal
                second_signal?: ISignal
            }
        }
    }

    interface ITile {
        name: string
        position: IPoint
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
