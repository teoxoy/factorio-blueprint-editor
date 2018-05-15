import inventoryBundle from '../bundles/inventoryBundle.json'
import factorioData from '../factorio-data/factorioData'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import util from '../util'
import G from '../globals'
import { PaintContainer } from './paint'
import { isArray } from 'util'

export class InventoryContainer extends PIXI.Container {

    static createIcon(item: any) {
        if (item.icon) {
            const icon = PIXI.Sprite.fromFrame(item.icon)
            icon.anchor.set(0.5, 0.5)
            return icon
        }
        if (item.icons) {
            const img = new PIXI.Container()
            for (const icon of item.icons) {
                const sprite = PIXI.Sprite.fromFrame(icon.icon)
                if (icon.scale) sprite.scale.set(icon.scale, icon.scale)
                if (icon.shift) sprite.position.set(icon.shift[0], icon.shift[1])
                if (icon.tint) {
                    const t = icon.tint
                    sprite.filters = [new AdjustmentFilter({
                        red: t.r,
                        green: t.g,
                        blue: t.b,
                        alpha: t.a
                    })]
                }
                sprite.anchor.set(0.5, 0.5)
                img.addChild(sprite)
            }
            return img
        }
    }

    recipeVisualization: PIXI.Container
    inventoryContents: PIXI.Container
    itemTooltip: PIXI.Text
    iconGutter = 36
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

        this.inventoryContents = new PIXI.Container()
        this.addChild(this.inventoryContents)

        this.itemTooltip = new PIXI.Text('')
        this.itemTooltip.style.fill = G.UIColors.text
        this.itemTooltip.y = 352
        this.addChild(this.itemTooltip)

        this.recipeVisualization = new PIXI.Container()
        this.recipeVisualization.position.set(16, 384 + 16)
        this.addChild(this.recipeVisualization)
    }

    setPosition() {
        this.position.set(
            G.app.renderer.width / 2 - this.iWidth / 2,
            G.app.renderer.height / 2 - this.iHeight / 2
        )
    }

    create(filteredItems?: string[], cb?: (name: string) => void) {
        this.itemTooltip.text = ''
        this.recipeVisualization.visible = false
        this.inventoryContents.removeChildren()

        let nextI = 0
        let groupHasItem = false
        for (let i = 0, l = inventoryBundle.length; i < l; i++) {

            const grObj = new PIXI.Container()
            let nextK = 0
            let nextJ = 0
            let subgroupHasItem = false
            for (const subgroup of inventoryBundle[i].subgroups) {
                for (const item of subgroup.items) {
                    const placeResult = factorioData.getItem(item.name).place_result
                    if ((!filteredItems && placeResult && factorioData.getEntity(placeResult)) ||
                        filteredItems && filteredItems.includes(item.name)
                    ) {
                        const img = InventoryContainer.createIcon(item)

                        if (nextK > 9) {
                            nextJ++
                            nextK = 0
                        }

                        img.x = nextK * this.iconGutter + 16
                        img.y = 64 + nextJ * this.iconGutter + 16
                        img.interactive = true
                        img.buttonMode = true

                        if (filteredItems && filteredItems.includes(item.name)) {
                            img.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                                if (e.data.button === 0) {
                                    cb(item.name)
                                    this.visible = false
                                }
                            })
                        } else {
                            img.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                                if (e.data.button === 0) {
                                    G.currentMouseState = G.mouseStates.PAINTING

                                    const newPosition = e.data.getLocalPosition(G.BPC)
                                    const size = util.switchSizeBasedOnDirection(factorioData.getEntity(placeResult).size, 0)
                                    G.BPC.paintContainer = new PaintContainer(placeResult, 0, {
                                        x: newPosition.x - newPosition.x % 32 + (size.x % 2 * 16),
                                        y: newPosition.y - newPosition.y % 32 + (size.y % 2 * 16)
                                    })
                                    G.BPC.addChild(G.BPC.paintContainer)
                                    this.visible = false
                                }
                            })
                        }
                        img.on('pointerover', () => {
                            this.itemTooltip.text = item.name.split('-').map((s: any) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
                            this.createRecipeVisualization(item.name)
                        })
                        img.on('pointerout', () => {
                            this.itemTooltip.text = ''
                            this.recipeVisualization.visible = false
                        })

                        grObj.addChild(img)
                        groupHasItem = true
                        subgroupHasItem = true
                        nextK++
                    }
                }
                if (subgroupHasItem) nextJ++
                subgroupHasItem = false
                nextK = 0
            }

            if (groupHasItem) {
                const img = PIXI.Sprite.fromFrame(inventoryBundle[i].icon)
                img.x = nextI * 64
                img.y = 0
                img.interactive = true
                img.buttonMode = true
                img.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    if (e.data.button === 0) {
                        if (img !== this.inventoryActiveGroup) {
                            this.inventoryGroup.get(this.inventoryActiveGroup).visible = false
                            this.inventoryActiveGroup = img
                            this.inventoryGroup.get(img).visible = true
                        }
                    }
                })

                if (nextI === 0) this.inventoryActiveGroup = img
                else grObj.visible = false

                this.inventoryGroup.set(img, grObj)
                this.inventoryContents.addChild(img, grObj)

                nextI++
                groupHasItem = false
            }
        }
    }

    toggle(filteredItems?: string[], cb?: (name: string) => void) {
        if (!this.visible) {
            this.create(filteredItems, cb)
            this.visible = true
            G.openedGUIWindow = this
        } else {
            this.close()
        }
    }

    close() {
        this.visible = false
        G.openedGUIWindow = G.editEntityContainer.visible ? G.editEntityContainer : undefined
    }

    createRecipeVisualization(recipeName: string) {
        const RECIPE = factorioData.getRecipe(recipeName)
        if (!RECIPE) return
        this.recipeVisualization.removeChildren()

        const recipe = RECIPE.normal ? RECIPE.normal : RECIPE
        // TODO: maybe normalize the recipeBundle trough script and not here at runtime
        const time = (recipe.energy_required !== undefined ? recipe.energy_required : RECIPE.energy_required) || 0.5
        const ingredients = recipe.ingredients.map((o: any) => isArray(o) ? o : [o.name, o.amount])
        const results = recipe.result ? [[recipe.result, recipe.result_count || 1]] :
            recipe.results.map((o: any) => [o.name, o.probability ? o.probability * o.amount : o.amount])

        let nextX = 0
        for (const i of ingredients) {
            const s = InventoryContainer.createIcon(factorioData.getItem(i[0]))
            s.x = nextX * 36
            this.recipeVisualization.addChild(s, createAmountText(i[1]))
            nextX++
        }

        const text = new PIXI.Text(`=${time}s>`)
        text.style.fontSize = 13
        text.style.fontWeight = 'bold'
        text.style.fill = G.UIColors.text
        text.anchor.set(0.5, 0.5)
        text.x = nextX++ * 36
        this.recipeVisualization.addChild(text)

        for (const r of results) {
            const s = InventoryContainer.createIcon(factorioData.getItem(r[0]))
            s.x = nextX * 36
            this.recipeVisualization.addChild(s, createAmountText(r[1]))
            nextX++
        }

        function createAmountText(amount: string) {
            const text = new PIXI.Text(amount)
            text.style.fontSize = 13
            text.style.fontWeight = 'bold'
            text.style.fill = G.UIColors.text
            text.anchor.set(1, 1)
            text.position.set(nextX * 36 + 16, 16)
            return text
        }

        this.recipeVisualization.visible = true
    }
}
