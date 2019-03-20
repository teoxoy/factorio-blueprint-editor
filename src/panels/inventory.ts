import FD from 'factorio-data'
import * as PIXI from 'pixi.js'
import G from '../common/globals'
import F from '../controls/functions'
import Dialog from '../controls/dialog'
import Button from '../controls/button'

/** Inventory Dialog - Displayed to the user if there is a need to select an item */
export class InventoryContainer extends Dialog {
    /** Container for Inventory Group Buttons */
    private readonly m_InventoryGroups: PIXI.Container

    /** Container for Inventory Group Items */
    private readonly m_InventoryItems: PIXI.Container

    /** Text for Recipe Tooltip */
    private readonly m_RecipeLabel: PIXI.Text

    /** Container for Recipe Tooltip */
    private readonly m_RecipeContainer: PIXI.Container

    /** Hovered item for item pointerout check */
    private m_hoveredItem: string

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
    constructor(
        title: string = 'Inventory',
        itemsFilter?: string[],
        selectedCallBack?: (selectedItem: string) => void
    ) {
        super(404, 442, title)

        this.m_InventoryGroups = new PIXI.Container()
        this.m_InventoryGroups.position.set(12, 46)
        this.addChild(this.m_InventoryGroups)

        this.m_InventoryItems = new PIXI.Container()
        this.m_InventoryItems.position.set(12, 126)
        this.addChild(this.m_InventoryItems)

        let groupIndex = 0
        for (const group of FD.inventoryLayout) {
            // Make creative entities avalible only in the main inventory
            if (group.name === 'creative' && itemsFilter !== undefined) {
                continue
            }

            const inventoryGroupItems = new PIXI.Container()
            let itemColIndex = 0
            let itemRowIndex = 0

            for (const subgroup of group.subgroups) {
                let subgroupHasItems = false

                for (const item of subgroup.items) {
                    const itemData = FD.items[item.name]
                    if (itemsFilter === undefined) {
                        const resultPlaceable = itemData.place_result !== undefined
                        const entityFindable = resultPlaceable
                            ? FD.entities[itemData.place_result] !== undefined
                            : false
                        if (!entityFindable) {
                            const tilePlaceable =
                                itemData.place_as_tile !== undefined && itemData.place_as_tile.result !== undefined
                            const tileFindable = tilePlaceable
                                ? FD.tiles[itemData.place_as_tile.result] !== undefined ||
                                  itemData.place_as_tile.result === 'landfill'
                                : false
                            if (!tileFindable) {
                                continue
                            }
                        }
                    } else {
                        if (!itemsFilter.includes(item.name)) {
                            continue
                        }
                    }

                    // const tileResult = itemData.place_as_tile !== undefined && itemData.place_as_tile.result !== undefined
                    // const placeResult = itemData.place_result !== undefined || tileResult

                    // if ((itemsFilter === undefined && placeResult && (itemData.place_result !== undefined ||
                    //        itemData.place_as_tile !== undefined)) ||
                    //    (itemsFilter !== undefined && itemsFilter.includes(item.name))) {

                    if (itemColIndex === 10) {
                        itemColIndex = 0
                        itemRowIndex += 1
                    }

                    const button: Button = new Button(36, 36)
                    button.position.set(itemColIndex * 38, itemRowIndex * 38)
                    button.content = F.CreateIcon(item.name, false)
                    button.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                        e.stopPropagation()
                        if (e.data.button === 0) {
                            this.close()
                            selectedCallBack(item.name)
                        }
                    })
                    button.on('pointerover', () => {
                        this.m_hoveredItem = item.name
                        this.updateRecipeVisualization(item.name)
                    })
                    button.on('pointerout', () => {
                        // we have to check this because pointerout can fire after pointerover
                        if (this.m_hoveredItem === item.name) {
                            this.m_hoveredItem = undefined
                            this.updateRecipeVisualization(undefined)
                        }
                    })

                    inventoryGroupItems.addChild(button)

                    itemColIndex += 1
                    subgroupHasItems = true
                    // }
                }

                if (subgroupHasItems) {
                    itemRowIndex += 1
                    itemColIndex = 0
                }
            }

            if (inventoryGroupItems.children.length > 0) {
                inventoryGroupItems.visible = groupIndex === 0
                this.m_InventoryItems.addChild(inventoryGroupItems)

                const button = new Button(68, 68, 3)
                button.active = groupIndex === 0
                button.position.set(groupIndex * 70, 0)
                button.content = F.CreateIcon(group.name, false)
                button.data = inventoryGroupItems
                button.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    if (e.data.button === 0) {
                        if (!button.active) {
                            for (const inventoryGroup of this.m_InventoryGroups.children as Button[]) {
                                inventoryGroup.active = inventoryGroup === button
                            }
                        }
                        const buttonData: PIXI.Container = button.data as PIXI.Container
                        if (!buttonData.visible) {
                            for (const inventoryGroupItems of this.m_InventoryItems.children as PIXI.Container[]) {
                                inventoryGroupItems.visible = inventoryGroupItems === buttonData
                                inventoryGroupItems.interactiveChildren = inventoryGroupItems === buttonData
                            }
                        }
                    }
                })

                this.m_InventoryGroups.addChild(button)

                groupIndex += 1
            }
        }

        const recipePanel: PIXI.Container = new PIXI.Container()
        recipePanel.position.set(0, 442)
        this.addChild(recipePanel)

        const recipeBackground: PIXI.Graphics = F.DrawRectangle(
            404,
            78,
            G.colors.dialog.background.color,
            G.colors.dialog.background.alpha,
            G.colors.dialog.background.border
        )
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
        this.position.set(G.app.screen.width / 2 - this.width / 2, G.app.screen.height / 2 - 520 / 2)
    }

    /** Update recipe visulaization */
    private updateRecipeVisualization(recipeName?: string) {
        // Update Recipe Label
        this.m_RecipeLabel.text = undefined

        // Update Recipe Container
        this.m_RecipeContainer.removeChildren()

        const recipe = FD.recipes[recipeName]
        if (recipe === undefined) {
            // Creative entities don't have a recipe so we have to do it this way
            if (recipeName) {
                this.m_RecipeLabel.text = `[CREATIVE] - ${FD.items[recipeName].ui_name}`
            }
            return
        }

        this.m_RecipeLabel.text = recipe.ui_name

        F.CreateRecipe(this.m_RecipeContainer, 0, 0, recipe.ingredients, recipe.results, recipe.time)
    }
}
