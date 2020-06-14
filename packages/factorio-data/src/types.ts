/* eslint-disable import/group-exports */
/* eslint-disable @typescript-eslint/interface-name-prefix */

export interface Color {
    r: number
    g: number
    b: number
}

export interface ColorWithAlpha extends Color {
    a: number
}

export interface CraftingMachineTint {
    primary: ColorWithAlpha
    secondary: ColorWithAlpha
    tertiary: ColorWithAlpha
    quaternary: ColorWithAlpha
}

export interface IngredientOrResult {
    type?: string
    name: string
    amount: number
    /** Seems to be the same as amount, only present on fluid recipes */
    catalyst_amount?: number
    probability?: number
}

export interface Recipe {
    name: string
    icon?: string
    icons?: Icon[]
    icon_size?: number
    icon_mipmaps?: number
    localised_name: string
    localised_description?: string
    category: string
    hidden?: boolean
    time: number
    ingredients: IngredientOrResult[]
    results: IngredientOrResult[]
    requester_paste_multiplier?: number
    /** Fluid recipe only property */
    crafting_machine_tint?: CraftingMachineTint
}

export interface InventoryLayoutGroup {
    name: string
    icon: string
    icons?: Icon[]
    icon_size?: number
    icon_mipmaps?: number
    order: string
    subgroups: InventoryLayoutSubgroup[]
    localised_name: string
}

export interface InventoryLayoutSubgroup {
    name: string
    order: string
    items: InventoryLayoutItem[]
}

export interface InventoryLayoutItem {
    name: string
    icon?: string
    icons?: Icon[]
    order: string
}

export interface Icon {
    icon: string
    icon_size?: number
    icon_mipmaps?: number
    dark_background_icon?: string
    tint?: ColorWithAlpha
    scale?: number
    shift?: number[]
}

export interface PlaceAsTile {
    result: string
    condition_size: number
    condition: string[]
}

export interface Bonus {
    bonus: number
}

export interface Effect {
    speed: Bonus
    consumption: Bonus
    productivity: Bonus
    pollution: Bonus
}

export interface Item {
    type: string
    name: string
    localised_name: string
    localised_description?: string
    subgroup: string
    order: string

    icon?: string
    dark_background_icon?: string
    icons?: Icon[]
    icon_size: number
    icon_mipmaps?: number

    speed?: number
    stack_size?: number
    durability?: number
    place_result?: string
    place_as_tile?: PlaceAsTile
    placed_as_equipment_result?: string
    rocket_launch_product?: string | number[]

    /** Ammo only property (type: 'ammo') */
    magazine_size?: number

    /** Fuel only property */
    fuel_category?: string
    /** Fuel only property */
    fuel_value?: string
    /** Fuel only property */
    fuel_acceleration_multiplier?: number
    /** Fuel only property */
    fuel_top_speed_multiplier?: number
    /** Uranium fuel cell only property */
    burnt_result?: string

    /** Wire only property */
    wire_count?: number

    /** Armor only property */
    infinite?: boolean
    /** Armor only property */
    equipment_grid?: string
    /** Armor only property */
    inventory_size_bonus?: number

    /** Modules only property (type: 'module') */
    category?: 'speed' | 'productivity' | 'effectivity'
    /** Modules only property (type: 'module') */
    effect?: Effect
    /** Modules only property (type: 'module') */
    limitation?: string[]
    /** Modules only property (type: 'module') */
    limitation_message?: string
    /** Modules only property (type: 'module') */
    tier?: number

    /** Rail planner only property (type: 'rail_planner') */
    straight_rail?: 'straight_rail'
    /** Rail planner only property (type: 'rail_planner') */
    curved_rail?: 'curved_rail'

    /* Blueprint and deconstruction planner only properties */
    // stackable?: boolean
    // inventory_size?: number
    // selection_color?: Color
    // alt_selection_color?: Color
    // selection_mode?: string[]
    // alt_selection_mode?: string[]
    // selection_cursor_box_type?: string
    // alt_selection_cursor_box_type?: string
}

export interface Fluid {
    type: string
    name: string
    icon: string
    icons?: Icon[]
    icon_size: number
    icon_mipmaps: number
    order: string
    localised_name: string

    default_temperature: number
    max_temperature: number
    heat_capacity: string
    base_color: Color
    flow_color: Color
    gas_temperature?: number
}

export interface VirtualSignal {
    type: string
    name: string
    icon: string
    icons?: Icon[]
    icon_size: number
    icon_mipmaps?: number
    subgroup: string
    order: string
    localised_name: string
    localised_description?: string
}

export interface Tile {
    type: string
    name: string
    localised_name?: string

