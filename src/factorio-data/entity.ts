import { Blueprint } from './blueprint'
import Immutable from 'immutable'
import factorioData from './factorioData'
import util from '../common/util'
import { Area } from './positionGrid'
import U from './generators/util'
import G from '../common/globals'

export default (rawEntity: any, BP: Blueprint) => ({
    get entity_number() { return rawEntity.get('entity_number') },
    get name() { return rawEntity.get('name') },

    get type() { return factorioData.getEntity(this.name).type },
    get entityData() { return factorioData.getEntity(this.name) },
    get recipeData() { return factorioData.getRecipe(this.name) },
    get itemData() { return factorioData.getItem(this.name) },
    get size() { return util.switchSizeBasedOnDirection(this.entityData.size, this.direction) },

    get position(): IPoint { return rawEntity.get('position').toJS() },
    get direction() {
        // TODO: find a better way of handling passive wires
        // maybe generate the connections in blueprint.ts and
        // store them in the entity.
        if (this.type === 'electric_pole') {
            if (!G.BPC.wiresContainer.entNrToConnectedEntNrs) return 0
            const entNrArr = G.BPC.wiresContainer.entNrToConnectedEntNrs.get(this.entity_number)
            if (!entNrArr) return 0
            return getPowerPoleRotation(
                this.position,
                entNrArr
                    .map(entNr => BP.entity(entNr))
                    .filter(e => !!e)
                    .map(ent => ent.position)
            )
        }

        return rawEntity.get('direction') || 0

        function getPowerPoleRotation(centre: IPoint, points: IPoint[]) {
            const sectorSum = points
                .map(p => U.getAngle(0, 0, p.x - centre.x, (p.y - centre.y) * -1 /* invert Y axis */))
                .map(angleToSector)
                .reduce((acc, sec) => acc + sec, 0)

            return Math.floor(sectorSum / points.length) * 2

            function angleToSector(angle: number) {
                const cwAngle = 360 - angle
                const sectorAngle = 360 / 8
                const offset = sectorAngle * 1.5
                let newAngle = cwAngle - offset
                if (Math.sign(newAngle) === -1) newAngle = 360 + newAngle
                const sector = Math.floor(newAngle / sectorAngle)
                return (sector % 4) as 0 | 1 | 2 | 3
            }
        }
    },
    get directionType() { return rawEntity.get('type') },
    get recipe() { return rawEntity.get('recipe') },

    set recipe(recipeName: string) {
        BP.operation(this.entity_number, 'Changed recipe', entities => (
            entities.withMutations(map => {
                map.setIn([this.entity_number, 'recipe'], recipeName)

                const modules = this.modules
                if (modules && recipeName && !factorioData.getItem('productivity_module').limitation.includes(recipeName)) {
                    for (const k in modules) {
                        // tslint:disable-next-line:no-dynamic-delete
                        if (k.includes('productivity_module')) delete modules[k]
                    }
                    map.setIn([this.entity_number, 'items'], Object.keys(modules).length ? Immutable.fromJS(modules) : undefined)
                }
            })
        ))
    },

    get acceptedRecipes() {
        if (!this.entityData.crafting_categories) return
        const acceptedRecipes: string[] = []
        const recipes = factorioData.getRecipes()
        const cc = this.entityData.crafting_categories
        for (const k in recipes) {
            if (cc.includes(recipes[k].category) || (cc.includes('crafting') && !recipes[k].category)) {
                const recipe = (recipes[k].normal ? recipes[k].normal : recipes[k])
                if (!((this.name === 'assembling_machine_1' && recipe.ingredients.length > 2) ||
                    (this.name === 'assembling_machine_2' && recipe.ingredients.length > 4))
                ) {
                    acceptedRecipes.push(k)
                }
            }
        }
        return acceptedRecipes
    },

    get acceptedModules() {
        if (!this.entityData.module_specification) return
        const ommitProductivityModules = this.name === 'beacon' ||
            (this.recipe && !factorioData.getItem('productivity_module').limitation.includes(this.recipe))
        const items = factorioData.getItems()
        const acceptedModules: string[] = []
        for (const k in items) {
            if (items[k].type === 'module' && !(k.includes('productivity_module') && ommitProductivityModules)) acceptedModules.push(k)
        }
        return acceptedModules
    },

    set direction(direction: number) {
        BP.operation(this.entity_number, 'Set entity direction to ' + direction,
            entities => entities.setIn([this.entity_number, 'direction'], direction)
        )
    },

    get modules() {
        const i = rawEntity.get('items')
        return i ? i.toJS() : undefined
    },

    get modulesList() {
        const i = rawEntity.get('items')
        if (!i) return
        const modules = i.toJS()
        const moduleList = []
        for (const n in modules) {
            for (let i = 0; i < modules[n]; i++) {
                moduleList.push(n)
            }
        }
        return moduleList
    },

    set modulesList(list: any) {
        if (util.equalArrays(list, this.modulesList)) return

        const modules = {}
        for (const m of list) {
            if (Object.keys(modules).includes(m)) {
                modules[m]++
            } else {
                modules[m] = 1
            }
        }
        BP.operation(this.entity_number, 'Changed modules',
            entities => entities.setIn([this.entity_number, 'items'], Immutable.fromJS(modules))
        )
    },

    get splitterInputPriority() {
        return rawEntity.get('input_priority')
    },

    get splitterOutputPriority() {
        return rawEntity.get('output_priority')
    },

    get splitterFilter() {
        return rawEntity.get('filter')
    },

    get inserterFilters() {
        const f = rawEntity.get('filters')
        return f ? f.toJS() : undefined
    },

    get constantCombinatorFilters() {
        const f = rawEntity.getIn(['control_behavior', 'filters'])
        return f ? f.toJS() : undefined
    },

    get logisticChestFilters() {
        const f = rawEntity.get('request_filters')
        return f ? f.toJS() : undefined
    },

    get deciderCombinatorConditions() {
        const c = rawEntity.getIn(['control_behavior', 'decider_conditions'])
        return c ? c.toJS() : undefined
    },

    get arithmeticCombinatorConditions() {
        const c = rawEntity.getIn(['control_behavior', 'arithmetic_conditions'])
        return c ? c.toJS() : undefined
    },

    get hasConnections() {
        return this.connections !== undefined
    },

    get connections() {
        const c = rawEntity.get('connections')
        // if (!c) return
        const conn = c ? c.toJS() : {}

        if (conn['Cu0']) {
            if (!conn['1']) conn['1'] = {}
            conn['1'].copper = conn['Cu0']
            delete conn.Cu0
        }
        if (conn['Cu1']) {
            if (!conn['2']) conn['2'] = {}
            conn['2'].copper = conn['Cu1']
            delete conn.Cu1
        }

        // TODO: Optimize this
        if (this.type === 'electric_pole') {
            const copperConn: any[] = []

            BP.rawEntities.forEach((v, k) => {
                const entity = v.toJS()
                if (entity.name === 'power_switch' && entity.connections) {
                    if (entity.connections.Cu0 && entity.connections.Cu0[0].entity_id === this.entity_number) {
                        copperConn.push({ entity_id: k })
                    }
                    if (entity.connections.Cu1 && entity.connections.Cu1[0].entity_id === this.entity_number) {
                        copperConn.push({ entity_id: k })
                    }
                }
            })

            if (copperConn.length !== 0) {
                if (!conn['1']) conn['1'] = {}
                conn['1'].copper = copperConn
            }
        }

        return Object.keys(conn).length ? conn : undefined
    },

    get connectedEntities() {
        const connections = this.connections
        if (!connections) return

        const entities = []
        for (const side in connections) {
            for (const color in connections[side]) {
                for (const c of connections[side][color]) {
                    entities.push(c.entity_id)
                }
            }
        }
        return entities
    },

    get chemicalPlantDontConnectOutput() {
        const r = this.recipe
        if (!r) return false
        const rData = factorioData.getRecipe(r)
        const recipe = (rData.normal ? rData.normal : rData)
        if (recipe.result || recipe.results[0].type === 'item') return true
        return false
    },

    get trainStopColor() {
        const c = rawEntity.get('color')
        return c ? c.toJS() : undefined
    },

    get operator() {
        if (this.name === 'decider_combinator') {
            const cb = rawEntity.get('control_behavior')
            if (cb) return cb.getIn(['decider_conditions', 'comparator'])
        }
        if (this.name === 'arithmetic_combinator') {
            const cb = rawEntity.get('control_behavior')
            if (cb) return cb.getIn(['arithmetic_conditions', 'operation'])
        }
        return undefined
    },

    getArea(pos?: IPoint) {
        return new Area({
            x: pos ? pos.x : this.position.x,
            y: pos ? pos.y : this.position.y,
            width: this.size.x,
            height: this.size.y
        }, true)
    },

    change(name: string, direction: number) {
        BP.operation(this.entity_number, 'Changed Entity', entities => (
            entities.withMutations(map => {
                map.setIn([this.entity_number, 'name'], name)
                map.setIn([this.entity_number, 'direction'], direction)
            })
        ))
    },

    move(pos: IPoint) {
        const entity = BP.entity(this.entity_number)
        if (!BP.entityPositionGrid.checkNoOverlap(entity.name, entity.direction, pos)) return false
        BP.operation(this.entity_number, 'Moved entity',
            entities => entities.setIn([this.entity_number, 'position'], Immutable.fromJS(pos)),
            'mov'
        )
        BP.entityPositionGrid.setTileData(this.entity_number)
        return true
    },

    rotate(notMoving: boolean, offset?: IPoint, pushToHistory = true, otherEntity?: number, ccw = false) {
        if (!this.assemblerCraftsWithFluid &&
            (this.name === 'assembling_machine_2' || this.name === 'assembling_machine_3')) return false
        if (notMoving && BP.entityPositionGrid.sharesCell(this.getArea())) return false
        const pr = this.entityData.possible_rotations
        if (!pr) return false
        const newDir = pr[
            (
                pr.indexOf(this.direction) +
                (notMoving && (this.size.x !== this.size.y || this.type === 'underground_belt') ? 2 : 1) * (ccw ? 3 : 1)
            ) % pr.length
        ]
        if (newDir === this.direction) return false
        BP.operation(this.entity_number, 'Rotated entity',
            entities => entities.withMutations(map => {
                map.setIn([this.entity_number, 'direction'], newDir)
                if (notMoving && this.type === 'underground_belt') {
                    map.updateIn([this.entity_number, 'type'], directionType =>
                        directionType === 'input' ? 'output' : 'input'
                    )
                }
                if (!notMoving && this.size.x !== this.size.y) {
                    // tslint:disable-next-line:no-parameter-reassignment
                    map.updateIn([this.entity_number, 'position', 'x'], x => x += offset.x)
                    // tslint:disable-next-line:no-parameter-reassignment
                    map.updateIn([this.entity_number, 'position', 'y'], y => y += offset.y)
                }
            }),
            'upd',
            notMoving && pushToHistory,
            otherEntity
        )
        return true
    },

    topLeft() {
        return { x: this.position.x - (this.size.x / 2), y: this.position.y - (this.size.y / 2) }
    },
    topRight() {
        return { x: this.position.x + (this.size.x / 2), y: this.position.y - (this.size.y / 2) }
    },
    bottomLeft() {
        return { x: this.position.x - (this.size.x / 2), y: this.position.y + (this.size.y / 2) }
    },
    bottomRight() {
        return { x: this.position.x + (this.size.x / 2), y: this.position.y + (this.size.y / 2) }
    },

    get assemblerCraftsWithFluid() {
        return this.recipe &&
            factorioData.getRecipe(this.recipe).category === 'crafting_with_fluid' &&
            this.entityData.crafting_categories &&
            this.entityData.crafting_categories.includes('crafting_with_fluid')
    },

    get assemblerPipeDirection() {
        if (!this.recipe) return
        const recipeData = factorioData.getRecipe(this.recipe)
        const rD = recipeData.normal ? recipeData.normal : recipeData
        for (const io of rD.ingredients) {
            if (io.type === 'fluid') {
                return 'input'
            }
        }
        if (rD.results) {
            for (const io of rD.results) {
                if (io.type === 'fluid') {
                    return 'output'
                }
            }
        }
    },

    getWireConnectionPoint(color: string, side: number) {
        const e = this.entityData
        // poles
        if (e.connection_points) return e.connection_points[this.direction / 2].wire[color]
        // combinators
        if (e.input_connection_points) {
            if (side === 1) return e.input_connection_points[this.direction / 2].wire[color]
            return e.output_connection_points[this.direction / 2].wire[color]
        }

        if (this.name === 'power_switch' && color === 'copper') {
            return e[(side === 1 ? 'left' : 'right') + '_wire_connection_point'].wire.copper
        }

        if (e.circuit_wire_connection_point) return e.circuit_wire_connection_point.wire[color]

        if (this.type === 'transport_belt') {
            return e.circuit_wire_connection_points[
                factorioData.getBeltConnections2(BP, this.position, this.direction) * 4
            ].wire[color]
        }
        if (e.circuit_wire_connection_points.length === 8) {
            return e.circuit_wire_connection_points[this.direction].wire[color]
        }
        if (this.name === 'constant_combinator') {
            return e.circuit_wire_connection_points[this.direction / 2].wire[color]
        }
        return e.circuit_wire_connection_points[this.direction / 2].wire[color]
    },

    toJS() {
        return rawEntity.toJS()
    }
})
