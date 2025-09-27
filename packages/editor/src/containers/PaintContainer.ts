import { ColorSource, Container, FederatedPointerEvent } from 'pixi.js'
import { IPoint } from '../types'
import G from '../common/globals'
import { Entity } from '../core/Entity'
import F from '../UI/controls/functions'
import { BlueprintContainer } from './BlueprintContainer'
import { EntitySprite } from './EntitySprite'

export class IllegalFlipError {
    public message: string
    public constructor(message: string) {
        this.message = message
    }
}

export enum Axis {
    X,
    Y,
}

export abstract class PaintContainer extends Container<EntitySprite> {
    protected readonly bpc: BlueprintContainer
    private _name: string
    private icon: Container
    private _blocked = false
    private _posConstraint?: Axis
    private _children_tint: ColorSource

    protected constructor(bpc: BlueprintContainer, name: string) {
        super()
        this.bpc = bpc
        this.name = name

        this._children_tint = F.rgbToColorSource(0.4, 1, 0.4)

        this.on('childAdded', (s: EntitySprite) => {
            s.tint = this._children_tint
        })

        this.bpc.on('globalpointermove', this.updateIconPos, this)
        this.show()
    }

    protected attachUpdateOn1(): void {
        const onUpdate1 = (): void => {
            this.moveAtCursor()
        }
        this.bpc.gridData.on('update', onUpdate1)
        this.on('destroyed', () => {
            this.bpc.gridData.off('update', onUpdate1)
        })
    }

    protected attachUpdateOn16(): void {
        const onUpdate16 = (): void => {
            this.moveAtCursor()
        }
        this.bpc.gridData.on('update16', onUpdate16)
        this.on('destroyed', () => {
            this.bpc.gridData.off('update16', onUpdate16)
        })
    }

    public get name(): string {
        return this._name
    }

    protected set name(name: string) {
        this._name = name
        this.icon?.destroy()
        this.icon = F.CreateIcon(this.getItemName())
        G.UI.addPaintIcon(this.icon)
    }

    protected get blocked(): boolean {
        return this._blocked
    }

    protected set blocked(value: boolean) {
        this._blocked = value
        this._children_tint = F.rgbToColorSource(
            this.blocked ? 1 : 0.4,
            this.blocked ? 0.4 : 1,
            0.4
        )
        for (const s of this.children) {
            s.tint = this._children_tint
        }
    }

    public hide(): void {
        this.visible = false
        this.icon.visible = true
    }

    public show(): void {
        this.visible = true
        this.icon.visible = false
    }

    public destroy(): void {
        this.bpc.off('globalpointermove', this.updateIconPos, this)
        this.icon.destroy()
        super.destroy()
    }

    protected getGridPosition(): IPoint {
        return {
            x: Math.round((this.x / 32) * 10) / 10,
            y: Math.round((this.y / 32) * 10) / 10,
        }
    }

    public setPosConstraint(axis?: Axis): void {
        this._posConstraint = axis
        this.moveAtCursor()
    }

    protected setPosition(position?: IPoint): void {
        if (this._posConstraint === undefined) {
            this.position = position
        } else {
            if (this._posConstraint === Axis.X) {
                this.position.x = position.x
            } else {
                this.position.y = position.y
            }
        }
    }

    protected setNewPosition(size?: IPoint): void {
        const position = { x: 0, y: 0 }

        if (size === undefined) {
            position.x = this.bpc.gridData.x
        } else if (size.x % 2 === 0) {
            const npx = this.bpc.gridData.x16 * 16
            position.x = npx + (npx % 32 === 0 ? 0 : 16)
        } else {
            position.x = this.bpc.gridData.x32 * 32 + 16
        }

        if (size === undefined) {
            position.y = this.bpc.gridData.y
        } else if (size.y % 2 === 0) {
            const npy = this.bpc.gridData.y16 * 16
            position.y = npy + (npy % 32 === 0 ? 0 : 16)
        } else {
            position.y = this.bpc.gridData.y32 * 32 + 16
        }

        this.setPosition(position)
    }

    private readonly updateIconPos = (e: FederatedPointerEvent): void => {
        this.icon.position.set(e.globalX + 16, e.globalY + 16)
    }

    // override
    public abstract getItemName(): string

    // override
    public abstract rotate(ccw?: boolean): void

    // override
    public abstract canFlipOrRotateByCopying(): boolean

    // override
    public abstract rotatedEntities(ccw?: boolean): Entity[]

    // override
    public abstract flippedEntities(vertical: boolean): Entity[]

    // override
    protected abstract redraw(): void

    // override
    public abstract moveAtCursor(): void

    // override
    public abstract removeContainerUnder(): void

    // override
    public abstract placeEntityContainer(): void
}
