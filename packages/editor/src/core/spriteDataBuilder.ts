import util from '../common/util'
import { IPoint } from '../types'
import FD, {
    ColorWithAlpha,
    getHeatBuffer,
    getEnergySource,
    getCircuitConnector,
    getEntitySize,
} from './factorioData'
import { PositionGrid } from './PositionGrid'
import { Entity } from './Entity'
import {
    CircuitConnectorDefinition,
    RailPieceLayers,
    SpriteVariations,
    EntityWithOwnerPrototype,
    TransportBeltAnimationSetWithCorners,
    Sprite as SpriteData,
    CombinatorPrototype,
    HeatConnection,
    Sprite4Way,
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
import { Animation } from 'factorio:prototype'
import { Animation4Way } from 'factorio:prototype'

interface IDrawData {
    dir: number

    name: string
    positionGrid: PositionGrid
    position: IPoint
    generateConnector: boolean

    assemblerPipeDirection: string
    dirType: string
    operator: string
    assemblerCraftsWithFluid: boolean
    trainStopColor: ColorWithAlpha
    chemicalPlantDontConnectOutput: boolean
    modules: string[]
}

export interface ExtendedSpriteData extends SpriteData {
    anchorX?: number
    anchorY?: number
    squishY?: number
    rotAngle?: number
}

const generatorCache = new Map<string, (data: IDrawData) => readonly ExtendedSpriteData[]>()

function getSpriteData(data: IDrawData): readonly ExtendedSpriteData[] {
    if (generatorCache.has(data.name)) {
        return generatorCache.get(data.name)(data)
    }

    const entity = FD.entities[data.name]
    const generator = (data: IDrawData): readonly ExtendedSpriteData[] => {
        return [
            ...generateGraphics(entity)(data),
            ...generateCovers(entity, data),
            ...generateConnection(entity, data),
        ]
    }
    generatorCache.set(data.name, generator)

    return generator(data)
}

function getPipeCovers(e: EntityWithOwnerPrototype): DirectionalSpriteLayers {
    if (e.fluid_box && e.output_fluid_box) {
        return e.fluid_box.pipe_covers
    }
    if (e.fluid_box) {
        return e.fluid_box.pipe_covers
    }
    if (e.output_fluid_box) {
        return e.output_fluid_box.pipe_covers
    }
    if (e.fluid_boxes) {
        for (const fb of e.fluid_boxes) {
            if (fb instanceof Object) {
                return fb.pipe_covers
            }
        }
    }
}

function generateConnection(e: EntityWithOwnerPrototype, data: IDrawData): readonly SpriteData[] {
    if (!data.generateConnector) return []
    const cc = getCircuitConnector(e, data.dir)
    if (cc) {
        const ccs = cc.sprites
        return [ccs.connector_main, ccs.wire_pins, ccs.led_blue_off]
    }
    return []
}
// UTIL FUNCTIONS
function addToShift(shift: IPoint | number[], tab: SpriteData): SpriteData {
    const SHIFT: number[] = Array.isArray(shift) ? shift : [shift.x, shift.y]

    tab.shift = tab.shift ? [SHIFT[0] + tab.shift[0], SHIFT[1] + tab.shift[1]] : SHIFT

    return tab
}

function setProperty<K extends keyof ExtendedSpriteData>(
    img: ExtendedSpriteData,
    key: K,
    val: ExtendedSpriteData[K]
): ExtendedSpriteData {
    img[key] = val
    return img
}

type PickByType<T, Value> = {
    [P in keyof T as T[P] extends Value ? P : never]: T[P]
}

function setPropertyUsing<
    K0 extends keyof PickByType<ExtendedSpriteData, number>,
    K1 extends keyof PickByType<ExtendedSpriteData, number>,
>(img: ExtendedSpriteData, key0: K0, key1: K1, mult = 1): ExtendedSpriteData {
    if (key1) {
        img[key0] = img[key1] * mult
    }
    return img
}

function duplicateAndSetPropertyUsing<
    K0 extends keyof PickByType<SpriteData, number>,
    K1 extends keyof PickByType<SpriteData, number>,
>(img: SpriteData, key0: K0, key1: K1, mult: number): SpriteData {
    return setPropertyUsing(util.duplicate(img), key0, key1, mult)
}

function generateCovers(e: EntityWithOwnerPrototype, data: IDrawData): readonly SpriteData[] {
    // entity doesn't have PipeCoverFeature
    if (!(e.fluid_box || e.fluid_boxes || e.output_fluid_box)) {
        return []
    }

    if (
        e.name === 'pipe' ||
        e.name === 'infinity-pipe' ||
        ((e.name === 'assembling-machine-2' || e.name === 'assembling-machine-3') &&
            !data.assemblerCraftsWithFluid)
    ) {
        return []
    }

    const connections = getPipeConnectionPoints(e, data.dir, data.assemblerPipeDirection)
    if (!connections) {
        return []
    }

    const output = []
    for (const connection of connections) {
        const dir = util.getRelativeDirection(connection)

        const needsCover = (): boolean => {
            if (e.name === 'chemical-plant') {
                // don't generate covers for northen side - the texture already contains those
                if (dir === 0) {
                    return false
                }

                if (data.chemicalPlantDontConnectOutput && data.dir === (dir + 4) % 8) {
                    return true
                }
            }

            const pos = {
                x: Math.floor(data.position.x + connection.x),
                y: Math.floor(data.position.y + connection.y),
            }

            const ent = data.positionGrid.getEntityAtPosition(pos)
            if (!ent) {
                return true
            }

            if (
                ent.name === 'chemical-plant' &&
                ent.chemicalPlantDontConnectOutput &&
                ent.direction === dir
            ) {
                return true
            }

            if (
                ent.type === 'pipe' ||
                ent.type === 'infinity-pipe' ||
                ent.type === 'pipe-to-ground' ||
                ent.entityData.fluid_box ||
                ent.entityData.output_fluid_box ||
                ent.entityData.fluid_boxes
            ) {
                const connections2 = getPipeConnectionPoints(
                    ent.entityData,
                    ent.direction,
                    ent.assemblerPipeDirection
                )
                for (const connection2 of connections2) {
                    const p2 = { ...pos }
                    switch (dir) {
                        case 0:
                            p2.y += 1
                            break
                        case 2:
                            p2.x -= 1
                            break
                        case 4:
                            p2.y -= 1
                            break
                        case 6:
                            p2.x += 1
                    }
                    if (
                        p2.x === Math.floor(ent.position.x + connection2.x) &&
                        p2.y === Math.floor(ent.position.y + connection2.y)
                    ) {
                        return false
                    }
                }
            }
            return true
        }

        if (!data.positionGrid || needsCover()) {
            let temp = getPipeCovers(e)[util.getDirName(dir)].layers[0]
            temp = addToShift(connection, util.duplicate(temp))
            if (dir === 4) {
                output.push(temp)
            } else {
                output.unshift(temp)
            }
        }
    }
    return output
}

function getPipeConnectionPoints(
    e: EntityWithOwnerPrototype,
    dir: number,
    assemblerPipeDirection: string
): IPoint[] {
    function getConn(): PipeConnection[] {
        if (e.fluid_box && e.output_fluid_box) {
            return [...e.fluid_box.pipe_connections, ...e.output_fluid_box.pipe_connections]
        }
        if (e.fluid_box) {
            if (e.name === 'pipe-to-ground') {
                return [e.fluid_box.pipe_connections[0]]
            }
            return e.fluid_box.pipe_connections
        }
        if (e.output_fluid_box) {
            return e.output_fluid_box.pipe_connections
        }
        if (e.fluid_boxes) {
            const conn = []
            for (const fb of e.fluid_boxes) {
                if (fb instanceof Object) {
                    conn.push(fb.pipe_connections[0])
                }
            }
            return conn
        }
        return undefined
    }
    const connections = getConn()
    if (!connections) {
        return undefined
    }
    const positions = []
    if (e.name === 'pumpjack') {
        positions.push({
            x: connections[0].positions[dir / 2][0],
            y: connections[0].positions[dir / 2][1],
        })
    } else if (e.name === 'assembling-machine-2' || e.name === 'assembling-machine-3') {
        positions.push(
            util.rotatePointBasedOnDir(
                connections[assemblerPipeDirection === 'input' ? 0 : 1].position,
                dir
            )
        )
    } else {
        for (const connection of connections) {
            positions.push(util.rotatePointBasedOnDir(connection.position, dir))
        }
    }
    return positions
}

function getHeatConnections(position: IPoint, positionGrid: PositionGrid): boolean[] {
    return positionGrid.getNeighbourData(position).map(({ x, y, entity }) => {
        if (!entity) {
            return false
        }

        const checkConnections = (connections: readonly HeatConnection[]): boolean => {
            return (
                connections
                    .map(conn => util.rotatePointBasedOnDir(conn.position, entity.direction))
                    .filter(
                        offset =>
                            x === Math.floor(entity.position.x + offset.x) &&
                            y === Math.floor(entity.position.y + offset.y)
                    ).length > 0
            )
        }

        // check for heat_buffer first since the reactor has both properties
        const heat_buffer = getHeatBuffer(entity.entityData)
        if (heat_buffer) {
            return checkConnections(heat_buffer.connections)
        }

        const energy_source = getEnergySource(entity.entityData)
        if (energy_source) {
            if (energy_source.type === 'heat') {
                return checkConnections(energy_source.connections)
            }
        }

        return false
    })
}

function getBeltWireConnectionIndex(
    positionGrid: PositionGrid,
    position: IPoint,
    dir: number
): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
    let C = positionGrid.getNeighbourData(position).map(d => {
        if (
            d.entity &&
            (d.entity.type === 'transport-belt' ||
                d.entity.type === 'splitter' ||
                ((d.entity.type === 'underground-belt' || d.entity.type === 'loader') &&
                    d.entity.directionType === 'output')) &&
            d.entity.direction === (d.relDir + 4) % 8
        ) {
            return d
        }
    })
    // Rotate directions
    C = [...C, ...C].splice(dir / 2, 4)

    if (!C[1] && C[2] && !C[3]) {
        if (dir === 0 || dir === 4) {
            return 2
        }
        return 1
    }
    if (C[1] && !C[2] && !C[3]) {
        switch (dir) {
            case 0:
                return 5
            case 2:
                return 3
            case 4:
                return 4
            case 6:
                return 6
        }
    }
    if (!C[1] && !C[2] && C[3]) {
        switch (dir) {
            case 0:
                return 6
            case 2:
                return 5
            case 4:
                return 3
            case 6:
                return 4
        }
    }
    return 0
}

