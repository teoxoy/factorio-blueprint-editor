import { Blueprint, getFactorioVersion } from './Blueprint'

class Book {
    private _active: Blueprint
    private _activeIndex: number
    private readonly blueprints: BPS.IBlueprintBookEntry[]

    private readonly label?: string
    private readonly description?: string
    private readonly icons?: BPS.IIcon[]

    public constructor(data: BPS.IBlueprintBook) {
        if (data) {
            this._activeIndex = getFlattenedActiveIndex(data.blueprints, data.active_index)
            this.blueprints = data.blueprints || []
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

function countNestedBlueprints(
    bps: BPS.IBlueprintBookEntry[] = [],
    includePlanners = false
): number {
    return bps.reduce((count, { blueprint, blueprint_book }) => {
        if (blueprint_book) {
            return count + countNestedBlueprints(blueprint_book.blueprints, includePlanners)
        } else if (blueprint || includePlanners) {
            return count + 1
        } else {
            return count
        }
    }, 0)
}

function getFlattenedActiveIndex(
    bps: BPS.IBlueprintBookEntry[] = [],
    active_index: number
): number {
    {
        const { upgrade_planner, deconstruction_planner, blueprint_book } = bps[active_index]

        if (
            upgrade_planner ||
            deconstruction_planner ||
            (blueprint_book && countNestedBlueprints(blueprint_book.blueprints) === 0)
        ) {
            return 0
        }
    }

    let res = active_index

    for (let i = 0; i < active_index; i++) {
        const { upgrade_planner, deconstruction_planner, blueprint_book } = bps[i]

        if (blueprint_book) {
            res += countNestedBlueprints(blueprint_book.blueprints) - 1
        } else if (upgrade_planner || deconstruction_planner) {
            res -= 1
        }
    }

    const { blueprint_book } = bps[active_index]

    if (blueprint_book) {
        res += getFlattenedActiveIndex(blueprint_book.blueprints, blueprint_book.active_index)
    }

    return res
}

function getBlueprintAtFlattenedActiveIndex(
    bps: BPS.IBlueprintBookEntry[],
    index: number
): BPS.IBlueprint {
    const search = (
        bps: BPS.IBlueprintBookEntry[] = [],
        index: number
    ): number | BPS.IBlueprint => {
        let i = index
        for (const { blueprint, blueprint_book } of bps) {
            if (blueprint) {
                if (i === 0) return blueprint
                i -= 1
            } else if (blueprint_book) {
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

function saveBlueprint(
    bps: BPS.IBlueprintBookEntry[] = [],
    index: number,
    bp: BPS.IBlueprint
): [number, number] {
    let i = index
    for (let j = 0; j < bps.length; j++) {
        const { blueprint, blueprint_book } = bps[j]
        if (blueprint) {
            if (i === 0) {
                bps[j].blueprint = bp
                return [undefined, j]
            }
            i -= 1
        } else if (blueprint_book) {
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