    needs_correction: boolean
    minable: Minable
    mined_sound: Sound
    collision_mask?: string[]
    walking_speed_modifier: number
    layer: number
    decorative_removal_probability: number
    variants: Variants
    transitions?: Transition[]
    transitions_between_transitions?: Transition[]
    walking_sound?: Sound[]
    map_color: Color
    pollution_absorption_per_second: number
    vehicle_friction_modifier: number
    transition_overlay_layer_offset?: number
    next_direction?: string
    transition_merges_with_tile?: string
}
export interface Variants extends TileSpriteLayers {
    main: TileSpriteData[]
    material_background?: TileSpriteData
}
export interface Transition extends TileSpriteLayers {
    to_tiles: string[]
    transition_group?: 0 | 1 | 2
    transition_group1?: 0 | 1 | 2
    transition_group2?: 0 | 1 | 2
    background_layer_offset?: number
    background_layer_group?: string
    offset_background_layer_by_tile_layer?: boolean
}
export interface TileSpriteLayers {
    inner_corner?: TileSpriteData
    inner_corner_mask?: TileSpriteData
    inner_corner_background?: TileSpriteData

    outer_corner?: TileSpriteData
    outer_corner_mask?: TileSpriteData
    outer_corner_background?: TileSpriteData

    side?: TileSpriteData
    side_mask?: TileSpriteData
    side_background?: TileSpriteData

    u_transition?: TileSpriteData
    u_transition_mask?: TileSpriteData
    u_transition_background?: TileSpriteData

    o_transition?: TileSpriteData
    o_transition_mask?: TileSpriteData
    o_transition_background?: TileSpriteData
}
export interface TileSpriteData {
    picture: string
    count: number
    line_length?: number
    x?: number
    y?: number
    tall?: boolean
    size?: number
    scale?: number
    probability?: number
    hr_version?: TileSpriteData
    weights?: number[]
}

// TODO: document the entity properties
export interface Entity {
    type: string
    name: string
    localised_name: string
    localised_description?: string
    icon?: string
    icons?: Icon[]
    icon_size: number
    flags?: string[]
    minable: Minable
    max_health: number
    corpse?: string
    next_upgrade?: string

    mined_sound?: Sound
    open_sound?: OpenCloseSound
    close_sound?: OpenCloseSound
    working_sound?: WorkingSound

    selection_box?: number[][]
    selection_box_offsets?: number[][]
    collision_box?: number[][]
    hole_clipping_box?: number[][]
    drawing_box?: number[][]
    drawing_boxes?: DrawingBoxes

    graphics_set?: {
        animation?: DirectionalSpriteLayers
        working_visualisations?: Array<{
            always_draw?: boolean
            north_animation?: SpriteData | SpriteLayers
            east_animation?: SpriteData | SpriteLayers
            south_animation?: SpriteData | SpriteLayers
            west_animation?: SpriteData | SpriteLayers
        }>
    }
    animation?: SpriteData | SpriteLayers | DirectionalSpriteData | DirectionalSpriteLayers
    animations?: SpriteData | DirectionalSpriteData | DirectionalSpriteLayers
    picture?: SpriteData | SpriteLayers | DirectionalSpriteData | DirectionalSpriteLayers
    pictures?:
        | SpriteLayers
        | DirectionalSpriteData
        | PipePictures
        | WallPictures
        | RailPictures
        | StorageTankPictures
    base_picture?:
        | SpriteData
        | SpriteLayers
        | DirectionalSpriteData
        | SpriteSheets
        | DirectionalSpriteLayers
    structure_patch?: DirectionalSpriteData
    structure?: DirectionalSpriteData | DirectionalSpriteLayers | UndergroundBeltStructure

    /** https://forums.factorio.com/65627 */
    structure_render_layer?: 'lower-object' | 'transport-belt-circuit-connector'

    belt_animation_set?: BeltAnimationSet

    hand_base_picture?: SpriteData
    hand_closed_picture?: SpriteData
    hand_open_picture?: SpriteData
    hand_base_shadow?: SpriteData
    hand_closed_shadow?: SpriteData
    hand_open_shadow?: SpriteData

    picture_off?: SpriteLayers
    picture_on?: SpriteData

    shadow_animations?: DirectionalSpriteData
    input_fluid_patch_sprites?: DirectionalSpriteData
    input_fluid_patch_shadow_sprites?: DirectionalSpriteData
    input_fluid_patch_shadow_animations?: DirectionalSpriteData
    input_fluid_patch_window_sprites?: DirectionalSpriteData
    input_fluid_patch_window_flow_sprites?: DirectionalSpriteData[]
    input_fluid_patch_window_base_sprites?: DirectionalSpriteData[]

    glow_light_intensity?: number