function getBeltSprites(
    bas: TransportBeltAnimationSetWithCorners,
    position: IPoint,
    direction: number,
    positionGrid?: PositionGrid,
    stratingEnding = true,
    endingEnding = true,
    forceStraight = false
): readonly SpriteData[] {
    const parts = []

    if (positionGrid) {
        const conn = getConnForPos(positionGrid, position, direction, forceStraight)

        parts.push(getBeltSpriteFromData(bas, direction, conn.curve))

        if (stratingEnding) {
            let spawn = true

            if (conn.from) {
                const C = getConnForPos(positionGrid, conn.from, conn.from.entity.direction)

                if (
                    (C.from &&
                        C.from.x === Math.floor(position.x) &&
                        C.from.y === Math.floor(position.y)) ||
                    (C.to && C.to.x === Math.floor(position.x) && C.to.y === Math.floor(position.y))
                ) {
                    spawn = false
                }
            }

            if (spawn) {
                parts.push(
                    addToShift(
                        util.rotatePointBasedOnDir([0, 1], direction),
                        getBeltSpriteFromData(bas, direction, 'stratingEnding')
                    )
                )
            }
        }

        if (endingEnding) {
            let spawn = true

            if (conn.to) {
                const C = getConnForPos(positionGrid, conn.to, conn.to.entity.direction)
                if (
                    (C.from &&
                        C.from.x === Math.floor(position.x) &&
                        C.from.y === Math.floor(position.y)) ||
                    (C.to && C.to.x === Math.floor(position.x) && C.to.y === Math.floor(position.y))
                ) {
                    spawn = false
                }
            }

            if (spawn) {
                parts.push(
                    addToShift(
                        util.rotatePointBasedOnDir([0, -1], direction),
                        getBeltSpriteFromData(bas, direction, 'endingEnding')
                    )
                )
            }
        }
    } else {
        parts.push(getBeltSpriteFromData(bas, direction, 'straight'))

        if (stratingEnding) {
            parts.push(
                addToShift(
                    util.rotatePointBasedOnDir([0, 1], direction),
                    getBeltSpriteFromData(bas, direction, 'stratingEnding')
                )
            )
        }

        if (endingEnding) {
            parts.push(
                addToShift(
                    util.rotatePointBasedOnDir([0, -1], direction),
                    getBeltSpriteFromData(bas, direction, 'endingEnding')
                )
            )
        }
    }

    return parts

    type BeltShape = 'straight' | 'rightCurve' | 'leftCurve' | 'stratingEnding' | 'endingEnding'

    interface IFromTo extends IPoint {
        entity: Entity
    }

    interface IConnection {
        from: IFromTo
        to: IFromTo
        curve: BeltShape
    }

    function getConnForPos(
        positionGrid: PositionGrid,
        pos: IPoint,
        direction: number,
        forceStraight = false
    ): IConnection {
        let C = positionGrid.getNeighbourData(pos).map(d => {
            if (
                d.entity &&
                (d.entity.type === 'transport-belt' ||
                    d.entity.type === 'splitter' ||
                    d.entity.type === 'underground-belt' ||
                    d.entity.type === 'loader')
            ) {
                return d
            }
        })
        // Rotate based on belt direction
        C = [...C, ...C].splice(direction / 2, 4)

        // Belt facing this belt
        const C2 = C.map(d => {
            if (
                !d ||
                ((d.entity.type === 'underground-belt' || d.entity.type === 'loader') &&
                    d.entity.directionType === 'input')
            ) {
                return
            }
            if (d.entity.direction === (d.relDir + 4) % 8) {
                return d
            }
        })

        const entAtPos = positionGrid.getEntityAtPosition(pos)
        if (
            forceStraight ||
            entAtPos.type === 'splitter' ||
            entAtPos.type === 'underground-belt' ||
            entAtPos.type === 'loader'
        ) {
            return {
                from: C[2],
                to: C[0],
                curve: 'straight',
            }
        }

        if (C2[1] && !C2[3] && !C2[2]) {
            return {
                from: C[1],
                to: C[0],
                curve: 'rightCurve',
            }
        }
        if (C2[3] && !C2[1] && !C2[2]) {
            return {
                from: C[3],
                to: C[0],
                curve: 'leftCurve',
            }
        }
        return {
            from: C[2],
            to: C[0],
            curve: 'straight',
        }
    }

    function getBeltSpriteFromData(
        bas: TransportBeltAnimationSetWithCorners,
        dir: number,
        type: BeltShape
    ): SpriteData {
        return duplicateAndSetPropertyUsing(bas.animation_set, 'y', 'size', getIndex() - 1)

        function getIndex(): number {
            switch (type) {
                case 'straight':
                    switch (dir) {
                        case 0:
                            return bas.north_index || 3
                        case 2:
                            return bas.east_index || 1
                        case 4:
                            return bas.south_index || 4
                        case 6:
                            return bas.west_index || 2
                    }
                    break
                case 'rightCurve':
                    switch (dir) {
                        case 0:
                            return bas.east_to_north_index || 5
                        case 2:
                            return bas.south_to_east_index || 9
                        case 4:
                            return bas.west_to_south_index || 12
                        case 6:
                            return bas.north_to_west_index || 8
                    }
                    break
                case 'leftCurve':
                    switch (dir) {
                        case 0:
                            return bas.west_to_north_index || 7
                        case 2:
                            return bas.north_to_east_index || 6
                        case 4:
                            return bas.east_to_south_index || 10
                        case 6:
                            return bas.south_to_west_index || 11
                    }
                    break
                case 'stratingEnding':
                    switch (dir) {
                        case 0:
                            return bas.starting_south_index || 13
                        case 2:
                            return bas.starting_west_index || 15
                        case 4:
                            return bas.starting_north_index || 17
                        case 6:
                            return bas.starting_east_index || 19
                    }
                    break
                case 'endingEnding':
                    switch (dir) {
                        case 0:
                            return bas.ending_north_index || 18
                        case 2:
                            return bas.ending_east_index || 20
                        case 4:
                            return bas.ending_south_index || 14
                        case 6:
                            return bas.ending_west_index || 16
                    }
            }
        }
    }
}

