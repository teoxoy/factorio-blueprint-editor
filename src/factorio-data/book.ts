import G from '../common/globals'
import Blueprint from './blueprint'

export class Book {
    activeIndex: number
    blueprints: {
        blueprint: BPS.IBlueprint
        loaded?: Blueprint
    }[]

    constructor(data: BPS.IBlueprintBook) {
        if (data) {
            this.activeIndex = data.active_index
            this.blueprints = data.blueprints
        } else {
            this.activeIndex = 0
            this.blueprints = []
        }
    }

    getBlueprint(index?: number) {
        if (index !== undefined) {
            this.activeIndex = index < 0 || index > this.blueprints.length - 1 ? 0 : index
        }

        const blueprint = this.blueprints[this.activeIndex]
        if (blueprint.loaded) {
            return blueprint.loaded
        }

        const bp = new Blueprint(blueprint.blueprint)
        blueprint.loaded = bp
        return bp
    }

    toObject() {
        const blueprints = []
        for (let i = 0; i < this.blueprints.length; i++) {
            blueprints.push({
                index: i,
                // TODO: modified instead of loaded
                blueprint: this.blueprints[i].loaded
                    ? this.blueprints[i].loaded.toObject().blueprint
                    : this.blueprints[i].blueprint
            })
        }
        return {
            blueprint_book: {
                blueprints,
                item: 'blueprint_book',
                active_index: this.activeIndex,
                version: G.getFactorioVersion()
            }
        }
    }
}
