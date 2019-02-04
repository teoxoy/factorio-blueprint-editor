/*
 * Component to store history for undo / redo in the user interface
 * ====================================================================================================
 * Supports history for maps and for objects
 * Supports nested objects within objects and arrays
 * Supports multiple actions as single action via transaction (only 1 undo / redo needed to revert)
 * Supports emitting of functions to be executed subsequently to historical action on undo / redo
 * ====================================================================================================
 * @example Enable for usage
 * import * as History from './history'
 *
 * @example Update value of object with comment
 * const o = { name: 'test name'}
 * History.updateValue(o, ['name'], 'updated name', 'Updated Object Name').commit()
 *
 * @example Update value of nested object with comment
 * const o = { name: { nestedName: 'test name' } }
 * History.updateValue(o, ['name','nestedName'], 'updated name', 'Updated Object Name').commit()
 *
 * @example Update item of map
 * const m: Map<number, string> = new Map()
 * m.push(1, 'fff')
 * History.updateMap(m, 1, 'updated fff', 'Updated Map Item')
 *
 * @example Transaction of 2 actions and naming of transaction
 * const o = { firstName: 'test first name', lastName: 'test last name'}
 * History.startTransaction('Update 2 values')
 * History.updateValue(o, ['firstName'], 'updated first name').commit()
 * History.updateValue(o, ['lastName'], 'updated last name').commit()
 * History.commitTransaction()
 *
 * @example Emit function after action execution
 * const o = { name: 'test name'}
 * History.updateValue(o, ['name'], 'updated name', 'Updated Object Name').emit(() => console.log(o.name)).commit()
 */

/** Private enumaration to determine the value (new value or old value) should be applied during action */
enum HistoryValue {
    New,
    Old
}

/** Private non-generic interface for generic `HistoryAction<V>` */
interface IHistoryAction {
    readonly data: IHistoryData
    apply(value: HistoryValue): number
}

/** Private interface hack to access properties of objects via `any` */
interface ITargetInfo {
    [key: string]: any
}

/** Private interface for values to be used during actions */
interface IValueInfo<V> {
    value: V
    exists: boolean
}

/** Private interface to be able to use the entity_number from provided object */
interface IEntityNumber {
    entity_number: number
}

/** Interface for providing additional data for action */
interface IHistoryData {
    readonly entity_number: number
    readonly type: 'init' | 'add' | 'del' | 'mov' | 'upd'
    readonly other_entity?: number
}

/** Interface for further enhancing actions */
interface IHistoryOptions {
    /** Change type of action */
    type(type: 'init' | 'add' | 'del' | 'mov' | 'upd'): IHistoryOptions

    /** Privde other/related entity number */
    other_entity(other_entity: number): IHistoryOptions

    /** Emit function after executing action */
    emit(f: (value: any, oldValue: any) => void): IHistoryOptions

    /** Commit action */
    commit(): IHistoryOptions
}

/** Implementation for IHistoryData interface */
class HistoryData implements IHistoryData {

    /** Entity number */
    public entity_number: number

    /** Action type */
    public type: 'init' | 'add' | 'del' | 'mov' | 'upd' = 'upd'

    /** Other entity */
    public other_entity?: number

    constructor(entity_number: number) {
        this.entity_number = entity_number
    }
}

/** Private class for historical actions */
class HistoryAction<V> implements IHistoryAction, IHistoryOptions {

    /** Field to store old value (=overwritten value) */
    private readonly m_OldValue: IValueInfo<V>

    /** Field to store new value (=overwriting value) */
    private readonly m_NewValue: IValueInfo<V>

    /** Field to store data associated with historical change */
    private readonly m_Data: HistoryData

    /** Field to store apply value action */
    private readonly m_Apply: (value: IValueInfo<V>) => void

    /** Field to store functions to emit after execution of action */
    private readonly m_Emits: Array<((value: any, oldValue: any) => void)>

    /** Field to store description */
    private readonly m_Text: string

    constructor(oldValue: IValueInfo<V>, newValue: IValueInfo<V>, data: HistoryData, apply: (value: IValueInfo<V>) => void, text?: string) {
        this.m_OldValue = oldValue
        this.m_NewValue = newValue
        this.m_Data = data
        this.m_Apply = apply
        this.m_Emits = []
        this.m_Text = text
    }

    /**
     * Commit the action to the history
     * This allows for emits to be set up first
     */
    public commit() {
        // If no transaction active, apply single history action trough transaction
        if (s_Transaction === undefined) {
            const transaction = new HistoryEntry(this.m_Text)
            transaction.push(this)
            s_CommitTransaction(transaction)

            this.apply()
        }

        return this
    }