function getAnimation(a: Animation4Way, dir: number): Animation {
    const ad = a[util.getDirName(dir)]
    if (ad) {
        return ad
    } else if (a['north']) {
        return a['north']
    } else {
        return a as Animation
    }
}

function generateGraphics(e: EntityWithOwnerPrototype): (data: IDrawData) => readonly SpriteData[] {
    switch (e.type) {
        case 'accumulator':
            return draw_accumulator(e as AccumulatorPrototype)
        case 'agricultural-tower':
            return draw_agricultural_tower(e as AgriculturalTowerPrototype)
        case 'ammo-turret':
            return draw_ammo_turret(e as AmmoTurretPrototype)
        case 'arithmetic-combinator':
            return draw_arithmetic_combinator(e as ArithmeticCombinatorPrototype)
        case 'artillery-turret':
            return draw_artillery_turret(e as ArtilleryTurretPrototype)
        case 'artillery-wagon':
            return draw_artillery_wagon(e as ArtilleryWagonPrototype)
        case 'assembling-machine':
            return draw_assembling_machine(e as AssemblingMachinePrototype)
        case 'asteroid-collector':
            return draw_asteroid_collector(e as AsteroidCollectorPrototype)
        case 'beacon':
            return draw_beacon(e as BeaconPrototype)
        case 'boiler':
            return draw_boiler(e as BoilerPrototype)
        case 'burner-generator':
            return draw_burner_generator(e as BurnerGeneratorPrototype)
        case 'cargo-bay':
            return draw_cargo_bay(e as CargoBayPrototype)
        case 'cargo-landing-pad':
            return draw_cargo_landing_pad(e as CargoLandingPadPrototype)
        case 'cargo-wagon':
            return draw_cargo_wagon(e as CargoWagonPrototype)
        case 'constant-combinator':
            return draw_constant_combinator(e as ConstantCombinatorPrototype)
        case 'construction-robot':
            return draw_construction_robot(e as ConstructionRobotPrototype)
        case 'container':
            return draw_container(e as ContainerPrototype)
        case 'curved-rail-a':
            return draw_curved_rail_a(e as CurvedRailAPrototype)
        case 'curved-rail-b':
            return draw_curved_rail_b(e as CurvedRailBPrototype)
        case 'decider-combinator':
            return draw_decider_combinator(e as DeciderCombinatorPrototype)
        case 'display-panel':
            return draw_display_panel(e as DisplayPanelPrototype)
        case 'electric-energy-interface':
            return draw_electric_energy_interface(e as ElectricEnergyInterfacePrototype)
        case 'electric-pole':
            return draw_electric_pole(e as ElectricPolePrototype)
        case 'electric-turret':
            return draw_electric_turret(e as ElectricTurretPrototype)
        case 'elevated-curved-rail-a':
            return draw_elevated_curved_rail_a(e as ElevatedCurvedRailAPrototype)
        case 'elevated-curved-rail-b':
            return draw_elevated_curved_rail_b(e as ElevatedCurvedRailBPrototype)
        case 'elevated-half-diagonal-rail':
            return draw_elevated_half_diagonal_rail(e as ElevatedHalfDiagonalRailPrototype)
        case 'elevated-straight-rail':
            return draw_elevated_straight_rail(e as ElevatedStraightRailPrototype)
        case 'fluid-turret':
            return draw_fluid_turret(e as FluidTurretPrototype)
        case 'fluid-wagon':
            return draw_fluid_wagon(e as FluidWagonPrototype)
        case 'furnace':
            return draw_furnace(e as FurnacePrototype)
        case 'fusion-generator':
            return draw_fusion_generator(e as FusionGeneratorPrototype)
        case 'fusion-reactor':
            return draw_fusion_reactor(e as FusionReactorPrototype)
        case 'gate':
            return draw_gate(e as GatePrototype)
        case 'generator':
            return draw_generator(e as GeneratorPrototype)
        case 'half-diagonal-rail':
            return draw_half_diagonal_rail(e as HalfDiagonalRailPrototype)
        case 'heat-interface':
            return draw_heat_interface(e as HeatInterfacePrototype)
        case 'heat-pipe':
            return draw_heat_pipe(e as HeatPipePrototype)
        case 'infinity-cargo-wagon':
            return draw_infinity_cargo_wagon(e as InfinityCargoWagonPrototype)
        case 'infinity-container':
            return draw_infinity_container(e as InfinityContainerPrototype)
        case 'inserter':
            return draw_inserter(e as InserterPrototype)
        case 'lab':
            return draw_lab(e as LabPrototype)
        case 'lamp':
            return draw_lamp(e as LampPrototype)
        case 'land-mine':
            return draw_land_mine(e as LandMinePrototype)
        case 'lane-splitter':
            return draw_lane_splitter(e as LaneSplitterPrototype)
        case 'legacy-curved-rail':
            return draw_legacy_curved_rail(e as LegacyCurvedRailPrototype)
        case 'legacy-straight-rail':
            return draw_legacy_straight_rail(e as LegacyStraightRailPrototype)
        case 'lightning-attractor':
            return draw_lightning_attractor(e as LightningAttractorPrototype)
        case 'linked-belt':
            return draw_linked_belt(e as LinkedBeltPrototype)
        case 'linked-container':
            return draw_linked_container(e as LinkedContainerPrototype)
        case 'loader-1x1':
        case 'loader':
            return draw_loader(e as LoaderPrototype)
        case 'locomotive':
            return draw_locomotive(e as LocomotivePrototype)
        case 'logistic-container':
            return draw_logistic_container(e as LogisticContainerPrototype)
        case 'logistic-robot':
            return draw_logistic_robot(e as LogisticRobotPrototype)
        case 'mining-drill':
            return draw_mining_drill(e as MiningDrillPrototype)
        case 'offshore-pump':
            return draw_offshore_pump(e as OffshorePumpPrototype)
        case 'pipe':
        case 'infinity-pipe':
            return draw_pipe(e as PipePrototype)
        case 'pipe-to-ground':
            return draw_pipe_to_ground(e as PipeToGroundPrototype)
        case 'power-switch':
            return draw_power_switch(e as PowerSwitchPrototype)
        case 'programmable-speaker':
            return draw_programmable_speaker(e as ProgrammableSpeakerPrototype)
        case 'proxy-container':
            return draw_proxy_container(e as ProxyContainerPrototype)
        case 'pump':
            return draw_pump(e as PumpPrototype)
        case 'radar':
            return draw_radar(e as RadarPrototype)
        case 'rail-ramp':
            return draw_rail_ramp(e as RailRampPrototype)
        case 'rail-signal':
        case 'rail-chain-signal':
            return draw_rail_signal_base(e as RailSignalBasePrototype)
        case 'rail-support':
            return draw_rail_support(e as RailSupportPrototype)
        case 'reactor':
            return draw_reactor(e as ReactorPrototype)
        case 'roboport':
            return draw_roboport(e as RoboportPrototype)
        case 'rocket-silo':
            return draw_rocket_silo(e as RocketSiloPrototype)
        case 'selector-combinator':
            return draw_selector_combinator(e as SelectorCombinatorPrototype)
        case 'solar-panel':
            return draw_solar_panel(e as SolarPanelPrototype)
        case 'space-platform-hub':
            return draw_space_platform_hub(e as SpacePlatformHubPrototype)
        case 'splitter':
            return draw_splitter(e as SplitterPrototype)
        case 'storage-tank':
            return draw_storage_tank(e as StorageTankPrototype)
        case 'straight-rail':
            return draw_straight_rail(e as StraightRailPrototype)
        case 'thruster':
            return draw_thruster(e as ThrusterPrototype)
        case 'train-stop':
            return draw_train_stop(e as TrainStopPrototype)
        case 'transport-belt':
            return draw_transport_belt(e as TransportBeltPrototype)
        case 'turret':
            return draw_turret(e as TurretPrototype)
        case 'underground-belt':
            return draw_underground_belt(e as UndergroundBeltPrototype)
        case 'valve':
            return draw_valve(e as ValvePrototype)
        case 'wall':
            return draw_wall(e as WallPrototype)
        default:
            throw new Error(`Missing draw function for: '${e.type}'`)
    }
}

