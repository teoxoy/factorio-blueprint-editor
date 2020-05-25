// eslint-disable-next-line spaced-comment
/// <reference types="emscripten" />
declare module '@fbe/lua-runtime' {
    interface IModule extends EmscriptenModule {
        cwrap: typeof cwrap
        addFunction: typeof addFunction
        UTF8ToString: typeof UTF8ToString
        allocateUTF8: typeof allocateUTF8
        getValue: typeof getValue
    }
    const createLuaEnv: (module?: Partial<EmscriptenModule>) => { then: (cb: (module: IModule) => void) => void }
    export default createLuaEnv
}
