import FD from 'factorio-data'
import util from '../common/util'
import { Area } from './positionGrid'
import Blueprint from './blueprint'
import Entity from './entity'

interface IDrawData {
    hr: boolean
    dir: number

    name: string
    bp: Blueprint
    position: IPoint
    generateConnector: boolean

    assemblerPipeDirection: string
    dirType: string
    operator: string
    assemblerCraftsWithFluid: boolean
    trainStopColor: {
        r: number
        g: number
        b: number
        a: number
    }
    chemicalPlantDontConnectOutput: boolean
}

function getSpriteData(data: IDrawData): ISpriteData[] {
    return entityToFunction.get(data.name)(data)
}

const entityToFunction = new Map()

for (const e in FD.entities) {
    if (FD.entities.hasOwnProperty(e)) {
        const entity = FD.entities[e]

        const generator = (data: IDrawData) => {
            const spriteData = [
                ...generateGraphics(entity)(data),
                ...generateCovers(entity, data),
                ...generateConnection(entity, data)
            ]
            for (let i = 0; i < spriteData.length; i++) {
                spriteData[i] = data.hr && spriteData[i].hr_version ? spriteData[i].hr_version : spriteData[i]
                if (spriteData[i].apply_runtime_tint && !spriteData[i].tint) {
                    spriteData[i].tint = {
                        r: 0.73,
                        g: 0.59,
                        b: 0.44,
                        a: 0.75
                    }
                }
            }
            return spriteData
        }

        entityToFunction.set(entity.name, generator)
    }
}

