import G from '../globals'
import util from '../util'
import factorioData from '../factorio-data/factorioData'
import { InventoryContainer } from './inventory'
import { EntityContainer } from './entity'
import { TilePaintContainer } from './tilePaint'
import { EntityPaintContainer } from './entityPaint'

// TODO: Evaluate whether this should be actually a control (nothing different much - just move it to a folder for controls)
export class RecipeButton extends PIXI.Container {

    private iWidth = 36
    private iHeight = 36

    private background: PIXI.Container
    private rollover: PIXI.Container
    private content: PIXI.Container

    public data: any = undefined

    constructor() {
        super()

        this.interactive = true
        this.buttonMode = true

        // Create Background
        this.background = InventoryContainer.drawRect(this.iWidth, this.iHeight, G.colors.pannel.button.background, 1, 1, true)

        // Create Rollover
        this.rollover = InventoryContainer.drawRect(this.iWidth - 1, this.iHeight - 1, G.colors.pannel.button.rollover, 0, 0.5)
        this.rollover.visible = false

        // Add objects
        this.addChild(this.background, this.rollover)

        // Enable Rollover
        this.on('pointerover', () => {
            this.rollover.visible = true
        })
        this.on('pointerout', () => {
            this.rollover.visible = false
        })
    }

    public setContent(content: PIXI.Container) {
        if (this.content != null)
        {
            this.removeChild(this.content)
            this.content.destroy()
            this.content = undefined
        }

        this.content = content;

        if (content != undefined) {
            this.content.position.set(this.iWidth / 2, this.iHeight / 2)
            this.addChild(this.content)
        }
    }
}

export class ToolbeltContainer extends PIXI.Container {

    // Container to host controls (common pattern)
    private content: PIXI.Container

    // Initialize Array with 20 slots in case user wants to have 2 rows
    private buttons: Array<RecipeButton> = new Array<RecipeButton>(20) 

    // Rows of Toolbelt
    private iRows = 1

    // Width of Toolbelt
    private iWidth = 439
    
    // Height of Toolbelt with 1 row of items: 60
    // Height of Toolbelt with 2 rows of items: 98
    private iHeight = 60

    constructor() {
        super()

        this.interactive = true
        this.interactiveChildren = true

        this.setPosition()
        window.addEventListener('resize', () => this.setPosition(), false)

        const background = InventoryContainer.drawRect(this.iWidth, this.iHeight, G.colors.pannel.background, 2, 0.7)
        this.addChild(background)

        // Handle Blueprint Painting
        this.on('pointerover', () => {
            if (G.BPC.paintContainer != null && G.BPC.paintContainer != undefined) G.BPC.paintContainer.visible = false
        })
        this.on('pointerout', () => {
            if (G.BPC.paintContainer != null && G.BPC.paintContainer != undefined) G.BPC.paintContainer.visible = true
        })

        // Create Content
        this.content = new PIXI.Container()
        this.content.position.set(12, 12);
        this.addChild(this.content)

        // Create Buttons (While maybe only 10 buttons will be shown, all buttons are created immediatly)
        for (let r = 0; r < 2; r++) {
            for (let i = 0; i < 10; i++ ) {
                let button = new RecipeButton();
                button.visible = false
                button.position.set(((36 + 2) * i) + (i > 4 ? 37 : 0), 38 * r)
                button.on('pointerup', (e: PIXI.interaction.InteractionEvent) => {
                    // Use Case 1: Left Click  & Slot=Empty & Mouse=Painting >> Assign Mouse Item to Slot
                    // Use Case 2: Left Click  & Slot=Item  & Mouse=Painting >> Assign Slot Item to Mouse
                    // Use Case 3: Left Click  & Slot=Empty & Mouse=Empty    >> Do Nothing
                    // Use Case 4: Left Click  & Slot=Item  & Mouse=Empty    >> Assign Slot Item to Mouse
                    // Use Case 5: Right Click & Slot=*     & Mouse=*        >> Unassign Slot
                    switch (e.data.button) {
                        case 0: { // >> Left Click (UC1-UC4)
                            // TODO: Implement correct way to check if the paintContainer contains an item
                            if (G.currentMouseState == G.mouseStates.PAINTING && G.BPC.paintContainer != null && G.BPC.paintContainer != undefined) { // >> Mouse == Painting (UC1,UC2)
                                if (button.data == undefined) { // >> Slot == Empty (UC1)
                                    // Assign Mouse Item to Slot
                                    button.data = factorioData.getItem(G.BPC.paintContainer.name)
                                    button.setContent(InventoryContainer.createIcon(button.data))
                                }
                                else { // >> Slot == Item (UC2)
                                    // Assign Slot Item to Mouse
                                    this.assignItemToMouse(button.data, e.data.getLocalPosition(G.BPC))
                                }
                            } else { // >> Mouse == Empty (UC3,UC4)
                                if (button.data != null && button.data != undefined) { // >> Slot == Item (UC4)
                                    // Assign Slot Item to Mouse
                                    this.assignItemToMouse(button.data, e.data.getLocalPosition(G.BPC))
                                }
                            }
                            break
                        }
                        case 2: { // >> Right Click (UC5)
                            // Unassign Slot
                            button.data = undefined
                            button.setContent(undefined)
                            break
                        }
                    }
                })

                this.buttons[(r * 10) + i] = button
                this.content.addChild(button);
            }
        }

        // Show Buttons
        this.setButtons()
    }

    // TODO: Integrate changing the # of rows into the settings ... which would call this function
    public setRows(rows: number) {
        // Check which number was provided and verify that it is different from current setup
        if (rows == 1 && this.iRows != 1) {
            this.iRows = 1
            this.iHeight = 60
        } else if (rows == 2 && this.iRows != 2) {
            this.iRows = 2
            this.iHeight = 98
        } else {
            return // Incorrect number of rows was provided ... we don't want to update UI
        }

        // Update UI
        this.setPosition()
        this.setButtons()
    }

    public setSlot(slot: number)
    {
        if (slot < 0 || slot > 9) return
        let item: any = this.buttons[slot].data
        if (item != undefined) this.assignItemToMouse(item, G.app.renderer.plugins.interaction.mouse.global)
    }

    private setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.iWidth / 2,
            G.app.screen.height - this.iHeight
        )
    }

    private setButtons()
    {
        for (let i = 0; i < 20; i++) {
            if (i < this.iRows * 10) this.buttons[i].visible = true
        }
    }

    // The following code is extracted from inventory.ts (more or less copy / paste)
    // TODO: Check whether this method could be actually moved to "BlueprintContainer"
    private assignItemToMouse(item: any, position: PIXI.Point) {
        const tileResult = item.place_as_tile && item.place_as_tile.result
        const placeResult = item.place_result || tileResult

        G.currentMouseState = G.mouseStates.PAINTING
        if (G.BPC.paintContainer) G.BPC.paintContainer.destroy()

        if (tileResult) {
            G.BPC.paintContainer = new TilePaintContainer(
                placeResult,
                EntityContainer.getPositionFromData(
                    position,
                    { x: TilePaintContainer.size, y: TilePaintContainer.size }
                )
            )
            G.BPC.tiles.addChild(G.BPC.paintContainer)
        } else {
            G.BPC.paintContainer = new EntityPaintContainer(
                placeResult,
                0,
                EntityContainer.getPositionFromData(
                    position,
                    util.switchSizeBasedOnDirection(factorioData.getEntity(placeResult).size, 0)
                )
            )
            G.BPC.paintContainer.moveAtCursor()
            G.BPC.addChild(G.BPC.paintContainer)
        }
    }
}
