import { Renderer } from '@pixi/core'
import { Container } from '@pixi/display'
import G from '../common/globals'
import { EntitySprite } from './EntitySprite'
import { BlueprintContainer } from './BlueprintContainer'

export class OptimizedContainer extends Container<EntitySprite> {
    private bpc: BlueprintContainer

    public constructor(bpc: BlueprintContainer) {
        super()
        this.bpc = bpc
    }

    public updateTransform(): void {
        this.worldAlpha = this.alpha * this.parent.worldAlpha
        this.transform.updateTransform(this.parent.transform)

        for (const c of this.children) {
            c.worldAlpha = c.alpha * c.parent.worldAlpha
            c.transform.updateTransform(c.parent.transform)
        }
    }

    public override render(renderer: Renderer): void {
        const [minX, minY] = this.bpc.toWorld(G.app.screen.x, G.app.screen.y)
        const [maxX, maxY] = this.bpc.toWorld(G.app.screen.width, G.app.screen.height)

        for (const c of this.children) {
            if (this.bpc.viewportCulling) {
                if (
                    c.cachedBounds[0] > maxX ||
                    c.cachedBounds[1] > maxY ||
                    c.cachedBounds[2] < minX ||
                    c.cachedBounds[3] < minY
                ) {
                    continue
                }
            }

            c.render(renderer)
        }
    }
}
