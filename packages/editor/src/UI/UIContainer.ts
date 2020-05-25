import * as PIXI from 'pixi.js'
import { Entity } from '../core/Entity'
import { DebugContainer } from './DebugContainer'
import { QuickbarPanel } from './QuickbarPanel'
import { EntityInfoPanel } from './EntityInfoPanel'
import { InventoryDialog } from './InventoryDialog'
import { createEditor } from './editors/factory'

export class UIContainer extends PIXI.Container {
    private debugContainer: DebugContainer
    public quickbarContainer: QuickbarPanel
    private infoEntityPanel: EntityInfoPanel
    private dialogsContainer: PIXI.Container
    private paintIconContainer: PIXI.Container

    public constructor() {
        super()

        this.debugContainer = new DebugContainer()
        this.quickbarContainer = new QuickbarPanel(2)
        this.infoEntityPanel = new EntityInfoPanel()
        this.dialogsContainer = new PIXI.Container()
        this.paintIconContainer = new PIXI.Container()

        this.addChild(
            this.debugContainer,
            this.quickbarContainer,
            this.infoEntityPanel,
            this.dialogsContainer,
            this.paintIconContainer
        )
    }

    public updateInfoEntityPanel(entity: Entity): void {
        this.infoEntityPanel.updateVisualization(entity)
    }

    public addPaintIcon(icon: PIXI.DisplayObject): void {
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
    ): void {
        const inv = new InventoryDialog(title, itemsFilter, selectedCallBack)
        this.dialogsContainer.addChild(inv)
    }

    // public changeQuickbarRows(rows: number): void {
    //     const itemNames = this.quickbarContainer.serialize()
    //     this.quickbarContainer.destroy()
    //     this.quickbarContainer = new QuickbarContainer(rows, itemNames)

    //     const index = this.getChildIndex(this.quickbarContainer)
    //     this.addChildAt(this.quickbarContainer, index)
    // }
}
