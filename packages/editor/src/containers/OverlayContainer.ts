import * as PIXI from 'pixi.js'
import FD, { FluidBox, CursorBoxType, SpriteData } from '@fbe/factorio-data'
import F from '../UI/controls/functions'
import G from '../common/globals'
import util from '../common/util'
import { isActionActive } from '../actions'
import { Entity } from '../core/Entity'
import { EditorMode, BlueprintContainer } from './BlueprintContainer'
import { EntityContainer } from './EntityContainer'

export class OverlayContainer extends PIXI.Container {
    private readonly bpc: BlueprintContainer
    private readonly entityInfos = new PIXI.Container()
    private readonly cursorBoxes = new PIXI.Container()
    private readonly undergroundLines = new PIXI.Container()
    private readonly selectionArea = new PIXI.Graphics()
    private copyCursorBox: PIXI.Container
    private selectionAreaUpdateFn: (endX: number, endY: number) => void

    public constructor(bpc: BlueprintContainer) {
        super()
        this.bpc = bpc

        this.addChild(this.entityInfos, this.cursorBoxes, this.undergroundLines, this.selectionArea)

        this.bpc.on('removeHoverContainer', this.destroyCopyCursorBox, this)
        this.bpc.on('createHoverContainer', () => {
            if (isActionActive('tryPasteEntitySettings')) {
                this.createCopyCursorBox()
            }
        })
    }

