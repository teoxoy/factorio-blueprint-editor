import util from '../common/util'

/** Private enumaration to determine the value (new value or old value) should be applied during action */
enum HistoryValue {
    New,
    Old
}

/** Private interface hack to access properties of objects via `any` */
type IIndexedObject = Record<string, any>

/** Private class for historical actions */
class Action<V> {
    /** Field to store old value (=overwritten value) */
    public readonly oldValue: V

    /** Field to store new value (=overwriting value) */
    public readonly newValue: V

    /** Field to store description */
    public readonly text: string

    /** Field to store apply function */
    private readonly applyFn: (value: V) => void

    /** Field to store functions to emit after execution of action */
    private readonly emits: ((value: V, oldValue: V) => void)[] = []

    /** Reference to History */
    private readonly history: History

    public applyImmediate = true

    public constructor(history: History, oldValue: V, newValue: V, text: string, applyFn: (value: V) => void) {
        this.history = history
        this.oldValue = oldValue
        this.newValue = newValue
        this.text = text
        this.applyFn = applyFn
    }

    /**
     * Commit the action to the history
     * This allows for emits to be set up first
     */
    public commit(): this {
        if (this.applyImmediate) {
            this.apply()
        }
        this.history.commitTransaction()

        return this
    }

    /**
     * Execute action and therfore apply value
     * @param value Whether to apply the new or the old value (Default: New)
     */
    public apply(value: HistoryValue = HistoryValue.New): void {
        const newValue = value === HistoryValue.New ? this.newValue : this.oldValue
        const oldValue = value === HistoryValue.New ? this.oldValue : this.newValue

        this.applyFn(newValue)

        for (const f of this.emits) {
            f(newValue, oldValue)
        }
    }

    /**
     * Adds the function to a queue
     *
     * The function will be executed after the action has been applied
     */
    public onDone(f: (newValue: V, oldValue: V) => void): Action<V> {
        this.emits.push(f)
        return this
    }
}

/** A wrapper that stores multiple `Action`s */
class Transaction {
    /** Field to store description */
    public text: string

    /** Should actions be applied immediately */
    private applyImmediate: boolean

    /** Field to store historical actions */
    private readonly actions: Action<unknown>[] = []

    public constructor(text?: string, applyImmediate?: boolean) {
        this.text = text
        this.applyImmediate = applyImmediate
    }

    public empty(): boolean {
        return this.actions.length === 0
    }

    public apply(): void {
        if (this.applyImmediate) {
            return
        }
        for (const action of this.actions) {
            action.apply(HistoryValue.New)
        }
    }

    /** Undo all actions from this transaction in reversed order */
    public undo(): void {
        const reversed = this.actions.map((_, i, arr) => arr[arr.length - 1 - i])
        for (const action of reversed) {
            action.apply(HistoryValue.Old)
        }
    }

    /** Redo all actions from this transaction */
    public redo(): void {
        for (const action of this.actions) {
            action.apply(HistoryValue.New)
        }
    }

    /** Logs all actions */
    public log(): void {
        console.log(`[DO] ${this.text}:`)
        this.actions.forEach((a, i) => console.log('\t', i, a.text, ' - ', a.oldValue, ' -> ', a.newValue))
    }

    /** Add action to this transaction */
    public push(action: Action<unknown>): void {
        if (this.text === undefined && this.actions.length === 0) {
            this.text = action.text
        }
        action.applyImmediate = this.applyImmediate
        this.actions.push(action)
    }
}

/**
 * **Component to store history for undo / redo actions**
 *
 * - Supports history for maps and for objects
 * - Supports changing values in nested arrays and objects
 * - Supports multiple actions being applied as a single action via transaction (only 1 undo / redo needed to revert)
 * - Supports nested transactions
 * - Supports emitting of functions to be executed subsequently to historical action on undo / redo
 * - Supports history length constraint
 *
 * @example
 * // Import and init
 * import History from './history'
 * const history = new History()
 *
 * // Update value of object
 * const o = { name: 'test name' }
 * history.updateValue(o, ['name'], 'updated name', 'Update Object Name').commit()
 *
 * // Update value of nested object
 * const o = { name: { nestedName: 'test name' } }
 * history.updateValue(o, ['name', 'nestedName'], 'updated name', 'Update Object Name').commit()
 *
 * // Update item of map
 * const m: Map<number, string> = new Map()
 * m.push(1, 'fff')
 * history.updateMap(m, 1, 'updated fff', 'Update Map Item')
 *
 * // Transaction of 2 actions and naming of transaction
 * const o = { firstName: 'test first name', lastName: 'test last name'}
 * history.startTransaction('Update 2 values')
 * history.updateValue(o, ['firstName'], 'update first name').commit()
 * history.updateValue(o, ['lastName'], 'update last name').commit()
 * history.commitTransaction()
 *
 * // Emit function after action execution
 * const o = { name: 'test name'}
 * history.updateValue(o, ['name'], 'updated name', 'Update Object Name').onDone(name => console.log(name)).commit()
 */
export class History {
    public logging = false

