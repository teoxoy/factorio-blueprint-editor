import G from '../common/globals'
import { InventoryContainer } from './inventory'
import { EntityContainer } from '../containers/entity'
import Dialog from '../controls/dialog'
import Slot from '../controls/slot'

export class EditEntityContainer extends Dialog {

    content: PIXI.Container
    itemTooltip: PIXI.Text
    inventoryActiveGroup: PIXI.Sprite
    inventoryGroup: Map<PIXI.Sprite, PIXI.Container> = new Map()
    active = false

    constructor() {
        super(404, 526)

        this.content = new PIXI.Container()
        this.addChild(this.content)
    }

    // TODO: Refactor, optimize and make a layout system for this
    create(entity_number: number) {
        this.content.removeChildren()
        const entity = G.bp.entity(entity_number)

        const cc = entity.entityData.crafting_categories
        if (cc && !cc.includes('rocket_building') && !cc.includes('smelting')) {
            const recipeContainer: Slot = new Slot(36, 36)
            recipeContainer.position.set(
                this.width / 2,
                this.height / 2 - 37
            )
            if (entity.recipe) recipeContainer.content = InventoryContainer.createIcon(entity.recipe, false)
            recipeContainer.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                e.stopPropagation()
                if (e.data.button === 0) {
                    G.inventoryContainer.toggle('Select Recipe', entity.acceptedRecipes, name => {
                        G.openedGUIWindow = this
                        if (entity.recipe !== name) {
                            EntityContainer.mappings.get(entity_number).changeRecipe(name)
                            this.create(entity_number)
                        }
                    })
                } else if (e.data.button === 2) {
                    if (entity.recipe) {
                        EntityContainer.mappings.get(entity_number).changeRecipe(undefined)
                        this.create(entity_number)
                    }
                }
            })
            this.content.addChild(recipeContainer)

            const recipeText = new PIXI.Text('Recipe ', {
                fill: G.colors.text.normal,
                fontFamily: G.fontFamily
            })
            recipeText.anchor.set(1, 0.5)
            recipeText.position.set(
                this.width / 2,
                this.height / 2 - 18
            )
            this.content.addChild(recipeText)
        }

        if (entity.entityData.module_specification) {
            const moduleContainer = new PIXI.Container()
            moduleContainer.position.set(
                this.width / 2,
                this.height / 2 + 1
            )
            const slots = entity.entityData.module_specification.module_slots
            const modules = entity.modulesList
            for (let i = 0; i < slots; i++) {
                const slot: Slot = new Slot(36, 36)
                slot.position.set(i * 38, 0)
                slot.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    e.stopPropagation()
                    if (e.data.button === 0) {
                        G.inventoryContainer.toggle('Select Module', entity.acceptedModules, name => {
                            G.openedGUIWindow = this
                            if (modules) {
                                if (modules[i] !== name) {
                                    modules[modules[i] ? i : modules.length] = name
                                    entity.modulesList = modules
                                }
                            } else {
                                entity.modulesList = [name]
                            }
                            EntityContainer.mappings.get(entity_number).redrawEntityInfo()
                            this.create(entity_number)
                        })
                    } else if (e.data.button === 2) {
                        if (modules && modules[i]) {
                            modules.splice(i, 1)
                            entity.modulesList = modules
                            EntityContainer.mappings.get(entity_number).redrawEntityInfo()
                            this.create(entity_number)
                        }
                    }
                })

                if (modules && modules[i]) slot.content = InventoryContainer.createIcon(modules[i], false)

                moduleContainer.addChild(slot)
            }
            this.content.addChild(moduleContainer)

            const recipeText = new PIXI.Text('Modules ', {
                fill: G.colors.text.normal,
                fontFamily: G.fontFamily
            })
            recipeText.anchor.set(1, 0.5)
            recipeText.position.set(
                this.width / 2,
                this.height / 2 + 18
            )
            this.content.addChild(recipeText)
        }

        if (this.content.children.length !== 0) {
            this.visible = true
            this.active = true
            G.openedGUIWindow = this
        }
    }

    close() {
        if (this.visible && G.openedGUIWindow !== this) {
            G.openedGUIWindow.close()
        }
        this.visible = false
        this.active = false
        G.openedGUIWindow = undefined
    }
}
