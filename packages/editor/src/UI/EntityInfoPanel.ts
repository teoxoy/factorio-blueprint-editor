import * as PIXI from 'pixi.js'
import FD from '../core/factorioData'
import G from '../common/globals'
import util from '../common/util'
import { Entity } from '../core/Entity'
import F from './controls/functions'
import { Panel } from './controls/Panel'
import { styles } from './style'

function template(strings: TemplateStringsArray, ...keys: (number | string)[]) {
    return (...values: (unknown | Record<string, unknown>)[]) => {
        const result = [strings[0].replace('\n', '')]
        keys.forEach((key, i) => {
            result.push(
                typeof key === 'number'
                    ? (values as string[])[key]
                    : (values[0] as Record<string, string>)[key],
                strings[i + 1]
            )
        })
        return result.join('')
    }
}

const entityInfoTemplate = template`
Crafting speed: ${'craftingSpeed'} ${'speedMultiplier'}
Power consumption: ${'energyUsage'} kW ${'energyMultiplier'}`

const SIZE_OF_ITEM_ON_BELT = 0.25

const getBeltSpeed = (beltSpeed: number): number => beltSpeed * 60 * (1 / SIZE_OF_ITEM_ON_BELT) * 2

const containerToContainer = (rotationSpeed: number, n: number): number => rotationSpeed * 60 * n

/**
    nr of items to ignore the time it takes to place them on a belt

    because: first item is being placed instantly and also in front so
    this also reduces the time it takes to put down the second item by about 75%
*/
const NR_OF_ITEMS_TO_IGNORE = 1.75
const containerToBelt = (rotationSpeed: number, beltSpeed: number, n: number): number => {
    const armTime = 1 / (rotationSpeed * 60)
    const itemTime = (1 / (beltSpeed * 60)) * SIZE_OF_ITEM_ON_BELT
    return n / (armTime + itemTime * Math.max(n - NR_OF_ITEMS_TO_IGNORE, 0))
}
// TODO: add beltToContainer

const roundToTwo = (n: number): number => Math.round(n * 100) / 100
const roundToFour = (n: number): number => Math.round(n * 10000) / 10000

/**
 * This class creates a panel to show detailed informations about each entity (as the original game and maybe more).
 * @function updateVisualization (Update informations and show/hide panel)
 * @function setPosition (top right corner of the screen)
 * @extends /controls/panel (extends PIXI.Container)
 * @see instantiation in /index.ts - event in /containers/entity.ts
 */
export class EntityInfoPanel extends Panel {
    private title: PIXI.Text
    private m_EntityName: PIXI.Text
    private m_entityInfo: PIXI.Text
    private m_RecipeContainer: PIXI.Container
    private m_RecipeIOContainer: PIXI.Container

    public constructor() {
        super(270, 270)

        this.interactive = false
        this.visible = false

        this.title = new PIXI.Text('Information', styles.dialog.title)
        this.title.anchor.set(0.5, 0)
        this.title.position.set(super.width / 2, 2)
        this.addChild(this.title)

        this.m_EntityName = new PIXI.Text('', styles.dialog.label)
        this.m_entityInfo = new PIXI.Text('', styles.dialog.label)
        this.m_RecipeContainer = new PIXI.Container()
        this.m_RecipeIOContainer = new PIXI.Container()

        this.addChild(
            this.m_EntityName,
            this.m_entityInfo,
            this.m_RecipeContainer,
            this.m_RecipeIOContainer
        )
    }