    public static createEntityInfo(entity: Entity, position: IPoint): PIXI.Container {
        const entityInfo = new PIXI.Container()

        if (entity.recipe && entity.entityData.show_recipe_icon !== false) {
            const recipeInfo = new PIXI.Container()
            createIconWithBackground(recipeInfo, entity.recipe)
            const S = entity.name === 'oil_refinery' ? 1.5 : 0.9
            recipeInfo.scale.set(S, S)
            recipeInfo.position.set(0, -10)
            entityInfo.addChild(recipeInfo)

            const fluidIcons = new PIXI.Container()
            const recipe = FD.recipes[entity.recipe]
            if (recipe.category === 'oil_processing' || recipe.category === 'chemistry') {
                const inputPositions: IPoint[] = []
                const outputPositions: IPoint[] = []
                for (const fb of entity.entityData.fluid_boxes) {
                    const positions =
                        fb.production_type === 'input' ? inputPositions : outputPositions
                    positions.push({
                        x: fb.pipe_connections[0].position[0],
                        y: fb.pipe_connections[0].position[1],
                    })
                }

                const createIconsForType = (type: string): void => {
                    const iconNames = (type === 'input' ? recipe.ingredients : recipe.results)
                        .filter(item => item.type === 'fluid')
                        .map(item => item.name)

                    if (iconNames.length !== 0) {
                        const positions = type === 'input' ? inputPositions : outputPositions
                        positions
                            .map(p => util.transformConnectionPosition(p, entity.direction))
                            .forEach((p, i) => {
                                createIconWithBackground(
                                    fluidIcons,
                                    i > iconNames.length - 1 ? iconNames[0] : iconNames[i],
                                    { x: p.x * 64, y: p.y * 64 }
                                )
                            })
                    }
                }
                createIconsForType('input')
                if (recipe.results) {
                    createIconsForType('output')
                }
            } else if (recipe.category === 'crafting_with_fluid') {
                for (const io of entity.assemblerPipeDirection === 'input'
                    ? recipe.ingredients
                    : recipe.results) {
                    if (io.type === 'fluid') {
                        const position = util.rotatePointBasedOnDir(
                            entity.entityData.fluid_boxes.find(
                                fb => fb.production_type === entity.assemblerPipeDirection
                            ).pipe_connections[0].position,
                            entity.direction
                        )
                        createIconWithBackground(fluidIcons, io.name, {
                            x: position.x * 32,
                            y: position.y * 32,
                        })
                    }
                }
            }
            fluidIcons.scale.set(0.5, 0.5)
            if (fluidIcons.children.length !== 0) {
                entityInfo.addChild(fluidIcons)
            }
        }

        const modules = entity.modules
        if (modules.length !== 0) {
            const moduleInfo = new PIXI.Container()
            const shift = entity.entityData.module_specification.module_info_icon_shift
            for (let index = 0; index < modules.length; index++) {
                createIconWithBackground(moduleInfo, modules[index], { x: index * 32, y: 0 })
            }
            moduleInfo.scale.set(0.5, 0.5)
            moduleInfo.position.set(
                (shift ? shift[0] : 0) * 32 - modules.length * 8 + 8,
                (shift ? shift[1] : 0.75) * 32
            )
            entityInfo.addChild(moduleInfo)
        }

        const filters =
            entity.filters === undefined
                ? undefined
                : entity.filters.filter(v => v.name !== undefined)
        if (
            filters !== undefined &&
            (entity.type === 'inserter' ||
                entity.type === 'logistic_container' ||
                entity.name === 'infinity_chest' ||
                entity.name === 'infinity_pipe')
        ) {
            const filterInfo = new PIXI.Container()
            for (let i = 0; i < filters.length; i++) {
                if (i === 4) {
                    break
                }
                if (filters[i].name === undefined) {
                    break
                }

                createIconWithBackground(filterInfo, filters[i].name, {
                    x: (i % 2) * 32 - (filters.length === 1 ? 0 : 16),
                    y: filters.length < 3 ? 0 : (i < 2 ? -1 : 1) * 16,
                })
            }
            let S = 0.5
            if (entity.type === 'inserter' && filters.length !== 1) {
                S = 0.4
            }
            if (entity.type === 'logistic_container' && filters.length === 1) {
                S = 0.6
            }
            filterInfo.scale.set(S, S)
            entityInfo.addChild(filterInfo)
        }

        if (entity.constantCombinatorFilters !== undefined) {
            const filters = entity.constantCombinatorFilters
            const filterInfo = new PIXI.Container()
            for (let i = 0; i < filters.length; i++) {
                if (i === 4) {
                    break
                }
                createIconWithBackground(filterInfo, filters[i].signal.name, {
                    x: (i % 2) * 32 - (filters.length === 1 ? 0 : 16),
                    y: filters.length < 3 ? 0 : (i < 2 ? -1 : 1) * 16,
                })
            }
            filterInfo.scale.set(0.5, 0.5)
            entityInfo.addChild(filterInfo)
        }

        const combinatorConditions =
            entity.deciderCombinatorConditions || entity.arithmeticCombinatorConditions
        if (combinatorConditions) {
            const filterInfo = new PIXI.Container()
            const cFS = combinatorConditions.first_signal
            const cSS = combinatorConditions.second_signal
            const cOS = combinatorConditions.output_signal
            if (cFS) {
                createIconWithBackground(filterInfo, cFS.name, { x: cSS ? -16 : 0, y: -16 })
            }
            if (cSS) {
                createIconWithBackground(filterInfo, cSS.name, { x: 16, y: -16 })
            }
            if (cOS) {
                createIconWithBackground(filterInfo, cOS.name, { x: 0, y: 16 })
            }
            filterInfo.scale.set(0.5, 0.5)
            if (filterInfo.children.length !== 0) {
                entityInfo.addChild(filterInfo)
            }
        }

        if (entity.type === 'boiler' || entity.type === 'generator') {
            const filteredFluidInputs = new PIXI.Container()
            const generateIconsForFluidBox = (fluidBox: FluidBox): void => {
                for (const c of fluidBox.pipe_connections) {
                    const position = util.transformConnectionPosition(
                        { x: c.position[0], y: c.position[1] },
                        entity.direction
                    )
                    createIconWithBackground(filteredFluidInputs, fluidBox.filter, {
                        x: position.x * 64,
                        y: position.y * 64,
                    })
                }
            }
            generateIconsForFluidBox(entity.entityData.fluid_box)
            if (entity.entityData.output_fluid_box) {
                generateIconsForFluidBox(entity.entityData.output_fluid_box)
            }
            filteredFluidInputs.scale.set(0.5, 0.5)
            entityInfo.addChild(filteredFluidInputs)
        }

        if (entity.splitterInputPriority || entity.splitterOutputPriority) {
            const filterInfo = new PIXI.Container()

            const createArrowForDirection = (direction: string, offsetY: number): void => {
                const arrow = createArrow(
                    util.rotatePointBasedOnDir(
                        { x: direction === 'right' ? 32 : -32, y: offsetY },
                        entity.direction
                    )
                )
                arrow.scale.set(0.75, 0.75)
                arrow.rotation = entity.direction * Math.PI * 0.25
                filterInfo.addChild(arrow)
            }

            if (entity.filters.length > 0) {
                createIconWithBackground(
                    filterInfo,
                    entity.filters[0].name,
                    util.rotatePointBasedOnDir(
                        { x: entity.splitterOutputPriority === 'right' ? 32 : -32, y: 0 },
                        entity.direction
                    )
                )
            } else if (entity.splitterOutputPriority) {
                createArrowForDirection(entity.splitterOutputPriority, -16)
            }
            if (entity.splitterInputPriority) {
                createArrowForDirection(entity.splitterInputPriority, 16)
            }
            filterInfo.scale.set(0.5, 0.5)
            entityInfo.addChild(filterInfo)
        }

        if (entity.name === 'arithmetic_combinator' || entity.name === 'decider_combinator') {
            const arrows = new PIXI.Container()
            arrows.addChild(createArrow({ x: 0, y: -48 }), createArrow({ x: 0, y: 48 }))
            arrows.rotation = entity.direction * Math.PI * 0.25
            arrows.scale.set(0.5, 0.5)
            entityInfo.addChild(arrows)
        }

        if (entity.type === 'mining_drill' && entity.name !== 'pumpjack') {
            const arrows = new PIXI.Container()
            arrows.addChild(
                createArrow({
                    x: entity.entityData.vector_to_place_result[0] * 64,
                    y: entity.entityData.vector_to_place_result[1] * 64 + 18,
                })
            )
            arrows.rotation = entity.direction * Math.PI * 0.25
            arrows.scale.set(0.5, 0.5)
            entityInfo.addChild(arrows)
        }

        if (
            entity.name === 'pumpjack' ||
            entity.name === 'pump' ||
            entity.name === 'offshore_pump' ||
            entity.type === 'boiler' ||
            entity.type === 'generator' ||
            entity.name === 'oil_refinery' ||
            entity.name === 'chemical_plant' ||
            entity.assemblerCraftsWithFluid ||
            entity.name === 'flamethrower_turret'
        ) {
            const createFluidArrow = (position: IPoint, type = 1): void => {
                const offset = 0.5
                if (entity.name === 'offshore_pump') {
                    position.y -= 2
                }
                if (entity.name === 'flamethrower_turret') {
                    position.y -= 2
                }
                const dir = util.getRelativeDirection(position)
                switch (dir) {
                    case 0:
                        position.y += offset
                        break
                    case 2:
                        position.x -= offset
                        break
                    case 4:
                        position.y -= offset
                        break
                    case 6:
                        position.x += offset
                }
                const arrow = createArrow(
                    {
                        x: position.x * 64,
                        y: position.y * 64,
                    },
                    type
                )
                if (entity.type === 'boiler' && type === 2) {
                    arrow.rotation = 0.5 * Math.PI
                }
                if (entity.name === 'pumpjack') {
                    arrow.rotation = entity.direction * Math.PI * 0.25
                }
                if (entity.name === 'flamethrower_turret') {
                    arrow.rotation = 0.5 * Math.PI
                }
                arrows.addChild(arrow)
            }

            const arrows = new PIXI.Container()
            if (entity.entityData.fluid_boxes) {
                if (entity.assemblerCraftsWithFluid) {
                    const c =
                        entity.entityData.fluid_boxes[
                            entity.assemblerPipeDirection === 'input' ? 1 : 0
                        ]
                    createFluidArrow({
                        x: c.pipe_connections[0].position[0],
                        y: c.pipe_connections[0].position[1],
                    })
                } else {
                    const dontConnectOutput =
                        entity.name === 'chemical_plant' && entity.chemicalPlantDontConnectOutput
                    for (const c of entity.entityData.fluid_boxes) {
                        // fluid_boxes are reversed
                        if (!(c.production_type === 'input' && dontConnectOutput)) {
                            createFluidArrow({
                                x: c.pipe_connections[0].position[0],
                                y: c.pipe_connections[0].position[1],
                            })
                        }
                    }
                }
            } else {
                if (entity.entityData.fluid_box) {
                    for (const p of entity.entityData.fluid_box.pipe_connections) {
                        if (
                            entity.name === 'pump' &&
                            p === entity.entityData.fluid_box.pipe_connections[1]
                        ) {
                            break
                        }
                        createFluidArrow(
                            {
                                x: p.position[0],
                                y: p.position[1],
                            },
                            entity.entityData.fluid_box.production_type === 'input_output' ? 2 : 1
                        )
                    }
                }
                if (entity.entityData.output_fluid_box) {
                    for (const p of entity.entityData.output_fluid_box.pipe_connections) {
                        createFluidArrow({
                            x: p.position ? p.position[0] : p.positions[entity.direction / 2][0],
                            y: p.position ? p.position[1] : p.positions[entity.direction / 2][1],
                        })
                    }
                }
            }

            if (entity.name !== 'pumpjack') {
                arrows.rotation =
                    (entity.name === 'oil_refinery' ||
                    entity.name === 'pump' ||
                    entity.type === 'boiler'
                        ? entity.direction
                        : (entity.direction + 4) % 8) *
                    Math.PI *
                    0.25
            }
            arrows.scale.set(0.5, 0.5)
            entityInfo.addChild(arrows)
        }

        if (entityInfo.children.length !== 0) {
            entityInfo.position.set(position.x, position.y)
            return entityInfo
        }

        function createIconWithBackground(
            container: PIXI.Container,
            itemName: string,
            position?: IPoint
        ): void {
            const icon = F.CreateIcon(itemName, true, true)
            const data = FD.utilitySprites.entity_info_dark_background
            const background = new PIXI.Sprite(G.sheet.get(data.filename))
            background.anchor.set(0.5, 0.5)
            if (position) {
                icon.position.set(position.x, position.y)
                background.position.set(position.x, position.y)
            }
            const lastLength = container.children.length
            container.addChild(background, icon)
            if (lastLength !== 0) {
                container.swapChildren(
                    container.getChildAt(lastLength / 2),
                    container.getChildAt(lastLength)
                )
            }
        }

        function createArrow(position: IPoint, type = 0): PIXI.Sprite {
            const typeToPath = (type = 0): SpriteData => {
                switch (type) {
                    case 0:
                        return FD.utilitySprites.indication_arrow
                    case 1:
                        return FD.utilitySprites.fluid_indication_arrow
                    case 2:
                        return FD.utilitySprites.fluid_indication_arrow_both_ways
                }
            }
            const arrow = new PIXI.Sprite(G.sheet.get(typeToPath(type).filename))
            arrow.anchor.set(0.5, 0.5)
            arrow.position.set(position.x, position.y)
            return arrow
        }
    }

