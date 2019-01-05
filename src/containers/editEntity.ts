import G from '../globals'
import { InventoryContainer } from './inventory'
import { EntityContainer } from './entity'

export class EditEntityContainer extends PIXI.Container {

    content: PIXI.Container
    itemTooltip: PIXI.Text
    inventoryActiveGroup: PIXI.Sprite
    inventoryGroup: Map<PIXI.Sprite, PIXI.Container> = new Map()
    iWidth = 404
    iHeight = 526
    active = false

    constructor() {
        super()

        this.visible = false
        this.interactive = true

        this.setPosition()
        window.addEventListener('resize', () => this.setPosition(), false)

        const background = InventoryContainer.drawRect(this.iWidth, this.iHeight, G.colors.pannel.background, 2, 0.7)
        this.addChild(background)

        this.content = new PIXI.Container()
        this.addChild(this.content)
    }

    setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.iWidth / 2,
            G.app.screen.height / 2 - this.iHeight / 2
        )
    }

    // TODO: Refactor, optimize and make a layout system for this
    create(entity_number: number) {
        this.content.removeChildren()
        const entity = G.bp.entity(entity_number)

        const cc = entity.entityData.crafting_categories
        if (cc && !cc.includes('rocket_building') && !cc.includes('smelting')) {
            const recipeContainer = new PIXI.Container()
            const background = InventoryContainer.drawRect(36, 36, G.colors.pannel.slot, 2, 1, true)
            background.position.set(-18, -18)
            recipeContainer.addChild(background)
            if (entity.recipe) recipeContainer.addChild(InventoryContainer.createIcon(entity.recipe))
            recipeContainer.position.set(
                this.iWidth / 2 + 16,
                this.iHeight / 2 - 19
            )
            recipeContainer.interactive = true
            recipeContainer.buttonMode = true

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
                this.iWidth / 2,
                this.iHeight / 2 - 18
            )
            this.content.addChild(recipeText)
        }

        if (entity.entityData.module_specification) {
            const moduleContainer = new PIXI.Container()
            moduleContainer.position.set(
                this.iWidth / 2 + 16,
                this.iHeight / 2 + 19
            )
            const slots = entity.entityData.module_specification.module_slots
            const modules = entity.modulesList
            for (let i = 0; i < slots; i++) {
                const slot = new PIXI.Container()
                slot.position.set(i * 38, 0)
                slot.interactive = true
                slot.buttonMode = true
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

                const background = InventoryContainer.drawRect(36, 36, G.colors.pannel.slot, 2, 1, true)
                background.position.set(-18, -18)
                slot.addChild(background)

                if (modules && modules[i]) slot.addChild(InventoryContainer.createIcon(modules[i]))

                moduleContainer.addChild(slot)
            }
            this.content.addChild(moduleContainer)

            const recipeText = new PIXI.Text('Modules ', {
                fill: G.colors.text.normal,
                fontFamily: G.fontFamily
            })
            recipeText.anchor.set(1, 0.5)
            recipeText.position.set(
                this.iWidth / 2,
                this.iHeight / 2 + 18
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