    public updateVisualization(entity?: Entity): void {
        this.m_RecipeContainer.removeChildren()
        this.m_RecipeIOContainer.removeChildren()

        if (!entity) {
            this.visible = false
            this.m_EntityName.text = ''
            this.m_entityInfo.text = ''
            return
        }

        this.visible = true
        let nextY = this.title.position.y + this.title.height + 10

        this.m_EntityName.text = `Name: ${FD.entities[entity.name].localised_name}`
        this.m_EntityName.position.set(10, nextY)
        nextY = this.m_EntityName.position.y + this.m_EntityName.height + 10

        if (entity.entityData.type === 'assembling_machine') {
            // Details for assembling machines with or without recipe
            let productivity = 0
            let consumption = 0
            // let pollution = 0
            let speed = 0

            if (entity.modules.length > 0) {
                for (const module of entity.modules) {
                    const moduleData = FD.items[module]
                    if (moduleData.effect.productivity) {
                        productivity += moduleData.effect.productivity.bonus
                    }
                    if (moduleData.effect.consumption) {
                        consumption += moduleData.effect.consumption.bonus
                    }
                    // if (moduleData.effect.pollution) {
                    //     pollution += moduleData.effect.pollution.bonus
                    // }
                    if (moduleData.effect.speed) {
                        speed += moduleData.effect.speed.bonus
                    }
                }
            }

            for (const beacon of this.findNearbyBeacons(entity)) {
                for (const module of beacon.modules) {
                    if (FD.items[module].effect.productivity) {
                        productivity +=
                            FD.items[module].effect.productivity.bonus *
                            beacon.entityData.distribution_effectivity
                    }
                    if (FD.items[module].effect.consumption) {
                        consumption +=
                            FD.items[module].effect.consumption.bonus *
                            beacon.entityData.distribution_effectivity
                    }
                    // if (FD.items[module].effect.pollution) {
                    //     pollution += FD.items[module].effect.pollution.bonus * beacon.entityData.distribution_effectivity
                    // }
                    if (FD.items[module].effect.speed) {
                        speed +=
                            FD.items[module].effect.speed.bonus *
                            beacon.entityData.distribution_effectivity
                    }
                }
            }

            consumption = consumption < -0.8 ? -0.8 : consumption
            const newCraftingSpeed = entity.entityData.crafting_speed * (1 + speed)
            const newEnergyUsage =
                parseInt(entity.entityData.energy_usage.slice(0, -2)) * (1 + consumption)

            const fmt = (n: number): string =>
                `(${Math.sign(n) === 1 ? '+' : '-'}${roundToTwo(Math.abs(n) * 100)}%)`

            // Show modules effect and some others informations
            this.m_entityInfo.text = entityInfoTemplate({
                craftingSpeed: roundToFour(newCraftingSpeed),
                speedMultiplier: speed ? fmt(speed) : '',
                energyUsage: roundToTwo(newEnergyUsage),
                energyMultiplier: consumption ? fmt(consumption) : '',
            })

            this.m_entityInfo.position.set(10, nextY)
            nextY = this.m_entityInfo.position.y + this.m_entityInfo.height + 10

            if (!entity.recipe) return

            // Details for assembling machines with recipe
            this.m_RecipeContainer.removeChildren()
            const recipe = FD.recipes[entity.recipe]
            if (recipe === undefined) return

            // Show the original recipe
            this.m_RecipeContainer.addChild(new PIXI.Text('Recipe:', styles.dialog.label))
            F.CreateRecipe(
                this.m_RecipeContainer,
                0,
                20,
                recipe.ingredients,
                recipe.results,
                recipe.time
            )
            this.m_RecipeContainer.position.set(10, nextY)
            nextY = this.m_RecipeContainer.position.y + this.m_RecipeContainer.height + 20

            // Show recipe that takes entity effects into account
            this.m_RecipeIOContainer.addChild(
                new PIXI.Text('Recipe (takes entity effects into account):', styles.dialog.label)
            )
            F.CreateRecipe(
                this.m_RecipeIOContainer,
                0,
                20,
                recipe.ingredients.map(i => ({
                    name: i.name,
                    amount: roundToTwo((i.amount * newCraftingSpeed) / recipe.time),
                })),
                recipe.results.map(r => ({
                    name: r.name,
                    amount: roundToTwo(
                        ((r.amount * newCraftingSpeed) / recipe.time) * (1 + productivity)
                    ),
                })),
                1
            )
            this.m_RecipeIOContainer.position.set(10, nextY)
            nextY = this.m_RecipeIOContainer.position.y + this.m_RecipeIOContainer.height + 20
        }

        const isBelt = (e: Entity): boolean =>
            e.entityData.type === 'transport_belt' ||
            e.entityData.type === 'underground_belt' ||
            e.entityData.type === 'splitter' ||
            e.entityData.type === 'loader'

        if (entity.entityData.type === 'inserter') {
            // Details for inserters
            let speed = containerToContainer(
                entity.entityData.rotation_speed,
                entity.inserterStackSize
            )
            const tiles = entity.name === 'long_handed_inserter' ? 2 : 1
            // const fromP = util.rotatePointBasedOnDir([0, -tiles], entity.direction)
            const toP = util.rotatePointBasedOnDir([0, tiles], entity.direction)
            // const from = G.bp.entities.get(
            //     G.bp.entityPositionGrid.getCellAtPosition(
            //         util.sumprod(entity.position, fromP)
            //     )
            // )
            const to = G.bp.entityPositionGrid.getEntityAtPosition(
                util.sumprod(entity.position, toP)
            )
            if (to && isBelt(to)) {
                speed = containerToBelt(
                    entity.entityData.rotation_speed,
                    to.entityData.speed,
                    entity.inserterStackSize
                )
            }
            this.m_entityInfo.text = `Speed: ${roundToTwo(
                speed
            )} items/s\n> changes if inserter unloads to a belt`
            this.m_entityInfo.position.set(10, nextY)
            nextY = this.m_entityInfo.position.y + this.m_entityInfo.height + 20
        }

        if (isBelt(entity)) {
            // Details for belts
            this.m_entityInfo.text = `Speed: ${roundToTwo(
                getBeltSpeed(entity.entityData.speed)
            )} items/s`
            this.m_entityInfo.position.set(10, nextY)
            nextY = this.m_entityInfo.position.y + this.m_entityInfo.height + 20
        }
    }

    protected setPosition(): void {
        this.position.set(G.app.screen.width - this.width + 1, 0)
    }

    private findNearbyBeacons(entity: Entity): Entity[] {
        const entityRect = new PIXI.Rectangle(entity.position.x, entity.position.y)
        entityRect.pad(entity.size.x / 2, entity.size.y / 2)

        return entity.Blueprint.entities.filter((beacon: Entity): boolean => {
            if (beacon.type !== 'beacon') {
                return false
            }

            const beaconAura = new PIXI.Rectangle(beacon.position.x, beacon.position.y, 1, 1)
            beaconAura.pad(FD.entities.beacon.supply_area_distance)

            return (
                beaconAura.contains(entityRect.left, entityRect.top) ||
                beaconAura.contains(entityRect.right, entityRect.top) ||
                beaconAura.contains(entityRect.left, entityRect.bottom) ||
                beaconAura.contains(entityRect.right, entityRect.bottom)
            )
        })
    }
}