    public createCopyCursorBox(): void {
        if (
            this.bpc.mode === EditorMode.EDIT &&
            this.copyCursorBox === undefined &&
            this.bpc.hoverContainer !== undefined &&
            this.bpc.entityForCopyData !== undefined &&
            EntityContainer.mappings.has(this.bpc.entityForCopyData.entityNumber) &&
            this.bpc.hoverContainer.entity.canPasteSettings(this.bpc.entityForCopyData)
        ) {
            const srcEnt = EntityContainer.mappings.get(this.bpc.entityForCopyData.entityNumber)
            this.copyCursorBox = this.createCursorBox(
                srcEnt.position,
                this.bpc.entityForCopyData.size,
                'copy'
            )
        }
    }

    public destroyCopyCursorBox(): void {
        if (this.copyCursorBox !== undefined) {
            this.copyCursorBox.destroy()
            this.copyCursorBox = undefined
        }
    }

    public toggleEntityInfoVisibility(): void {
        this.entityInfos.visible = !this.entityInfos.visible
    }

    public createEntityInfo(entity: Entity, position: IPoint): PIXI.Container {
        const entityInfo = OverlayContainer.createEntityInfo(entity, position)
        if (entityInfo !== undefined) {
            this.entityInfos.addChild(entityInfo)
            return entityInfo
        }
    }

