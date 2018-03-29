import factorioData from '../factorio-data/factorioData'
import G from '../globals'
import { InventoryContainer } from './inventory'
import { EntityContainer } from './entity'

export class EditEntityContainer extends PIXI.Container {

    content: PIXI.Container
    itemTooltip: PIXI.Text
    iconGutter = 32
    inventoryActiveGroup: PIXI.Sprite
    inventoryGroup: Map<PIXI.Sprite, PIXI.Container> = new Map()
    iWidth = 32 * 12
    iHeight = 32 * 13

    constructor() {
        super()

        this.visible = false
        this.interactive = true

        this.setPosition()
        window.addEventListener('resize', () => this.setPosition(), false)

        const background = new PIXI.Sprite(PIXI.Texture.WHITE)
        background.width = this.iWidth
        background.height = this.iHeight
        background.tint = 0x3A3A3A
        background.alpha = 0.9
        this.addChild(background)

        this.content = new PIXI.Container()
        this.addChild(this.content)
    }

    setPosition() {
        this.position.set(
            G.app.renderer.width / 2 - this.iWidth / 2,
            G.app.renderer.height / 2 - this.iHeight / 2
        )
    }

    // TODO: Refactor, optimize and make a layout system for this
    create(entity_number: number) {
        this.content.removeChildren()
        const entity = G.bp.entity(entity_number)

        const cc = entity.entityData.crafting_categories
        if (cc && !cc.includes('rocket-building') && !cc.includes('smelting')) {
            const recipeContainer = new PIXI.Container()
            const background = new PIXI.Sprite(PIXI.Texture.WHITE)
            background.anchor.set(0.5, 0.5)
            background.width = 32
            background.height = 32
            background.tint = 0x9E9E9E
            recipeContainer.addChild(background)
            if (entity.recipe) recipeContainer.addChild(InventoryContainer.createIcon(factorioData.getItem(entity.recipe)))
            recipeContainer.position.set(
                this.iWidth / 2 + 16,
                this.iHeight / 2 - 18
            )
            recipeContainer.interactive = true
            recipeContainer.buttonMode = true

            recipeContainer.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                e.stopPropagation()
                if (e.data.button === 0) {
                    G.inventoryContainer.toggle(entity.acceptedRecipes, name => {
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

            const recipeText = new PIXI.Text('Recipe ')
            recipeText.anchor.set(1, 0.5)
            recipeText.position.set(
                this.iWidth / 2,
                this.iHeight / 2 - 18
            )
            recipeText.style.fill = 0xFFFFFF
            this.content.addChild(recipeText)
        }

        if (entity.entityData.module_specification) {
            const moduleContainer = new PIXI.Container()
            moduleContainer.position.set(
                this.iWidth / 2 + 16,
                this.iHeight / 2 + 18
            )
            const slots = entity.entityData.module_specification.module_slots
            const modules = entity.modulesList
            for (let i = 0; i < slots; i++) {
                const slot = new PIXI.Container()
                slot.position.set(i * 36, 0)
                slot.interactive = true
                slot.buttonMode = true
                slot.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    e.stopPropagation()
                    if (e.data.button === 0) {
                        G.inventoryContainer.toggle(entity.acceptedModules, name => {
                            G.openedGUIWindow = this
                            if (modules && modules[i] !== name) {
                                modules[modules.length] = name
                                entity.modulesList = modules
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

                const background = new PIXI.Sprite(PIXI.Texture.WHITE)
                background.anchor.set(0.5, 0.5)
                background.width = 32
                background.height = 32
                background.tint = 0x9E9E9E
                slot.addChild(background)

                if (modules && modules[i]) slot.addChild(InventoryContainer.createIcon(factorioData.getItem(modules[i])))

                moduleContainer.addChild(slot)
            }
            this.content.addChild(moduleContainer)

            const recipeText = new PIXI.Text('Modules ')
            recipeText.anchor.set(1, 0.5)
            recipeText.position.set(
                this.iWidth / 2,
                this.iHeight / 2 + 18
            )
            recipeText.style.fill = 0xFFFFFF
            this.content.addChild(recipeText)
        }

        if (this.content.children.length !== 0) {
            this.visible = true
            G.openedGUIWindow = this
        }
    }

    close() {
        if (this.visible && G.openedGUIWindow !== this) {
            G.openedGUIWindow.close()
        }
        this.visible = false
        G.openedGUIWindow = undefined
    }
}