function getPipeCovers(e: FD.Entity) {
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

function generateConnection(e: FD.Entity, data: IDrawData) {
    function hasWireConnectionFeature(e: FD.Entity) {
        if (e.type === 'transport_belt') {
            return false
        }
        if (
            e.connection_points ||
            e.input_connection_points ||
            e.circuit_wire_connection_point ||
            e.circuit_wire_connection_points
        ) {
            return true
        }
    }
    if (!hasWireConnectionFeature(e)) {
        return []
    }
    if (data.generateConnector) {
        if (e.circuit_connector_sprites) {
            const ccs =
                e.circuit_connector_sprites instanceof Array
                    ? e.circuit_connector_sprites[e.circuit_connector_sprites.length === 8 ? data.dir : data.dir / 2]
                    : e.circuit_connector_sprites
            return [ccs.connector_main, ccs.wire_pins, ccs.led_blue_off]
        }
    }
    return []
}
// UTIL FUNCTIONS
function addToShift(shift: IPoint | number[], tab: FD.SpriteData) {
    const SHIFT: number[] = shift instanceof Array ? shift : [(shift as IPoint).x, (shift as IPoint).y]

    tab.shift = tab.shift ? [SHIFT[0] + tab.shift[0], SHIFT[1] + tab.shift[1]] : SHIFT
    if (tab.hr_version) {
        tab.hr_version.shift = tab.hr_version.shift
            ? [SHIFT[0] + tab.hr_version.shift[0], SHIFT[1] + tab.hr_version.shift[1]]
            : SHIFT
    }
    return tab
}

function setProperty(img: FD.SpriteData, key: string, val: any) {
    img[key] = val
    if (img.hr_version) {
        img.hr_version[key] = val
    }
    return img
}

function setPropertyUsing(img: FD.SpriteData, key: string, key2: string, mult = 1) {
    if (key2) {
        img[key] = img[key2] * mult
        if (img.hr_version) {
            img.hr_version[key] = img.hr_version[key2] * mult
        }
    }
    return img
}

function duplicateAndSetPropertyUsing(img: FD.SpriteData, key: string, key2: string, mult: number) {
    return setPropertyUsing(util.duplicate(img), key, key2, mult)
}

function generateCovers(e: FD.Entity, data: IDrawData) {
    // entity doesn't have PipeCoverFeature
    if (!(e.fluid_box || e.fluid_boxes || e.output_fluid_box)) {
        return []
    }

    if (
        e.name === 'pipe' ||
        e.name === 'infinity_pipe' ||
        ((e.name === 'assembling_machine_2' || e.name === 'assembling_machine_3') && !data.assemblerCraftsWithFluid)
    ) {
        return []
    }
    const output = []
    const connections = getPipeConnectionPoints(e, data.dir, data.assemblerPipeDirection)
    if (connections) {
        for (const connection of connections) {
            const dir = util.getRelativeDirection(connection)

            const needsCover = () => {
                if (e.name === 'chemical_plant' && data.chemicalPlantDontConnectOutput && data.dir === (dir + 4) % 8) {
                    return true
                }

                const pos = {
                    x: Math.floor(data.position.x + connection.x),
                    y: Math.floor(data.position.y + connection.y)
                }

                const ent = data.bp.entities.get(data.bp.entityPositionGrid.getCellAtPosition(pos))
                if (!ent) {
                    return true
                }

                if (ent.name === 'chemical_plant' && ent.chemicalPlantDontConnectOutput && ent.direction === dir) {
                    return true
                }

                if (
                    ent.name === 'pipe' ||
                    ent.name === 'infinity_pipe' ||
                    ent.name === 'pipe_to_ground' ||
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

            if (!data.bp || needsCover()) {
                let temp = getPipeCovers(e)[util.intToDir(dir)].layers[0]
                temp = addToShift(connection, util.duplicate(temp))
                if (dir === 4) {
                    output.push(temp)
                } else {
                    output.unshift(temp)
                }
            }
        }
    }
    return output
}

function getPipeConnectionPoints(e: FD.Entity, dir: number, assemblerPipeDirection: string) {
    function getConn() {
        if (e.fluid_box && e.output_fluid_box) {
            return [...e.fluid_box.pipe_connections, ...e.output_fluid_box.pipe_connections]
        }
        if (e.fluid_box) {
            if (e.name === 'pipe_to_ground') {
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
        positions.push({ x: connections[0].positions[dir / 2][0], y: connections[0].positions[dir / 2][1] })
    } else if (e.name === 'assembling_machine_2' || e.name === 'assembling_machine_3') {
        positions.push(
            util.rotatePointBasedOnDir(connections[assemblerPipeDirection === 'input' ? 0 : 1].position, dir)
        )
    } else {
        for (const connection of connections) {
            positions.push(util.rotatePointBasedOnDir(connection.position, dir))
        }
    }
    return positions
}

function getHeatConectionPoints(e: FD.Entity) {
    // nuclear reactor
    if (e.heat_buffer) {
        return e.heat_buffer.connections
    }
    // heat exchanger
    if (e.energy_source) {
        return e.energy_source.connections
    }
}

function getHeatConnections(position: IPoint, bp: Blueprint) {
    return bp.entityPositionGrid.getNeighbourData(position).map(({ x, y, entity }) => {
        if (!entity) {
            return false
        }

        if (entity.name === 'heat_pipe' || entity.name === 'heat_interface') {
            return true
        }
        if (entity.name === 'heat_exchanger' || entity.name === 'nuclear_reactor') {
            return (
                getHeatConectionPoints(entity.entityData)
                    .map(conn => util.rotatePointBasedOnDir(conn.position, entity.direction))
                    .filter(
                        offset =>
                            x === Math.floor(entity.position.x + offset.x) &&
                            y === Math.floor(entity.position.y + offset.y)
                    ).length > 0
            )
        }
    })
}

function getBeltWireConnectionIndex(bp: Blueprint, position: IPoint, dir: number) {
    let C = bp.entityPositionGrid.getNeighbourData(position).map(d => {
        if (
            d.entity &&
            (d.entity.type === 'transport_belt' ||
                d.entity.type === 'splitter' ||
                ((d.entity.type === 'underground_belt' || d.entity.type === 'loader') &&
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
    bas: FD.BeltAnimationSet,
    position: IPoint,
    direction: number,
    blueprint?: Blueprint,
    stratingEnding = true,
    endingEnding = true,
    forceStraight = false
) {
    const parts = []

    if (blueprint) {
        const conn = getConnForPos(blueprint, position, direction, forceStraight)

        parts.push(getBeltSpriteFromData(bas, direction, conn.curve))

        if (stratingEnding) {
            let spawn = true

            if (conn.from) {
                const C = getConnForPos(blueprint, conn.from, conn.from.entity.direction)

                if (
                    (C.from && C.from.x === Math.floor(position.x) && C.from.y === Math.floor(position.y)) ||
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
                const C = getConnForPos(blueprint, conn.to, conn.to.entity.direction)
                if (
                    (C.from && C.from.x === Math.floor(position.x) && C.from.y === Math.floor(position.y)) ||
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

    interface IConnection {
        from: {
            x: number
            y: number
            entity: Entity
        }
        to: {
            x: number
            y: number
            entity: Entity
        }
        curve: 'straight' | 'rightCurve' | 'leftCurve'
    }

    function getConnForPos(blueprint: Blueprint, pos: IPoint, direction: number, forceStraight = false): IConnection {
        let C = blueprint.entityPositionGrid.getNeighbourData(pos).map(d => {
            if (
                d.entity &&
                (d.entity.type === 'transport_belt' ||
                    d.entity.type === 'splitter' ||
                    d.entity.type === 'underground_belt' ||
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
                ((d.entity.type === 'underground_belt' || d.entity.type === 'loader') &&
                    d.entity.directionType === 'input')
            ) {
                return
            }
            if (d.entity.direction === (d.relDir + 4) % 8) {
                return d
            }
        })

        const entAtPos = blueprint.entities.get(blueprint.entityPositionGrid.getCellAtPosition(pos))
        if (
            forceStraight ||
            entAtPos.type === 'splitter' ||
            entAtPos.type === 'underground_belt' ||
            entAtPos.type === 'loader'
        ) {
            return {
                from: C[2],
                to: C[0],
                curve: 'straight'
            }
        }

        if (C2[1] && !C2[3] && !C2[2]) {
            return {
                from: C[1],
                to: C[0],
                curve: 'rightCurve'
            }
        }
        if (C2[3] && !C2[1] && !C2[2]) {
            return {
                from: C[3],
                to: C[0],
                curve: 'leftCurve'
            }
        }
        return {
            from: C[2],
            to: C[0],
            curve: 'straight'
        }
    }

    function getBeltSpriteFromData(
        bas: FD.BeltAnimationSet,
        dir: number,
        type: 'straight' | 'rightCurve' | 'leftCurve' | 'stratingEnding' | 'endingEnding'
    ) {
        return duplicateAndSetPropertyUsing(bas.animation_set, 'y', 'height', getIndex() - 1)

        function getIndex() {
            switch (type) {
                case 'straight':
                    switch (dir) {
                        case 0:
                            return bas.north_index
                        case 2:
                            return bas.east_index
                        case 4:
                            return bas.south_index
                        case 6:
                            return bas.west_index
                    }
                    break
                case 'rightCurve':
                    switch (dir) {
                        case 0:
                            return bas.east_to_north_index
                        case 2:
                            return bas.south_to_east_index
                        case 4:
                            return bas.west_to_south_index
                        case 6:
                            return bas.north_to_west_index
                    }
                    break
                case 'leftCurve':
                    switch (dir) {
                        case 0:
                            return bas.west_to_north_index
                        case 2:
                            return bas.north_to_east_index
                        case 4:
                            return bas.east_to_south_index
                        case 6:
                            return bas.south_to_west_index
                    }
                    break
                case 'stratingEnding':
                    switch (dir) {
                        case 0:
                            return bas.starting_south_index
                        case 2:
                            return bas.starting_west_index
                        case 4:
                            return bas.starting_north_index
                        case 6:
                            return bas.starting_east_index
                    }
                    break
                case 'endingEnding':
                    switch (dir) {
                        case 0:
                            return bas.ending_north_index
                        case 2:
                            return bas.ending_east_index
                        case 4:
                            return bas.ending_south_index
                        case 6:
                            return bas.ending_west_index
                    }
            }
        }
    }
}

function generateGraphics(e: FD.Entity): (data: IDrawData) => FD.SpriteData[] {
    if (e.name.search('combinator') !== -1) {
        return (data: IDrawData) => {
            if (e.name === 'decider_combinator' || e.name === 'arithmetic_combinator') {
                const operatorToSpriteData = (operator: string) => {
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
                            return e.name === 'decider_combinator' ? e.less_symbol_sprites : e.multiply_symbol_sprites
                    }
                }
                return [
                    e.sprites[util.intToDir(data.dir)].layers[0],
                    operatorToSpriteData(data.operator)[util.intToDir(data.dir)]
                ]
            }
            return [e.sprites[util.intToDir(data.dir)].layers[0]]
        }
    }

    if (e.name.search('assembling_machine') !== -1) {
        return (data: IDrawData) => {
            if (
                (e.name === 'assembling_machine_2' || e.name === 'assembling_machine_3') &&
                data.assemblerCraftsWithFluid
            ) {
                const pipeDirection = data.assemblerPipeDirection === 'input' ? data.dir : (data.dir + 4) % 8
                const out = [
                    (e.animation as FD.SpriteLayers).layers[0],
                    addToShift(
                        getPipeConnectionPoints(e, data.dir, data.assemblerPipeDirection)[0],
                        util.duplicate(e.fluid_boxes[0].pipe_picture[util.intToDir(pipeDirection)])
                    )
                ]
                if (pipeDirection === 0) {
                    return [out[1], out[0]]
                }
                return out
            }
            return [(e.animation as FD.SpriteLayers).layers[0]]
        }
    }

    switch (e.name) {
        case 'accumulator':
        case 'electric_energy_interface':
            return () => [(e.picture as FD.SpriteLayers).layers[0]]
        case 'solar_panel':
            return () => [(e.picture as FD.SpriteLayers).layers[0]]
        case 'radar':
            return () => [(e.pictures as FD.SpriteLayers).layers[0]]
        case 'small_lamp':
            return () => [e.picture_off.layers[0]]
        case 'land_mine':
            return () => [e.picture_set]
        case 'programmable_speaker':
            return () => [e.sprite.layers[0]]
        case 'power_switch':
            return () => [e.power_on_animation]
        case 'beacon':
            return () => [e.base_picture as FD.SpriteData, e.animation as FD.SpriteData]
        case 'lab':
            return () => [e.off_animation.layers[0]]
        case 'infinity_chest':
        case 'heat_interface':
            return () => [e.picture as FD.SpriteData]

        case 'offshore_pump':
            return (data: IDrawData) => [(e.picture as FD.DirectionalSpriteData)[util.intToDir(data.dir)]]
        case 'pipe_to_ground':
            return (data: IDrawData) => [(e.pictures as FD.DirectionalSpriteData)[util.intToDir(data.dir)]]
        case 'burner_mining_drill':
            return (data: IDrawData) => [
                (e.animations as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0]
            ]

        case 'pumpjack':
            return (data: IDrawData) => [
                duplicateAndSetPropertyUsing((e.base_picture as FD.SpriteSheets).sheets[0], 'x', 'width', data.dir / 2),
                (e.animations as FD.DirectionalSpriteLayers).north.layers[0]
            ]
        case 'storage_tank':
            return (data: IDrawData) => [
                (e.pictures as FD.StorageTankPictures).window_background,
                setPropertyUsing(
                    util.duplicate((e.pictures as FD.StorageTankPictures).picture.sheets[0]),
                    'x',
                    data.dir === 2 ? 'width' : undefined
                )
            ]
        case 'centrifuge':
            return () => [e.idle_animation.layers[0], e.idle_animation.layers[2], e.idle_animation.layers[4]]
        case 'roboport':
            return () => [e.base.layers[0], e.door_animation_up, e.door_animation_down, e.base_animation]
        case 'rocket_silo':
            return () => [
                e.door_back_sprite,
                e.door_front_sprite,
                e.base_day_sprite,
                e.arm_01_back_animation,
                e.arm_02_right_animation,
                e.arm_03_front_animation,
                e.satellite_animation
            ]

        case 'electric_mining_drill':
        case 'pump':
            return (data: IDrawData) => [(e.animations as FD.DirectionalSpriteData)[util.intToDir(data.dir)]]
        case 'boiler':
            return (data: IDrawData) => [(e.structure as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0]]
        case 'heat_exchanger':
            return (data: IDrawData) => {
                let needsEnding = true
                if (data.bp) {
                    const conn = getHeatConectionPoints(e)[0]
                    const pos = util.rotatePointBasedOnDir(conn.position, data.dir)
                    const c = getHeatConnections(
                        {
                            x: Math.floor(data.position.x + pos.x),
                            y: Math.floor(data.position.y + pos.y)
                        },
                        data.bp
                    )
                    needsEnding = !c[((data.dir + conn.direction) % 8) / 2]
                }
                if (needsEnding) {
                    return [
                        addToShift(
                            util.rotatePointBasedOnDir([0, 1.5], data.dir),
                            util.duplicate(e.energy_source.pipe_covers[util.intToDir((data.dir + 4) % 8)])
                        ),
                        (e.structure as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0]
                    ]
                }
                return [(e.structure as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0]]
            }
        case 'oil_refinery':
        case 'chemical_plant':
            return (data: IDrawData) => [(e.animation as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0]]
        case 'steam_engine':
        case 'steam_turbine':
            return (data: IDrawData) => [
                data.dir === 0 ? e.vertical_animation.layers[0] : e.horizontal_animation.layers[0]
            ]
        case 'gun_turret':
            return (data: IDrawData) => [
                (e.base_picture as FD.SpriteLayers).layers[0],
                (e.base_picture as FD.SpriteLayers).layers[1],
                duplicateAndSetPropertyUsing(
                    (e.folded_animation as FD.SpriteLayers).layers[0],
                    'y',
                    'height',
                    data.dir / 2
                ),
                duplicateAndSetPropertyUsing(
                    (e.folded_animation as FD.SpriteLayers).layers[1],
                    'y',
                    'height',
                    data.dir / 2
                )
            ]
        case 'laser_turret':
            return (data: IDrawData) => [
                (e.base_picture as FD.SpriteLayers).layers[0],
                duplicateAndSetPropertyUsing(
                    (e.folded_animation as FD.SpriteLayers).layers[0],
                    'y',
                    'height',
                    data.dir / 2
                ),
                duplicateAndSetPropertyUsing(
                    (e.folded_animation as FD.SpriteLayers).layers[2],
                    'y',
                    'height',
                    data.dir / 2
                )
            ]

        case 'train_stop':
            return (data: IDrawData) => {
                const dir = data.dir
                let ta = util.duplicate(e.top_animations[util.intToDir(dir)].layers[1])
                ta = setProperty(ta, 'color', data.trainStopColor ? data.trainStopColor : e.color)
                return [
                    e.rail_overlay_animations[util.intToDir(dir)],
                    (e.animations as FD.DirectionalSpriteLayers)[util.intToDir(dir)].layers[0],
                    e.top_animations[util.intToDir(dir)].layers[0],
                    ta,
                    e.light1.picture[util.intToDir(dir)],
                    e.light2.picture[util.intToDir(dir)]
                ]
            }
        case 'flamethrower_turret':
            return (data: IDrawData) => [
                (e.base_picture as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0],
                (e.base_picture as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[1],
                (e.folded_animation as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[0],
                (e.folded_animation as FD.DirectionalSpriteLayers)[util.intToDir(data.dir)].layers[1]
            ]
        case 'artillery_turret':
            return (data: IDrawData) => {
                const d = data.dir * 2
                let base = util.duplicate(e.cannon_base_pictures.layers[0])
                base = setProperty(base, 'filename', data.hr ? base.hr_version.filenames[d] : base.filenames[d])
                let barrel = util.duplicate(e.cannon_barrel_pictures.layers[0])
                barrel = setProperty(barrel, 'filename', data.hr ? barrel.hr_version.filenames[d] : barrel.filenames[d])
                barrel = addToShift(getShift(), barrel)
                function getShift() {
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
                return [(e.base_picture as FD.SpriteLayers).layers[0], barrel, base]
            }
        case 'straight_rail':
        case 'curved_rail':
            return (data: IDrawData) => {
                const dir = data.dir
                function getBaseSprites() {
                    function getRailSpriteForDir() {
                        const pictures = e.pictures as FD.RailPictures
                        if (e.name === 'straight_rail') {
                            switch (dir) {
                                case 0:
                                    return pictures.straight_rail_vertical
                                case 1:
                                    return pictures.straight_rail_diagonal_right_top
                                case 2:
                                    return pictures.straight_rail_horizontal
                                case 3:
                                    return pictures.straight_rail_diagonal_right_bottom
                                case 4:
                                    return pictures.straight_rail_vertical
                                case 5:
                                    return pictures.straight_rail_diagonal_left_bottom
                                case 6:
                                    return pictures.straight_rail_horizontal
                                case 7:
                                    return pictures.straight_rail_diagonal_left_top
                            }
                        } else {
                            switch (dir) {
                                case 0:
                                    return pictures.curved_rail_vertical_left_bottom
                                case 1:
                                    return pictures.curved_rail_vertical_right_bottom
                                case 2:
                                    return pictures.curved_rail_horizontal_left_top
                                case 3:
                                    return pictures.curved_rail_horizontal_left_bottom
                                case 4:
                                    return pictures.curved_rail_vertical_right_top
                                case 5:
                                    return pictures.curved_rail_vertical_left_top
                                case 6:
                                    return pictures.curved_rail_horizontal_right_bottom
                                case 7:
                                    return pictures.curved_rail_horizontal_right_top
                            }
                        }
                    }
                    const ps = getRailSpriteForDir()
                    return [ps.stone_path_background, ps.stone_path, ps.ties, ps.backplates, ps.metals]
                }

                if (data.bp && e.name === 'straight_rail' && (dir === 0 || dir === 2)) {
                    const size = util.switchSizeBasedOnDirection(e.size, dir)
                    const gates = data.bp.entityPositionGrid.foreachOverlap(
                        new Area({
                            x: data.position.x,
                            y: data.position.y,
                            width: size.x,
                            height: size.y
                        }),
                        (entnr: number) => {
                            const ent = data.bp.entities.get(entnr)
                            if (ent && ent.name === 'gate') {
                                return true
                            }
                        },
                        true
                    )
                    if (gates) {
                        const railBases: FD.SpriteData[] = []
                        const assignShiftAndPushPicture = (shift: number[], picture: FD.SpriteData) => {
                            railBases.push(addToShift(shift, util.duplicate(picture)))
                        }
                        if (dir === 0) {
                            if (gates[0] || gates[2]) {
                                assignShiftAndPushPicture([0, -0.5], FD.entities.gate.horizontal_rail_base)
                            }
                            if (gates[1] || gates[3]) {
                                assignShiftAndPushPicture([0, 0.5], FD.entities.gate.horizontal_rail_base)
                            }
                        }
                        if (dir === 2) {
                            if (gates[0] || gates[1]) {
                                assignShiftAndPushPicture([-0.5, 0], FD.entities.gate.vertical_rail_base)
                            }
                            if (gates[2] || gates[3]) {
                                assignShiftAndPushPicture([0.5, 0], FD.entities.gate.vertical_rail_base)
                            }
                        }
                        return [...getBaseSprites(), ...railBases]
                    }
                }
                return getBaseSprites()
            }
        case 'rail_signal':
        case 'rail_chain_signal':
            return (data: IDrawData) => {
                const dir = data.dir
                let rp = duplicateAndSetPropertyUsing(e.rail_piece, 'x', 'width', dir)
                let a = duplicateAndSetPropertyUsing(e.animation as FD.SpriteData, 'y', 'height', dir)
                if (e.name === 'rail_chain_signal') {
                    const getRightShift = () => {
                        switch (dir) {
                            case 0:
                                return [1, 0]
                            case 1:
                                return [1, 1]
                            case 2:
                                return [0, 1]
                            case 3:
                                return [-1, 1]
                            case 4:
                                return [-2, 0]
                            case 5:
                                return [-1, -1]
                            case 6:
                                return [0, -2]
                            case 7:
                                return [1, -1]
                        }
                    }
                    const s = getRightShift()
                    rp = addToShift(s, rp)
                    a = addToShift(s, a)
                }
                return [rp, a]
            }
        case 'nuclear_reactor':
            return (data: IDrawData) => {
                const conn = e.heat_buffer.connections
                const patches = []
                for (let i = 0; i < conn.length; i++) {
                    let patchSheet = e.connection_patches_disconnected.sheet
                    if (data.bp) {
                        const c = getHeatConnections(
                            {
                                x: Math.floor(data.position.x) + conn[i].position[0],
                                y: Math.floor(data.position.y) + conn[i].position[1]
                            },
                            data.bp
                        )
                        if (c[conn[i].direction / 2]) {
                            patchSheet = e.connection_patches_connected.sheet
                        }
                    }
                    patchSheet = duplicateAndSetPropertyUsing(patchSheet, 'x', 'width', i)
                    patchSheet = addToShift(conn[i].position, patchSheet)
                    patches.push(patchSheet)
                }
                return [...patches, e.lower_layer_picture, (e.picture as FD.SpriteLayers).layers[0]]
            }
        case 'stone_wall':
            return (data: IDrawData) => {
                const pictures = e.pictures as FD.WallPictures

                if (data.bp) {
                    const sprites = []

                    const conn = data.bp.entityPositionGrid
                        .getNeighbourData(data.position)
                        .map(
                            ({ entity, relDir }) =>
                                entity &&
                                (entity.name === 'stone_wall' ||
                                    (entity.name === 'gate' && entity.direction === relDir % 4))
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
                        duplicateAndSetPropertyUsing(wall, 'x', 'width', util.getRandomInt(0, wall.line_length))
                    )

                    const neighbourDirections = data.bp.entityPositionGrid
                        .getNeighbourData(data.position)
                        .filter(
                            ({ entity, relDir }) => entity && entity.name === 'gate' && entity.direction === relDir % 4
                        )
                        .map(({ relDir }) => relDir)

                    neighbourDirections.forEach(relDir => {
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
                    })

                    const spawnFilling = [[-1, 0], [-1, 1], [0, 1]]
                        .map(o => {
                            const ent = data.bp.entities.get(
                                data.bp.entityPositionGrid.getCellAtPosition([
                                    data.position.x + o[0],
                                    data.position.y + o[1]
                                ])
                            )
                            return !!ent && ent.name === 'stone_wall'
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

                return [pictures.single.layers[0]]
            }
        case 'gate':
            return (data: IDrawData) => {
                function getBaseSprites() {
                    if (data.bp) {
                        const size = util.switchSizeBasedOnDirection(e.size, data.dir)
                        const rail = data.bp.entityPositionGrid.getFirstFromArea(
                            new Area({
                                x: data.position.x,
                                y: data.position.y,
                                width: size.x,
                                height: size.y
                            }),
                            (entnr: number) => {
                                const ent = data.bp.entities.get(entnr)
                                if (ent.name === 'straight_rail') {
                                    return ent
                                }
                            }
                        )
                        if (rail) {
                            if (data.dir === 0) {
                                if (rail.position.y > data.position.y) {
                                    return [e.vertical_rail_animation_left.layers[0]]
                                }
                                return [e.vertical_rail_animation_right.layers[0]]
                            } else {
                                if (rail.position.x > data.position.x) {
                                    return [e.horizontal_rail_animation_left.layers[0]]
                                }
                                return [e.horizontal_rail_animation_right.layers[0]]
                            }
                        }
                    }

                    if (data.dir === 0) {
                        return [e.vertical_animation.layers[0]]
                    }
                    return [e.horizontal_animation.layers[0]]
                }

                if (data.dir === 0 && data.bp) {
                    const wall = data.bp.entities.get(
                        data.bp.entityPositionGrid.getCellAtPosition([data.position.x, data.position.y + 1])
                    )
                    if (wall && wall.name === 'stone_wall') {
                        return [...getBaseSprites(), e.wall_patch.layers[0]]
                    }
                }

                return getBaseSprites()
            }
        case 'pipe':
        case 'infinity_pipe':
            return (data: IDrawData) => {
                const pictures = e.pictures as FD.PipePictures
                if (data.bp) {
                    const conn = data.bp.entityPositionGrid
                        .getNeighbourData(data.position)
                        .map(({ entity, relDir }) => {
                            if (!entity) {
                                return false
                            }

                            if (entity.name === 'pipe' || entity.name === 'infinity_pipe') {
                                return true
                            }
                            if (entity.name === 'pipe_to_ground' && entity.direction === (relDir + 4) % 8) {
                                return true
                            }

                            if (
                                (entity.name === 'assembling_machine_2' || entity.name === 'assembling_machine_3') &&
                                !entity.assemblerCraftsWithFluid
                            ) {
                                return false
                            }
                            if (
                                entity.name === 'chemical_plant' &&
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
                                        Math.floor(data.position.x) === Math.floor(entity.position.x + connection.x) &&
                                        Math.floor(data.position.y) === Math.floor(entity.position.y + connection.y)
                                    ) {
                                        return true
                                    }
                                }
                            }
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
        case 'heat_pipe':
            return (data: IDrawData) => {
                if (data.bp) {
                    const conn = getHeatConnections(data.position, data.bp)
                    if (conn[0] && conn[1] && conn[2] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.cross)]
                    }
                    if (conn[0] && conn[1] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.t_up)]
                    }
                    if (conn[1] && conn[2] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.t_down)]
                    }
                    if (conn[0] && conn[1] && conn[2]) {
                        return [util.getRandomItem(e.connection_sprites.t_right)]
                    }
                    if (conn[0] && conn[2] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.t_left)]
                    }
                    if (conn[0] && conn[2]) {
                        return [util.getRandomItem(e.connection_sprites.straight_vertical)]
                    }
                    if (conn[1] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.straight_horizontal)]
                    }
                    if (conn[0] && conn[1]) {
                        return [util.getRandomItem(e.connection_sprites.corner_right_up)]
                    }
                    if (conn[0] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.corner_left_up)]
                    }
                    if (conn[1] && conn[2]) {
                        return [util.getRandomItem(e.connection_sprites.corner_right_down)]
                    }
                    if (conn[2] && conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.corner_left_down)]
                    }
                    if (conn[0]) {
                        return [util.getRandomItem(e.connection_sprites.ending_up)]
                    }
                    if (conn[2]) {
                        return [util.getRandomItem(e.connection_sprites.ending_down)]
                    }
                    if (conn[1]) {
                        return [util.getRandomItem(e.connection_sprites.ending_right)]
                    }
                    if (conn[3]) {
                        return [util.getRandomItem(e.connection_sprites.ending_left)]
                    }
                }
                return [util.getRandomItem(e.connection_sprites.single)]
            }
    }

    switch (e.type) {
        case 'furnace':
        case 'logistic_container':
            return () => [(e.animation as FD.SpriteLayers).layers[0]]
        case 'container':
            return () => [(e.picture as FD.SpriteLayers).layers[0]]

        case 'electric_pole':
            return (data: IDrawData) => [
                duplicateAndSetPropertyUsing((e.pictures as FD.SpriteLayers).layers[0], 'x', 'width', data.dir / 2)
            ]

        case 'splitter':
            return (data: IDrawData) => {
                const b0Offset = util.rotatePointBasedOnDir([-0.5, 0], data.dir)
                const b1Offset = util.rotatePointBasedOnDir([0.5, 0], data.dir)

                const belt0Parts = getBeltSprites(
                    e.belt_animation_set,
                    data.bp
                        ? {
                              x: data.position.x + b0Offset.x,
                              y: data.position.y + b0Offset.y
                          }
                        : b0Offset,
                    data.dir,
                    data.bp,
                    true,
                    true,
                    true
                ).map(sd => addToShift(b0Offset, sd))

                const belt1Parts = getBeltSprites(
                    e.belt_animation_set,
                    data.bp
                        ? {
                              x: data.position.x + b1Offset.x,
                              y: data.position.y + b1Offset.y
                          }
                        : b1Offset,
                    data.dir,
                    data.bp,
                    true,
                    true,
                    true
                ).map(sd => addToShift(b1Offset, sd))

                return [
                    ...belt0Parts,
                    ...belt1Parts,
                    (e.structure as FD.DirectionalSpriteData)[util.intToDir(data.dir)]
                ]
            }
        case 'underground_belt':
            return (data: IDrawData) => {
                const isInput = data.dirType === 'input'
                const dir = isInput ? data.dir : (data.dir + 4) % 8

                const beltParts = getBeltSprites(
                    e.belt_animation_set,
                    data.position,
                    data.dir,
                    data.bp,
                    isInput,
                    !isInput,
                    true
                )

                let mainBelt = beltParts[0]
                mainBelt = setProperty(mainBelt, dir === 2 || dir === 6 ? 'divW' : 'divH', 2)

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

                if (data.bp && (dir === 2 || dir === 6)) {
                    let C = data.bp.entityPositionGrid.getNeighbourData(data.position).map(d => {
                        if (
                            d.entity &&
                            (d.entity.type === 'transport_belt' ||
                                d.entity.type === 'splitter' ||
                                ((d.entity.type === 'underground_belt' || d.entity.type === 'loader') &&
                                    d.entity.directionType === 'output'))
                        ) {
                            return d
                        }
                    })

                    // Belt facing this belt
                    C = C.map(d => {
                        if (d && d.entity.direction === (d.relDir + 4) % 8) {
                            return d
                        }
                    })

                    sideloadingBack = C[0] !== undefined
                    sideloadingFront = C[2] !== undefined
                }

                const structure = e.structure as FD.UndergroundBeltStructure
                const sprites = []

                if (!sideloadingBack) {
                    sprites.push(duplicateAndSetPropertyUsing(structure.back_patch.sheet, 'x', 'width', dir / 2))
                }

                sprites.push(mainBelt)

                /* eslint-disable no-nested-ternary */
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
                /* eslint-enable no-nested-ternary */

                if (!sideloadingFront) {
                    sprites.push(duplicateAndSetPropertyUsing(structure.front_patch.sheet, 'x', 'width', dir / 2))
                }

                if (beltParts[1]) {
                    sprites.push(beltParts[1])
                }

                return sprites
            }
        case 'transport_belt':
            return (data: IDrawData) => {
                if (data.generateConnector && data.bp) {
                    const connIndex = getBeltWireConnectionIndex(data.bp, data.position, data.dir)
                    const patchIndex = (() => {
                        switch (connIndex) {
                            case 1:
                                return 0
                            case 3:
                                return 1
                            case 4:
                                return 2
                        }
                    })()

                    const sprites = []

                    if (patchIndex !== undefined) {
                        let patch = e.connector_frame_sprites.frame_back_patch.sheet
                        sprites.push(duplicateAndSetPropertyUsing(patch, 'x', 'width', patchIndex))
                    }

                    sprites.push(...getBeltSprites(e.belt_animation_set, data.position, data.dir, data.bp))

                    let frame = e.connector_frame_sprites.frame_main.sheet
                    frame = duplicateAndSetPropertyUsing(frame, 'x', 'width', 1)
                    sprites.push(setPropertyUsing(frame, 'y', 'height', connIndex))

                    return sprites
                }
                return [...getBeltSprites(e.belt_animation_set, data.position, data.dir, data.bp)]
            }
        case 'inserter':
            return (data: IDrawData) => {
                let ho = util.duplicate(e.hand_open_picture)
                let hb = util.duplicate(e.hand_base_picture)

                const handData = {
                    anchorX: 0.5,
                    anchorY: 1,
                    rotAngle: 0,
                    squishY: 1,
                    x: 0,
                    y: 0
                }
                const armData = { ...handData }

                const armAngle = 45
                const armAngleLHI = 25

                if (e.name === 'long_handed_inserter') {
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
                    duplicateAndSetPropertyUsing(e.platform_picture.sheet, 'x', 'width', ((data.dir + 4) % 8) / 2),
                    ho,
                    hb
                ]
            }
        case 'loader': {
            return (data: IDrawData) => {
                const isInput = data.dirType === 'input'
                const dir = isInput ? data.dir : (data.dir + 4) % 8

                const beltParts = getBeltSprites(
                    e.belt_animation_set,
                    data.position,
                    data.dir,
                    data.bp,
                    isInput,
                    !isInput,
                    true
                ).map(sprite => addToShift(util.rotatePointBasedOnDir([0, 0.5], dir), sprite))

                let mainBelt = beltParts[0]
                mainBelt = setProperty(mainBelt, dir === 2 || dir === 6 ? 'divW' : 'divH', 2)

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

                const structure = e.structure as FD.UndergroundBeltStructure
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
    }
}

export default {
    getSpriteData,
    getBeltWireConnectionIndex
}
