import { Container } from 'pixi.js'
import { Entity } from '../core/Entity'
import { DebugContainer } from './DebugContainer'
import { QuickbarPanel } from './QuickbarPanel'
import { EntityInfoPanel } from './EntityInfoPanel'
import { InventoryDialog } from './InventoryDialog'
import { WiresPanel } from './WiresPanel'
import { createEditor } from './editors/factory'

export class UIContainer extends Container {
    private debugContainer: DebugContainer
    public quickbarPanel: QuickbarPanel
    private wiresPanel: WiresPanel
    private entityInfoPanel: EntityInfoPanel
    private dialogsContainer: Container
    private paintIconContainer: Container

    public constructor() {
        super()

        this.debugContainer = new DebugContainer()
        this.quickbarPanel = new QuickbarPanel(2)
        this.wiresPanel = new WiresPanel()
        this.entityInfoPanel = new EntityInfoPanel()
        this.dialogsContainer = new Container()
        this.paintIconContainer = new Container()

        this.addChild(
            this.debugContainer,
            this.quickbarPanel,
            this.wiresPanel,
            this.entityInfoPanel,
            this.dialogsContainer,
            this.paintIconContainer
        )
    }

    public updateEntityInfoPanel(entity: Entity): void {
        this.entityInfoPanel.updateVisualization(entity)
    }

    public addPaintIcon(icon: Container): void {
        this.paintIconContainer.addChild(icon)
    }

    public set showDebuggingLayer(visible: boolean) {
        this.debugContainer.visible = visible
    }

    public createEditor(entity: Entity): void {
        const editor = createEditor(entity)
        if (editor) {
            this.dialogsContainer.addChild(editor)
        }
    }

    public createInventory(
        title?: string,
        itemsFilter?: string[],
        selectedCallBack?: (selectedItem: string) => void
    ): InventoryDialog {
        const inv = new InventoryDialog(title, itemsFilter, selectedCallBack)
        this.dialogsContainer.addChild(inv)
        return inv
    }

    // public changeQuickbarRows(rows: number): void {
    //     const itemNames = this.quickbarPanel.serialize()
    //     this.quickbarPanel.destroy()
    //     this.quickbarPanel = new QuickbarContainer(rows, itemNames)

    //     const index = this.getChildIndex(this.quickbarPanel)
    //     this.addChildAt(this.quickbarPanel, index)
    // }
}
