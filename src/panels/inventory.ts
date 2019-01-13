/// <reference path="../../node_modules/factorio-data/data/prototypes/inventoryLayout.js" />

import inventoryBundle from 'factorio-data/data/prototypes/inventoryLayout'
import factorioData from '../factorio-data/factorioData'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import G from '../common/globals'
import F from '../controls/functions'
import Dialog from '../controls/dialog'
import Button from '../controls/button'
import { IInventoryGroup, IRecipe, IRecipeNormal } from '../interfaces/iFactorioData'

// TODO: Optimize showing recipe when hovering with mouse over button
// TODO: Move methods createIcon() and createIconWithAmount() to common functions class

/** Inventory Dialog - Displayed to the user if there is a need to select an item */
export class InventoryContainer extends Dialog {

    /**
     * Create Icon from Sprite Item information
     * @param item - Item to create Sprite from
     * @param setAnchor - Temporar parameter to disable anchoring (this parameter may be removed again in the future)
     */
    static createIcon(itemName: string, setAnchor: boolean = true): PIXI.DisplayObject {
        let item = factorioData.getItem(itemName)
        // only needed for inventory group icon
        if (!item) item = inventoryBundle.find(g => g.name === itemName)

        if (item.icon !== undefined) {
            const icon = PIXI.Sprite.fromFrame(item.icon)
            if (setAnchor) icon.anchor.set(0.5, 0.5)
            return icon
        }
        if (item.icons !== undefined) {
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

    /**
     * Creates an icon with amount on host at coordinates
     * @param host - PIXI.Container on top of which the icon shall be created
     * @param x - Horizontal position of icon from top left corner
     * @param y - Vertical position of icon from top left corner
     * @param name - Name if item
     * @param amount - Amount to show
     */
    private static createIconWithAmount(host: PIXI.Container, x: number, y: number, name: string, amount: string) {
        const icon: PIXI.DisplayObject = InventoryContainer.createIcon(name, false)
        icon.position.set(x, y)
        host.addChild(icon)

        const size: PIXI.TextMetrics = PIXI.TextMetrics.measureText(amount, G.styles.icon.amount)
        const text = new PIXI.Text(amount, G.styles.icon.amount)
        text.position.set(x + 33 - size.width, y + 33 - size.height)
        host.addChild(text)
    }

    /** Container for Inventory Group Buttons */
    private readonly m_InventoryGroups: PIXI.Container

    /** Container for Inventory Group Items */
    private readonly m_InventoryItems: PIXI.Container

    /** Text for Recipe Tooltip */
    private readonly m_RecipeLabel: PIXI.Text

    /** Container for Recipe Tooltip */
    private readonly m_RecipeContainer: PIXI.Container

    /**
     *
     * Cols
     * Space   @ 0     +12              ->12
     * Items   @ 12    +(10*(36+2))     ->392
     * Space   @ 392   +12              ->404
     * Width : 12 + (10 * (36 + 2)) + 12 = 404
     *
     * Rows
     * Space   @ 0   +10                ->10
     * Title   @ 10  +24                ->34
     * Space   @ 34  +12                ->46
     * Groups  @ 46  +68                ->114
     * Space   @ 114 +12                ->126
     * Items   @ 126 +(8*(36+2))        ->430
     * Space   @ 430 +12                ->442
     * Height : 10 + 24 + 12 + 68 + 12 + (8*(36+2)) + 12 = 442
     *
     * Space   @ 0   +10                ->10
     * R.Label @ 10  +16                ->26
     * Space   @ 26  +10                ->36
     * R.Data  @ 36  +36                ->72
     * Space   @ 8   +8                 ->78
     * Height : 10 + 16 + 10 + 36 + 8 = 78
     */
    constructor(title: string = 'Inventory', itemsFilter?: string[], selectedCallBack?: (selectedItem: string) => void) {
        super(404, 442, Dialog.capitalize(title))

        this.on('pointerover', () => { if (G.BPC.paintContainer !== undefined) G.BPC.paintContainer.hide() })
        this.on('pointerout',  () => { if (G.BPC.paintContainer !== undefined) G.BPC.paintContainer.show() })

        this.m_InventoryGroups = new PIXI.Container()
        this.m_InventoryGroups.position.set(12, 46)
        this.addChild(this.m_InventoryGroups)

        this.m_InventoryItems = new PIXI.Container()
        this.m_InventoryItems.position.set(12, 126)
        this.addChild(this.m_InventoryItems)

        let groupIndex = 0
        for (const group of inventoryBundle as unknown as IInventoryGroup[]) {

            const inventoryGroupItems = new PIXI.Container()
            let itemColIndex = 0
            let itemRowIndex = 0

            for (const subgroup of group.subgroups) {

                let subgroupHasItems = false

                for (const item of subgroup.items) {

                    const itemData = factorioData.getItem(item.name)
                    if ((itemsFilter === undefined && (itemData.place_result !== undefined || itemData.place_as_tile !== undefined)) ||
                        (itemsFilter !== undefined && itemsFilter.includes(item.name))) {

                        if (itemColIndex === 10) {
                            itemColIndex = 0
                            itemRowIndex++
                        }

                        const button: Button = new Button(36, 36)
                        button.position.set(itemColIndex * 38, itemRowIndex * 38)
                        button.content = InventoryContainer.createIcon(item.name, false)
                        button.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                            if (e.data.button === 0) {
                                selectedCallBack(item.name)
                            }
                        })
                        button.on('pointerover', () => {
                            this.updateRecipeVisualization(item.name)
                        })
                        button.on('pointerout', () => {
                            this.updateRecipeVisualization(undefined)
                        })

                        inventoryGroupItems.addChild(button)

                        itemColIndex++
                        subgroupHasItems = true
                    }
                }

                if (subgroupHasItems) {
                    itemRowIndex++
                    itemColIndex = 0
                }
            }

            if (inventoryGroupItems.children.length > 0) {

                inventoryGroupItems.visible = groupIndex === 0
                this.m_InventoryItems.addChild(inventoryGroupItems)

                const button = new Button(68, 68, 3)
                button.active = groupIndex === 0
                button.position.set(groupIndex * 70, 0)
                button.content = InventoryContainer.createIcon(group.name, false)
                button.data = inventoryGroupItems
                button.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    if (e.data.button === 0) {
                        if (!button.active) {
                            for (const inventoryGroup of this.m_InventoryGroups.children) {
                                (inventoryGroup as Button).active = inventoryGroup === button
                            }
                        }
                        const buttonData: PIXI.Container = button.data as PIXI.Container
                        if (!buttonData.visible) {
                            for (const inventoryGroupItems of this.m_InventoryItems.children) {
                                inventoryGroupItems.visible = inventoryGroupItems === buttonData
                                inventoryGroupItems.interactiveChildren = inventoryGroupItems === buttonData
                            }
                        }
                    }
                })

                this.m_InventoryGroups.addChild(button)

                groupIndex++
            }
        }

        const recipePanel: PIXI.Container = new PIXI.Container()
        recipePanel.position.set(0, 442)
        this.addChild(recipePanel)

        const recipeBackground: PIXI.Graphics = F.DrawRectangle(404, 78,
            G.colors.dialog.background.color,
            G.colors.dialog.background.alpha,
            G.colors.dialog.background.border)
        recipeBackground.position.set(0, 0)
        recipePanel.addChild(recipeBackground)

        this.m_RecipeLabel = new PIXI.Text('', G.styles.dialog.label)
        this.m_RecipeLabel.position.set(12, 10)
        recipePanel.addChild(this.m_RecipeLabel)

        this.m_RecipeContainer = new PIXI.Container()
        this.m_RecipeContainer.position.set(12, 36)
        recipePanel.addChild(this.m_RecipeContainer)
    }

    /** Override automatically set position of dialog due to additional area for recipe */
    setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height / 2 - 520 / 2
        )
    }

    /** Update recipe visulaization */
    private updateRecipeVisualization(recipeName?: string) {

        // Update Recipe Label
        this.m_RecipeLabel.text = recipeName === undefined ? undefined : Dialog.capitalize(recipeName)

        // Update Recipe Container
        this.m_RecipeContainer.removeChildren()

        const recipe: IRecipe = factorioData.getRecipe(recipeName)
        if (recipe === undefined) {
            return
        }

        const normal: IRecipeNormal = Object.keys(recipe).includes('normal') ? recipe.normal : undefined

        const ingredientsObject = Object.keys(recipe).includes('ingredients') ? recipe.ingredients :
            (normal === undefined ? undefined :
                (Object.keys(recipe.normal).includes('ingredients') ? recipe.normal.ingredients : undefined))
        if (ingredientsObject === undefined) {
            return
        }

        /* tslint:disable-next-line */ // This needs to be looked at in teh recipeBundle
        const ingredients: Map<string, Number> = ingredientsObject.map((o: any) => o instanceof Array ? o : [ o.name, o.amount ])

        let nextX = 0
        for (const ingredient of ingredients) {
            InventoryContainer.createIconWithAmount(this.m_RecipeContainer, nextX, 0, ingredient[0], ingredient[1].toString())
            nextX += 36
        }

        const time = Object.keys(recipe).includes('energy_required') ? recipe.energy_required :
        (normal === undefined ? (0.5) :
            (Object.keys(recipe.normal).includes('energy_required') ? recipe.normal.energy_required : (0.5)))

        nextX += 2
        const timeText = `=${time}s>`
        const timeSize: PIXI.TextMetrics = PIXI.TextMetrics.measureText(timeText, G.styles.dialog.label)
        const timeObject: PIXI.Text = new PIXI.Text(`=${time}s>`, G.styles.dialog.label)
        timeObject.position.set(nextX, 6)
        this.m_RecipeContainer.addChild(timeObject)
        nextX += timeSize.width + 6

        const resultcount = Object.keys(recipe).includes('result_count') ? recipe.result_count :
            (normal === undefined ? 1 :
                (Object.keys(recipe.normal).includes('result_count') ? recipe.normal.result_count : 1))

        InventoryContainer.createIconWithAmount(this.m_RecipeContainer, nextX, 0, recipeName, resultcount.toString())
    }
}
