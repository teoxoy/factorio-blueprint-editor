import * as PIXI from 'pixi.js'

export class VisualizationArea {
    public static ALPHA = 0.25
    private readonly sprites: PIXI.Sprite[]

    public constructor(sprites: PIXI.Sprite[]) {
        this.sprites = sprites
    }

    public destroy(): void {
        for (const sprite of this.sprites) {
            sprite.destroy()
        }
    }

    public show(): void {
        for (const sprite of this.sprites) {
            sprite.visible = true
        }
    }

    public hide(): void {
        for (const sprite of this.sprites) {
            sprite.visible = false
        }
    }

    public highlight(): void {
        for (const sprite of this.sprites) {
            sprite.alpha += VisualizationArea.ALPHA
        }
    }

    public moveTo(position: IPoint): void {
        for (const sprite of this.sprites) {
            sprite.position.set(position.x, position.y)
        }
    }
}
