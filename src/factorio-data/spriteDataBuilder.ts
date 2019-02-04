import FD from 'factorio-data'
import { Area } from './positionGrid'
import util from '../common/util'
import Blueprint from './blueprint'

export default {
    getSpriteData,
    getBeltConnections2
}

interface IDrawData {
    hr: boolean
    dir: number

    name: string
    bp: Blueprint
    position: IPoint
    hasConnections: boolean

    assemblerPipeDirection: string
    dirType: string
    operator: string
    assemblerCraftsWithFluid: boolean
    trainStopColor: {
        r: number;
        g: number;
        b: number;
        a: number;
    }
    chemicalPlantDontConnectOutput: boolean
}

function getSpriteData(data: IDrawData): ISpriteData[] {
    return entityToFunction.get(data.name)(data)
}

const entityToFunction = new Map()

for (const e in FD.entities) {
    const entity: FD.Entity = FD.entities[e]
    let func = generateGraphics(entity)
    if (hasPipeCoverFeature(entity)) {
        func = appendToFunc(entity, func)
    }
    if (hasWireConnectionFeature(entity)) {
        func = appendToFunc2(entity, func)
    }
    func = appendToFunc3(func)
    entityToFunction.set(entity.name, func)
}

function hasPipeCoverFeature(e: any) {
    if (e.fluid_box ||
        e.fluid_boxes ||
        e.output_fluid_box) return true
}

function hasWireConnectionFeature(e: any) {
    if (e.type === 'transport_belt') return false
    if (e.connection_points ||
        e.input_connection_points ||
        e.circuit_wire_connection_point ||
        e.circuit_wire_connection_points) return true
}

function appendToFunc(e: any, func: (data: any) => any) {
    return (data: any) => {
        const ret = func(data)
        generateCovers(e, data, ret)
        return ret
    }
}

function appendToFunc2(e: any, func: (data: any) => any) {
    return (data: any) => {
        const ret = func(data)
        generateConnection(e, data, ret)
        return ret
    }
}

function appendToFunc3(func: (data: any) => any) {
    return (data: any) => {
        const ret = func(data)
        for (let i = 0; i < ret.length; i++) {
            ret[i] = data.hr && ret[i].hr_version ? ret[i].hr_version : ret[i]
            if (ret[i].apply_runtime_tint && !ret[i].color) {
                ret[i].color = {
                    r: 0.73,
                    g: 0.59,
                    b: 0.44,
                    a: 0.75
                }
            }
        }
        return ret
    }
}

