import * as PIXI from 'pixi.js'
import G from '../common/globals'
import { Entity } from '../core/Entity'
import { DebugContainer } from './DebugContainer'
import { QuickbarPanel } from './QuickbarPanel'
import { EntityInfoPanel } from './EntityInfoPanel'
import { InventoryDialog } from './InventoryDialog'
import { createEditor } from './editors/factory'
import { Dialog } from './controls/Dialog'

export class UIContainer extends PIXI.Container {
    private debugContainer: DebugContainer
    public quickbarPanel: QuickbarPanel
    private entityInfoPanel: EntityInfoPanel
    private dialogsContainer: PIXI.Container
    private paintIconContainer: PIXI.Container

    public constructor() {
        super()

        this.debugContainer = new DebugContainer()
        this.quickbarPanel = new QuickbarPanel(2)
        this.entityInfoPanel = new EntityInfoPanel()
        this.dialogsContainer = new PIXI.Container()
        this.paintIconContainer = new PIXI.Container()

        this.addChild(
            this.debugContainer,
            this.quickbarPanel,
            this.entityInfoPanel,
            this.dialogsContainer,
            this.paintIconContainer
        )
    }

    public updateEntityInfoPanel(entity: Entity): void {
        this.entityInfoPanel.updateVisualization(entity)
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
    //     const itemNames = this.quickbarPanel.serialize()
    //     this.quickbarPanel.destroy()
    //     this.quickbarPanel = new QuickbarContainer(rows, itemNames)

    //     const index = this.getChildIndex(this.quickbarPanel)
    //     this.addChildAt(this.quickbarPanel, index)
    // }
}
