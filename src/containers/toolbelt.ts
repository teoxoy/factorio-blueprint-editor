import G from '../globals'
import factorioData from '../factorio-data/factorioData'
import { InventoryContainer } from './inventory'

export class ToolbeltSlot extends PIXI.Container {

    public itemName: string

    private iWidth = 36
    private iHeight = 36

    private background: PIXI.Container
    private hoverEff: PIXI.Container
    private content: PIXI.Container

    constructor() {
        super()

        this.interactive = true
        this.buttonMode = true

        this.background = InventoryContainer.drawRect(this.iWidth, this.iHeight, G.colors.pannel.button.background, 1, 1, true)

        // Hover Effect
        this.hoverEff = InventoryContainer.drawRect(this.iWidth - 1, this.iHeight - 1, G.colors.pannel.button.rollover, 0, 0.5)
        this.hoverEff.visible = false

        this.on('pointerover', () => this.hoverEff.visible = true)
        this.on('pointerout', () => this.hoverEff.visible = false)

        this.addChild(this.background, this.hoverEff)
    }

    public assignItem(itemName: string) {
        let item = factorioData.getItem(itemName)
        if (!item) item = factorioData.getItem(factorioData.getTile(itemName).minable.result)
        this.itemName = item.name

        if (this.content) this.content.destroy()
        this.content = InventoryContainer.createIcon(item)
        this.content.position.set(this.iWidth / 2, this.iHeight / 2)
        this.addChild(this.content)
    }

    public unassignItem() {
        this.itemName = undefined
        this.content.destroy()
    }
}

export class ToolbeltContainer extends PIXI.Container {

    static createTriangleButton(width: number, height: number) {
        const button = new PIXI.Graphics()

        button
            .beginFill(G.colors.pannel.slot)
            .moveTo(0, height)
            .lineTo(width / 2, 0)
            .lineTo(width, height)
            .lineTo(0, height)
            .endFill()

        button.interactive = true

        button.on('pointerover', () => button.alpha = 0.8)
        button.on('pointerout', () => button.alpha = 1)

        return button
    }

    private iWidth = 442
    private iHeight: number
    private rows: number

    private slots: ToolbeltSlot[]
    private slotsContainer: PIXI.Container

    constructor(rows = 1, itemNames?: string[]) {
        super()

        this.rows = rows
        this.iHeight = 24 + rows * 38
        this.slots = new Array<ToolbeltSlot>(rows * 10)

        this.interactive = true
        this.interactiveChildren = true

        this.setPosition()
        window.addEventListener('resize', () => this.setPosition(), false)

        const background = InventoryContainer.drawRect(this.iWidth, this.iHeight, G.colors.pannel.background, 2, 0.7)
        this.addChild(background)

        // Hide paintContainer if the pointer is inside the ToolbeltContainer
        this.on('pointerover', () => { if (G.BPC.paintContainer) G.BPC.paintContainer.visible = false })
        this.on('pointerout',  () => { if (G.BPC.paintContainer) G.BPC.paintContainer.visible = true  })

        this.slotsContainer = new PIXI.Container()
        this.slotsContainer.position.set(12, 12)
        this.addChild(this.slotsContainer)

        this.generateSlots(itemNames)

        const t = ToolbeltContainer.createTriangleButton(15, 14)
        t.position.set((this.iWidth - t.width) / 2, (this.iHeight - t.height) / 2)
        t.on('pointerdown', () => this.changeActiveToolbelt())
        this.addChild(t)
    }

    generateSlots(itemNames?: string[]) {
        for (let r = 0; r < this.rows; r++) {
            for (let i = 0; i < 10; i++) {
                const toolbeltSlot = new ToolbeltSlot()
                toolbeltSlot.position.set(((36 + 2) * i) + (i > 4 ? 38 : 0), 38 * r)

                if (itemNames && itemNames[(r * 10) + i]) toolbeltSlot.assignItem(itemNames[(r * 10) + i])

                toolbeltSlot.on('pointerup', (e: PIXI.interaction.InteractionEvent) => {
                    // Use Case 1: Left Click  & Slot=Empty & Mouse=Painting >> Assign Mouse Item to Slot
                    // Use Case 2: Left Click  & Slot=Item  & Mouse=Painting >> Assign Slot Item to Mouse
                    // Use Case 3: Left Click  & Slot=Empty & Mouse=Empty    >> Do Nothing
                    // Use Case 4: Left Click  & Slot=Item  & Mouse=Empty    >> Assign Slot Item to Mouse
                    // Use Case 5: Right Click & Slot=*     & Mouse=*        >> Unassign Slot

                    // >> Left Click (UC1-UC4)
                    if (e.data.button === 0) {
                        // >> Mouse == Painting (UC1,UC2)
                        if (G.currentMouseState === G.mouseStates.PAINTING) {
                            // >> Slot == Empty (UC1)
                            if (!toolbeltSlot.itemName) toolbeltSlot.assignItem(G.BPC.paintContainer.name)
                            // >> Slot == Item (UC2)
                            else G.BPC.spawnEntityAtMouse(toolbeltSlot.itemName)
                        } else {
                            // >> Mouse == Empty (UC3,UC4)
                            if (toolbeltSlot.itemName) { // >> Slot == Item (UC4)
                                // Assign Slot Item to Mouse
                                G.BPC.spawnEntityAtMouse(toolbeltSlot.itemName)
                            }
                        }
                    // >> Right Click (UC5)
                    } else if (e.data.button === 2) {
                        toolbeltSlot.unassignItem()
                    }
                })

                this.slots[(r * 10) + i] = toolbeltSlot
                this.slotsContainer.addChild(toolbeltSlot)
            }
        }
    }

    public bindKeyToSlot(slot: number) {
        const itemName = this.slots[slot].itemName
        if (!itemName) return

        if (G.currentMouseState === G.mouseStates.PAINTING && G.BPC.paintContainer.name === itemName) {
            G.BPC.paintContainer.destroy()
            G.BPC.paintContainer = undefined
            G.currentMouseState = G.mouseStates.NONE
            return
        }

        G.BPC.spawnEntityAtMouse(itemName)
    }

    public changeActiveToolbelt() {
        this.slotsContainer.removeChildren()

        let itemNames = this.getAllItemNames()
        // Left shift array by 10
        itemNames = itemNames.concat(itemNames.splice(0, 10))
        this.generateSlots(itemNames)
    }

    public getAllItemNames() {
        return this.slots.map(s => s.itemName)
    }

    private setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.iWidth / 2,
            G.app.screen.height - this.iHeight
        )
    }
}