function getPipeCovers(e: any) {
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

function generateConnection(e: any, data: any, out: any[]) {
    if (data.hasConnections) {
        if (e.circuit_connector_sprites) {
            const temp = e.circuit_connector_sprites instanceof Array ?
                e.circuit_connector_sprites[
                    e.circuit_connector_sprites.length === 8 ? data.dir : data.dir / 2
                ] : e.circuit_connector_sprites
            out.push(temp.connector_main)
            out.push(temp.wire_pins)
            out.push(temp.led_blue_off)
        }
    }
}

function generateCovers(e: any, data: IDrawData, out: any[]) {
    if (e.name === 'pipe' ||
        ((e.name === 'assembling_machine_2' || e.name === 'assembling_machine_3') &&
        !data.assemblerCraftsWithFluid)
    ) return

    const connections = getPipeConnectionPoints(e, data.dir, data.assemblerPipeDirection)
    if (connections) {
        for (const connection of connections) {

            const dir = Math.abs(connection.x) > Math.abs(connection.y) ?
                (Math.sign(connection.x) === 1 ? 2 : 6) :
                (Math.sign(connection.y) === 1 ? 4 : 0)

            function needsCover() {
                if (e.name === 'chemical_plant' && data.chemicalPlantDontConnectOutput &&
                    data.dir === (dir + 4) % 8) return true

                const pos = {
                    x: Math.floor(data.position.x + connection.x),
                    y: Math.floor(data.position.y + connection.y)
                }

                const ent = data.bp.entities.get(data.bp.entityPositionGrid.getCellAtPosition(pos))
                if (!ent) return true

                if (ent.name === 'chemical_plant' && ent.chemicalPlantDontConnectOutput &&
                    ent.direction === dir) return true

                if (ent.name === 'pipe' ||
                    ent.name === 'pipe_to_ground' ||
                    ent.entityData.fluid_box ||
                    ent.entityData.output_fluid_box ||
                    ent.entityData.fluid_boxes) {

                    const connections2 = getPipeConnectionPoints(
                        ent.entityData, ent.direction, ent.assemblerPipeDirection
                    )
                    for (const connection2 of connections2) {
                        const p2 = { ...pos }
                        switch (dir) {
                            case 0: p2.y += 1; break
                            case 2: p2.x -= 1; break
                            case 4: p2.y -= 1; break
                            case 6: p2.x += 1
                        }
                        if (p2.x === Math.floor(ent.position.x + connection2.x) &&
                            p2.y === Math.floor(ent.position.y + connection2.y)) return false
                    }
                }
                return true
            }

            if (!data.bp || needsCover()) {
                let temp = getPipeCovers(e)[util.intToDir(dir)].layers[0]
                temp = util.add_to_shift(connection, util.duplicate(temp))
                if (dir === 4) {
                    out.push(temp)
                } else {
                    out.unshift(temp)
                }
            }
        }
    }
}

function getPipeConnectionPoints(e: any, dir: number, assemblerPipeDirection: string) {
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
    if (!connections) return undefined
    const positions = []
    // tslint:disable-next-line:prefer-switch
    if (e.name === 'pumpjack') {
        positions.push({ x: connections[0].positions[dir / 2][0], y: connections[0].positions[dir / 2][1] })
    } else if (e.name === 'assembling_machine_2' || e.name === 'assembling_machine_3') {
        positions.push(util.rotatePointBasedOnDir(
            connections[assemblerPipeDirection === 'input' ? 0 : 1].position, dir
        ))
    } else {
        for (const connection of connections) {
            positions.push(util.rotatePointBasedOnDir(connection.position, dir))
        }
    }
    return positions
}

function getHeatConectionPoints(e: FD.Entity) {
    // nuclear reactor
    if (e.heat_buffer) return e.heat_buffer.connections
    // heat exchanger
    if (e.energy_source) return e.energy_source.connections
}

function getHeatConnections(position: IPoint, bp: Blueprint) {
    return bp.entityPositionGrid.getNeighbourData(position)
        .map(({ x, y, entity }) => {
            if (!entity) return false

            if (entity.name === 'heat_pipe') return true
            if (entity.name === 'heat_exchanger' || entity.name === 'nuclear_reactor') {
                return getHeatConectionPoints(entity.entityData)
                    .map(conn => util.rotatePointBasedOnDir(conn.position, entity.direction))
                    .filter(offset =>
                        x === Math.floor(entity.position.x + offset.x) &&
                        y === Math.floor(entity.position.y + offset.y))
                    .length > 0
            }
        })
}

function getBeltConnections2(bp: Blueprint, position: IPoint, dir: number) {
    let directions = bp.entityPositionGrid.getNeighbourData(position)
        .map(({ entity }) => {
            if (!entity) return false

            if (
                entity.type === 'transport_belt' ||
                entity.type === 'splitter' ||
                (entity.type === 'underground_belt' && entity.directionType === 'output')
            ) return entity.direction
        })
    // Rotate directions
    directions = [...directions, ...directions].splice(dir / 2, 4)

    const foundR = directions[1] !== false && (directions[1] + 2) % 8 === dir
    const foundL = directions[3] === (dir + 2) % 8

    if ((dir === directions[2] && (foundR || foundL)) || (foundR && foundL)) {
        return 0
    }
    if (!foundR && !foundL) {
        if (dir === 0 || dir === 4) return 2
        return 1
    }
    switch (dir) {
        case 0: if (foundR) return 5; else return 6
        case 2: if (foundR) return 3; else return 5
        case 4: if (foundR) return 4; else return 3
        case 6: if (foundR) return 6; else return 4
    }
}

function generateGraphics(e: any) {

    if (e.name.search('combinator') !== -1) {
        return (data: IDrawData) => {
            function getBaseSprite() { return e.sprites[util.intToDir(data.dir)].layers[0] }

            if (e.name === 'decider_combinator' || e.name === 'arithmetic_combinator') {
                function mapSymbolToSpriteName() {
                    if (!data.operator) return e.name === 'decider_combinator' ? 'less' : 'multiply'
                    switch (data.operator) {
                        case '<': return 'less'
                        case '>': return 'greater'
                        case '≤': return 'less_or_equal'
                        case '≥': return 'greater_or_equal'
                        case '=': return 'equal'
                        case '≠': return 'not_equal'

                        case '+': return 'plus'
                        case '-': return 'minus'
                        case '*': return 'multiply'
                        case '/': return 'divide'
                        case '%': return 'modulo'
                        case '^': return 'power'
                        case '<<': return 'left_shift'
                        case '>>': return 'right_shift'
                        case 'AND': return 'and'
                        case 'OR': return 'or'
                        case 'XOR': return 'xor'
                    }
                }
                return [getBaseSprite(), e[mapSymbolToSpriteName() + '_symbol_sprites'][util.intToDir(data.dir)]]
            }
            return [getBaseSprite()]
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
                    e.animation.layers[0],
                    util.add_to_shift(
                        getPipeConnectionPoints(e, data.dir, data.assemblerPipeDirection)[0],
                        util.duplicate(e.fluid_boxes[0].pipe_picture[util.intToDir(pipeDirection)])
                    )
                ]
                if (pipeDirection === 0) return [out[1], out[0]]
                return out
            }
            return [e.animation.layers[0]]
        }
    }

    switch (e.name) {
        case 'accumulator': return () => [e.picture]
        case 'solar_panel': return () => [e.picture.layers[0]]
        case 'radar': return () => [e.pictures.layers[0]]
        case 'small_lamp': return () => [e.picture_off.layers[0]]
        case 'land_mine': return () => [e.picture_set]
        case 'programmable_speaker': return () => [e.sprite.layers[0]]
        case 'power_switch': return () => [e.power_on_animation]
        case 'beacon': return () => [e.base_picture, e.animation]
        case 'lab': return () => [e.off_animation.layers[0]]

        case 'offshore_pump': return (data: IDrawData) => [e.picture[util.intToDir(data.dir)]]
        case 'pipe_to_ground': return (data: IDrawData) => [e.pictures[util.intToDir(data.dir)]]
        case 'burner_mining_drill': return (data: IDrawData) => [e.animations[util.intToDir(data.dir)].layers[0]]

        case 'pumpjack': return (data: IDrawData) => [
            util.duplicateAndSetPropertyUsing(e.base_picture.sheets[0], 'x', 'width', data.dir / 2),
            e.animations.north.layers[0]
        ]
        case 'storage_tank': return (data: IDrawData) => [
            e.pictures.window_background,
            util.set_property_using(util.duplicate(e.pictures.picture.sheets[0]), 'x', data.dir === 2 ? 'width' : undefined)
        ]
        case 'centrifuge': return () => [
            e.idle_animation.layers[0],
            e.idle_animation.layers[2],
            e.idle_animation.layers[4]
        ]
        case 'roboport': return () => [e.base.layers[0], e.door_animation_up, e.door_animation_down, e.base_animation]
        case 'rocket_silo': return () => [
            e.door_back_sprite,
            e.door_front_sprite,
            e.base_day_sprite,
            e.arm_01_back_animation,
            e.arm_02_right_animation,
            e.arm_03_front_animation,
            e.satellite_animation
        ]

        case 'electric_mining_drill':
        case 'pump': return (data: IDrawData) => [e.animations[util.intToDir(data.dir)]]
        case 'boiler': return (data: IDrawData) => [e.structure[util.intToDir(data.dir)].layers[0]]
        case 'heat_exchanger': return (data: IDrawData) => {
            let needsEnding = true
            if (data.bp) {
                const conn = getHeatConectionPoints(e)[0]
                const pos = util.rotatePointBasedOnDir(conn.position, data.dir)
                const c = getHeatConnections({
                    x: Math.floor(data.position.x + pos.x),
                    y: Math.floor(data.position.y + pos.y)
                }, data.bp)
                needsEnding = !c[(data.dir + conn.direction) % 8 / 2]
            }
            if (needsEnding) {
                return [
                    util.add_to_shift(util.rotatePointBasedOnDir([0, 1.5], data.dir),
                        util.duplicate(e.energy_source.pipe_covers[util.intToDir((data.dir + 4) % 8)])
                    ),
                    e.structure[util.intToDir(data.dir)].layers[0]
                ]
            }
            return [e.structure[util.intToDir(data.dir)].layers[0]]
        }
        case 'oil_refinery':
        case 'chemical_plant': return (data: IDrawData) => [e.animation[util.intToDir(data.dir)].layers[0]]
        case 'steam_engine':
        case 'steam_turbine': return (data: IDrawData) => [
            data.dir === 0 ? e.vertical_animation.layers[0] : e.horizontal_animation.layers[0]
        ]
        case 'gun_turret':
        case 'laser_turret': return (data: IDrawData) => [
            ...e.base_picture.layers,
            util.duplicateAndSetPropertyUsing(e.folded_animation.layers[0], 'y', 'height', data.dir / 2),
            util.duplicateAndSetPropertyUsing(e.folded_animation.layers[e.name === 'laser_turret' ? 2 : 1], 'y', 'height', data.dir / 2)
        ]

        case 'train_stop': return (data: IDrawData) => {
            const dir = data.dir
            let ta = util.duplicate(e.top_animations[util.intToDir(dir)].layers[1])
            ta = util.set_property(ta, 'color', data.trainStopColor ? data.trainStopColor : e.color)
            return [
                e.rail_overlay_animations[util.intToDir(dir)],
                e.animations[util.intToDir(dir)].layers[0],
                e.top_animations[util.intToDir(dir)].layers[0],
                ta,
                e.light1.picture[util.intToDir(dir)],
                e.light2.picture[util.intToDir(dir)]
            ]
        }
        case 'flamethrower_turret': return (data: IDrawData) => {
            const dir = data.dir
            const pipe = FD.entities['pipe']
            const pipePictures = pipe.pictures as FD.PipePictures
            const pipePicture = dir === 0 || dir === 4 ? pipePictures.straight_horizontal : pipePictures.straight_vertical
            const p1 = util.add_to_shift(util.rotatePointBasedOnDir([0.5, 1], dir), util.duplicate(pipePicture))
            const p2 = util.add_to_shift(util.rotatePointBasedOnDir([-0.5, 1], dir), util.duplicate(pipePicture))
            return [
                p1,
                p2,
                e.base_picture[util.intToDir(dir)].layers[0],
                e.base_picture[util.intToDir(dir)].layers[1],
                e.folded_animation[util.intToDir(dir)].layers[0],
                e.folded_animation[util.intToDir(dir)].layers[1]
            ]
        }
        case 'artillery_turret': return (data: IDrawData) => {
            const d = data.dir * 2
            e.cannon_base_pictures.layers[0].filename = e.cannon_base_pictures.layers[0].filenames[d]
            e.cannon_base_pictures.layers[0].hr_version.filename = e.cannon_base_pictures.layers[0].hr_version.filenames[d]
            e.cannon_barrel_pictures.layers[0].filename = e.cannon_barrel_pictures.layers[0].filenames[d]
            e.cannon_barrel_pictures.layers[0].hr_version.filename = e.cannon_barrel_pictures.layers[0].hr_version.filenames[d]
            function getShift() {
                switch (data.dir) {
                    case 0: return [0, 1]
                    case 2: return [-1, 0.31]
                    case 4: return [0, -0.4]
                    case 6: return [1, 0.31]
                }
            }
            return [
                e.base_picture.layers[0],
                util.add_to_shift(getShift(), util.duplicate(e.cannon_barrel_pictures.layers[0])),
                e.cannon_base_pictures.layers[0]
            ]
        }
        case 'straight_rail':
        case 'curved_rail': return (data: IDrawData) => {
            const dir = data.dir
            function getBaseSprites() {
                function getRailSpriteForDir() {
                    const p = e.pictures
                    if (e.name === 'straight_rail') {
                        switch (dir) {
                            case 0: return p.straight_rail_vertical
                            case 1: return p.straight_rail_diagonal_right_top
                            case 2: return p.straight_rail_horizontal
                            case 3: return p.straight_rail_diagonal_right_bottom
                            case 4: return p.straight_rail_vertical
                            case 5: return p.straight_rail_diagonal_left_bottom
                            case 6: return p.straight_rail_horizontal
                            case 7: return p.straight_rail_diagonal_left_top
                        }
                    } else {
                        switch (dir) {
                            case 0: return p.curved_rail_vertical_left_bottom
                            case 1: return p.curved_rail_vertical_right_bottom
                            case 2: return p.curved_rail_horizontal_left_top
                            case 3: return p.curved_rail_horizontal_left_bottom
                            case 4: return p.curved_rail_vertical_right_top
                            case 5: return p.curved_rail_vertical_left_top
                            case 6: return p.curved_rail_horizontal_right_bottom
                            case 7: return p.curved_rail_horizontal_right_top
                        }
                    }
                }
                const ps = getRailSpriteForDir()
                return [
                    ps.stone_path_background,
                    ps.stone_path,
                    ps.ties,
                    ps.backplates,
                    ps.metals
                ]
            }

            if (data.bp && e.name === 'straight_rail' && (dir === 0 || dir === 2)) {
                const size = util.switchSizeBasedOnDirection(e.size, dir)
                const gates = data.bp.entityPositionGrid.foreachOverlap(new Area({
                    x: data.position.x,
                    y: data.position.y,
                    width: size.x,
                    height: size.y
                }), (entnr: number) => {
                    const ent = data.bp.entities.get(entnr)
                    if (ent && ent.name === 'gate') return true
                }, true)
                if (gates) {
                    const railBases: any[] = []
                    function assignShiftAndPushPicture(shift: number[], picture: string) {
                        railBases.push(util.add_to_shift(shift, util.duplicate(FD.entities['gate'][picture])))
                    }
                    if (dir === 0) {
                        if (gates[0] || gates[2]) {
                            assignShiftAndPushPicture([0, -0.5], 'horizontal_rail_base')
                            assignShiftAndPushPicture([0, -0.5], 'horizontal_rail_base_mask')
                        }
                        if (gates[1] || gates[3]) {
                            assignShiftAndPushPicture([0, 0.5], 'horizontal_rail_base')
                            assignShiftAndPushPicture([0, 0.5], 'horizontal_rail_base_mask')
                        }
                    }
                    if (dir === 2) {
                        if (gates[0] || gates[1]) {
                            assignShiftAndPushPicture([-0.5, 0], 'vertical_rail_base')
                            assignShiftAndPushPicture([-0.5, 0], 'vertical_rail_base_mask')
                        }
                        if (gates[2] || gates[3]) {
                            assignShiftAndPushPicture([0.5, 0], 'vertical_rail_base')
                            assignShiftAndPushPicture([0.5, 0], 'vertical_rail_base_mask')
                        }
                    }
                    return [...getBaseSprites(), ...railBases]
                }
            }
            return getBaseSprites()
        }
        case 'rail_signal':
        case 'rail_chain_signal':  return (data: IDrawData) => {
            const dir = data.dir
            let rp = util.duplicateAndSetPropertyUsing(e.rail_piece, 'x', 'width', dir)
            let a = util.duplicateAndSetPropertyUsing(e.animation, 'y', 'height', dir)
            if (e.name === 'rail_chain_signal') {
                function getRightShift() {
                    switch (dir) {
                        case 0: return [1, 0]
                        case 1: return [1, 1]
                        case 2: return [0, 1]
                        case 3: return [-1, 1]
                        case 4: return [-2, 0]
                        case 5: return [-1, -1]
                        case 6: return [0, -2]
                        case 7: return [1, -1]
                    }
                }
                const s = getRightShift()
                rp = util.add_to_shift(s, rp)
                a = util.add_to_shift(s, a)
            }
            return [rp, a]
        }
        case 'nuclear_reactor': return (data: IDrawData) => {
            const conn = e.heat_buffer.connections
            const patches = []
            for (let i = 0; i < conn.length; i++) {
                let patchSheet = e.connection_patches_disconnected.sheet
                if (data.bp) {
                    const c = getHeatConnections({
                        x: Math.floor(data.position.x) + conn[i].position[0],
                        y: Math.floor(data.position.y) + conn[i].position[1]
                    }, data.bp)
                    if (c[conn[i].direction / 2]) {
                        patchSheet = e.connection_patches_connected.sheet
                    }
                }
                patchSheet = util.duplicateAndSetPropertyUsing(patchSheet, 'x', 'width', i)
                patchSheet = util.add_to_shift(conn[i].position, patchSheet)
                patches.push(patchSheet)
            }
            return [...patches, e.lower_layer_picture, e.picture.layers[0]]
        }
        case 'stone_wall': return (data: IDrawData) => {
            function getBaseSprite() {
                function getRandomPic(type: string) {
                    if (e.pictures[type] instanceof Array) {
                        return e.pictures[type][util.getRandomInt(0, e.pictures[type].length - 1)].layers[0]
                    }
                    return e.pictures[type].layers[0]
                }
                if (data.bp) {
                    const conn = data.bp.entityPositionGrid.getNeighbourData(data.position)
                        .map(({ entity, relDir }) =>
                            entity && (entity.name === 'stone_wall' || (entity.name === 'gate' && entity.direction === relDir % 4)))

                    if (conn[1] && conn[2] && conn[3]) return getRandomPic('t_up')
                    if (conn[1] && conn[2]) return getRandomPic('corner_right_down')
                    if (conn[2] && conn[3]) return getRandomPic('corner_left_down')
                    if (conn[1] && conn[3]) return getRandomPic('straight_horizontal')
                    if (conn[1]) return getRandomPic('ending_right')
                    if (conn[2]) return getRandomPic('straight_vertical')
                    if (conn[3]) return getRandomPic('ending_left')
                }
                return getRandomPic('single')
            }

            if (data.bp) {
                const found = data.bp.entityPositionGrid.getNeighbourData(data.position)
                    .find(({ entity, relDir }) =>
                        entity && entity.name === 'gate' && entity.direction === relDir % 4)

                if (found && !data.hasConnections) return [getBaseSprite(), e.wall_diode_red]
            }
            return [getBaseSprite()]
        }
        case 'gate': return (data: IDrawData) => {
            const dir = data.dir
            function getBaseSprites() {
                if (data.bp) {
                    const size = util.switchSizeBasedOnDirection(e.size, dir)
                    const rail = data.bp.entityPositionGrid.getFirstFromArea(new Area({
                        x: data.position.x,
                        y: data.position.y,
                        width: size.x,
                        height: size.y
                    }), (entnr: number) => {
                        const ent = data.bp.entities.get(entnr)
                        if (ent.name === 'straight_rail') return ent
                    })
                    if (rail) {
                        if (dir === 0) {
                            if (rail.position.y > data.position.y) return [e.vertical_rail_animation_left.layers[0]]
                            return [e.vertical_rail_animation_right.layers[0]]
                        } else {
                            if (rail.position.x > data.position.x) return [e.horizontal_rail_animation_left.layers[0]]
                            return [e.horizontal_rail_animation_right.layers[0]]
                        }
                    }
                }

                if (dir === 0) return [...e.vertical_base.layers, e.vertical_animation.layers[0]]
                return [...e.horizontal_base.layers, e.horizontal_animation.layers[0]]
            }
            if (data.bp) {
                const out = getBaseSprites()
                const conn = data.bp.entityPositionGrid.getNeighbourData(data.position)
                    .map(({ entity, relDir }) =>
                        entity && entity.name === 'stone_wall' && dir === relDir % 4)

                for (let i = 0; i < conn.length; i++) {
                    if (conn[i]) {
                        const wp = FD.entities['gate'].wall_patch[util.intToDir((i * 2 + 4) % 8)].layers[0]
                        if (i === 0) {
                            out.unshift(wp)
                        } else {
                            out.push(wp)
                        }
                    }
                }
                return out
            }
            return getBaseSprites()
        }
        case 'pipe': return (data: IDrawData) => {
            if (data.bp) {
                const conn = data.bp.entityPositionGrid.getNeighbourData(data.position)
                    .map(({ entity, relDir }) => {
                        if (!entity) return false

                        if (entity.name === 'pipe') return true
                        if (entity.name === 'pipe_to_ground' && entity.direction === (relDir + 4) % 8) return true

                        if ((entity.name === 'assembling_machine_2' || entity.name === 'assembling_machine_3') &&
                            !entity.assemblerCraftsWithFluid) return false
                        if (entity.name === 'chemical_plant' && entity.chemicalPlantDontConnectOutput &&
                            entity.direction === relDir) return false

                        if (entity.entityData.fluid_box || entity.entityData.output_fluid_box || entity.entityData.fluid_boxes) {
                            const connections = getPipeConnectionPoints(entity.entityData, entity.direction, entity.assemblerPipeDirection)
                            for (const connection of connections) {
                                if (Math.floor(data.position.x) === Math.floor(entity.position.x + connection.x) &&
                                    Math.floor(data.position.y) === Math.floor(entity.position.y + connection.y)) {
                                        return true
                                    }
                            }
                        }
                    })

                if (conn[0] && conn[1] && conn[2] && conn[3]) return [e.pictures.cross]
                if (conn[0] && conn[1] && conn[3]) return [e.pictures.t_up]
                if (conn[1] && conn[2] && conn[3]) return [e.pictures.t_down]
                if (conn[0] && conn[1] && conn[2]) return [e.pictures.t_right]
                if (conn[0] && conn[2] && conn[3]) return [e.pictures.t_left]
                if (conn[0] && conn[2]) {
                    return Math.floor(data.position.y) % 2 === 0 ? [e.pictures.straight_vertical] :
                        [e.pictures.vertical_window_background, e.pictures.straight_vertical_window]
                }
                if (conn[1] && conn[3]) {
                    return Math.floor(data.position.x) % 2 === 0 ? [e.pictures.straight_horizontal] :
                        [e.pictures.horizontal_window_background, e.pictures.straight_horizontal_window]
                }
                if (conn[0] && conn[1]) return [e.pictures.corner_up_right]
                if (conn[0] && conn[3]) return [e.pictures.corner_up_left]
                if (conn[1] && conn[2]) return [e.pictures.corner_down_right]
                if (conn[2] && conn[3]) return [e.pictures.corner_down_left]
                if (conn[0]) return [e.pictures.ending_up]
                if (conn[2]) return [e.pictures.ending_down]
                if (conn[1]) return [e.pictures.ending_right]
                if (conn[3]) return [e.pictures.ending_left]
            }
            return [e.pictures.straight_vertical_single]
        }
        case 'heat_pipe': return (data: IDrawData) => {
            function getRandomPic(type: string) {
                if (e.connection_sprites[type].length === 1) return [e.connection_sprites[type][0]]
                return [e.connection_sprites[type][util.getRandomInt(0, e.connection_sprites[type].length - 1)]]
            }
            if (data.bp) {
                const conn = getHeatConnections(data.position, data.bp)
                if (conn[0] && conn[1] && conn[2] && conn[3]) return getRandomPic('cross')
                if (conn[0] && conn[1] && conn[3]) return getRandomPic('t_up')
                if (conn[1] && conn[2] && conn[3]) return getRandomPic('t_down')
                if (conn[0] && conn[1] && conn[2]) return getRandomPic('t_right')
                if (conn[0] && conn[2] && conn[3]) return getRandomPic('t_left')
                if (conn[0] && conn[2]) return getRandomPic('straight_vertical')
                if (conn[1] && conn[3]) return getRandomPic('straight_horizontal')
                if (conn[0] && conn[1]) return getRandomPic('corner_right_up')
                if (conn[0] && conn[3]) return getRandomPic('corner_left_up')
                if (conn[1] && conn[2]) return getRandomPic('corner_right_down')
                if (conn[2] && conn[3]) return getRandomPic('corner_left_down')
                if (conn[0]) return getRandomPic('ending_up')
                if (conn[2]) return getRandomPic('ending_down')
                if (conn[1]) return getRandomPic('ending_right')
                if (conn[3]) return getRandomPic('ending_left')
            }
            return getRandomPic('single')
        }
    }

    switch (e.type) {
        case 'furnace': return () => [e.animation.layers[0]]
        case 'container':
        case 'logistic_container': return () => [e.picture]

        case 'electric_pole': return (data: IDrawData) =>
            [util.duplicateAndSetPropertyUsing(e.pictures, 'x', 'width', data.dir / 2)]

        case 'splitter': return (data: IDrawData) => {
            const dir = data.dir
            const nP = e.name.split('_')
            const beltType = nP.length === 1 ? '' : nP[0] + '_'

            let belt = FD.entities[beltType + 'transport_belt']
            belt = dir === 0 || dir === 4 ? belt.belt_vertical : belt.belt_horizontal

            belt = util.duplicate(belt)
            if (dir === 4) belt = util.set_property(belt, 'flipY', true)
            if (dir === 6) belt = util.set_property(belt, 'flipX', true)

            let belt2 = util.duplicate(belt)
            belt = util.add_to_shift(util.rotatePointBasedOnDir([-0.5, 0], dir), belt)
            belt2 = util.add_to_shift(util.rotatePointBasedOnDir([0.5, 0], dir), belt2)

            return [belt, belt2, e.structure[util.intToDir(dir)]]
        }
        case 'underground_belt': return (data: IDrawData) => {
            const dir = data.dir
            let belt = dir === 0 || dir === 4 ? e.belt_vertical : e.belt_horizontal

            belt = util.duplicate(belt)
            if (dir === 6) belt = util.set_property(belt, 'flipX', true)
            if (dir === 4) belt = util.set_property(belt, 'flipY', true)
            belt = util.set_property(belt, dir === 2 || dir === 6 ? 'divW' : 'divH', 2)

            const dirType = data.dirType === 'output' ? -1 : 1
            belt = util.add_to_shift([
                (dir === 2 ? -1 : (dir === 6 ? 1 : 0)) * dirType * (dirType === 1 ? 0.35 : 0.2),
                // * ((data.hr ? belt.hr_version.width : belt.width) / 8 * dirType) / 32,
                (dir === 4 ? -1 : (dir === 0 ? 1 : 0)) * dirType * (dirType === 1 ? 0.2 : 0.35)
                // * ((data.hr ? belt.hr_version.height : belt.height) / 8 * dirType) / 32
            ], belt)
            return [
                belt,
                util.duplicateAndSetPropertyUsing(
                    dirType === 1 ? e.structure.direction_in.sheet : e.structure.direction_out.sheet,
                    'x',
                    'width',
                    (dirType === 1 ? dir : ((dir + 4) % 8)) / 2
                )
            ]
        }
        case 'transport_belt': return (data: IDrawData) => {
            const dir = data.dir
            function getBeltConnections() {
                let directions = data.bp.entityPositionGrid.getNeighbourData(data.position)
                    .map(({ entity }) => {
                        if (!entity) return false

                        if (
                            entity.type === 'transport_belt' ||
                            entity.type === 'splitter' ||
                            (entity.type === 'underground_belt' && entity.directionType === 'output')
                        ) return entity.direction
                    })
                // Rotate directions
                directions = [...directions, ...directions].splice(dir / 2, 4)

                const rightEntDir = directions[1]
                const leftEntDir = directions[3]

                if (dir === directions[2]) return false
                let found = false
                if (rightEntDir !== false && (rightEntDir + 2) % 8 === dir) {
                    found = true
                }
                if (leftEntDir === (dir + 2) % 8) {
                    if (found) {
                        return false
                    } else {
                        return leftEntDir
                    }
                }
                if (found) {
                    return rightEntDir
                }
                return false
            }

            let belt = dir === 0 || dir === 4 ? e.belt_vertical : e.belt_horizontal

            if (data.bp) {
                belt = util.duplicate(belt)
                const res = getBeltConnections()
                if (res !== false) {
                    const temp = res === 0 || res === 4
                    belt = util.set_property(belt, 'rot', (res + (temp ? 0 : 2)) / 2)
                    belt = util.set_property_using(belt, 'y', 'height',
                        (temp ? 11 : 8) * (data.hr && e.name !== 'transport_belt' ? 2 : 1))
                    if (res === (dir + 2) % 8) {
                        belt = util.set_property(belt, temp ? 'flipX' : 'flipY', true)
                    }
                } else {
                    if (dir === 6) {
                        belt = util.set_property(belt, 'flipX', true)
                    }
                    if (dir === 4) {
                        belt = util.set_property(belt, 'flipY', true)
                    }
                }
            } else {
                if (dir === 6) {
                    belt = util.set_property(util.duplicate(belt), 'flipX', true)
                }
                if (dir === 4) {
                    belt = util.set_property(util.duplicate(belt), 'flipY', true)
                }
            }

            if (data.hasConnections) {
                let frame = e.connector_frame_sprites.frame_main.sheet
                frame = util.duplicate(frame)
                frame = util.set_property_using(frame, 'x', 'width')
                frame = util.set_property_using(frame, 'y', 'height',
                    data.bp ? getBeltConnections2(data.bp, data.position, dir) : (dir === 0 || dir === 4 ? 2 : 1)
                )
                return [belt, frame]
            }
            return [belt]
        }
        case 'inserter': return (data: IDrawData) => {
            const dir = data.dir
            let ho = util.duplicate(e.hand_open_picture)
            let hb = util.duplicate(e.hand_base_picture)
            const hoMod = {
                rot: 0,
                height_divider: 1,
                x: 0,
                y: 0
            }
            const hbMod = { ...hoMod }
            const am = 0.5
            if (e.name === 'long_handed_inserter') {
                switch (dir) {
                    case 0:
                        hoMod.rot = 2
                        hoMod.height_divider = 3
                        hoMod.y = -am * 1.5

                        hbMod.y = -am
                        break
                    case 2:
                        hoMod.rot = 1.7
                        hoMod.height_divider = 1.5
                        hoMod.x = am
                        hoMod.y = -am / 1.25

                        hbMod.rot = 0.3
                        hbMod.x = am / 3
                        hbMod.y = -am / 1.5
                        break
                    case 4:
                        hoMod.rot = 2
                        hoMod.height_divider = 1.25
                        hoMod.y = am / 1.75

                        hbMod.rot = 0
                        hbMod.height_divider = 1.75
                        hbMod.y = -am / 1.75
                        break
                    case 6:
                        hoMod.rot = 2.3
                        hoMod.height_divider = 1.5
                        hoMod.x = -am
                        hoMod.y = -am / 1.25

                        hbMod.rot = 3.7
                        hbMod.x = -am / 3
                        hbMod.y = -am / 1.5
                }
            } else {
                switch (dir) {
                    case 6:
                        hoMod.rot = 2.5
                        hoMod.height_divider = 2
                        hoMod.x = -am
                        hoMod.y = -am * 0.5

                        hbMod.rot = 3.5
                        hbMod.height_divider = 1.5
                        hbMod.x = -am / 3
                        hbMod.y = -am / 2
                        break
                    case 2:
                        hoMod.rot = 1.5
                        hoMod.height_divider = 2
                        hoMod.x = am
                        hoMod.y = -am * 0.5

                        hbMod.rot = 0.5
                        hbMod.height_divider = 1.5
                        hbMod.x = am / 3
                        hbMod.y = -am / 2
                        break
                    case 4:
                        hoMod.rot = 2
                        hoMod.height_divider = 1.75
                        hoMod.y = am / 1.5

                        hbMod.rot = 2
                        hbMod.height_divider = 5
                        break
                    case 0:
                        hoMod.height_divider = 3
                        hoMod.y = -am * 1.5

                        hbMod.height_divider = 1.25
                        hbMod.y = -am / 1.5
                }
            }
            ho = util.set_property(ho, 'rot', hoMod.rot)
            ho = util.set_property(ho, 'height_divider', hoMod.height_divider)
            ho = util.add_to_shift(hoMod, ho)

            hb = util.set_property(hb, 'rot', hbMod.rot)
            hb = util.set_property(hb, 'height_divider', hbMod.height_divider)
            hb = util.add_to_shift(hbMod, hb)
            return [
                util.duplicateAndSetPropertyUsing(e.platform_picture.sheet, 'x', 'width', ((dir + 4) % 8) / 2),
                ho,
                hb
            ]
        }
    }
}
