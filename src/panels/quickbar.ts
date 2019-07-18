import * as PIXI from 'pixi.js'
import G from '../common/globals'
import Panel from '../controls/panel'
import Slot from '../controls/slot'
import F from '../controls/functions'
import { EditorMode } from '../containers/blueprint'
import { InventoryContainer } from './inventory'

class QuickbarSlot extends Slot {
    public get itemName(): string {
        return this.data as string
    }

    public assignItem(itemName: string): void {
        this.data = itemName
        this.content = F.CreateIcon(itemName, false)
    }

    public unassignItem(): void {
        this.data = undefined
        this.content = undefined
    }
}

export class QuickbarContainer extends Panel {
    private static createTriangleButton(width: number, height: number): PIXI.Graphics {
        const button = new PIXI.Graphics()

        button
            .beginFill(G.colors.controls.button.background.color)
            .moveTo(0, height)
            .lineTo(width / 2, 0)
            .lineTo(width, height)
            .lineTo(0, height)
            .endFill()

        button.interactive = true

        button.on('pointerover', () => {
            button.alpha = 0.8
        })
        button.on('pointerout', () => {
            button.alpha = 1
        })

        return button
    }

    private iWidth = 442
    private iHeight: number
    private rows: number

    private slots: QuickbarSlot[]
    private slotsContainer: PIXI.Container

    public constructor(rows = 1, itemNames?: string[]) {
        super(
            442,
            24 + rows * 38,
            G.colors.quickbar.background.color,
            G.colors.quickbar.background.alpha,
            G.colors.quickbar.background.border
        )

        this.rows = rows
        this.iHeight = 24 + rows * 38
        this.slots = new Array<QuickbarSlot>(rows * 10)

        this.slotsContainer = new PIXI.Container()
        this.slotsContainer.position.set(12, 12)
        this.addChild(this.slotsContainer)

        this.generateSlots(itemNames)

        const t = QuickbarContainer.createTriangleButton(15, 14)
        t.position.set((this.iWidth - t.width) / 2, (this.iHeight - t.height) / 2)
        t.on('pointerdown', () => this.changeActiveQuickbar())
        this.addChild(t)
    }

    public generateSlots(itemNames?: string[]): void {
        for (let r = 0; r < this.rows; r++) {
            for (let i = 0; i < 10; i++) {
                const quickbarSlot = new QuickbarSlot()
                quickbarSlot.position.set((36 + 2) * i + (i > 4 ? 38 : 0), 38 * r)

                if (itemNames && itemNames[r * 10 + i]) {
                    quickbarSlot.assignItem(itemNames[r * 10 + i])
                }

                quickbarSlot.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
                    // Use Case 1: Left Click  & Slot=Empty & Mouse=Painting >> Assign Mouse Item to Slot
                    // Use Case 2: Left Click  & Slot=Item  & Mouse=Painting >> Assign Slot Item to Mouse
                    // Use Case 3: Left Click  & Slot=Empty & Mouse=Empty    >> Assign Slot Item to Selected Inv item
                    // Use Case 4: Left Click  & Slot=Item  & Mouse=Empty    >> Assign Slot Item to Mouse
                    // Use Case 5: Right Click & Slot=*     & Mouse=*        >> Unassign Slot

                    if (e.data.button === 0) {
                        if (G.BPC.mode === EditorMode.PAINT) {
                            if (quickbarSlot.itemName) {
                                // UC2
                                G.BPC.spawnPaintContainer(quickbarSlot.itemName)
                            } else {
                                // UC1
                                quickbarSlot.assignItem(G.BPC.paintContainer.getItemName())
                            }
                        } else if (quickbarSlot.itemName) {
                            // UC4
                            G.BPC.spawnPaintContainer(quickbarSlot.itemName)
                        } else {
                            // UC3
                            new InventoryContainer('Inventory', undefined, item => quickbarSlot.assignItem(item))
                        }
                    } else if (e.data.button === 2) {
                        // UC5
                        quickbarSlot.unassignItem()
                    }
                })

                this.slots[r * 10 + i] = quickbarSlot
                this.slotsContainer.addChild(quickbarSlot)
            }
        }
    }

    public bindKeyToSlot(slot: number): void {
        const itemName = this.slots[slot].itemName
        if (!itemName) {
            return
        }

        if (G.BPC.mode === EditorMode.PAINT && G.BPC.paintContainer.getItemName() === itemName) {
            G.BPC.paintContainer.destroy()
            return
        }

        G.BPC.spawnPaintContainer(itemName)
    }

    public changeActiveQuickbar(): void {
        this.slotsContainer.removeChildren()

        let itemNames = this.getAllItemNames()
        // Left shift array by 10
        itemNames = itemNames.concat(itemNames.splice(0, 10))
        this.generateSlots(itemNames)
    }

    public getAllItemNames(): string[] {
        return this.slots.map(s => s.itemName)
    }

    protected setPosition(): void {
        this.position.set(G.app.screen.width / 2 - this.width / 2, G.app.screen.height - this.height + 1)
    }
}