function draw_accumulator(e: AccumulatorPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.chargable_graphics.picture.layers
}
function draw_agricultural_tower(
    e: AgriculturalTowerPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_ammo_turret(e: AmmoTurretPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => [
        ...e.graphics_set.base_visualisation.animation.layers,
        duplicateAndSetPropertyUsing(e.folded_animation.layers[0], 'y', 'height', data.dir / 2),
        duplicateAndSetPropertyUsing(e.folded_animation.layers[1], 'y', 'height', data.dir / 2),
    ]
}
function draw_arithmetic_combinator(
    e: ArithmeticCombinatorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const operatorToSpriteData = (operator: string): Sprite4Way => {
            switch (operator) {
                case '+':
                    return e.plus_symbol_sprites
                case '-':
                    return e.minus_symbol_sprites
                case '*':
                    return e.multiply_symbol_sprites
                case '/':
                    return e.divide_symbol_sprites
                case '%':
                    return e.modulo_symbol_sprites
                case '^':
                    return e.power_symbol_sprites
                case '<<':
                    return e.left_shift_symbol_sprites
                case '>>':
                    return e.right_shift_symbol_sprites
                case 'AND':
                    return e.and_symbol_sprites
                case 'OR':
                    return e.or_symbol_sprites
                case 'XOR':
                    return e.xor_symbol_sprites
                default:
                    throw new Error('Internal Error!')
            }
        }
        return [
            ...e.sprites[util.getDirName(data.dir)].layers,
            operatorToSpriteData(data.operator)[util.getDirName(data.dir)],
        ]
    }
}
function draw_artillery_turret(
    e: ArtilleryTurretPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const d = data.dir
        let base = util.duplicate(e.cannon_base_pictures.layers[0])
        base = setProperty(base, 'filename', base.filenames[d])
        base = addToShift([0, -0.6875], base)
        let barrel = util.duplicate(e.cannon_barrel_pictures.layers[0])
        barrel = setProperty(barrel, 'filename', barrel.filenames[d])
        barrel = addToShift([0, -0.6875], barrel)
        barrel = addToShift(getShift(), barrel)
        function getShift(): number[] {
            switch (data.dir) {
                case 0:
                    return [0, 1]
                case 2:
                    return [-1, 0.31]
                case 4:
                    return [0, -0.4]
                case 6:
                    return [1, 0.31]
            }
        }
        return [...e.base_picture.layers, barrel, base]
    }
}
function draw_artillery_wagon(
    e: ArtilleryWagonPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_assembling_machine(
    e: AssemblingMachinePrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        if (
            (e.name === 'assembling-machine-2' || e.name === 'assembling-machine-3') &&
            data.assemblerCraftsWithFluid
        ) {
            const pipeDirection =
                data.assemblerPipeDirection === 'input' ? data.dir : (data.dir + 4) % 8
            const out = [
                e.graphics_set.animation.layers[0],
                addToShift(
                    getPipeConnectionPoints(e, data.dir, data.assemblerPipeDirection)[0],
                    util.duplicate(e.fluid_boxes[0].pipe_picture[util.getDirName(pipeDirection)])
                ),
            ]
            if (pipeDirection === 0) {
                return [out[1], out[0]]
            }
            return out
        }

        if (e.graphics_set.always_draw_idle_animation) {
            return e.graphics_set.idle_animation.layers
        } else {
            return getAnimation(e.graphics_set.animation, data.dir).layers
        }
    }
}
function draw_asteroid_collector(
    e: AsteroidCollectorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_beacon(e: BeaconPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const layers = e.graphics_set.animation_list
            .filter(vis => vis.always_draw)
            .map(vis => vis.animation)
            .flatMap(vis => (vis.layers ? vis.layers : [vis]))

        const modules = (data.modules || []).map(name => FD.items[name])
        const moduleLayers = e.graphics_set.module_visualisations
            .flatMap(vis => vis.slots)
            .flatMap((arr, i) => {
                const module = modules[i]
                if (module) {
                    return arr.map(slot => {
                        const img = util.duplicate(slot.pictures)

                        let variationIndex = module.tier - 1
                        if (slot.has_empty_slot) {
                            variationIndex += 1
                        }
                        setPropertyUsing(img, 'x', 'width', variationIndex)

                        if (slot.apply_module_tint) {
                            let tint = module.beacon_tint[slot.apply_module_tint]
                            if (Array.isArray(tint)) {
                                tint = { r: tint[0], g: tint[1], b: tint[2], a: 1 }
                            }
                            setProperty(img, 'tint', tint)
                        }
                        return img
                    })
                } else {
                    return arr.filter(slot => slot.has_empty_slot).map(slot => slot.pictures)
                }
            })

        return [...layers, ...moduleLayers]
    }
}
function draw_boiler(e: BoilerPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        let energy_source = getEnergySource(e)
        if (energy_source.type === 'heat') {
            let needsEnding = true
            if (data.positionGrid) {
                const conn = energy_source.connections[0]
                const pos = util.rotatePointBasedOnDir(conn.position, data.dir)
                const c = getHeatConnections(
                    {
                        x: Math.floor(data.position.x + pos.x),
                        y: Math.floor(data.position.y + pos.y),
                    },
                    data.positionGrid
                )
                needsEnding = !c[((data.dir + conn.direction) % 8) / 2]
            }
            if (needsEnding) {
                return [
                    addToShift(
                        util.rotatePointBasedOnDir([0, 1.5], data.dir),
                        util.duplicate(
                            energy_source.pipe_covers[util.getDirName((data.dir + 4) % 8)]
                        )
                    ),
                    ...e.pictures[util.getDirName(data.dir)].structure.layers,
                ]
            }
        }
        return e.pictures[util.getDirName(data.dir)].structure.layers
    }
}
function draw_burner_generator(
    e: BurnerGeneratorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_cargo_bay(e: CargoBayPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_cargo_landing_pad(
    e: CargoLandingPadPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_cargo_wagon(e: CargoWagonPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_constant_combinator(
    e: ConstantCombinatorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        return e.sprites[util.getDirName(data.dir)].layers
    }
}
function draw_construction_robot(
    e: ConstructionRobotPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_container(e: ContainerPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.picture.layers
}
function draw_curved_rail_a(e: CurvedRailAPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_curved_rail_b(e: CurvedRailBPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_decider_combinator(
    e: DeciderCombinatorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const operatorToSpriteData = (operator: string): Sprite4Way => {
            switch (operator) {
                case '<':
                    return e.less_symbol_sprites
                case '>':
                    return e.greater_symbol_sprites
                case '≤':
                    return e.less_or_equal_symbol_sprites
                case '≥':
                    return e.greater_or_equal_symbol_sprites
                case '=':
                    return e.equal_symbol_sprites
                case '≠':
                    return e.not_equal_symbol_sprites
                default:
                    throw new Error('Internal Error!')
            }
        }
        return [
            ...e.sprites[util.getDirName(data.dir)].layers,
            operatorToSpriteData(data.operator)[util.getDirName(data.dir)],
        ]
    }
}
function draw_display_panel(e: DisplayPanelPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_electric_energy_interface(
    e: ElectricEnergyInterfacePrototype
): (data: IDrawData) => readonly SpriteData[] {
    return () => e.picture.layers
}
function draw_electric_pole(e: ElectricPolePrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => [
        duplicateAndSetPropertyUsing(e.pictures.layers[0], 'x', 'width', data.dir / 2),
    ]
}
function draw_electric_turret(
    e: ElectricTurretPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => [
        ...e.graphics_set.base_visualisation.animation.layers,
        duplicateAndSetPropertyUsing(e.folded_animation.layers[0], 'y', 'height', data.dir / 2),
        duplicateAndSetPropertyUsing(e.folded_animation.layers[2], 'y', 'height', data.dir / 2),
    ]
}
function draw_elevated_curved_rail_a(
    e: ElevatedCurvedRailAPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_elevated_curved_rail_b(
    e: ElevatedCurvedRailBPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_elevated_half_diagonal_rail(
    e: ElevatedHalfDiagonalRailPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_elevated_straight_rail(
    e: ElevatedStraightRailPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_fluid_turret(e: FluidTurretPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) =>
        e.graphics_set.base_visualisation.animation[util.getDirName(data.dir)].layers
}
function draw_fluid_wagon(e: FluidWagonPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_furnace(e: FurnacePrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.graphics_set.animation.layers
}
function draw_fusion_generator(
    e: FusionGeneratorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_fusion_reactor(
    e: FusionReactorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_gate(e: GatePrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        function getBaseSprites(): readonly SpriteData[] {
            if (data.positionGrid) {
                const size = getEntitySize(e, data.dir)
                const rail = data.positionGrid.findInArea(
                    {
                        x: data.position.x,
                        y: data.position.y,
                        w: size.x,
                        h: size.y,
                    },
                    entity => entity.name === 'legacy-straight-rail'
                )
                if (rail) {
                    if (data.dir % 4 === 0) {
                        if (rail.position.y > data.position.y) {
                            return e.vertical_rail_animation_left.layers
                        }
                        return e.vertical_rail_animation_right.layers
                    } else {
                        if (rail.position.x > data.position.x) {
                            return e.horizontal_rail_animation_left.layers
                        }
                        return e.horizontal_rail_animation_right.layers
                    }
                }
            }

            if (data.dir % 4 === 0) {
                return e.vertical_animation.layers
            }
            return e.horizontal_animation.layers
        }

        if (data.dir % 4 === 0 && data.positionGrid) {
            const wall = data.positionGrid.getEntityAtPosition({
                x: data.position.x,
                y: data.position.y + 1,
            })
            if (wall && wall.type === 'wall') {
                return [...getBaseSprites(), ...e.wall_patch.layers]
            }
        }

        return getBaseSprites()
    }
}
function draw_generator(e: GeneratorPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) =>
        data.dir % 4 === 0 ? e.vertical_animation.layers : e.horizontal_animation.layers
}
function draw_half_diagonal_rail(
    e: HalfDiagonalRailPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_heat_interface(
    e: HeatInterfacePrototype
): (data: IDrawData) => readonly SpriteData[] {
    return () => [e.picture]
}
function draw_heat_pipe(e: HeatPipePrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        if (data.positionGrid) {
            const getOpt = (): SpriteVariations => {
                const conn = getHeatConnections(data.position, data.positionGrid)
                if (conn[0] && conn[1] && conn[2] && conn[3]) {
                    return e.connection_sprites.cross
                }
                if (conn[0] && conn[1] && conn[3]) {
                    return e.connection_sprites.t_up
                }
                if (conn[1] && conn[2] && conn[3]) {
                    return e.connection_sprites.t_down
                }
                if (conn[0] && conn[1] && conn[2]) {
                    return e.connection_sprites.t_right
                }
                if (conn[0] && conn[2] && conn[3]) {
                    return e.connection_sprites.t_left
                }
                if (conn[0] && conn[2]) {
                    return e.connection_sprites.straight_vertical
                }
                if (conn[1] && conn[3]) {
                    return e.connection_sprites.straight_horizontal
                }
                if (conn[0] && conn[1]) {
                    return e.connection_sprites.corner_right_up
                }
                if (conn[0] && conn[3]) {
                    return e.connection_sprites.corner_left_up
                }
                if (conn[1] && conn[2]) {
                    return e.connection_sprites.corner_right_down
                }
                if (conn[2] && conn[3]) {
                    return e.connection_sprites.corner_left_down
                }
                if (conn[0]) {
                    return e.connection_sprites.ending_up
                }
                if (conn[2]) {
                    return e.connection_sprites.ending_down
                }
                if (conn[1]) {
                    return e.connection_sprites.ending_right
                }
                if (conn[3]) {
                    return e.connection_sprites.ending_left
                }
                return e.connection_sprites.single
            }
            return [util.getRandomItem(getOpt())]
        }
        return [util.getRandomItem(e.connection_sprites.single)]
    }
}
function draw_infinity_cargo_wagon(
    e: InfinityCargoWagonPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_infinity_container(
    e: InfinityContainerPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return () => e.picture.layers
}
function draw_inserter(e: InserterPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        let ho = util.duplicate(e.hand_open_picture)
        let hb = util.duplicate(e.hand_base_picture)

        const handData = {
            anchorX: 0.5,
            anchorY: 1,
            rotAngle: 0,
            squishY: 1,
            x: 0,
            y: 0,
        }
        const armData = { ...handData }

        const armAngle = 45
        const armAngleLHI = 25

        if (e.name === 'long-handed-inserter') {
            switch (data.dir) {
                case 6:
                    handData.rotAngle = armAngleLHI - 180
                    handData.squishY = 1.5
                    handData.x = -0.275
                    handData.y = -0.7

                    armData.rotAngle = -armAngleLHI
                    armData.squishY = 1.25
                    armData.x = 0.03
                    armData.y = 0.03
                    break
                case 2:
                    handData.rotAngle = -armAngleLHI + 180
                    handData.squishY = 1.5
                    handData.x = 0.275
                    handData.y = -0.7

                    armData.rotAngle = armAngleLHI
                    armData.squishY = 1.25
                    armData.x = -0.03
                    armData.y = 0.03
                    break
                case 4:
                    handData.rotAngle = 180
                    handData.squishY = 1.25
                    handData.y = -0.3

                    armData.squishY = 2.5
                    armData.y = 0.03
                    break
                case 0:
                    handData.rotAngle = 180
                    handData.squishY = 3.5
                    handData.y = -0.95

                    armData.y = 0.05
            }
        } else {
            switch (data.dir) {
                case 6:
                    handData.rotAngle = -armAngle - 90
                    handData.squishY = 2.5
                    handData.x = -0.325
                    handData.y = -0.325

                    armData.rotAngle = -armAngle
                    armData.squishY = 1.9
                    armData.x = 0.03
                    armData.y = 0.03
                    break
                case 2:
                    handData.rotAngle = armAngle + 90
                    handData.squishY = 2.5
                    handData.x = 0.325
                    handData.y = -0.325

                    armData.rotAngle = armAngle
                    armData.squishY = 1.9
                    armData.x = -0.03
                    armData.y = 0.03
                    break
                case 4:
                    handData.rotAngle = 180
                    handData.squishY = 1.75
                    handData.y = 0.03

                    armData.rotAngle = 180
                    armData.squishY = 7
                    armData.y = -0.03
                    break
                case 0:
                    handData.squishY = 3
                    handData.y = -0.5

                    armData.squishY = 1.4
                    armData.y = 0.05
            }
        }

        ho = setProperty(ho, 'anchorX', handData.anchorX)
        ho = setProperty(ho, 'anchorY', handData.anchorY)
        ho = setProperty(ho, 'rotAngle', handData.rotAngle)
        ho = setProperty(ho, 'squishY', handData.squishY)
        ho = addToShift(handData, ho)

        hb = setProperty(hb, 'anchorX', armData.anchorX)
        hb = setProperty(hb, 'anchorY', armData.anchorY)
        hb = setProperty(hb, 'rotAngle', armData.rotAngle)
        hb = setProperty(hb, 'squishY', armData.squishY)
        hb = addToShift(armData, hb)

        return [
            duplicateAndSetPropertyUsing(
                e.platform_picture.sheet,
                'x',
                'width',
                ((data.dir + 4) % 8) / 2
            ),
            ho,
            hb,
        ]
    }
}
function draw_lab(e: LabPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.off_animation.layers
}
function draw_lamp(e: LampPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.picture_off.layers
}
function draw_land_mine(e: LandMinePrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => [e.picture_set]
}
function draw_lane_splitter(e: LaneSplitterPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_legacy_curved_rail(
    e: LegacyCurvedRailPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const dir = data.dir
        const ps = e.pictures[util.getDirName8Way(dir)]
        return [ps.stone_path_background, ps.stone_path, ps.ties, ps.backplates, ps.metals]
    }
}
function draw_legacy_straight_rail(
    e: LegacyStraightRailPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const dir = data.dir
        function getBaseSprites(): SpriteVariations[] {
            const ps = e.pictures[util.getDirName8Way(dir)]
            return [ps.stone_path_background, ps.stone_path, ps.ties, ps.backplates, ps.metals]
        }

        if (data.positionGrid && dir % 2 === 0) {
            const size = getEntitySize(e, dir)

            const railBases = data.positionGrid
                .getEntitiesInArea({
                    x: data.position.x,
                    y: data.position.y,
                    w: size.x,
                    h: size.y,
                })
                .filter(e => e.type === 'gate')
                .map(e => util.sumprod(e.position, -1, data.position))
                // Rotate relative to mid point
                .map(p => util.rotatePointBasedOnDir(p, dir).y)
                // Remove duplicates
                .sort()
                .filter((y, i, arr) => i === 0 || y !== arr[i - 1])
                // Reverse rotate relative to mid point
                .map(y => util.rotatePointBasedOnDir([0, y], (8 - dir) % 8))
                // Map positions to SpriteData
                .map(p =>
                    addToShift(
                        p,
                        util.duplicate(
                            dir % 4 === 0
                                ? FD.entities.gate.horizontal_rail_base
                                : FD.entities.gate.vertical_rail_base
                        )
                    )
                )

            return [...getBaseSprites(), ...railBases]
        }
        return getBaseSprites()
    }
}
function draw_lightning_attractor(
    e: LightningAttractorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_linked_belt(e: LinkedBeltPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_linked_container(
    e: LinkedContainerPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_loader(e: LoaderPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const isInput = data.dirType === 'input'
        const dir = isInput ? data.dir : (data.dir + 4) % 8

        const beltParts = getBeltSprites(
            e.belt_animation_set,
            data.position,
            data.dir,
            data.positionGrid,
            isInput,
            !isInput,
            true
        ).map(sprite => addToShift(util.rotatePointBasedOnDir([0, 0.5], dir), sprite))

        let mainBelt = beltParts[0]
        if (dir === 2 || dir === 6) {
            mainBelt = setPropertyUsing(mainBelt, 'width', 'width', 0.5)
        } else {
            mainBelt = setPropertyUsing(mainBelt, 'height', 'height', 0.5)
        }

        if (dir === 2) {
            mainBelt = setProperty(mainBelt, 'anchorX', 1)
        }
        if (dir === 6) {
            mainBelt = setProperty(mainBelt, 'anchorX', 0.5)
        }
        if (dir === 4) {
            mainBelt = setProperty(mainBelt, 'anchorY', 1)
        }
        if (dir === 0) {
            mainBelt = setProperty(mainBelt, 'anchorY', 0.5)
        }

        const structure = e.structure
        const sprites = []

        sprites.push(mainBelt)

        sprites.push(
            duplicateAndSetPropertyUsing(
                isInput ? structure.direction_in.sheet : structure.direction_out.sheet,
                'x',
                'width',
                dir / 2
            )
        )

        if (beltParts[1]) {
            sprites.push(beltParts[1])
        }

        return sprites
    }
}
function draw_locomotive(e: LocomotivePrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_logistic_container(
    e: LogisticContainerPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return () => e.animation.layers
}
function draw_logistic_robot(
    e: LogisticRobotPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_mining_drill(e: MiningDrillPrototype): (data: IDrawData) => readonly SpriteData[] {
    switch (e.name) {
        case 'burner-mining-drill':
            return (data: IDrawData) => e.graphics_set.animation[util.getDirName(data.dir)].layers

        case 'pumpjack':
            return (data: IDrawData) => [
                duplicateAndSetPropertyUsing(e.base_picture.sheets[0], 'x', 'width', data.dir / 2),
                ...e.graphics_set.animation.north.layers,
            ]

        case 'electric-mining-drill':
            return (data: IDrawData) => {
                const dir = util.getDirName(data.dir)
                const layers0 = e.graphics_set.animation[dir].layers

                const animDir = `${dir}_animation` as
                    | 'north-animation'
                    | 'east-animation'
                    | 'south-animation'
                    | 'west-animation'

                const layers1 = e.graphics_set.working_visualisations
                    .filter(vis => vis.always_draw)
                    .map(vis => vis[animDir])
                    .filter(vis => !!vis)
                    .flatMap(vis => (vis.layers ? vis.layers : [vis]))

                return [...layers0, ...layers1]
            }
    }
}
function draw_offshore_pump(e: OffshorePumpPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => e.graphics_set.animation[util.getDirName(data.dir)].layers
}
function draw_pipe(e: PipePrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const pictures = e.pictures
        if (data.positionGrid) {
            const conn = data.positionGrid
                .getNeighbourData(data.position)
                .map(({ entity, relDir }) => {
                    if (!entity) {
                        return false
                    }

                    if (entity.type === 'pipe' || entity.type === 'infinity-pipe') {
                        return true
                    }
                    if (entity.type === 'pipe-to-ground' && entity.direction === (relDir + 4) % 8) {
                        return true
                    }

                    if (
                        (entity.name === 'assembling-machine-2' ||
                            entity.name === 'assembling-machine-3') &&
                        !entity.assemblerCraftsWithFluid
                    ) {
                        return false
                    }
                    if (
                        entity.name === 'chemical-plant' &&
                        entity.chemicalPlantDontConnectOutput &&
                        entity.direction === relDir
                    ) {
                        return false
                    }

                    if (
                        entity.entityData.fluid_box ||
                        entity.entityData.output_fluid_box ||
                        entity.entityData.fluid_boxes
                    ) {
                        const connections = getPipeConnectionPoints(
                            entity.entityData,
                            entity.direction,
                            entity.assemblerPipeDirection
                        )
                        for (const connection of connections) {
                            if (
                                Math.floor(data.position.x) ===
                                    Math.floor(entity.position.x + connection.x) &&
                                Math.floor(data.position.y) ===
                                    Math.floor(entity.position.y + connection.y)
                            ) {
                                return true
                            }
                        }
                    }
                    return undefined
                })

            if (conn[0] && conn[1] && conn[2] && conn[3]) {
                return [pictures.cross]
            }
            if (conn[0] && conn[1] && conn[3]) {
                return [pictures.t_up]
            }
            if (conn[1] && conn[2] && conn[3]) {
                return [pictures.t_down]
            }
            if (conn[0] && conn[1] && conn[2]) {
                return [pictures.t_right]
            }
            if (conn[0] && conn[2] && conn[3]) {
                return [pictures.t_left]
            }
            if (conn[0] && conn[2]) {
                return Math.floor(data.position.y) % 2 === 0
                    ? [pictures.straight_vertical]
                    : [pictures.vertical_window_background, pictures.straight_vertical_window]
            }
            if (conn[1] && conn[3]) {
                return Math.floor(data.position.x) % 2 === 0
                    ? [pictures.straight_horizontal]
                    : [pictures.horizontal_window_background, pictures.straight_horizontal_window]
            }
            if (conn[0] && conn[1]) {
                return [pictures.corner_up_right]
            }
            if (conn[0] && conn[3]) {
                return [pictures.corner_up_left]
            }
            if (conn[1] && conn[2]) {
                return [pictures.corner_down_right]
            }
            if (conn[2] && conn[3]) {
                return [pictures.corner_down_left]
            }
            if (conn[0]) {
                return [pictures.ending_up]
            }
            if (conn[2]) {
                return [pictures.ending_down]
            }
            if (conn[1]) {
                return [pictures.ending_right]
            }
            if (conn[3]) {
                return [pictures.ending_left]
            }
        }
        return [pictures.straight_vertical_single]
    }
}
function draw_pipe_to_ground(e: PipeToGroundPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => [e.pictures[util.getDirName(data.dir)]]
}
function draw_power_switch(e: PowerSwitchPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => [...e.power_on_animation.layers, e.led_off]
}
function draw_programmable_speaker(
    e: ProgrammableSpeakerPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return () => e.sprite.layers
}
function draw_proxy_container(
    e: ProxyContainerPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_pump(e: PumpPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => [e.animations[util.getDirName(data.dir)]]
}
function draw_radar(e: RadarPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.pictures.layers
}
function draw_rail_ramp(e: RailRampPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_rail_signal_base(
    e: RailSignalBasePrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const dir = data.dir
        let rp = duplicateAndSetPropertyUsing(
            e.ground_picture_set.rail_piece.sprites,
            'x',
            'width',
            (dir * 2) % e.ground_picture_set.rail_piece.sprites.line_length
        )
        rp = setPropertyUsing(
            rp,
            'y',
            'height',
            Math.floor((dir * 2) / e.ground_picture_set.rail_piece.sprites.line_length)
        )
        let a = duplicateAndSetPropertyUsing(
            e.ground_picture_set.structure.layers[0],
            'y',
            'height',
            dir * 2
        )
        return [rp, a]
    }
}
function draw_rail_support(e: RailSupportPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_reactor(e: ReactorPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const conn = e.heat_buffer.connections
        const patches = []
        for (let i = 0; i < conn.length; i++) {
            let patchSheet = e.connection_patches_disconnected.sheet
            if (data.positionGrid) {
                const c = getHeatConnections(
                    {
                        x: Math.floor(data.position.x) + conn[i].position[0],
                        y: Math.floor(data.position.y) + conn[i].position[1],
                    },
                    data.positionGrid
                )
                if (c[conn[i].direction / 2]) {
                    patchSheet = e.connection_patches_connected.sheet
                }
            }
            patchSheet = duplicateAndSetPropertyUsing(patchSheet, 'x', 'width', i)
            patchSheet = addToShift(conn[i].position, patchSheet)
            patches.push(patchSheet)
        }
        return [...patches, e.lower_layer_picture, ...e.picture.layers]
    }
}
function draw_roboport(e: RoboportPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => [...e.base.layers, e.door_animation_up, e.door_animation_down, e.base_animation]
}
function draw_rocket_silo(e: RocketSiloPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => [
        e.door_back_sprite,
        e.door_front_sprite,
        e.base_day_sprite,
        e.arm_01_back_animation,
        e.arm_02_right_animation,
        e.arm_03_front_animation,
        e.satellite_animation,
    ]
}
function draw_selector_combinator(
    e: SelectorCombinatorPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_solar_panel(e: SolarPanelPrototype): (data: IDrawData) => readonly SpriteData[] {
    return () => e.picture.layers
}
function draw_space_platform_hub(
    e: SpacePlatformHubPrototype
): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_splitter(e: SplitterPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const b0Offset = util.rotatePointBasedOnDir([-0.5, 0], data.dir)
        const b1Offset = util.rotatePointBasedOnDir([0.5, 0], data.dir)

        const belt0Parts = getBeltSprites(
            e.belt_animation_set,
            data.positionGrid ? util.sumprod(data.position, b0Offset) : b0Offset,
            data.dir,
            data.positionGrid,
            true,
            true,
            true
        ).map(sd => addToShift(b0Offset, sd))

        const belt1Parts = getBeltSprites(
            e.belt_animation_set,
            data.positionGrid ? util.sumprod(data.position, b1Offset) : b1Offset,
            data.dir,
            data.positionGrid,
            true,
            true,
            true
        ).map(sd => addToShift(b1Offset, sd))

        const dir = util.getDirName(data.dir)
        return [...belt0Parts, ...belt1Parts, e.structure_patch[dir], e.structure[dir]]
    }
}
function draw_storage_tank(e: StorageTankPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => [
        addToShift([0, 1], util.duplicate(e.pictures.window_background)),
        setPropertyUsing(
            util.duplicate(e.pictures.picture.sheets[0]),
            'x',
            'width',
            Math.floor(data.dir / 2) % e.pictures.picture.sheets[0].frames
        ),
    ]
}
function draw_straight_rail(e: StraightRailPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_thruster(e: ThrusterPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_train_stop(e: TrainStopPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const dir = data.dir
        let ta = util.duplicate(e.top_animations[util.getDirName(dir)].layers[1])
        ta = setProperty(ta, 'tint', data.trainStopColor ? data.trainStopColor : e.color)
        return [
            e.rail_overlay_animations[util.getDirName(dir)],
            ...e.animations[util.getDirName(dir)].layers,
            ...e.top_animations[util.getDirName(dir)].layers,
            ta,
            e.light1.picture[util.getDirName(dir)],
            e.light2.picture[util.getDirName(dir)],
        ]
    }
}
function draw_transport_belt(
    e: TransportBeltPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        if (data.generateConnector && data.positionGrid) {
            const connIndex = getBeltWireConnectionIndex(data.positionGrid, data.position, data.dir)
            const patchIndex = (() => {
                switch (connIndex) {
                    case 1:
                        return 0
                    case 3:
                        return 1
                    case 4:
                        return 2
                    default:
                        return undefined
                }
            })()

            const sprites = []

            if (patchIndex !== undefined) {
                const patch = e.connector_frame_sprites.frame_back_patch.sheet
                sprites.push(duplicateAndSetPropertyUsing(patch, 'x', 'width', patchIndex))
            }

            sprites.push(
                ...getBeltSprites(e.belt_animation_set, data.position, data.dir, data.positionGrid)
            )

            let frame = e.connector_frame_sprites.frame_main.sheet
            frame = duplicateAndSetPropertyUsing(frame, 'x', 'width', 1)
            sprites.push(setPropertyUsing(frame, 'y', 'height', connIndex))

            return sprites
        }
        return [...getBeltSprites(e.belt_animation_set, data.position, data.dir, data.positionGrid)]
    }
}
function draw_turret(e: TurretPrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_underground_belt(
    e: UndergroundBeltPrototype
): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const isInput = data.dirType === 'input'
        const dir = isInput ? data.dir : (data.dir + 4) % 8

        const beltParts = getBeltSprites(
            e.belt_animation_set,
            data.position,
            data.dir,
            data.positionGrid,
            isInput,
            !isInput,
            true
        )

        let mainBelt = beltParts[0]
        if (dir === 2 || dir === 6) {
            mainBelt = setPropertyUsing(mainBelt, 'width', 'width', 0.5)
        } else {
            mainBelt = setPropertyUsing(mainBelt, 'height', 'height', 0.5)
        }

        if (dir === 2) {
            mainBelt = setProperty(mainBelt, 'anchorX', 1)
        }
        if (dir === 6) {
            mainBelt = setProperty(mainBelt, 'anchorX', 0.5)
        }
        if (dir === 4) {
            mainBelt = setProperty(mainBelt, 'anchorY', 1)
        }
        if (dir === 0) {
            mainBelt = setProperty(mainBelt, 'anchorY', 0.5)
        }

        let sideloadingBack = false
        let sideloadingFront = false

        if (data.positionGrid && (dir === 2 || dir === 6)) {
            let C = data.positionGrid.getNeighbourData(data.position).map(d => {
                if (
                    d.entity &&
                    (d.entity.type === 'transport-belt' ||
                        d.entity.type === 'splitter' ||
                        ((d.entity.type === 'underground-belt' || d.entity.type === 'loader') &&
                            d.entity.directionType === 'output'))
                ) {
                    return d
                }
                return undefined
            })

            // Belt facing this belt
            C = C.map(d => {
                if (d && d.entity.direction === (d.relDir + 4) % 8) {
                    return d
                }
                return undefined
            })

            sideloadingBack = C[0] !== undefined
            sideloadingFront = C[2] !== undefined
        }

        const structure = e.structure
        const sprites = []

        if (!sideloadingBack) {
            sprites.push(
                duplicateAndSetPropertyUsing(structure.back_patch.sheet, 'x', 'width', dir / 2)
            )
        }

        sprites.push(mainBelt)

        sprites.push(
            duplicateAndSetPropertyUsing(
                sideloadingFront
                    ? isInput
                        ? structure.direction_in_side_loading.sheet
                        : structure.direction_out_side_loading.sheet
                    : isInput
                      ? structure.direction_in.sheet
                      : structure.direction_out.sheet,
                'x',
                'width',
                dir / 2
            )
        )

        if (!sideloadingFront) {
            sprites.push(
                duplicateAndSetPropertyUsing(structure.front_patch.sheet, 'x', 'width', dir / 2)
            )
        }

        if (beltParts[1]) {
            sprites.push(beltParts[1])
        }

        return sprites
    }
}
function draw_valve(e: ValvePrototype): (data: IDrawData) => readonly SpriteData[] {
    throw new Error('Not implemented!')
}
function draw_wall(e: WallPrototype): (data: IDrawData) => readonly SpriteData[] {
    return (data: IDrawData) => {
        const pictures = e.pictures

        if (data.positionGrid) {
            const sprites = []

            const conn = data.positionGrid
                .getNeighbourData(data.position)
                .map(
                    ({ entity, relDir }) =>
                        entity &&
                        (entity.type === 'wall' ||
                            (entity.type === 'gate' && entity.direction % 4 === relDir % 4))
                )

            const wall = (() => {
                if (conn[1] && conn[2] && conn[3]) {
                    return pictures.t_up.layers[0]
                } else if (conn[1] && conn[2]) {
                    return pictures.corner_right_down.layers[0]
                } else if (conn[2] && conn[3]) {
                    return pictures.corner_left_down.layers[0]
                } else if (conn[1] && conn[3]) {
                    return pictures.straight_horizontal.layers[0]
                } else if (conn[1]) {
                    return pictures.ending_right.layers[0]
                } else if (conn[2]) {
                    return pictures.straight_vertical.layers[0]
                } else if (conn[3]) {
                    return pictures.ending_left.layers[0]
                } else {
                    return pictures.single.layers[0]
                }
            })()

            sprites.push(
                duplicateAndSetPropertyUsing(
                    wall,
                    'x',
                    'width',
                    util.getRandomInt(0, wall.line_length)
                )
            )

            const neighbourDirections = data.positionGrid
                .getNeighbourData(data.position)
                .filter(
                    ({ entity, relDir }) =>
                        entity && entity.type === 'gate' && entity.direction % 4 === relDir % 4
                )
                .map(({ relDir }) => relDir)

            for (const relDir of neighbourDirections) {
                const patch = duplicateAndSetPropertyUsing(
                    pictures.gate_connection_patch.sheets[0],
                    'x',
                    'width',
                    relDir / 2
                )
                if (relDir === 0) {
                    sprites.unshift(patch)
                } else {
                    sprites.push(patch)
                }
            }

            const spawnFilling = [
                [-1, 0],
                [-1, 1],
                [0, 1],
            ]
                .map(o => {
                    const ent = data.positionGrid.getEntityAtPosition(
                        util.sumprod(data.position, o)
                    )
                    return !!ent && ent.type === 'wall'
                })
                .every(e => e)

            if (spawnFilling) {
                let filling = duplicateAndSetPropertyUsing(
                    pictures.filling,
                    'x',
                    'width',
                    util.getRandomInt(0, pictures.filling.line_length)
                )
                filling = setProperty(filling, 'anchorX', 1.17)
                sprites.push(filling)
            }

            sprites.push(
                ...neighbourDirections.map(relDir =>
                    duplicateAndSetPropertyUsing(e.wall_diode_red.sheet, 'x', 'width', relDir / 2)
                )
            )

            return sprites
        }

        return pictures.single.layers
    }
}

export { getSpriteData, getBeltWireConnectionIndex }
