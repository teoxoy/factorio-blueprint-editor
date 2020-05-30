import * as PIXI from 'pixi.js'
import G from '../common/globals'
import { EntitySprite } from './EntitySprite'
import { BlueprintContainer } from './BlueprintContainer'

export class OptimizedContainer extends PIXI.Container {
    private bpc: BlueprintContainer
    public children: EntitySprite[]

    public constructor(bpc: BlueprintContainer) {
        super()
        this.bpc = bpc
    }

    public updateTransform(): void {
        // @ts-ignore
        this.worldAlpha = this.alpha * this.parent.worldAlpha
        this.transform.updateTransform(this.parent.transform)

        for (const c of this.children) {
            // @ts-ignore
            c.worldAlpha = c.alpha * c.parent.worldAlpha
            c.transform.updateTransform(c.parent.transform)
        }
    }

    public render(renderer: PIXI.Renderer): void {
        // @ts-ignore
        const batchRenderer = renderer.plugins.batch as PIXI.AbstractBatchRenderer
        renderer.batch.setObjectRenderer(batchRenderer)

        const { x: minX, y: minY } = this.bpc.toLocal(
            new PIXI.Point(G.app.screen.x, G.app.screen.y)
        )
        const { x: maxX, y: maxY } = this.bpc.toLocal(
            new PIXI.Point(G.app.screen.width, G.app.screen.height)
        )

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

            c.calculateVertices()
            batchRenderer.render(c)
        }
    }
}
