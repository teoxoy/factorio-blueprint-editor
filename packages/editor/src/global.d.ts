// hack, see https://github.com/pixijs/pixijs/issues/8957
declare namespace GlobalMixins {
    interface DisplayObjectEvents {
        close: []
        changed: []
        mode: [mode: EditorMode]
        selected: [index: number, count: number]
    }
}