    /**
     * Execute action and therfore apply value
     * @param value Whether to apply the new or the old value (Default: New)
     */
    public apply(value: HistoryValue = HistoryValue.New): number {

        const valueInfo = value === HistoryValue.New ? this.m_NewValue : this.m_OldValue
        const oldValueInfo = value === HistoryValue.New ? this.m_OldValue : this.m_NewValue

        this.m_Apply(valueInfo)

        if (this.m_Emits.length > 0) {
            for (const f of this.m_Emits) {
                f(valueInfo.value, oldValueInfo.value)
            }
        }

        return this.m_Data.entity_number
    }

    /** Historical action associated data */
    public get data(): IHistoryData {
        return this.m_Data
    }

    /** Change type of action */
    public type(type: 'init' | 'add' | 'del' | 'mov' | 'upd'): IHistoryOptions {
        this.m_Data.type = type
        return this
    }

    /** Privde other/related entity number */
    public other_entity(other_entity: number): IHistoryOptions {
        this.m_Data.other_entity = other_entity
        return this
    }

    /** Emit function after executing action */
    public emit(f: (value: any, oldValue: any) => void): IHistoryOptions {
        this.m_Emits.push(f)
        return this
    }
}

/** Historical entries */
class HistoryEntry {

    /** Field to store description */
    private readonly m_Text: string

    /** Field to store historical actions */
    private readonly m_Actions: IHistoryAction[]

    constructor(text?: string) {
        this.m_Text = text
        this.m_Actions = []
    }

    /**
     * Execute all actions and therfore apply all values of this transaction
     * @param value Whether to apply the new or the old values (Default: New)
     * @returns False if there were no actions to be executed
     */
    public apply(value: HistoryValue = HistoryValue.New): boolean {
        if (this.m_Actions.length === 0) return false

        const entityNumbers: number[] = []
        for (const action of this.m_Actions) {
            entityNumbers.push(action.apply(value))
        }
        // if (this.m_Text !== undefined) console.log(`[${entityNumbers.join(',')}]: ${this.m_Text}`)

        return true
    }

    /** Undo all actions from this entry */
    public undo() {
        const entityNumbers: number[] = []
        for (const action of this.m_Actions) {
            entityNumbers.push(action.apply(HistoryValue.Old))
        }
        if (this.m_Text !== undefined) console.log(`[${entityNumbers.join(',')}]: UNDO ${this.m_Text}`)
    }

    /** Undo all actions from this entry */
    public redo() {
        const entityNumbers: number[] = []
        for (const action of this.m_Actions) {
            entityNumbers.push(action.apply(HistoryValue.New))
        }
        if (this.m_Text !== undefined) console.log(`[${entityNumbers.join(',')}]: REDO ${this.m_Text}`)
    }

    /** Log all actions (used during transaction commit as apply is not executed there) */
    public log() {
        const entityNumbers: number[] = this.m_Actions.map(a => a.data.entity_number)
        if (this.m_Text !== undefined) console.log(`[${entityNumbers.join(',')}]: ${this.m_Text}`)
    }

    /** Add action to this entry */
    public push(action: IHistoryAction) {
        this.m_Actions.push(action)
    }

    /** Latest historical action associated data of this transaction */
    public get data(): IHistoryData {
        return this.m_Actions.length > 0 ? this.m_Actions[this.m_Actions.length - 1].data : undefined
    }
}

/** Static non-global field to store current history index */
let s_HistoryIndex = 0

/** Static non-gloabl field to store historical entries */
let s_HistoryEntries: HistoryEntry[] = []

/** Count how many times a 'startTransaction' was called so we know when 'commitTransaction' actually needs to apply */
let s_TransactionCount = 0

/** Static non-global field to hold active transaction entry */
let s_Transaction: HistoryEntry

/** Perform update value action on object and store in history  */
function updateValue<T extends IEntityNumber, V>(
    target: T, path: string[], value: V, text?: string, remove: boolean = false): IHistoryOptions {

    const oldValue: IValueInfo<V> = s_GetValue<V>(target, path)
    const newValue: IValueInfo<V> = { value, exists: !remove }
    const data: HistoryData = new HistoryData(target.entity_number)

    const historyAction: HistoryAction<V> = new HistoryAction(oldValue, newValue, data, (v: IValueInfo<V>) => {
        if (!v.exists) {
            const current = s_GetValue(target, path)
            if (current.exists) {
                s_DeleteValue(target, path)
            }
        } else {
            s_SetValue(target, path, v)
        }
    }, text)

    // If transaction is active, add the new historyAction to it
    if (s_Transaction) s_Transaction.push(historyAction)

    return historyAction
}

