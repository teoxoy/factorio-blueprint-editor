import createLuaEnv from '@fbe/lua-runtime'
import script from './script.lua'
import * as types from './types'

interface IFD {
    loadData: (modules: Record<string, Record<string, string>>) => Promise<void>
    items: Record<string, types.Item>
    fluids: Record<string, types.Fluid>
    signals: Record<string, types.VirtualSignal>
    recipes: Record<string, types.Recipe>
    entities: Record<string, types.Entity>
    tiles: Record<string, types.Tile>
    inventoryLayout: types.InventoryLayoutGroup[]
    utilitySprites: types.UtilitySprites
    // treesAndRocks: Record<string, types.TreeOrRock>
}

// @ts-ignore
const FD: IFD = { loadData }

async function loadData(modules: Record<string, Record<string, string>>): Promise<void> {
    return new Promise((resolve, reject) => {
        createLuaEnv({
            print: str => console.log('LUA', str),
            printErr: str => console.error('LUA', str),
            onAbort: reject
        }).then(LUA => {
            try {
                const passIsLualibFnPtr = LUA.cwrap('passIsLualibFnPtr', null, ['number'])
                const passGetFileFnPtr = LUA.cwrap('passGetFileFnPtr', null, ['number'])
                const run = LUA.cwrap('run', 'string', ['string'])

                const isLualibFnPtr = LUA.addFunction((ptr: number) => {
                    const key = LUA.UTF8ToString(ptr)
                    return !!modules.lualib[key]
                }, 'ii')
                passIsLualibFnPtr(isLualibFnPtr)

                const getFileFnPtr = LUA.addFunction((ptr: number, ptr2: number, errOnNotFound: boolean) => {
                    const key = LUA.UTF8ToString(ptr)
                    const modName = LUA.UTF8ToString(ptr2)
                    const module = modules[modName][key]
                    if (!module) {
                        if (errOnNotFound) {
                            throw new Error(`Module ${key} in mod ${modName} not found!`)
                        } else {
                            return LUA.allocateUTF8('')
                        }
                    }
                    return LUA.allocateUTF8(module)
                }, 'iiii')
                passGetFileFnPtr(getFileFnPtr)

                const rawDataString = run(script)
                    // convert every - to _ without file paths
                    .replace(/("(?!__base__|__core__)[^":]+?-[^":]+?")/g, (_: string, capture: string) =>
                        capture.replace(/-/g, '_')
                    )
                const data = JSON.parse(rawDataString)

                FD.items = data.items
                FD.fluids = data.fluids
                FD.signals = data.signals
                FD.recipes = data.recipes
                FD.entities = data.entities
                FD.tiles = data.tiles
                FD.inventoryLayout = data.inventoryLayout
                FD.utilitySprites = data.utilitySprites

                resolve()
            } catch (err) {
                reject(err)
            }
        })
    })
}

export function getModulesFor(entityName: string): types.Item[] {
    return (
        Object.keys(FD.items)
            .map(k => FD.items[k])
            .filter(item => item.type === 'module')
            // filter modules based on entity allowed_effects (ex: beacons don't accept productivity effect)
            .filter(
                item =>
                    !FD.entities[entityName].allowed_effects ||
                    Object.keys(item.effect).every(effect => FD.entities[entityName].allowed_effects.includes(effect))
            )
    )
}

export * from './types'
export default FD
