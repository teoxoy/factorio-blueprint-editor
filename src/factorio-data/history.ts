interface IHistoryItem {
    readonly text: string
    readonly data: IHistoryData
    readonly master: IHistoryItem
    readonly links: IHistoryItem[]
    undo(): void
    redo(): void
}

interface ITargetInfo {
    [key: string]: any
}

interface IValueInfo<V> {
    value: V
    exists: boolean
}

interface IHistoryData {
    readonly type: 'init' | 'add' | 'del' | 'mov' | 'upd'
    readonly entity_number: number
    readonly other_entity?: number
}

/** Historical data representation */
class HistoryItem<V> implements IHistoryItem {

    /** Field to store old value (=overwritten value) */
    private readonly m_OldValue: IValueInfo<V>

    /** Field to store new value (=overwriting value) */
    private readonly m_NewValue: IValueInfo<V>

    /** Field to store annotation of historical change */
    private readonly m_Text: string

    /** Field to store data associated with historical change */
    private readonly m_Data: IHistoryData

    /** Field to store info if the historical action is linked to master historical action and which one */
    private readonly m_Master: IHistoryItem

    /** Field to store references to linked historical action linked to this one */
    private readonly m_Links: IHistoryItem[] = []

    /** Field to store apply value action */
    private readonly m_Apply: (value: IValueInfo<V>) => void

    constructor(oldValue: IValueInfo<V>, newValue: IValueInfo<V>,
                text: string, data: IHistoryData, master: IHistoryItem,
                apply: (value: IValueInfo<V>) => void) {
        this.m_OldValue = oldValue
        this.m_NewValue = newValue
        this.m_Text = text
        this.m_Data = data
        this.m_Master = master
        this.m_Apply = apply
    }

    /** Apply */
    public apply(value: IValueInfo<V>) {
        this.m_Apply(value)
        if (this.m_Text !== undefined) console.log(`[${this.m_Data.entity_number}]: ${this.m_Text}`)
    }

    /** Undo */
    public undo() {
        this.m_Apply(this.m_OldValue)
        if (this.m_Text !== undefined) console.log(`[${this.m_Data.entity_number}]: UNDO: ${this.m_Text}`)
    }

    /** Redo */
    public redo() {
        this.m_Apply(this.m_NewValue)
        if (this.m_Text !== undefined) console.log(`[${this.m_Data.entity_number}]: REDO: ${this.m_Text}`)
    }

    /** Historical action associated data */
    public get text(): string {
        return this.m_Text
    }

    /** Historical action associated data */
    public get data(): IHistoryData {
        return this.m_Data
    }

    /** Indicate which historical action is the master */
    public get master(): IHistoryItem {
        return this.m_Master
    }

    /** Other Historical actions linked to this one  */
    public get links(): IHistoryItem[] {
        return this.m_Links
    }
}

/** Static non-gloabl field to store historical actions */
const s_HistoryItems: IHistoryItem[] = []

/** Static non-global field to store current history index */
let s_HistoryIndex = 0

/** Perform update value action on object and store in history  */
function updateValue<T, V>(target: T, path: string[], value: V, text?: string, data?: IHistoryData, remove: boolean = false, link?: number) {

    console.log(s_HistoryIndex)

    const oldValue: IValueInfo<V> = getValue<V>(target, path)
    const newValue: IValueInfo<V> = { value, exists: remove ? false : true }
    const master: IHistoryItem = link !== undefined ? s_HistoryItems[link] : undefined

    const historyItem: HistoryItem<V> = new HistoryItem(oldValue, newValue, text, data, master, (v: IValueInfo<V>) => {
        if (!v.exists) {
            const current = getValue(target, path)
            if (current.exists) {
                delValue(target, path)
            }
        } else {
            setValue(target, path, v)
        }
    })
    historyItem.apply(newValue)

    while (s_HistoryItems.length > s_HistoryIndex) { s_HistoryItems.pop() } // Slice would need value re-assignment - hence not used on purpose
    s_HistoryItems.push(historyItem)
    s_HistoryIndex++

    if (master !== undefined) {
        master.links.push(historyItem)
    }
}

