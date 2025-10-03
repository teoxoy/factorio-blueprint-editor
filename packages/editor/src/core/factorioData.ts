import { CircuitConnectorDefinition } from 'factorio:prototype'
import { IconData } from 'factorio:prototype'
import {
    RecipePrototype,
    ItemPrototype,
    VirtualSignalPrototype,
    ModulePrototype,
    FluidPrototype,
    ColorStruct,
    TilePrototype,
    EntityWithOwnerPrototype,
    UtilitySprites,
    HeatBuffer,
    EnergySource,
    CraftingMachinePrototype,
    AccumulatorPrototype,
    AgriculturalTowerPrototype,
    AmmoTurretPrototype,
    ArithmeticCombinatorPrototype,
    ArtilleryTurretPrototype,
    ArtilleryWagonPrototype,
    AssemblingMachinePrototype,
    AsteroidCollectorPrototype,
    BeaconPrototype,
    BoilerPrototype,
    BurnerGeneratorPrototype,
    CargoBayPrototype,
    CargoLandingPadPrototype,
    CargoWagonPrototype,
    ConstantCombinatorPrototype,
    ConstructionRobotPrototype,
    ContainerPrototype,
    CurvedRailAPrototype,
    CurvedRailBPrototype,
    DeciderCombinatorPrototype,
    CombinatorPrototype,
    DisplayPanelPrototype,
    ElectricEnergyInterfacePrototype,
    ElectricPolePrototype,
    ElectricTurretPrototype,
    ElevatedCurvedRailAPrototype,
    ElevatedCurvedRailBPrototype,
    ElevatedHalfDiagonalRailPrototype,
    ElevatedStraightRailPrototype,
    FluidTurretPrototype,
    FluidWagonPrototype,
    FurnacePrototype,
    FusionGeneratorPrototype,
    FusionReactorPrototype,
    GatePrototype,
    GeneratorPrototype,
    HalfDiagonalRailPrototype,
    HeatInterfacePrototype,
    HeatPipePrototype,
    InfinityCargoWagonPrototype,
    InfinityContainerPrototype,
    InserterPrototype,
    LabPrototype,
    LampPrototype,
    LandMinePrototype,
    LaneSplitterPrototype,
    LegacyCurvedRailPrototype,
    LegacyStraightRailPrototype,
    LightningAttractorPrototype,
    LinkedBeltPrototype,
    LinkedContainerPrototype,
    LoaderPrototype,
    LocomotivePrototype,
    LogisticContainerPrototype,
    LogisticRobotPrototype,
    MiningDrillPrototype,
    OffshorePumpPrototype,
    PipePrototype,
    PipeToGroundPrototype,
    PowerSwitchPrototype,
    ProgrammableSpeakerPrototype,
    ProxyContainerPrototype,
    PumpPrototype,
    RadarPrototype,
    RailRampPrototype,
    RailSignalBasePrototype,
    RailSupportPrototype,
    ReactorPrototype,
    RoboportPrototype,
    RocketSiloPrototype,
    SelectorCombinatorPrototype,
    SolarPanelPrototype,
    SpacePlatformHubPrototype,
    SplitterPrototype,
    StorageTankPrototype,
    StraightRailPrototype,
    ThrusterPrototype,
    TrainStopPrototype,
    TransportBeltPrototype,
    TurretPrototype,
    UndergroundBeltPrototype,
    ValvePrototype,
    WallPrototype,
} from 'factorio:prototype'
import { IPoint } from '../types'
import { WireConnectionPoint } from 'factorio:prototype'
import { BoundingBox } from 'factorio:prototype'
import { MapPosition } from 'factorio:prototype'
import { FluidBox } from 'factorio:prototype'

function getModulesFor(entityName: string): ItemPrototype[] {
    return (
        Object.keys(FD.items)
            .map(k => FD.items[k])
            .filter(isModule)
            // filter modules based on entity allowed_effects (ex: beacons don't accept productivity effect)
            .filter(
                module =>
                    !FD.entities[entityName].allowed_effects ||
                    Object.keys(module.effect).every(effect =>
                        FD.entities[entityName].allowed_effects.includes(effect)
                    )
            )
    )
}

export function isInserter(item: EntityWithOwnerPrototype): item is InserterPrototype {
    const type: InserterPrototype['type'] = 'inserter'
    return item.type === type
}
export function isCraftingMachine(e: EntityWithOwnerPrototype): e is CraftingMachinePrototype {
    switch (e.type) {
        case 'assembling-machine':
        case 'furnace':
        case 'rocket-silo': {
            return true
        }
        default:
            return false
    }
}

function isModule(item: ItemPrototype): item is ModulePrototype {
    const type: ModulePrototype['type'] = 'module'
    return item.type === type
}
export function getModule(name: string): ModulePrototype {
    const item = FD.items[name]
    if (isModule(item)) return item
    else throw new Error('Internal Error!')
}