    energy_glow_animation?: SpriteData
    folded_animation?: SpriteLayers | DirectionalSpriteLayers
    preparing_animation?: SpriteLayers | DirectionalSpriteLayers
    prepared_animation?: SpriteLayers | DirectionalSpriteLayers
    attacking_animation?: SpriteLayers | DirectionalSpriteLayers
    folding_animation?: SpriteLayers | DirectionalSpriteLayers

    horizontal_rail_animation_left?: SpriteLayers
    horizontal_rail_animation_right?: SpriteLayers
    vertical_rail_animation_left?: SpriteLayers
    vertical_rail_animation_right?: SpriteLayers
    vertical_rail_base?: SpriteData
    horizontal_rail_base?: SpriteData
    wall_patch?: SpriteLayers

    picture_safe?: SpriteData
    picture_set?: SpriteData
    picture_set_enemy?: SpriteData

    shadow_sprite?: SpriteData
    hole_sprite?: SpriteData
    hole_light_sprite?: SpriteData
    rocket_shadow_overlay_sprite?: SpriteData
    rocket_glow_overlay_sprite?: SpriteData
    door_back_sprite?: SpriteData
    door_back_open_offset?: number[]
    door_front_sprite?: SpriteData
    door_front_open_offset?: number[]
    base_day_sprite?: SpriteData
    red_lights_back_sprites?: SpriteLayers
    red_lights_front_sprites?: SpriteLayers
    satellite_animation?: SpriteData
    arm_01_back_animation?: SpriteData
    arm_02_right_animation?: SpriteData
    arm_03_front_animation?: SpriteData
    base_front_sprite?: SpriteData

    base?: SpriteLayers
    base_patch?: SpriteData
    base_animation?: SpriteData
    door_animation_up?: SpriteData
    door_animation_down?: SpriteData
    recharging_animation?: SpriteData

    sprites?: DirectionalSpriteLayers
    activity_led_sprites?: DirectionalSpriteData
    plus_symbol_sprites?: DirectionalSpriteData
    minus_symbol_sprites?: DirectionalSpriteData
    multiply_symbol_sprites?: DirectionalSpriteData
    divide_symbol_sprites?: DirectionalSpriteData
    modulo_symbol_sprites?: DirectionalSpriteData
    power_symbol_sprites?: DirectionalSpriteData
    left_shift_symbol_sprites?: DirectionalSpriteData
    right_shift_symbol_sprites?: DirectionalSpriteData
    and_symbol_sprites?: DirectionalSpriteData
    or_symbol_sprites?: DirectionalSpriteData
    xor_symbol_sprites?: DirectionalSpriteData

    greater_symbol_sprites?: DirectionalSpriteData
    less_symbol_sprites?: DirectionalSpriteData
    equal_symbol_sprites?: DirectionalSpriteData
    not_equal_symbol_sprites?: DirectionalSpriteData
    less_or_equal_symbol_sprites?: DirectionalSpriteData
    greater_or_equal_symbol_sprites?: DirectionalSpriteData

    crafting_categories?: string[]
    result_inventory_size?: number
    energy_usage?: string
    crafting_speed?: number
    source_inventory_size?: number
    energy_source?: EnergySource
    fast_replaceable_group?: string
    size: Size
    dying_explosion?: string
    module_specification?: ModuleSpecification
    allowed_effects?: string[]
    animation_speed_coefficient?: number
    speed?: number
    connector_frame_sprites?: ConnectorFrameSprites
    circuit_wire_connection_points?: CircuitWireConnectionPoints[]
    circuit_connector_sprites?: CircuitConnectorSprites | CircuitConnectorSprites[]
    circuit_wire_max_distance?: number
    possible_rotations?: number[]
    mode?: string
    target_temperature?: number
    energy_consumption?: string
    patch?: BoilerPatch
    fire_flicker_enabled?: boolean
    fire?: DirectionalSpriteData
    fire_glow_flicker_enabled?: boolean
    fire_glow?: DirectionalSpriteData
    burning_cooldown?: number
    inventory_size?: number
    circuit_wire_connection_point?: CircuitWireConnectionPoints
    maximum_wire_distance?: number
    supply_area_distance?: number
    track_coverage_during_build_by_moving?: boolean
    connection_points?: CircuitWireConnectionPoints[]
    radius_visualisation_picture?: SpriteData
    alert_icon_shift?: number[]
    effectivity?: number
    fluid_usage_per_tick?: number
    maximum_temperature?: number
    horizontal_animation?: SpriteLayers
    vertical_animation?: SpriteLayers
    smoke?: Smoke[]
    min_perceived_performance?: number
    performance_to_sound_speedup?: number
    burns_fluid?: boolean
    collision_mask?: string[]
    fluid_box_tile_collision_test?: string[]
    adjacent_tile_collision_test?: string[]
    fluid?: string
    pumping_speed?: number
    tile_width?: number
    tile_height?: number
    placeable_position_visualization?: SpriteData
    energy_per_movement?: string
    energy_per_rotation?: string
    extension_speed?: number
    rotation_speed?: number
    pickup_position?: number[]
    insert_position?: number[]
    platform_picture?: SpriteSheet
    default_stack_control_input_signal?: Signal
    hand_size?: number
    stack?: boolean
    filter_count?: number
    horizontal_window_bounding_box?: number[][]
    vertical_window_bounding_box?: number[][]
    energy_per_sector?: string
    max_distance_of_sector_revealed?: number
    max_distance_of_nearby_sector_revealed?: number
    energy_per_nearby_scan?: string
    integration_patch?: SpriteData
    radius_minimap_visualisation_color?: ColorWithAlpha
    energy_usage_per_tick?: string
    darkness_for_all_lamps_on?: number
    darkness_for_all_lamps_off?: number
    light?: Light
    light_when_colored?: Light
    glow_size?: number
    glow_color_intensity?: number
    signal_to_color_mapping?: SignalToColorMapping[]
    underground_sprite?: SpriteData
    scale_entity_info_icon?: boolean
    has_backer_name?: boolean
    always_draw_idle_animation?: boolean
    idle_animation?: SpriteLayers
    working_visualisations?: WorkingVisualisation[]
    repair_speed_modifier?: number
    connected_gate_visualization?: SpriteData