/** Perform change to map and store in history */
function updateMap<K, V>(targetMap: Map<K, V>, key: K, value: V, text?: string, data?: IHistoryData, remove: boolean = false): number {

    console.log(s_HistoryIndex)
    console.log(s_HistoryItems)

    const oldValue: IValueInfo<V> = targetMap.has(key) ?
        { value: targetMap.get(key), exists: true } :
        { value: undefined, exists: false }
    const newValue: IValueInfo<V> = { value, exists: remove ? false : true }

    const historyItem: HistoryItem<V> = new HistoryItem(oldValue, newValue, text, data, undefined, (v: IValueInfo<V>) => {
        if (!v.exists) {
            if (targetMap.has(key)) {
                targetMap.delete(key)
            }
        } else {
            targetMap.set(key, v.value)
        }
    })
    historyItem.apply(newValue)

    while (s_HistoryItems.length > s_HistoryIndex) { s_HistoryItems.pop() } // Slice would need value re-assignment - hence not used on purpose
    s_HistoryItems.push(historyItem)
    s_HistoryIndex++

    console.log(s_HistoryItems)
    console.log(s_HistoryIndex)

    return s_HistoryIndex - 1
}

/** Return true if there are any actions left for undo */
function canUndo(): boolean {
    return s_HistoryIndex > 0
}

/** Return data associated with next undo action */
function getUndoPreview(): IHistoryData {
    return s_HistoryItems[s_HistoryIndex - 1].data
}

/** Undo last action stored in history */
function undo() {
    console.log(s_HistoryIndex)
    console.log(s_HistoryItems)
    const historyItem: IHistoryItem = s_HistoryItems[s_HistoryIndex - 1]
    if (historyItem.master !== undefined) {
        for (const childItem of historyItem.master.links) {
            childItem.undo()
            s_HistoryIndex--
        }
        historyItem.master.undo()
        s_HistoryIndex--
    } else {
        historyItem.undo()
        s_HistoryIndex--
    }
    console.log(s_HistoryItems)
    console.log(s_HistoryIndex)
}

/** Return true if there are any actions left for redo */
function canRedo(): boolean {
    return s_HistoryIndex < s_HistoryItems.length
}

/** Return data associated with next redo action */
function getRedoPreview(): IHistoryData {
    return s_HistoryItems[s_HistoryIndex].data
}

/** Redo last undone action stored in history */
function redo() {
    console.log(s_HistoryIndex)
    console.log(s_HistoryItems)
    const historyItem: IHistoryItem = s_HistoryItems[s_HistoryIndex]
    if (historyItem.links.length > 0) {
        for (const childItem of historyItem.links) {
            childItem.redo()
            s_HistoryIndex++
        }
    }
    historyItem.redo()
    s_HistoryIndex++
    console.log(s_HistoryItems)
    console.log(s_HistoryIndex)
}

/** Get Value of an object from a specific object path */
function getValue<V>(obj: ITargetInfo, path: string[]): IValueInfo<V> {
    if (path.length === 1) {
        if (obj.hasOwnProperty(path[0])) {
            return { value: obj[path[0]], exists: true } /* tslint:disable-line:no-unsafe-any */
        } else {
            return { value: undefined, exists: false }
        }
    } else {
        return getValue(obj[path[0]] as ITargetInfo, path.slice(1))
    }
}

/** Set value of an object on a sepcific path */
function setValue(obj: ITargetInfo, path: string[], value: any) {
    if (path.length === 1) {
        obj[path[0]] = value
    } else {
        setValue(obj[path[0]] as ITargetInfo, path.slice(1), value)
    }
}

/** Delete value of an object at a specific path  */
function delValue(obj: ITargetInfo, path: string[]) {
    if (path.length === 1) {
        delete obj[path[0]] /* tslint:disable-line:no-dynamic-delete */
    } else {
        delValue(obj[path[0]] as ITargetInfo, path.slice(1))
    }
}

export {
    IHistoryData,
    updateValue,
    updateMap,
    canUndo,
    getUndoPreview,
    undo,
    canRedo,
    getRedoPreview,
    redo
}