export function getCircuitConnector(
    e: EntityWithOwnerPrototype,
    dir: number,
    isLoaderInputting: () => boolean,
    getBeltConnectionIndex: () => number
): null | CircuitConnectorDefinition {
    switch (e.type) {
        case 'accumulator':
        case 'agricultural-tower':
        case 'artillery-turret':
        case 'cargo-landing-pad':
        case 'container':
        case 'infinity-container':
        case 'logistic-container':
        case 'temporary-container':
        case 'lamp':
        case 'linked-container':
        case 'programmable-speaker':
        case 'proxy-container':
        case 'radar':
        case 'reactor':
        case 'roboport':
        case 'space-platform-hub':
        case 'wall': {
            const e_resolved = e as
                | AccumulatorPrototype
                | AgriculturalTowerPrototype
                | ArtilleryTurretPrototype
                | CargoLandingPadPrototype
                | ContainerPrototype
                | LampPrototype
                | LinkedContainerPrototype
                | ProgrammableSpeakerPrototype
                | ProxyContainerPrototype
                | RadarPrototype
                | ReactorPrototype
                | RoboportPrototype
                | SpacePlatformHubPrototype
                | WallPrototype
            return e_resolved.circuit_connector
        }
        case 'assembling-machine':
        case 'rocket-silo':
        case 'asteroid-collector':
        case 'display-panel':
        case 'furnace':
        case 'inserter':
        case 'mining-drill':
        case 'offshore-pump':
        case 'pump':
        case 'storage-tank':
        case 'train-stop': {
            const e_resolved = e as
                | AssemblingMachinePrototype // also has circuit_connector_flipped
                | AsteroidCollectorPrototype
                | DisplayPanelPrototype
                | FurnacePrototype // also has circuit_connector_flipped
                | InserterPrototype
                | MiningDrillPrototype
                | OffshorePumpPrototype
                | PumpPrototype
                | StorageTankPrototype
                | TrainStopPrototype
            return e_resolved.circuit_connector[dir / 2]
        }
        case 'rail-chain-signal':
        case 'rail-signal': {
            const e_resolved = e as RailSignalBasePrototype
            return e_resolved.ground_picture_set.circuit_connector[dir * 2]
        }
        case 'loader':
        case 'loader-1x1': {
            const e_resolved = e as LoaderPrototype
            // First the four cardinal directions for `direction_out`, followed by the four directions for `direction_in`.
            return e_resolved.circuit_connector[(isLoaderInputting() ? 4 : 0) + dir / 2]
        }
        case 'transport-belt': {
            const e_resolved = e as TransportBeltPrototype
            // Set of 7 CircuitConnectorDefinition in order: X, H, V, SE, SW, NE and NW.
            return e_resolved.circuit_connector[getBeltConnectionIndex()]
        }
        case 'ammo-turret':
        case 'electric-turret':
        case 'fluid-turret':
        case 'turret': {
            const e_resolved = e as TurretPrototype
            // Set of CircuitConnectorDefinition for all directions used by this turret.
            // Required amount of elements is based on other prototype values: 8 elements if
            // building-direction-8-way flag is set, or 16 elements if
            // building-direction-16-way flag is set, or 4 elements if
            // turret_base_has_direction is set to true, or 1 element.
            let d = 0
            if (e.flags && e.flags.includes('building-direction-16-way')) {
                d = dir * 2
            } else if (e.flags && e.flags.includes('building-direction-8-way')) {
                d = dir
            } else if (e_resolved.turret_base_has_direction) {
                d = dir / 2
            }
            return e_resolved.circuit_connector[d]
        }
        default:
            return null
    }
}

export function getWireConnectionPoint(
    e: EntityWithOwnerPrototype,
    dir: number,
    getCombinatorSide: () => 'input' | 'output',
    getPowerSwitchSide: () => 'circuit' | 'left' | 'right'
): null | WireConnectionPoint {
    switch (e.type) {
        case 'arithmetic-combinator':
        case 'decider-combinator':
        case 'selector-combinator': {
            const e_resolved = e as CombinatorPrototype
            if (getCombinatorSide() === 'input') {
                return e_resolved.input_connection_points[dir / 2]
            } else {
                return e_resolved.output_connection_points[dir / 2]
            }
        }
        case 'constant-combinator': {
            const e_resolved = e as ConstantCombinatorPrototype
            return e_resolved.circuit_wire_connection_points[dir / 2]
        }
        case 'electric-pole': {
            const e_resolved = e as ElectricPolePrototype
            return e_resolved.connection_points[dir / 2]
        }
        case 'power-switch': {
            const e_resolved = e as PowerSwitchPrototype
            switch (getPowerSwitchSide()) {
                case 'circuit':
                    return e_resolved.circuit_wire_connection_point
                case 'left':
                    return e_resolved.left_wire_connection_point
                case 'right':
                    return e_resolved.right_wire_connection_point
            }
        }
        default:
            return null
    }
}