    public createCursorBox(
        position: IPoint,
        size: IPoint,
        type: CursorBoxType = 'regular'
    ): PIXI.Container {
        const cursorBox = new PIXI.Container()
        cursorBox.scale.set(0.5, 0.5)
        cursorBox.position.set(position.x, position.y)
        this.cursorBoxes.addChild(cursorBox)

        if (size.x === 1 && size.y === 1) {
            const data = FD.utilitySprites.cursor_box[type][0].sprite
            const texture = G.sheet.get(data.filename, data.x, data.y, data.width, data.height)
            const s = new PIXI.Sprite(texture)
            s.anchor.set(0.5, 0.5)
            cursorBox.addChild(s)
        } else {
            cursorBox.addChild(...createCorners(Math.min(size.x, size.y)))
        }

        return cursorBox

        function createCorners(minSideLength: number): PIXI.Sprite[] {
            const boxes = FD.utilitySprites.cursor_box[type]
            const data = (
                boxes.find(t => t.max_side_length > minSideLength) || boxes[boxes.length - 1]
            ).sprite
            const texture = G.sheet.get(data.filename, data.x, data.y, data.width, data.height)

            const c0 = new PIXI.Sprite(texture)
            const c1 = new PIXI.Sprite(texture)
            const c2 = new PIXI.Sprite(texture)
            const c3 = new PIXI.Sprite(texture)
            const X = size.x * 32
            const Y = size.y * 32
            c0.position.set(-X, -Y)
            c1.position.set(X, -Y)
            c2.position.set(-X, Y)
            c3.position.set(X, Y)
            c1.rotation = Math.PI * 0.5
            c2.rotation = Math.PI * 1.5
            c3.rotation = Math.PI
            return [c0, c1, c2, c3]
        }
    }