    wall_diode_green?: SpriteSheet
    wall_diode_green_light_top?: Light
    wall_diode_green_light_right?: Light
    wall_diode_green_light_bottom?: Light
    wall_diode_green_light_left?: Light
    wall_diode_red?: SpriteSheet
    wall_diode_red_light_top?: Light
    wall_diode_red_light_right?: Light
    wall_diode_red_light_bottom?: Light
    wall_diode_red_light_left?: Light
    /** Wall only prop https://forums.factorio.com/74695 */
    visual_merge_group?: number

    opened_duration?: number
    default_output_signal?: Signal
    resource_categories?: string[]
    fluid_box?: FluidBox
    fluid_boxes?: FluidBox[]
    input_fluid_box?: FluidBox
    output_fluid_box?: FluidBox
    mining_speed?: number
    resource_searching_radius?: number
    vector_to_place_result?: number[]
    monitor_visualization_tint?: Color
    base_render_layer?: string
    preparing_speed?: number
    folding_speed?: number
    automated_ammo_count?: number
    attacking_speed?: number
    alert_when_attacking?: boolean
    call_for_help_radius?: number
    max_distance?: number
    underground_remove_belts_sprite?: SpriteData
    structure_animation_speed_coefficient?: number
    structure_animation_movement_cooldown?: number
    overlay?: SpriteLayers
    production?: string
    opening_speed?: number
    activation_distance?: number
    timeout_to_close?: number
    fadeout_interval?: number
    placeable_by?: PlaceableBy
    trigger_radius?: number
    ammo_category?: string
    animation_ticks_per_frame?: number
    rail_overlay_animations?: DirectionalSpriteData
    top_animations?: DirectionalSpriteLayers
    light1?: TrainStopLight
    light2?: TrainStopLight
    color?: ColorWithAlpha
    default_train_stopped_signal?: Signal
    rail_piece?: SpriteData
    green_light?: Light
    orange_light?: Light
    red_light?: Light
    default_red_output_signal?: Signal
    default_orange_output_signal?: Signal
    default_green_output_signal?: Signal
    blue_light?: Light
    default_blue_output_signal?: Signal
    on_animation?: SpriteLayers
    off_animation?: SpriteLayers
    researching_speed?: number
    inputs?: string[]
    logistic_mode?: string
    logistic_slots_count?: number
    rocket_parts_required?: number
    rocket_result_inventory_size?: number
    fixed_recipe?: string
    show_recipe_icon?: boolean
    idle_energy_usage?: string
    lamp_energy_usage?: string
    active_energy_usage?: string
    rocket_entity?: string
    times_to_blink?: number
    light_blinking_speed?: number
    door_opening_speed?: number
    base_engine_light?: Light
    silo_fade_out_start_distance?: number
    silo_fade_out_end_distance?: number
    alarm_trigger?: RocketSiloAlarm[]
    clamps_on_trigger?: RocketSiloAlarm[]
    clamps_off_trigger?: RocketSiloAlarm[]
    doors_trigger?: RocketSiloAlarm[]
    raise_rocket_trigger?: RocketSiloAlarm[]
    recharge_minimum?: string
    charging_energy?: string
    logistics_radius?: number
    construction_radius?: number
    charge_approach_distance?: number
    robot_slots_count?: number
    material_slots_count?: number
    stationing_offset?: number[]
    charging_offsets?: number[][]
    recharging_light?: Light
    request_to_open_door_timeout?: number
    spawn_and_station_height?: number
    draw_logistic_radius_visualization?: boolean
    draw_construction_radius_visualization?: boolean
    open_door_trigger_effect?: RoboportDoorEffect[]
    close_door_trigger_effect?: RoboportDoorEffect[]
    default_available_logistic_output_signal?: Signal
    default_total_logistic_output_signal?: Signal
    default_available_construction_output_signal?: Signal
    default_total_construction_output_signal?: Signal
    two_direction_only?: boolean
    window_bounding_box?: number[][]
    flow_length_in_ticks?: number
    fluid_wagon_connector_frame_count?: number
    fluid_wagon_connector_alignment_tolerance?: number
    fluid_animation?: DirectionalSpriteData
    glass_pictures?: DirectionalSpriteData
    charge_animation?: SpriteLayers
    charge_cooldown?: number
    charge_light?: Light
    discharge_animation?: SpriteLayers
    discharge_cooldown?: number
    discharge_light?: Light
    animation_shadow?: SpriteData
    distribution_effectivity?: number
    activity_led_light?: Light
    activity_led_light_offsets?: number[][]
    screen_light?: Light
    screen_light_offsets?: number[][]
    input_connection_bounding_box?: number[][]
    output_connection_bounding_box?: number[][]
    input_connection_points?: CircuitWireConnectionPoints[]
    output_connection_points?: CircuitWireConnectionPoints[]
    item_slot_count?: number
    power_on_animation?: SpriteData
    overlay_start_delay?: number
    overlay_start?: SpriteData
    overlay_loop?: SpriteData
    led_on?: SpriteData
    led_off?: SpriteData
    left_wire_connection_point?: CircuitWireConnectionPoints
    right_wire_connection_point?: CircuitWireConnectionPoints
    wire_max_distance?: number
    sprite?: SpriteLayers
    audible_distance_modifier?: number
    maximum_polyphony?: number
    instruments?: Instrument[]
    allow_copy_paste?: boolean
    energy_production?: string
    consumption?: string
    neighbour_bonus?: number
    lower_layer_picture?: SpriteData
    heat_lower_layer_picture?: SpriteData
    working_light_picture?: SpriteData
    heat_buffer?: HeatBuffer
    connection_patches_connected?: SpriteSheet
    connection_patches_disconnected?: SpriteSheet
    heat_connection_patches_connected?: SpriteSheet
    heat_connection_patches_disconnected?: SpriteSheet
    connection_sprites?: HeatPipeSprites
    heat_glow_sprites?: HeatPipeSprites
    order?: string
    gui_mode?: string
    erase_contents_when_mined?: boolean
    ammo_stack_limit?: number
    gun?: string
    turret_rotation_speed?: number
    turn_after_shooting_cooldown?: number
    cannon_parking_frame_count?: number
    cannon_parking_speed?: number
    manual_range_modifier?: number
    base_shift?: number[]
    base_picture_render_layer?: string
    cannon_barrel_pictures?: SpriteLayers
    cannon_base_pictures?: SpriteLayers
    out_of_ammo_alert_icon?: SpriteData
    // cannon_base_shiftings?: number[][]
    // cannon_barrel_recoil_shiftings?: CannonBarrelRecoilShiftings[]
    cannon_barrel_light_direction?: number[]
    cannon_barrel_recoil_shiftings_load_correction_matrix?: number[][]
    ending_attack_speed?: number
    turret_base_has_direction?: boolean
    fluid_buffer_size?: number
    fluid_buffer_input_flow?: number
    activation_buffer_ratio?: number
    ending_attack_animation?: DirectionalSpriteLayers
    not_enough_fuel_indicator_picture?: DirectionalSpriteData
    enough_fuel_indicator_picture?: DirectionalSpriteData
    indicator_light?: Light
    gun_animation_render_layer?: string
    gun_animation_secondary_draw_order?: number
    base_picture_secondary_draw_order?: number
    muzzle_animation?: SpriteData
    muzzle_light?: Light
    // folded_muzzle_animation_shift?: MuzzleAnimationShift
    // preparing_muzzle_animation_shift?: MuzzleAnimationShift
    // prepared_muzzle_animation_shift?: MuzzleAnimationShift
    // attacking_muzzle_animation_shift?: MuzzleAnimationShift
    // ending_attack_muzzle_animation_shift?: MuzzleAnimationShift
    // folding_muzzle_animation_shift?: MuzzleAnimationShift
    prepare_range?: number
    shoot_in_prepare_state?: boolean
}
export interface Minable {
    mining_time: number
    result?: string
    results?: {
        name: string
        amount_min: number
        amount_max: number
    }
    mining_particle?: string
    count?: number
}
export interface OpenCloseSound {
    filename?: string
    volume?: number
    variations?: Sound
    aggregation?: SoundAggregation
}
export interface SoundAggregation {
    max_count: number
    remove: boolean
}
export interface Sound {
    filename: string
    volume?: number
}
export interface WorkingSound {
    sound?: Sound | Sound[]
    apparent_volume?: number
    max_sounds_per_type?: number
    audible_distance_modifier?: number
    probability?: number
    match_speed_to_activity?: boolean
    match_progress_to_activity?: boolean
    match_volume_to_activity?: boolean
    idle_sound?: Sound
    persistent?: boolean
}
export interface EnergySource extends Partial<HeatBuffer> {
    type: string
    fuel_category?: string
    effectivity?: number
    fuel_inventory_size?: number
    burnt_inventory_size?: number
    emissions_per_minute?: number
    smoke?: Smoke[]
    usage_priority?: string
    pipe_covers?: DirectionalSpriteData
    heat_pipe_covers?: DirectionalSpriteData
    drain?: string
    input_flow_limit?: string
    buffer_capacity?: string
    output_flow_limit?: string
    min_working_temperature?: number
}
export interface Smoke {
    name: string
    deviation?: number[]
    frequency: number
    position?: number[]
    slow_down_factor?: number
    starting_vertical_speed?: number
    starting_frame_deviation?: number
    north_position?: number[]
    south_position?: number[]
    east_position?: number[]
    west_position?: number[]
}
export interface Connections {
    position?: number[]
    direction: number
}
export interface Signal {
    type: string
    name: string
}
export interface SignalToColorMapping extends Signal {
    color: Color
}
export interface SpriteData {
    filename?: string
    filenames?: string[]
    stripes?: Stripes[]