    private readonly MAX_HISTORY_LENGTH = 1000
    private readonly MIN_HISTORY_LENGTH = 800

    /** Counts how many times a 'startTransaction' was called so we know when 'commitTransaction' actually needs to apply */
    private transactionCount = 0

    private historyIndex = 0
    private activeTransaction: Transaction
    private transactionHistory: Transaction[] = []

    /** Removes all history entries */
    public reset(): void {
        this.historyIndex = 0
        this.transactionHistory = []
    }

    /** Updates a value in an `Array` or `Object` at the specified path and stores it in the history  */
    public updateValue<T, V>(target: T, path: string[], value: V, text: string): Action<V> {
        const oldValue = this.GetValue<V>(target, path)
        const newValue = value

        const historyAction = new Action(this, oldValue, newValue, text, v => {
            if (v === undefined) {
                const current = this.GetValue(target, path)
                if (current !== undefined) {
                    this.DeleteValue(target, path)
                }
            } else {
                this.SetValue<V>(target, path, v)
            }
        })

        this.startTransaction()
        this.activeTransaction.push(historyAction)

        return historyAction
    }

    /** Updates a value in a `Map` and stores it in the history */
    public updateMap<K, V>(target: Map<K, V>, key: K, value: V, text: string): Action<V> {
        const oldValue = target.get(key)
        const newValue = value

        const historyAction = new Action(this, oldValue, newValue, text, v => {
            if (v === undefined) {
                if (target.has(key)) {
                    target.delete(key)
                }
            } else {
                target.set(key, v)
            }
        })

        this.startTransaction()
        this.activeTransaction.push(historyAction)

        return historyAction
    }

    /**
     * Undo last action stored in history
     * @returns `false` if there are no actions left for undo
     * */
    public undo(): boolean {
        if (this.historyIndex === 0) {
            return false
        }

        const historyEntry = this.transactionHistory[this.historyIndex - 1]
        historyEntry.undo()
        this.historyIndex -= 1

        if (this.logging) {
            console.log(`[UNDO] ${historyEntry.text}`)
        }

        return true
    }

    /**
     * Redo last action stored in history
     * @returns `false` if there are no actions left for redo
     * */
    public redo(): boolean {
        if (this.historyIndex === this.transactionHistory.length) {
            return false
        }

        const historyEntry = this.transactionHistory[this.historyIndex]
        historyEntry.redo()
        this.historyIndex += 1

        if (this.logging) {
            console.log(`[REDO] ${historyEntry.text}`)
        }

        return true
    }

    /**
     * Starts a new transaction
     * @param text Description of transaction - If not specified it will be the description of the first action
     * @returns `false` if there is already an active transaction
     */
    public startTransaction(text?: string, applyImmediate = true): boolean {
        this.transactionCount += 1

        if (this.activeTransaction === undefined) {
            this.activeTransaction = new Transaction(text, applyImmediate)
            return true
        } else {
            return false
        }
    }

    /**
     * Commits the active transaction and pushes it into the history
     * @returns `false` if `transactionCount` is not 0 or transaction is empty
     */
    public commitTransaction(): boolean {
        this.transactionCount -= 1

        if (this.transactionCount === 0) {
            if (this.activeTransaction.empty()) {
                return false
            }

            while (this.transactionHistory.length > this.historyIndex) {
                this.transactionHistory.pop()
            }

            this.activeTransaction.apply()
            this.transactionHistory.push(this.activeTransaction)
            if (this.logging) {
                if (this.historyIndex !== 0 && this.historyIndex % 20 === 0) {
                    console.clear()
                }
                this.activeTransaction.log()
            }
            this.activeTransaction = undefined

            if (this.historyIndex > this.MAX_HISTORY_LENGTH) {
                this.transactionHistory.splice(0, this.MAX_HISTORY_LENGTH - this.MIN_HISTORY_LENGTH)
                this.historyIndex = this.transactionHistory.length
            }

            this.historyIndex += 1

            return true
        }

        return false
    }

    /** Gets the value of the `Array` or `Object` at the specified path  */
    private GetValue<V>(obj: IIndexedObject, path: string[]): V {
        if (path.length === 1) {
            if (util.objectHasOwnProperty(obj, path[0])) {
                return obj[path[0]]
            } else {
                return undefined
            }
        } else {
            return this.GetValue(obj[path[0]], path.slice(1))
        }
    }

    /** Sets the value of the `Array` or `Object` at the specified path  */
    private SetValue<V>(obj: IIndexedObject, path: string[], value: V): void {
        if (path.length === 1) {
            if (Array.isArray(obj)) {
                obj.push(value)
            } else {
                obj[path[0]] = value
            }
        } else {
            this.SetValue<V>(obj[path[0]], path.slice(1), value)
        }
    }

    /** Deletes the value of the `Array` or `Object` at the specified path  */
    private DeleteValue(obj: IIndexedObject, path: string[]): void {
        if (path.length === 1) {
            if (Array.isArray(obj)) {
                obj.splice(Number(path[0]), 1)
            } else {
                delete obj[path[0]]
            }
        } else {
            this.DeleteValue(obj[path[0]], path.slice(1))
        }
    }
}
