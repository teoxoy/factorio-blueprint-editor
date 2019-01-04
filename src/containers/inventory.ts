/// <reference path="../../node_modules/factorio-data/data/prototypes/inventoryLayout.js" />

import inventoryBundle from 'factorio-data/data/prototypes/inventoryLayout'
import factorioData from '../factorio-data/factorioData'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import util from '../util'
import G from '../globals'
import { EntityPaintContainer } from './entityPaint'
import { EntityContainer } from './entity'
import { TilePaintContainer } from './tilePaint'

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

    // Pattern/Solution from https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
    static shadeColor(color: number, percent: number): number {
        const amt = Math.round(2.55 * percent)
        const R = (color >> 16) + amt
        const G = (color >> 8 & 0x00FF) + amt
        const B = (color & 0x0000FF) + amt
        // tslint:disable-next-line:whitespace
        return 0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)
    }

    static drawRect(width: number, height: number, background: number, border = 1, alpha = 1, active = false): PIXI.Graphics {
        const rectangle = new PIXI.Graphics()
        rectangle.beginFill(background, alpha)
        if (border === 0) {
            rectangle.drawRect(0, 0, width, height)
        } else {
            if (border > 0) {
                rectangle.lineStyle(1, InventoryContainer.shadeColor(background, active ? -20 : 20))
                    .moveTo(0, height - 1)
                    .lineTo(0, 0)
                    .lineTo(width - 1, 0)
                    .lineStyle(1, InventoryContainer.shadeColor(background, active ? 20 : -15))
                    .lineTo(width - 1, height - 1)
                    .lineTo(0, height - 1)
            }
            if (border > 1) {
                rectangle.lineStyle(1, InventoryContainer.shadeColor(background, active ? -10 : 10))
                    .moveTo(1, height - 2)
                    .lineTo(1, 1)
                    .lineTo(width - 2, 1)
                    .lineStyle(1, InventoryContainer.shadeColor(background, active ? 10 : -10))
                    .lineTo(width - 2, height - 2)
                    .lineTo(1, height - 2)
            }
            if (border > 2) {
                rectangle.lineStyle(1, InventoryContainer.shadeColor(background, active ? -5 : 5))
                    .moveTo(2, height - 3)
                    .lineTo(2, 2)
                    .lineTo(width - 3, 2)
                    .lineStyle(1, InventoryContainer.shadeColor(background, active ? 5 : -5))
                    .lineTo(width - 3, height - 3)
                    .lineTo(2, height - 3)
            }
        }
        rectangle.endFill()

        return rectangle
    }

    static drawButton(width: number, height: number, item: any, group: boolean = false): PIXI.Container {
        const button = new PIXI.Container()

        const back = InventoryContainer.drawRect(width, height, G.colors.pannel.button.background, group ? 3 : 1)

        const active = InventoryContainer.drawRect(width, height, G.colors.pannel.button.active, group ? 3 : 1, 1, true)
        active.name = 'active'
        active.visible = false

        const over = InventoryContainer.drawRect(width - 1, height - 1, G.colors.pannel.button.active, 0, 0.6)
        over.visible = false

        const icon = InventoryContainer.createIcon(item)
        icon.position.set(width / 2, height / 2)

        button.addChild(back, active, over, icon)

        button.on('pointerover', () => {
            if (!active.visible) over.visible = true
        })
        button.on('pointerout', () => {
            over.visible = false
        })

        return button
    }

    recipeVisualization: PIXI.Container
    inventoryContents: PIXI.Container
    itemTooltip: PIXI.Text
    iconGutter = 36
    inventoryActiveGroup: PIXI.Container
    inventoryGroup: Map<PIXI.Container, PIXI.Container> = new Map()
    title: PIXI.Text

    // Cols
    // Space @ 0+12                         ->12
    // Items @ 12+(10*(36+2))456            ->392
    // Space @ 392+12                       ->404
    iWidth = 12 + (10 * (36 + 2)) + 12

    // Rows
    // Space   @ 0+10                       ->10
    // Title   @ 10+24                      ->34
    // Space   @ 34+12                      ->46
    // Groups  @ 46+68                      ->114
    // Space   @ 114+12                     ->126
    // Items   @ (46+80)126+(8*(36+2))304   ->430
    // Space   @ 430+12                     ->442
    // Tooltip @ 442+24                     ->466
    // Space   @ 466+12                     ->478
    // Recipe  @ 478+36                     ->514
    // Space   @ 514+12                     ->526
    iHeight = 10 + 24 + 12 + 68 + 12 + (8 * (36 + 2)) + 12 + 24 + 12 + 36 + 12

    constructor() {
        super()

        this.visible = false
        this.interactive = true

        this.setPosition()
        window.addEventListener('resize', () => this.setPosition(), false)

        const background = InventoryContainer.drawRect(this.iWidth, this.iHeight, G.colors.pannel.background, 2, 0.7)
        this.addChild(background)

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

    setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.iWidth / 2,
            G.app.screen.height / 2 - this.iHeight / 2
        )
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
                        const img = InventoryContainer.drawButton(this.iconGutter, this.iconGutter, item)

                        if (nextK > 9) {
                            nextJ++
                            nextK = 0
                        }

                        img.x = nextK * (this.iconGutter + 2)
                        img.y = 80 + nextJ * (this.iconGutter + 2)
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
                const img = InventoryContainer.drawButton(68, 68, inventoryBundle[i], true)
                img.x = nextI * 70
                img.y = 0
                img.interactive = true
                img.buttonMode = true
                img.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    if (e.data.button === 0) {
                        if (img !== this.inventoryActiveGroup) {
                            this.inventoryGroup.get(this.inventoryActiveGroup).visible = false
                            this.inventoryActiveGroup.getChildByName('active').visible = false
                            this.inventoryActiveGroup = img
                            this.inventoryGroup.get(img).visible = true
                            this.inventoryActiveGroup.getChildByName('active').visible = true
                        }
                    }
                })

                if (nextI === 0) {
                    this.inventoryActiveGroup = img
                    this.inventoryActiveGroup.getChildByName('active').visible = true
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
