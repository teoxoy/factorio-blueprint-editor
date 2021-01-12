import { Blueprint, getFactorioVersion } from './Blueprint'

interface IBP {
    blueprint?: BPS.IBlueprint
    blueprint_book?: BPS.IBlueprintBook
}

class Book {
    private _active: Blueprint
    private _activeIndex: number
    private readonly blueprints: {
        blueprint?: BPS.IBlueprint
        blueprint_book?: BPS.IBlueprintBook
    }[]

    private readonly label?: string
    private readonly description?: string
    private readonly icons?: BPS.IIcon[]

    public constructor(data: BPS.IBlueprintBook) {
        if (data) {
            this._activeIndex = getFlattenedActiveIndex(data.blueprints, data.active_index)
            this.blueprints = data.blueprints
            this.label = data.label
            this.description = data.description
            this.icons = data.icons
        } else {
            this._activeIndex = 0
            this.blueprints = []
        }
    }

    public get activeIndex(): number {
        return this._activeIndex
    }

    public get lastBookIndex(): number {
        return countNestedBlueprints(this.blueprints) - 1
    }

    private saveActiveBlueprint(): number {
        if (this._active) {
            const [, activeIndex] = saveBlueprint(
                this.blueprints,
                this._activeIndex,
                this._active.serialize()
            )
            return activeIndex
        }
        return 0
    }

    public selectBlueprint(index?: number): Blueprint {
        this.saveActiveBlueprint()

        if (index !== undefined) {
            this._activeIndex = index < 0 || index > this.lastBookIndex ? 0 : index
        }

        const blueprint = getBlueprintAtFlattenedActiveIndex(this.blueprints, this._activeIndex)
        const bp = new Blueprint(blueprint)
        this._active = bp
        return bp
    }

    public serialize(): BPS.IBlueprintBook {
        const activeIndex = this.saveActiveBlueprint()

        return {
            blueprints: this.blueprints.map((v, index) => ({ ...v, index })),
            item: 'blueprint_book',
            active_index: activeIndex,
            version: getFactorioVersion(),
            label: this.label,
            description: this.description,
            icons: this.icons,
        }
    }
}

function countNestedBlueprints(bps: IBP[]): number {
    return bps.reduce(
        (count, { blueprint_book }) =>
            count + (blueprint_book ? countNestedBlueprints(blueprint_book.blueprints) : 1),
        0
    )
}

function getFlattenedActiveIndex(bps: IBP[], active_index: number): number {
    return bps.reduce((aI, { blueprint_book }, i) => {
        if (blueprint_book && i < active_index) {
            return aI + countNestedBlueprints(blueprint_book.blueprints) - 1
        }
        if (blueprint_book && i === active_index) {
            return (
                aI + getFlattenedActiveIndex(blueprint_book.blueprints, blueprint_book.active_index)
            )
        }
        return aI
    }, active_index)
}

function getBlueprintAtFlattenedActiveIndex(bps: IBP[], index: number): BPS.IBlueprint {
    const search = (bps: IBP[], index: number): number | BPS.IBlueprint => {
        let i = index
        for (const { blueprint, blueprint_book } of bps) {
            if (blueprint) {
                if (i === 0) return blueprint
                i -= 1
            } else {
                const ret = search(blueprint_book.blueprints, i)
                if (typeof ret === 'number') {
                    i = ret
                } else {
                    return ret
                }
            }
        }
        return i
    }

    const ret = search(bps, index)
    return typeof ret === 'number' ? undefined : ret
}

function saveBlueprint(bps: IBP[], index: number, bp: BPS.IBlueprint): [number, number] {
    let i = index
    for (let j = 0; j < bps.length; j++) {
        const { blueprint, blueprint_book } = bps[j]
        if (blueprint) {
            if (i === 0) {
                bps[j].blueprint = bp
                return [undefined, j]
            }
            i -= 1
        } else {
            const [newI, activeIndex] = saveBlueprint(blueprint_book.blueprints, i, bp)
            if (newI === undefined) {
                blueprint_book.active_index = activeIndex
                return [undefined, j]
            } else {
                i = newI
            }
        }
    }
    return [i, undefined]
}

export { Book }