    width: number
    height: number

    scale?: number
    x?: number
    y?: number
    priority?: string
    frame_count?: number
    line_length?: number
    variation_count?: number
    direction_count?: number
    axially_symmetrical?: boolean
    shift?: number[]
    draw_as_shadow?: boolean
    repeat_count?: number
    blend_mode?: string
    animation_speed?: number
    run_mode?: string
    apply_runtime_tint?: boolean
    apply_projection?: boolean
    flags?: string[]
    counterclockwise?: boolean
    tint?: ColorWithAlpha
    lines_per_file?: number
    hr_version?: SpriteData
}
export interface Stripes {
    filename: string
    width_in_frames: number
    height_in_frames: number
}
export interface DirectionalSpriteData {
    north: SpriteData
    east: SpriteData
    south: SpriteData
    west: SpriteData
}
export interface SpriteLayers {
    layers: SpriteData[]
}
export interface DirectionalSpriteLayers {
    north: SpriteLayers
    east: SpriteLayers
    south: SpriteLayers
    west: SpriteLayers
}
export interface SpriteSheet {
    sheet: SpriteData
}
export interface SpriteSheets {
    sheets: SpriteData[]
}
export interface PipePictures {
    straight_vertical_single: SpriteData
    straight_vertical: SpriteData
    straight_vertical_window: SpriteData
    straight_horizontal_window: SpriteData
    straight_horizontal: SpriteData
    corner_up_right: SpriteData
    corner_up_left: SpriteData
    corner_down_right: SpriteData
    corner_down_left: SpriteData
    t_up: SpriteData
    t_down: SpriteData
    t_right: SpriteData
    t_left: SpriteData
    cross: SpriteData
    ending_up: SpriteData
    ending_down: SpriteData
    ending_right: SpriteData
    ending_left: SpriteData
    horizontal_window_background: SpriteData
    vertical_window_background: SpriteData
    fluid_background: SpriteData
    low_temperature_flow: SpriteData
    middle_temperature_flow: SpriteData
    high_temperature_flow: SpriteData
    gas_flow: SpriteData
}
export interface WallPictures {
    single: SpriteLayers
    straight_vertical: SpriteLayers
    straight_horizontal: SpriteLayers
    corner_right_down: SpriteLayers
    corner_left_down: SpriteLayers
    t_up: SpriteLayers
    ending_right: SpriteLayers
    ending_left: SpriteLayers
    filling: SpriteData
    water_connection_patch: SpriteSheets
    gate_connection_patch: SpriteSheets
}
export interface StorageTankPictures {
    picture: SpriteSheets
    fluid_background: SpriteData
    window_background: SpriteData
    flow_sprite: SpriteData
    gas_flow: SpriteData
}
export interface RailPictures {
    straight_rail_horizontal: RailSpriteLayers
    straight_rail_vertical: RailSpriteLayers
    straight_rail_diagonal_left_top: RailSpriteLayers
    straight_rail_diagonal_right_top: RailSpriteLayers
    straight_rail_diagonal_right_bottom: RailSpriteLayers
    straight_rail_diagonal_left_bottom: RailSpriteLayers
    curved_rail_vertical_left_top: RailSpriteLayers
    curved_rail_vertical_right_top: RailSpriteLayers
    curved_rail_vertical_right_bottom: RailSpriteLayers
    curved_rail_vertical_left_bottom: RailSpriteLayers
    curved_rail_horizontal_left_top: RailSpriteLayers
    curved_rail_horizontal_right_top: RailSpriteLayers
    curved_rail_horizontal_right_bottom: RailSpriteLayers
    curved_rail_horizontal_left_bottom: RailSpriteLayers
    rail_endings: SpriteSheet
}
export interface RailSpriteLayers {
    metals: SpriteData
    backplates: SpriteData
    ties: SpriteData
    stone_path: SpriteData
    stone_path_background: SpriteData
    segment_visualisation_middle: SpriteData
    segment_visualisation_ending_front: SpriteData
    segment_visualisation_ending_back: SpriteData
    segment_visualisation_continuing_front: SpriteData
    segment_visualisation_continuing_back: SpriteData
}
export interface BeltAnimationSet {
    animation_set: SpriteData
    east_index?: number
    west_index?: number
    north_index?: number
    south_index?: number
    east_to_north_index?: number
    north_to_east_index?: number
    west_to_north_index?: number
    north_to_west_index?: number
    south_to_east_index?: number
    east_to_south_index?: number
    south_to_west_index?: number
    west_to_south_index?: number
    starting_south_index?: number
    ending_south_index?: number
    starting_west_index?: number
    ending_west_index?: number
    starting_north_index?: number
    ending_north_index?: number
    starting_east_index?: number
    ending_east_index?: number
}
export interface UndergroundBeltStructure {
    direction_in: SpriteSheet
    direction_out: SpriteSheet
    direction_in_side_loading: SpriteSheet
    direction_out_side_loading: SpriteSheet
    back_patch: SpriteSheet
    front_patch: SpriteSheet
}
export interface Size {
    width: number
    height: number
}
export interface ModuleSpecification {
    module_slots: number
    module_info_icon_shift?: number[]
    max_entity_info_module_icons_per_row?: number
    max_entity_info_module_icon_rows?: number
    module_info_multi_row_initial_height_modifier?: number
}
export interface ConnectorFrameSprites {
    frame_main: SpriteSheet
    frame_shadow: SpriteSheet
    frame_back_patch: SpriteSheet
    frame_main_scanner: SpriteData
    frame_main_scanner_movement_speed: number
    frame_main_scanner_horizontal_start_shift?: number[]
    frame_main_scanner_horizontal_end_shift?: number[]
    frame_main_scanner_horizontal_y_scale: number
    frame_main_scanner_horizontal_rotation: number
    frame_main_scanner_vertical_start_shift?: number[]
    frame_main_scanner_vertical_end_shift?: number[]
    frame_main_scanner_vertical_y_scale: number
    frame_main_scanner_vertical_rotation: number
    frame_main_scanner_cross_horizontal_start_shift?: number[]
    frame_main_scanner_cross_horizontal_end_shift?: number[]
    frame_main_scanner_cross_horizontal_y_scale: number
    frame_main_scanner_cross_horizontal_rotation: number
    frame_main_scanner_cross_vertical_start_shift?: number[]
    frame_main_scanner_cross_vertical_end_shift?: number[]
    frame_main_scanner_cross_vertical_y_scale: number
    frame_main_scanner_cross_vertical_rotation: number
    frame_main_scanner_nw_ne: SpriteData
    frame_main_scanner_sw_se: SpriteData
}
export interface CircuitWireConnectionPoints {
    wire: WireTypes
    shadow: WireTypes
}
export interface WireTypes {
    [key: string]: number[]
    copper?: number[]
    red?: number[]
    green?: number[]
}
export interface CircuitConnectorSprites {
    led_blue: SpriteData
    led_red: SpriteData
    led_green: SpriteData
    led_light: Light
    blue_led_light_offset?: number[]
    red_green_led_light_offset?: number[]
    connector_main?: SpriteData
    wire_pins?: SpriteData
    wire_pins_shadow?: SpriteData
    led_blue_off?: SpriteData
    connector_shadow?: SpriteData
}
export interface PipeConnection {
    type?: string
    position?: number[]
    positions?: number[][]
    max_underground_distance?: number
}
export interface SecondaryDrawOrders {
    north: number
}
export interface FluidBox {
    base_area?: number
    height?: number
    base_level?: number
    pipe_covers?: DirectionalSpriteLayers
    pipe_connections?: PipeConnection[]
    production_type?: string
    filter?: string
    minimum_temperature?: number
    secondary_draw_order?: number
    render_layer?: string
    pipe_picture?: DirectionalSpriteData
    secondary_draw_orders?: SecondaryDrawOrders
}
export interface BoilerPatch {
    east: SpriteData
}
export interface Light {
    intensity: number
    size: number
    shift?: number[]
    color?: Color | ColorWithAlpha
    minimum_darkness?: number
}
export interface WorkingVisualisation {
    north_position?: number[]
    east_position?: number[]
    south_position?: number[]
    west_position?: number[]
    render_layer?: string
    animation?: SpriteData
    light?: Light
    effect?: string
    apply_recipe_tint?: string
    north_animation?: SpriteData
    east_animation?: SpriteData
    south_animation?: SpriteData
}
export interface PlaceableBy {
    item: string
    count: number
}
export interface DrawingBoxes {
    north: number[][]
    east: number[][]
    south: number[][]
    west: number[][]
}
export interface TrainStopLight {
    light: Light
    picture: DirectionalSpriteData
    red_picture: DirectionalSpriteData
}
export interface RocketSiloAlarm {
    type: string
    sound?: Sound[]
}
export interface RoboportDoorEffect {
    type: string
    sound: Sound
}
export interface Instrument {
    name: string
    notes?: Note[]
}
export interface Note {
    name: string
    sound: NoteSound
}
export interface NoteSound {
    filename: string
    preload?: boolean
}
export interface HeatBuffer {
    max_temperature: number
    specific_heat: string
    max_transfer: string
    glow_alpha_modifier?: number
    minimum_glow_temperature?: number
    connections?: Connections[]
    heat_picture?: DirectionalSpriteData
    heat_glow?: SpriteData | DirectionalSpriteData
}
export interface HeatPipeSprites {
    single: SpriteData[]
    straight_vertical: SpriteData[]
    straight_horizontal: SpriteData[]
    corner_right_up: SpriteData[]
    corner_left_up: SpriteData[]
    corner_right_down: SpriteData[]
    corner_left_down: SpriteData[]
    t_up: SpriteData[]
    t_down: SpriteData[]
    t_right: SpriteData[]
    t_left: SpriteData[]
    cross: SpriteData[]
    ending_up: SpriteData[]
    ending_down: SpriteData[]
    ending_right: SpriteData[]
    ending_left: SpriteData[]
}
// export interface CannonBarrelRecoilShiftings {
//     x: number
//     y: number
//     z: number
// }
// export interface MuzzleAnimationShift {
//     rotations: MuzzleAnimationShiftRotation[]
//     direction_shift: MuzzleAnimationShiftDirection
// }
// export interface MuzzleAnimationShiftRotation {
//     frames: number[][]
//     render_layer?: string
// }
// export interface MuzzleAnimationShiftDirection {
//     north: number[]
//     east: number[]
//     south: number[]
//     west: number[]
// }

