import FD from 'factorio-data'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import Panel from '../controls/panel'
import Entity from '../factorio-data/entity'
import { InventoryContainer } from './inventory'

/**
 * This class creates a panel to show detailed informations about each entity (as the original game and maybe more).
 * @function updateVisualization (Update informations and show/hide panel)
 * @function setPosition (top right corner of the screen)
 * @extends /controls/panel (extends PIXI.Container)
 * @see instanciation in /app.ts - event in /containers/entity.ts
 */
export class InfoEntityPanel extends Panel {
    InfoProdTitle: PIXI.Text
    m_EntityName: PIXI.Text
    m_entityInfo: PIXI.Text
    m_RecipeRawContainer: PIXI.Container
    m_RecipeContainer: PIXI.Container

    constructor() {
        super(
            270,
            460,
            G.colors.controls.panel.background.color,
            G.colors.controls.panel.background.alpha,
            G.colors.controls.panel.background.border
        )

        this.interactive = false
        this.visible = false

        this.InfoProdTitle = new PIXI.Text('Information', G.styles.dialog.title)
        this.InfoProdTitle.anchor.set(0.5, 0)
        this.InfoProdTitle.position.set(super.width / 2, 2)
        this.addChild(this.InfoProdTitle)

        this.m_EntityName = new PIXI.Text('', G.styles.dialog.label)
        this.addChild(this.m_EntityName)

        this.m_entityInfo = new PIXI.Text('', G.styles.dialog.label)
        this.addChild(this.m_entityInfo)

        this.m_RecipeRawContainer = new PIXI.Container()
        this.addChild(this.m_RecipeRawContainer)

        this.m_RecipeContainer = new PIXI.Container()
        this.addChild(this.m_RecipeContainer)
    }
    updateVisualization(entity?: Entity) {
        if (!entity) {
            this.visible = false
            this.m_EntityName.text = ''
            this.m_entityInfo.text = ''
            this.m_RecipeRawContainer.removeChildren()
            this.m_RecipeContainer.removeChildren()
            return
        }
        this.visible = true

        // TODO (for all entities): icon, recipe to create itself, total raw to create itself, energy consumption,...
        this.m_EntityName.text = `Type : ${entity.name.charAt(0).toUpperCase()}${entity.name.slice(1)}\nRaw recipe :`
        this.m_EntityName.position.set(10, this.InfoProdTitle.position.y + this.InfoProdTitle.height + 10)

        // Raw recipe
        let nextX = 0
        for (const ingredient of FD.recipes[entity.name].ingredients) {
            InventoryContainer.createIconWithAmount(
                this.m_RecipeRawContainer,
                nextX,
                0,
                ingredient.name,
                ingredient.amount
            )
            nextX += 36
        }
        nextX += 2
        let timeText = `=${FD.recipes[entity.name].time}s>`
        let timeSize: PIXI.TextMetrics = PIXI.TextMetrics.measureText(timeText, G.styles.dialog.label)
        let timeObject: PIXI.Text = new PIXI.Text(timeText, G.styles.dialog.label)
        timeObject.position.set(nextX, 6)
        this.m_RecipeRawContainer.addChild(timeObject)
        nextX += timeSize.width + 6
        for (const result of FD.recipes[entity.name].results) {
            InventoryContainer.createIconWithAmount(this.m_RecipeRawContainer, nextX, 0, result.name, result.amount)
            nextX += 36
        }
        this.m_RecipeRawContainer.position.set(10, this.m_EntityName.position.y + this.m_EntityName.height + 10)
        this.m_RecipeRawContainer.scale.set(0.85, 0.85)

        if (entity.entityData.type === 'assembling_machine') {
            // Details for assembling machines with or without recipe
            let k_productivity = 0
            let k_consumption = 0
            let k_pollution = 0
            let k_speed = 0
            if (entity.modules.length > 0) {
                for (const module of entity.modules) {
                    if (FD.items[module].effect.productivity) {
                        k_productivity += FD.items[module].effect.productivity.bonus
                    }
                    if (FD.items[module].effect.consumption) {
                        k_consumption += FD.items[module].effect.consumption.bonus
                    }
                    if (FD.items[module].effect.pollution) {
                        k_pollution += FD.items[module].effect.pollution.bonus
                    }
                    if (FD.items[module].effect.speed) {
                        k_speed += FD.items[module].effect.speed.bonus
                    }
                }
            }
            k_productivity = Math.round(k_productivity * 100) / 100
            k_consumption = Math.round(k_consumption * 100) / 100
            k_pollution = Math.round(k_pollution * 100) / 100
            k_speed = Math.round(k_speed * 100) / 100
            let new_crafting_speed = entity.entityData.crafting_speed * (1 + k_speed)
            let new_energy_usage = parseInt(entity.entityData.energy_usage.slice(0, -2))
            new_energy_usage = Math.max(new_energy_usage * 0.2, new_energy_usage * (1 + k_consumption))
            // Show modules effect and some others informations
            this.m_entityInfo.text = `Modules effect :\n- Production : ${k_productivity}\n- Consumption : ${k_consumption}\n- Pollution : ${k_pollution}\n- Speed : ${k_speed}\nCrafting speed : ${new_crafting_speed}\nConsumption : ${new_energy_usage} kW`
            this.m_entityInfo.position.set(
                10,
                this.m_RecipeRawContainer.position.y + this.m_RecipeRawContainer.height + 20
            )

            if (!entity.recipe) {
                return
            }
            // Details for assembling machines with recipe
            this.m_RecipeContainer.removeChildren()
            const recipe = FD.recipes[entity.recipe]
            if (recipe === undefined) {
                return
            }

            // Show the original recipe
            let nextX = 0
            for (const ingredient of recipe.ingredients) {
                InventoryContainer.createIconWithAmount(
                    this.m_RecipeContainer,
                    nextX,
                    0,
                    ingredient.name,
                    ingredient.amount
                )
                nextX += 36
            }
            nextX += 2
            const timeText = `=${recipe.time}s>`
            const timeSize: PIXI.TextMetrics = PIXI.TextMetrics.measureText(timeText, G.styles.dialog.label)
            const timeObject: PIXI.Text = new PIXI.Text(timeText, G.styles.dialog.label)
            timeObject.position.set(nextX, 6)
            this.m_RecipeContainer.addChild(timeObject)
            nextX += timeSize.width + 6
            for (const result of recipe.results) {
                InventoryContainer.createIconWithAmount(this.m_RecipeContainer, nextX, 0, result.name, result.amount)
                nextX += 36
            }

            // Calculation of input and output of recipe
            const txt_ingredient: PIXI.Text = new PIXI.Text('', G.styles.dialog.label)
            txt_ingredient.position.set(0, txt_ingredient.y + 50)
            txt_ingredient.text = 'Input :\n'
            for (const ingredient of recipe.ingredients) {
                txt_ingredient.text += `${Math.round(((ingredient.amount * new_crafting_speed) / recipe.time) * 100) /
                    100} /s x ${ingredient.name}\n`
            }
            txt_ingredient.text += '\nOutput :\n'
            for (const result of recipe.results) {
                txt_ingredient.text += `${Math.round(
                    ((result.amount * new_crafting_speed) / recipe.time) * (1 + k_productivity) * 100
                ) / 100} /s x ${result.name}\n`
            }
            this.m_RecipeContainer.addChild(txt_ingredient)
            this.m_RecipeContainer.position.set(10, this.m_entityInfo.position.y + this.m_entityInfo.height + 20)
        }
        if (entity.entityData.type === 'inserter') {
            // Details for inserters
            let speed = [0.59, 0.83, 1.15, 2.31, 2.31, 2.31, 2.31]
            let type = [
                'burner_inserter',
                'inserter',
                'long_handed_inserter',
                'fast_inserter',
                'stack_inserter',
                'stack_filter_inserter',
                'filter_inserter'
            ]
            this.m_entityInfo.text = `Speed : ${speed[type.indexOf(entity.entityData.name)]} items/s`
            // +"\nConsumption : "+new_energy_usage+" kW"// Not very easy to get data, it needs special calcultations
            this.m_entityInfo.position.set(
                10,
                this.m_RecipeRawContainer.position.y + this.m_RecipeRawContainer.height + 20
            )
        }
        if (entity.entityData.type === 'transport_belt') {
            // Details for belts
            let speed = [13.33, 26.66, 40]
            let type = ['transport_belt', 'fast_transport_belt', 'express_transport_belt']
            this.m_entityInfo.text = `Speed : ${speed[type.indexOf(entity.entityData.name)]} items/s`
            this.m_entityInfo.position.set(
                10,
                this.m_RecipeRawContainer.position.y + this.m_RecipeRawContainer.height + 20
            )
        }
    }
    setPosition() {
        this.position.set(G.app.screen.width - this.width, 35)
    }
}
