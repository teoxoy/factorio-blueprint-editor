declare module '*.lua' {
    const content: string
    export default content
}

declare module '*.wasm' {
    const name: string
    export default name
}