export function getFluidBoxes(
    e: EntityWithOwnerPrototype,
    assemblingMachineHasFluidRecipe: boolean
): readonly FluidBox[] {
    const fbs = getInnerFluidBoxes(e, assemblingMachineHasFluidRecipe)
    const es = getEnergySource(e)
    if (es && es.type === 'fluid') {
        fbs.push(es.fluid_box)
    }
    return fbs
}

function getInnerFluidBoxes(
    e: EntityWithOwnerPrototype,
    assemblingMachineHasFluidRecipe: boolean
): FluidBox[] {
    switch (e.type) {
        case 'boiler': {
            const e_resolved = e as BoilerPrototype
            const out = [e_resolved.fluid_box]
            if (e_resolved.mode === 'output-to-separate-pipe') {
                out.push(e_resolved.output_fluid_box)
            }
            return out
        }
        case 'assembling-machine': {
            const e_resolved = e as AssemblingMachinePrototype
            if (
                e_resolved.fluid_boxes_off_when_no_fluid_recipe &&
                !assemblingMachineHasFluidRecipe
            ) {
                return []
            } else {
                return [...(e_resolved.fluid_boxes || [])]
            }
        }
        case 'furnace':
        case 'rocket-silo': {
            const e_resolved = e as CraftingMachinePrototype
            return [...(e_resolved.fluid_boxes || [])]
        }
        case 'fluid-turret':
        case 'generator':
        case 'offshore-pump':
        case 'infinity-pipe':
        case 'pipe':
        case 'pipe-to-ground':
        case 'pump':
        case 'storage-tank':
        case 'valve': {
            const e_resolved = e as
                | FluidTurretPrototype
                | GeneratorPrototype
                | OffshorePumpPrototype
                | PipePrototype
                | PipeToGroundPrototype
                | PumpPrototype
                | StorageTankPrototype
                | ValvePrototype
            return [e_resolved.fluid_box]
        }
        case 'fusion-generator':
        case 'fusion-reactor': {
            const e_resolved = e as FusionGeneratorPrototype | FusionReactorPrototype
            return [e_resolved.input_fluid_box, e_resolved.output_fluid_box]
        }
        case 'mining-drill': {
            const e_resolved = e as MiningDrillPrototype
            const out = []
            // if (e_resolved.input_fluid_box) out.push(e_resolved.input_fluid_box)
            if (e_resolved.output_fluid_box) out.push(e_resolved.output_fluid_box)
            return out
        }
        case 'thruster': {
            const e_resolved = e as ThrusterPrototype
            return [e_resolved.fuel_fluid_box, e_resolved.oxidizer_fluid_box]
        }
        default:
            return []
    }
}

export function mapBoundingBox(bb: BoundingBox): [[number, number], [number, number]] {
    const mapP = (p: MapPosition): [number, number] =>
        Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y]
    if (Array.isArray(bb)) {
        return [mapP(bb[0]), mapP(bb[1])]
    } else {
        return [mapP(bb.left_top), mapP(bb.right_bottom)]
    }
}

export function getEntitySize(e: EntityWithOwnerPrototype, dir: number = 0): IPoint {
    const bb = mapBoundingBox(e.collision_box)
    const w = e.tile_width || Math.ceil(Math.abs(bb[0][0]) + Math.abs(bb[1][0]))
    const h = e.tile_height || Math.ceil(Math.abs(bb[0][1]) + Math.abs(bb[1][1]))
    if (w === h) {
        return { x: w, y: h }
    } else {
        switch (dir) {
            case 0:
            case 4:
                return { x: w, y: h }
            case 2:
            case 6:
                return { x: h, y: w }
            default:
                throw new Error("Can't swap size based on dir!")
        }
    }
}