    public createUndergroundLine(
        name: string,
        position: IPoint,
        direction: number,
        searchDirection: number
    ): PIXI.Container {
        const fd = FD.entities[name]
        if (fd.type === 'underground_belt' || name === 'pipe_to_ground') {
            const otherEntity = this.bpc.bp.entities.get(
                this.bpc.bp.entityPositionGrid.getOpposingEntity(
                    name,
                    name === 'pipe_to_ground' ? searchDirection : direction,
                    position,
                    searchDirection,
                    fd.max_distance || 10
                )
            )

            if (otherEntity) {
                // Return if directionTypes are the same
                if (
                    fd.type === 'underground_belt' &&
                    (otherEntity.directionType === 'input'
                        ? otherEntity.direction
                        : otherEntity.direction + (4 % 8)) === searchDirection
                ) {
                    return
                }

                const searchingAlongY = searchDirection % 4 === 0
                const distance = searchingAlongY
                    ? Math.abs(otherEntity.position.y - position.y)
                    : Math.abs(otherEntity.position.x - position.x)

                const sign = searchDirection === 0 || searchDirection === 6 ? -1 : 1

                const lineParts = new PIXI.Container()
                lineParts.x = position.x * 32
                lineParts.y = position.y * 32
                this.undergroundLines.addChild(lineParts)

                for (let i = 1; i < distance; i++) {
                    const data =
                        name === 'pipe_to_ground'
                            ? FD.utilitySprites.underground_pipe_connection
                            : fd.underground_sprite
                    const s = new PIXI.Sprite(
                        G.sheet.get(data.filename, data.x, data.y, data.width, data.height)
                    )
                    s.rotation = direction * Math.PI * 0.25
                    if (data.scale) {
                        s.scale.set(data.scale)
                    }
                    s.anchor.set(0.5)
                    s.x = searchingAlongY ? 0 : sign * i * 32
                    s.y = searchingAlongY ? sign * i * 32 : 0
                    lineParts.addChild(s)
                }

                const otherEntityCursorBox = this.createCursorBox(
                    {
                        x: searchingAlongY ? 0 : sign * distance * 32,
                        y: searchingAlongY ? sign * distance * 32 : 0,
                    },
                    otherEntity.size,
                    'pair'
                )
                lineParts.addChild(otherEntityCursorBox)

                return lineParts
            }
        }
    }

    public showSelectionArea(color: number): void {
        const startPos = { x: this.bpc.gridData.x, y: this.bpc.gridData.y }

        this.selectionAreaUpdateFn = (endX: number, endY: number) => {
            const X = Math.min(startPos.x, endX)
            const Y = Math.min(startPos.y, endY)
            const W = Math.abs(endX - startPos.x)
            const H = Math.abs(endY - startPos.y)

            this.selectionArea
                .clear()
                .lineStyle(2 / this.bpc.getViewportScale(), color)
                .moveTo(X, Y)
                .lineTo(X + W, Y)
                .lineTo(X + W, Y + H)
                .lineTo(X, Y + H)
                .lineTo(X, Y)
        }

        this.bpc.gridData.on('update', this.selectionAreaUpdateFn)
    }

    public hideSelectionArea(): void {
        this.selectionArea.clear()
        this.bpc.gridData.off('update', this.selectionAreaUpdateFn)
    }
}
