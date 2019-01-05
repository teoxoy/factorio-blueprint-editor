import G from '../globals'
import util from '../util'
import factorioData from '../factorio-data/factorioData'
import { InventoryContainer } from './inventory'
import { EntityContainer } from './entity'
import { TilePaintContainer } from './tilePaint'
import { EntityPaintContainer } from './entityPaint'
import Panel from '../controls/panel'
import Slot from '../controls/slot'

/** Toolbelt */
export class ToolbeltContainer extends Panel {

    /** The following code is extracted from inventory.ts (more or less copy / paste) */
    private static assignItemToMouse(item: any, position: PIXI.Point) {
        // TODO: Check whether this method could be actually moved to "BlueprintContainer"
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

    /** Container to host controls (common pattern) */
    private readonly content: PIXI.Container

    /** Initialize Array with 10 slots */
    private readonly buttons: Slot[] = new Array<Slot>(10)

    // Width of Toolbelt: 439
    // Height of Toolbelt with 1 row of items: 60
    // Height of Toolbelt with 2 rows of items: 98
    constructor() {
        super(439, 60)

        // Handle Blueprint Painting
        this.on('pointerover', () => {
            if (G.BPC.paintContainer !== undefined) G.BPC.paintContainer.visible = false
        })
        this.on('pointerout', () => {
            if (G.BPC.paintContainer !== undefined) G.BPC.paintContainer.visible = true
        })

        // Create Content
        this.content = new PIXI.Container()
        this.content.position.set(12, 12)
        this.addChild(this.content)

        // Create Buttons (While maybe only 10 buttons will be shown, all buttons are created immediatly)
        for (let i = 0; i < 10; i++) {
            const button = new Slot(36, 36, 1)
            button.position.set(((36 + 2) * i) + (i > 4 ? 37 : 0), 0)
            button.on('pointerup', (e: PIXI.interaction.InteractionEvent) => {
                // Use Case 1: Left Click  & Slot=Empty & Mouse=Painting >> Assign Mouse Item to Slot
                // Use Case 2: Left Click  & Slot=Item  & Mouse=Painting >> Assign Slot Item to Mouse
                // Use Case 3: Left Click  & Slot=Empty & Mouse=Empty    >> Do Nothing
                // Use Case 4: Left Click  & Slot=Item  & Mouse=Empty    >> Assign Slot Item to Mouse
                // Use Case 5: Right Click & Slot=*     & Mouse=*        >> Unassign Slot
                if (e.data.button === 0) { // Left Click (UC1-UC4)
                    if (G.currentMouseState === G.mouseStates.PAINTING && G.BPC.paintContainer !== undefined) { // Mouse == Painting (UC1,UC2)
                        console.log(button.data)
                        if (button.data === undefined) { // Slot == Empty (UC1)
                            // Assign Mouse Item to Slot
                            button.data = factorioData.getItem(G.BPC.paintContainer.name)
                            button.content = InventoryContainer.createIcon(button.data, false)
                        } else { // Slot == Item (UC2)
                            // Assign Slot Item to Mouse
                            ToolbeltContainer.assignItemToMouse(button.data, e.data.getLocalPosition(G.BPC))
                        }
                    } else { // Mouse == Empty (UC3,UC4)
                        if (button.data !== undefined) { // >> Slot == Item (UC4)
                            // Assign Slot Item to Mouse
                            ToolbeltContainer.assignItemToMouse(button.data, e.data.getLocalPosition(G.BPC))
                        }
                    }
                } else if (e.data.button === 2) { // Right Click (UC5)
                    // Unassign Slot
                    button.data = undefined
                    button.content = undefined
                }
            })

            this.buttons[i] = button
            this.content.addChild(button)
        }
    }

    /** Activate item from a specific toolbelt slot */
    public setSlot(slot: number) {
        if (slot < 0 || slot > 9) return
        const item: any = this.buttons[slot].data
        if (item !== undefined) ToolbeltContainer.assignItemToMouse(item, G.app.renderer.plugins.interaction.mouse.global)
    }

    setPosition() {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height - this.height
        )
    }
}