/** Perform change to map and store in history */
function updateMap<K extends number, V extends IEntityNumber>(
    target: Map<K, V>, key: K, value: V, text?: string, remove: boolean = false): IHistoryOptions {

    const oldValue: IValueInfo<V> = target.has(key) ?
        { value: target.get(key), exists: true } :
        { value: undefined, exists: false }
    const newValue: IValueInfo<V> = { value, exists: !remove }
    const data: IHistoryData = new HistoryData(key)

    const historyAction: HistoryAction<V> = new HistoryAction(oldValue, newValue, data, (v: IValueInfo<V>) => {
        if (!v.exists) {
            if (target.has(key)) {
                target.delete(key)
            }
        } else {
            target.set(key, v.value)
        }
    }, text)

    // If transaction is active, add the new historyAction to it
    if (s_Transaction) s_Transaction.push(historyAction)

    return historyAction
}

/** Return true if there are any actions left for undo */
function canUndo(): boolean {
    return s_HistoryIndex > 0
}

/** Return data associated with next undo action */
function getUndoPreview(): IHistoryData {
    return s_HistoryEntries[s_HistoryIndex - 1].data
}

/** Undo last action stored in history */
function undo() {
    const historyEntry: HistoryEntry = s_HistoryEntries[s_HistoryIndex - 1]
    historyEntry.undo()
    s_HistoryIndex--
}

/** Return true if there are any actions left for redo */
function canRedo(): boolean {
    return s_HistoryIndex < s_HistoryEntries.length
}

/** Return data associated with next redo action */
function getRedoPreview(): IHistoryData {
    return s_HistoryEntries[s_HistoryIndex].data
}

/** Redo last undone action stored in history */
function redo() {
    const historyEntry: HistoryEntry = s_HistoryEntries[s_HistoryIndex]
    historyEntry.redo()
    s_HistoryIndex++
}

/**
 * Start a new multiple action transaction
 * @param text Description of transaction which will be logged
 * @returns True if new transaction was started | False if there is an existing transaction in progress
 */
function startTransaction(text?: string): boolean {
    s_TransactionCount++

    if (s_Transaction !== undefined) return false

    s_Transaction = new HistoryEntry(text)
    return true
}

/**
 * Commit an in-progress transaction and push it into the history
 * @returns True if transaction was committed | False if there was not transaction in progress
 */
function commitTransaction(force = false) {
    s_TransactionCount--

    if (s_TransactionCount !== 0 && !force) return false

    if (s_Transaction === undefined) return false

    if (s_Transaction.apply()) {
        s_CommitTransaction(s_Transaction)
    }

    s_Transaction = undefined
    return true
}

/** Private function to get value of an object from a specific object path */
function s_GetValue<V>(obj: ITargetInfo, path: string[]): IValueInfo<V> {
    if (path.length === 1) {
        if (obj.hasOwnProperty(path[0])) {
            return { value: obj[path[0]], exists: true } /* tslint:disable-line:no-unsafe-any */
        } else {
            return { value: undefined, exists: false }
        }
    } else {
        return s_GetValue(obj[path[0]] as ITargetInfo, path.slice(1))
    }
}

/** Private function to set value of an object on a sepcific path */
function s_SetValue(obj: ITargetInfo, path: string[], value: any) {
    if (path.length === 1) {
        /* tslint:disable-next-line:no-unsafe-any */
        obj[path[0]] = value.value
    } else {
        s_SetValue(obj[path[0]] as ITargetInfo, path.slice(1), value)
    }
}

/** Private function to delete value of an object at a specific path  */
function s_DeleteValue(obj: ITargetInfo, path: string[]) {
    if (path.length === 1) {
        if (Array.isArray(obj)) {
            obj.splice(Number(path[0]), 1)
        } else {
            delete obj[path[0]] /* tslint:disable-line:no-dynamic-delete */
        }
    } else {
        s_DeleteValue(obj[path[0]] as ITargetInfo, path.slice(1))
    }
}

/** Private central function to commit a transaction */
function s_CommitTransaction(transaction: HistoryEntry) {
    transaction.log()
    while (s_HistoryEntries.length > s_HistoryIndex) { s_HistoryEntries.pop() } // Slice would need value re-assignment - hence not used on purpose
    s_HistoryEntries.push(transaction)
    s_HistoryIndex++
}

/** Resets the History (removes all history entries) */
function reset() {
    s_HistoryIndex = 0
    s_HistoryEntries = []
}

export {
    IHistoryData,
    IHistoryOptions,
    updateValue,
    updateMap,
    canUndo,
    getUndoPreview,
    undo,
    canRedo,
    getRedoPreview,
    redo,
    startTransaction,
    commitTransaction,
    reset
}
