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
        let INDEX = this.activeIndex
        if (index !== undefined) {
            INDEX = index < 0 || index > this.blueprints.length - 1 ? 0 : index
        }
        this.activeIndex = INDEX

        if (this.blueprints[INDEX].loaded) {
            return this.blueprints[INDEX].loaded
        }

        const bp = new Blueprint(this.blueprints[INDEX].blueprint)
        this.blueprints[INDEX].loaded = bp
        return bp
    }

    toObject() {
        const blueprints = []
        for (let i = 0; i < this.blueprints.length; i++) {
            blueprints.push({
                index: i,
                // TODO: modified instead of loaded
                blueprint: this.blueprints[i].loaded
                    ? this.blueprints[i].loaded.toObject()
                    : this.blueprints[i].blueprint
            })
        }
        return {
            blueprint_book: {
                blueprints,
                item: 'blueprint_book',
                active_index: this.activeIndex,
                version: 0
            }
        }
    }
}