export interface TreeOrRock {
    name: string
    type: string
    flags: string[]
    icon: string
    icon_size: number
    subgroup: string
    order: string
    collision_box: number[][]
    selection_box: number[][]
    minable: Minable
    loot?: LootItem[]
    count_as_rock_for_filtered_deconstruction?: boolean
    mined_sound?: Sound
    render_layer?: string
    max_health: number
    pictures?: SpriteData[]
    size: Size
    corpse?: string
    remains_when_mined?: string
    emissions_per_second?: number
    drawing_box?: number[][]
    variations?: VariationsItem[]
    darkness_of_burnt_tree?: number
    variation_weights?: number[]
    colors?: Color[]
}
export interface LootItem {
    item: string
    probability: number
    count_min: number
    count_max: number
}
export interface VariationsItem {
    trunk: SpriteData
    leaves: SpriteData
    shadow: SpriteData
    leaf_generation: Generation
    branch_generation: Generation
}
export interface Generation {
    type: string
    entity_name: string
    offset_deviation: number[][]
    initial_height: number
    initial_height_deviation: number
    speed_from_center: number
    frame_speed?: number
    repeat_count?: number
}

export interface CursorBox {
    sprite: SpriteData
    is_whole_box?: boolean
    max_side_length?: number
    side_length?: number
    side_height?: number
}

export type CursorBoxType =
    | 'regular'
    | 'not_allowed'
    | 'electricity'
    | 'pair'
    | 'copy'
    | 'train_visualization'
    | 'logistics'

export type UtilitySprites = { cursor_box: Record<CursorBoxType, CursorBox[]> } & Record<
    string,
    SpriteData
>
