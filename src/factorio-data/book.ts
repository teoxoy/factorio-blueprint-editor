import G from '../common/globals'
import Blueprint from './blueprint'

export class Book {
    private _activeIndex: number
    private readonly blueprints: {
        blueprint: BPS.IBlueprint
        loaded?: Blueprint
    }[]

    public constructor(data: BPS.IBlueprintBook) {
        if (data) {
            this._activeIndex = data.active_index
            this.blueprints = data.blueprints
        } else {
            this._activeIndex = 0
            this.blueprints = []
        }
    }

    public get activeIndex() {
        return this._activeIndex
    }

    public get lastBookIndex() {
        return Math.min(0, this.blueprints.length - 1)
    }

    public getBlueprint(index?: number) {
        if (index !== undefined) {
            this._activeIndex = index < 0 || index > this.lastBookIndex ? 0 : index
        }

        const blueprint = this.blueprints[this._activeIndex]
        if (blueprint.loaded) {
            return blueprint.loaded
        }

        const bp = new Blueprint(blueprint.blueprint)
        blueprint.loaded = bp
        return bp
    }

    public serialize() {
        const blueprints = []
        for (let i = 0; i < this.blueprints.length; i++) {
            blueprints.push({
                index: i,
                // TODO: modified instead of loaded
                blueprint: this.blueprints[i].loaded
                    ? this.blueprints[i].loaded.serialize().blueprint
                    : this.blueprints[i].blueprint
            })
        }
        return {
            blueprint_book: {
                blueprints,
                item: 'blueprint_book',
                active_index: this._activeIndex,
                version: G.getFactorioVersion()
            }
        }
    }
}
