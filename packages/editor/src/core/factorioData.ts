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

function isModule(item: ItemPrototype): item is ModulePrototype {
    const type: ModulePrototype['type'] = 'module'
    return item.type === type
}
export function isCraftingMachine(e: EntityWithOwnerPrototype): e is CraftingMachinePrototype {
    switch (e.type as string) {
        case 'assembling_machine':
        case 'furnace':
        case 'rocket_silo': {
            return true
        }
        default:
            return false
    }
}

export function getModule(name: string): ModulePrototype {
    const item = FD.items[name]
    if (isModule(item)) return item
    else throw new Error('Internal Error!')
}

export function getCircuitConnector(
    e: EntityWithOwnerPrototype,
    dir: number
): null | CircuitConnectorDefinition {
    switch (e.type as string) {
        case 'accumulator':
        case 'agricultural_tower':
        case 'artillery_turret':
        case 'cargo_landing_pad':
        case 'container':
        case 'infinity_container':
        case 'logistic_container':
        case 'temporary_container':
        case 'lamp':
        case 'linked_container':
        case 'programmable_speaker':
        case 'proxy_container':
        case 'radar':
        case 'reactor':
        case 'roboport':
        case 'space_platform_hub':
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
        case 'assembling_machine':
        case 'rocket_silo':
        case 'asteroid_collector':
        case 'display_panel':
        case 'furnace':
        case 'inserter':
        case 'mining_drill':
        case 'offshore_pump':
        case 'pump':
        case 'storage_tank':
        case 'train_stop': {
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
        case 'rail_chain_signal':
        case 'rail_signal': {
            const e_resolved = e as RailSignalBasePrototype
            return e_resolved.ground_picture_set.circuit_connector[dir * 2]
        }
        case 'loader':
        case 'loader_1x1': {
            const e_resolved = e as LoaderPrototype
            // First the four cardinal directions for `direction_out`, followed by the four directions for `direction_in`.
            // TODO
            return e_resolved.circuit_connector[0]
        }
        case 'transport_belt': {
            const e_resolved = e as TransportBeltPrototype
            // Set of 7 CircuitConnectorDefinition in order: X, H, V, SE, SW, NE and NW.
            // TODO
            return e_resolved.circuit_connector[0]
        }
        case 'ammo_turret':
        case 'electric_turret':
        case 'fluid_turret':
        case 'turret': {
            const e_resolved = e as TurretPrototype
            // Set of CircuitConnectorDefinition for all directions used by this turret. Required amount of elements is based on other prototype values: 8 elements if building-direction-8-way flag is set, or 16 elements if building-direction-16-way flag is set, or 4 elements if turret_base_has_direction is set to true, or 1 element.
            // TODO
            return e_resolved.circuit_connector[0]
        }
        default:
            return null
    }
}

export function getHeatBuffer(e: EntityWithOwnerPrototype): null | HeatBuffer {
    switch (e.type as string) {
        case 'heat_pipe':
        case 'heat_interface':
        case 'reactor': {
            const e_resolved = e as HeatPipePrototype | HeatInterfacePrototype | ReactorPrototype
            return e_resolved.heat_buffer
        }
        default:
            return null
    }
}
export function getEnergySource(e: EntityWithOwnerPrototype): null | EnergySource {
    switch (e.type as string) {
        case 'agricultural_tower':
        case 'boiler':
        case 'assembling_machine':
        case 'furnace':
        case 'rocket_silo':
        case 'inserter':
        case 'lab':
        case 'mining_drill':
        case 'offshore_pump':
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
    // convert every - to _ without file paths
    const data = JSON.parse(
        str.replace(/("(?!__base__|__core__)[^":]+?-[^":]+?")/g, (_: string, capture: string) =>
            capture.replace(/-/g, '_')
        )
    )
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
    icons?: IconData[]
    order: string
}
