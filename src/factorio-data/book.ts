import Blueprint from './blueprint'

export class Book {

    active_index: number
    blueprints: any[]

    constructor(data: any) {
        if (data) {
            this.active_index = data.blueprint_book.active_index
            this.blueprints = data.blueprint_book.blueprints
        } else {
            this.active_index = 0
            this.blueprints = []
        }
    }

    addBlueprint(blueprint: Blueprint) {
        this.blueprints.push(blueprint)
    }

    getBlueprint(index?: number) {
        let INDEX = this.active_index
        if (index !== undefined) INDEX = (index < 0 || index > this.blueprints.length - 1) ? 0 : index
        this.active_index = INDEX

        if (this.blueprints[INDEX].loaded) return this.blueprints[INDEX].loaded

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
                blueprint: this.blueprints[i].loaded ?
                    this.blueprints[i].loaded.toObject() :
                    this.blueprints[i].blueprint
            })
        }
        return {
            blueprint_book: {
                blueprints,
                item: 'blueprint_book',
                active_index: this.active_index,
                version: 0
            }
        }
    }
}
