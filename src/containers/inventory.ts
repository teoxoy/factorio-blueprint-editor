/// <reference path="../../node_modules/factorio-data/data/prototypes/inventoryLayout.js" />

import inventoryBundle from 'factorio-data/data/prototypes/inventoryLayout'
import factorioData from '../factorio-data/factorioData'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import util from '../util'
import G from '../globals'
import { EntityPaintContainer } from './entityPaint'
import { EntityContainer } from './entity'
import { TilePaintContainer } from './tilePaint'
import Dialog from '../controls/dialog'
import Button from '../controls/button'

/**
 * Inventory Dialog will be displayed to the user if there is a need to select an item
 */
export class InventoryContainer extends Dialog {

    /**
     * Create Icon from Sprite Item information
     * @param item - Item to create Sprite from
     * @param setAnchor - Temporar parameter to disable anchoring (this parameter may be removed again in the future)
     */
    static createIcon(item: any, setAnchor: boolean = true) {
        if (item.icon) {
            const icon = PIXI.Sprite.fromFrame(item.icon)
            if (setAnchor) icon.anchor.set(0.5, 0.5)
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
                if (setAnchor) sprite.anchor.set(0.5, 0.5)
                img.addChild(sprite)
            }
            return img
        }
    }

    recipeVisualization: PIXI.Container
    inventoryContents: PIXI.Container
    itemTooltip: PIXI.Text
    iconGutter = 36
    inventoryActiveGroup: Button
    inventoryGroup: Map<Button, PIXI.Container> = new Map()
    title: PIXI.Text

    /**
     *
     * Cols
     * Space @ 0+12                         ->12
     * Items @ 12+(10*(36+2))               ->392
     * Space @ 392+12                       ->404
     * Width : 12 + (10 * (36 + 2)) + 12,
     *
     * Rows
     * Space   @ 0+10                       ->10
     * Title   @ 10+24                      ->34
     * Space   @ 34+12                      ->46
     * Groups  @ 46+68                      ->114
     * Space   @ 114+12                     ->126
     * Items   @ 126+(8*(36+2))             ->430
     * Space   @ 430+12                     ->442
     * Tooltip @ 442+24                     ->466
     * Space   @ 466+12                     ->478
     * Recipe  @ 478+36                     ->514
     * Space   @ 514+12                     ->526
     * Height : 10 + 24 + 12 + 68 + 12 + (8 * (36 + 2)) + 12 + 24 + 12 + 36 + 12)
     */
    constructor() {
        super(
            /* Width  : */ 12 + (10 * (36 + 2)) + 12,
            /* Height : */ 10 + 24 + 12 + 68 + 12 + (8 * (36 + 2)) + 12 + 24 + 12 + 36 + 12)

        const title = new PIXI.Text('Inventory', {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily,
            fontWeight: '500',
            fontSize: 20
        })
        title.position.set(12, 10)
        this.title = title
        this.addChild(title)

        this.inventoryContents = new PIXI.Container()
        this.inventoryContents.position.set(12, 46)
        this.addChild(this.inventoryContents)

        this.itemTooltip = new PIXI.Text('', {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily,
            fontWeight: '500',
            fontSize: 20
        })
        this.itemTooltip.position.set(12, 442)
        this.addChild(this.itemTooltip)

        this.recipeVisualization = new PIXI.Container()
        this.recipeVisualization.position.set(28, 478 + 16)
        this.addChild(this.recipeVisualization)
    }

    create(title?: string, filteredItems?: string[], cb?: (name: string) => void) {
        this.title.text = title ? title : 'Inventory'

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
                    const itemData = factorioData.getItem(item.name)
                    const tileResult = itemData.place_as_tile && itemData.place_as_tile.result
                    const placeResult = itemData.place_result || tileResult
                    if ((!filteredItems && placeResult && (factorioData.getEntity(placeResult) || factorioData.getTile(placeResult))) ||
                        filteredItems && filteredItems.includes(item.name)
                    ) {
                        const img: Button = new Button(36, 36)
                        img.content = InventoryContainer.createIcon(item, false)

                        if (nextK > 9) {
                            nextJ++
                            nextK = 0
                        }

                        img.x = nextK * (this.iconGutter + 2)
                        img.y = 80 + nextJ * (this.iconGutter + 2)

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

                                    if (G.BPC.paintContainer) G.BPC.paintContainer.destroy()

                                    const newPosition = e.data.getLocalPosition(G.BPC)

                                    if (tileResult) {
                                        G.BPC.paintContainer = new TilePaintContainer(
                                            placeResult,
                                            EntityContainer.getPositionFromData(
                                                newPosition,
                                                { x: TilePaintContainer.size, y: TilePaintContainer.size }
                                            )
                                        )
                                        G.BPC.tiles.addChild(G.BPC.paintContainer)
                                    } else {
                                        G.BPC.paintContainer = new EntityPaintContainer(
                                            placeResult,
                                            0,
                                            EntityContainer.getPositionFromData(
                                                newPosition,
                                                util.switchSizeBasedOnDirection(factorioData.getEntity(placeResult).size, 0)
                                            )
                                        )
                                        G.BPC.addChild(G.BPC.paintContainer)
                                    }

                                    this.close()
                                }
                            })
                        }
                        img.on('pointerover', () => {
                            this.itemTooltip.text = item.name.split('_').map((s: any) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
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
                const img = new Button(68, 68, 3)
                img.content = InventoryContainer.createIcon(inventoryBundle[i], false)
                img.x = nextI * 70
                img.y = 0
                img.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    if (e.data.button === 0) {
                        if (img !== this.inventoryActiveGroup) {
                            this.inventoryGroup.get(this.inventoryActiveGroup).visible = false
                            this.inventoryActiveGroup.active = false
                            this.inventoryActiveGroup = img
                            this.inventoryGroup.get(img).visible = true
                            this.inventoryActiveGroup.active = true
                        }
                    }
                })

                if (nextI === 0) {
                    this.inventoryActiveGroup = img
                    this.inventoryActiveGroup.active = true
                } else {
                    grObj.visible = false
                }

                this.inventoryGroup.set(img, grObj)
                this.inventoryContents.addChild(img, grObj)

                nextI++
                groupHasItem = false
            }
        }
    }

    toggle(title?: string, filteredItems?: string[], cb?: (name: string) => void) {
        if (!this.visible) {
            if (G.editEntityContainer.active) G.editEntityContainer.visible = false
            this.create(title, filteredItems, cb)
            this.visible = true
            G.openedGUIWindow = this
        } else {
            this.close()
        }
    }

    close() {
        this.visible = false
        if (G.editEntityContainer.active) {
            G.openedGUIWindow = G.editEntityContainer
            G.editEntityContainer.visible = true
        } else {
            G.openedGUIWindow = undefined
        }
    }

    createRecipeVisualization(recipeName: string) {
        const RECIPE = factorioData.getRecipe(recipeName)
        if (!RECIPE) return
        this.recipeVisualization.removeChildren()

        const recipe = RECIPE.normal ? RECIPE.normal : RECIPE
        // TODO: maybe normalize the recipeBundle trough script and not here at runtime
        const time = (recipe.energy_required !== undefined ? recipe.energy_required : RECIPE.energy_required) || 0.5
        const ingredients = recipe.ingredients.map((o: any) => o instanceof Array ? o : [o.name, o.amount])
        const results = recipe.result ? [[recipe.result, recipe.result_count || 1]] :
            recipe.results.map((o: any) => [o.name, o.probability ? o.probability * o.amount : o.amount])

        let nextX = 0
        for (const i of ingredients) {
            const s = InventoryContainer.createIcon(factorioData.getItem(i[0]))
            s.x = nextX * 36
            this.recipeVisualization.addChild(s, createAmountText(i[1]))
            nextX++
        }

        const text = new PIXI.Text(`=${time}s>`, {
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily,
            fontWeight: '500',
            fontSize: 13
        })
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
            const text = new PIXI.Text(amount, {
                fill: G.colors.text.normal,
                fontFamily: G.fontFamily,
                fontWeight: '500',
                fontSize: 13
            })
            text.anchor.set(1, 1)
            text.position.set(nextX * 36 + 16, 16)
            return text
        }

        this.recipeVisualization.visible = true
    }
}