export function getPossibleRotations(e: EntityWithOwnerPrototype): number[] {
    if (e.flags && e.flags.includes('not-rotatable')) {
        return []
    }
    if (e.flags && e.flags.includes('building-direction-8-way')) {
        return [0, 1, 2, 3, 4, 5, 6, 7]
    }
    if (e.flags && e.flags.includes('building-direction-16-way')) {
        return [0, 1, 2, 3, 4, 5, 6, 7]
    }
    switch (e.type) {
        case 'agricultural-tower':
        case 'artillery-turret':
        case 'asteroid-collector':
        case 'boiler':
        case 'burner-generator':
        case 'arithmetic-combinator':
        case 'decider-combinator':
        case 'selector-combinator':
        case 'constant-combinator':
        case 'assembling-machine':
        case 'fusion-generator':
        case 'gate':
        case 'generator':
        case 'inserter':
        case 'lightning-attractor':
        case 'mining-drill':
        case 'offshore-pump':
        case 'pipe-to-ground':
        case 'pump':
        case 'curved-rail-a':
        case 'elevated-curved-rail-a':
        case 'curved-rail-b':
        case 'elevated-curved-rail-b':
        case 'half-diagonal-rail':
        case 'elevated-half-diagonal-rail':
        case 'legacy-curved-rail':
        case 'legacy-straight-rail':
        case 'rail-ramp':
        case 'straight-rail':
        case 'elevated-straight-rail':
        case 'rail-chain-signal':
        case 'rail-signal':
        case 'rail-support':
        case 'simple-entity-with-owner':
        case 'simple-entity-with-force':
        case 'thruster':
        case 'train-stop':
        case 'lane-splitter':
        case 'linked-belt':
        case 'loader-1x1':
        case 'loader':
        case 'splitter':
        case 'transport-belt':
        case 'underground-belt':
        case 'turret':
        case 'ammo-turret':
        case 'electric-turret':
        case 'fluid-turret':
        case 'valve':
        case 'artillery-wagon':
        case 'cargo-wagon':
        case 'infinity-cargo-wagon':
        case 'fluid-wagon':
        case 'locomotive':
            return [0, 2, 4, 6]
        case 'storage-tank':
        case 'fusion-reactor': {
            const e_resolved = e as StorageTankPrototype | FusionReactorPrototype
            if (e_resolved.two_direction_only) {
                return [0, 2]
            } else {
                return [0, 2, 4, 6]
            }
        }
        default:
            return []
    }
}

export function getHeatBuffer(e: EntityWithOwnerPrototype): null | HeatBuffer {
    switch (e.type) {
        case 'heat-pipe':
        case 'heat-interface':
        case 'reactor': {
            const e_resolved = e as HeatPipePrototype | HeatInterfacePrototype | ReactorPrototype
            return e_resolved.heat_buffer
        }
        default:
            return null
    }
}
export function getEnergySource(e: EntityWithOwnerPrototype): null | EnergySource {
    switch (e.type) {
        case 'agricultural-tower':
        case 'boiler':
        case 'assembling-machine':
        case 'furnace':
        case 'rocket-silo':
        case 'inserter':
        case 'lab':
        case 'mining-drill':
        case 'offshore-pump':
        case 'pump':
        case 'radar':
        case 'reactor': {
            const e_resolved = e as
                | AgriculturalTowerPrototype
                | BoilerPrototype
                | CraftingMachinePrototype
                | InserterPrototype
                | LabPrototype
                | MiningDrillPrototype
                | OffshorePumpPrototype
                | PumpPrototype
                | RadarPrototype
                | ReactorPrototype
            return e_resolved.energy_source
        }
        default:
            return null
    }
}

export function getColor(
    color:
        | ColorStruct
        | readonly [number, number, number]
        | readonly [number, number, number, number]
): ColorWithAlpha {
    if (Array.isArray(color)) {
        return {
            r: color[0],
            g: color[1],
            b: color[2],
            a: color[3] || 1,
        }
    } else {
        return {
            r: color.r || 0,
            g: color.g || 0,
            b: color.b || 0,
            a: color.a || 1,
        }
    }
}

// @ts-ignore
const FD: {
    items: Record<string, ItemPrototype>
    fluids: Record<string, FluidPrototype>
    signals: Record<string, VirtualSignalPrototype>
    recipes: Record<string, RecipePrototype>
    entities: Record<string, EntityWithOwnerPrototype>
    tiles: Record<string, TilePrototype>
    inventoryLayout: InventoryLayoutGroup[]
    utilitySprites: UtilitySprites
    // treesAndRocks: Record<string, TreeOrRock>

    getModulesFor: (entityName: string) => ItemPrototype[]
} = {}

export function loadData(str: string): void {
    const data = JSON.parse(str)
    console.log(data)
    FD.items = data.items
    FD.fluids = data.fluids
    FD.signals = data.signals
    FD.recipes = data.recipes
    FD.entities = data.entities
    FD.tiles = data.tiles
    FD.inventoryLayout = data.inventoryLayout
    FD.utilitySprites = data.utilitySprites
    FD.getModulesFor = getModulesFor

    for (const e of Object.values(FD.entities)) {
        // separate fast_replaceable_group since we don't support fast replacing different types
        if (e.type === 'splitter') {
            e.fast_replaceable_group = 'splitter'
        } else if (e.type === 'underground-belt') {
            e.fast_replaceable_group = 'underground-belt'
        }
    }
}

export default FD

export interface Color {
    r: number
    g: number
    b: number
}

export interface ColorWithAlpha extends Color {
    a: number
}

export interface InventoryLayoutGroup {
    name: string
    icon: string
    icons?: IconData[]
    icon_size?: number
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
    icons?: IconData[]
    order: string
}
