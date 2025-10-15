import { Container } from 'pixi.js'
import { EditorMode } from '../containers/BlueprintContainer'
import G from '../common/globals'
import { Panel } from './controls/Panel'
import { Slot } from './controls/Slot'
import F from './controls/functions'
import { colors } from './style'

class WireSlot extends Slot<string | undefined> {
    public get wireName(): string {
        return this.data
    }

    public setWireName(wireName: string): void {
        this.data = wireName
        this.content = F.CreateIcon(wireName)
    }
}

export class WiresPanel extends Panel {
    private slotsContainer: Container
    public static Wires = ['copper-wire', 'red-wire', 'green-wire']

    public constructor() {
        super(
            24 + 38 * 3 - 2,
            24 + 38,
            colors.quickbar.background.color,
            colors.quickbar.background.alpha,
            colors.quickbar.background.border
        )

        this.slotsContainer = new Container()
        this.slotsContainer.position.set(12, 12)
        this.addChild(this.slotsContainer)

        this.generateSlots()
    }

    public generateSlots(): void {
        for (const [i, wire] of WiresPanel.Wires.entries()) {
            const slot = new WireSlot()
            slot.setWireName(wire)
            slot.position.set((36 + 2) * i, 0)

            slot.on('pointerdown', e => {
                if (e.button === 0) {
                    if (G.BPC.mode === EditorMode.PAINT) {
                        if (slot.wireName === G.BPC.paintContainer.getItemName()) {
                            G.BPC.paintContainer.destroy()
                        } else {
                            G.BPC.spawnPaintContainer(slot.wireName)
                        }
                    } else {
                        G.BPC.spawnPaintContainer(slot.wireName)
                    }
                }
            })

            this.slotsContainer.addChild(slot)
        }
    }

    protected override setPosition(): void {
        this.position.set(G.app.screen.width / 2 + 442 / 2, G.app.screen.height - this.height + 1)
    }
}
