import keyboardJS from 'keyboardjs'

// Wrapper for keyboardJS that adds some other functionality too

const pressing = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    get movingViaWASD() {
        return this.w !== this.s || this.a !== this.d
    }
}

let boundKeyCombos: Array<{
    keyCombo: string;
    pressHandler(e: keyboardJS.KeyEvent): void;
    releaseHandler(e: keyboardJS.KeyEvent): void;
}> = []

function bindKeyCombo(keyCombo: string, pressHandler?: (e: keyboardJS.KeyEvent) => void, releaseHandler?: (e: keyboardJS.KeyEvent) => void) {
    keyboardJS.bind(keyCombo, pressHandler, releaseHandler)
    boundKeyCombos.push({ keyCombo, pressHandler, releaseHandler })
}

function unbindKeyCombo(keyCombo: string, pressHandler?: (e: keyboardJS.KeyEvent) => void, releaseHandler?: (e: keyboardJS.KeyEvent) => void) {
    keyboardJS.unbind(keyCombo, pressHandler, releaseHandler)
    boundKeyCombos = boundKeyCombos
        .filter(kc => kc.keyCombo !== keyCombo && kc.pressHandler !== pressHandler && kc.releaseHandler !== releaseHandler)
}

// Wrapper for bindKeyCombo that preventsDefault on the pressHandler
function bind(keyCombo: string, pressHandler?: (e: keyboardJS.KeyEvent) => void, releaseHandler?: (e: keyboardJS.KeyEvent) => void) {
    const PRESSED = pressHandler
        ? (e: keyboardJS.KeyEvent) => { e.preventDefault(); pressHandler(e) }
        : undefined

    bindKeyCombo(keyCombo, PRESSED, releaseHandler)
}

function changeKeyCombo(oldKeyCombo: string, newKeyCombo: string) {
    boundKeyCombos
        .filter(kc => kc.keyCombo === oldKeyCombo)
        .forEach(kc => {
            unbindKeyCombo(oldKeyCombo, kc.pressHandler, kc.releaseHandler)
            bind(newKeyCombo, kc.pressHandler, kc.releaseHandler)
        })
}

export default {
    pressing,
    bind,
    unbind: unbindKeyCombo,
    changeKeyCombo,
    pause: keyboardJS.pause.bind(keyboardJS),
    resume: keyboardJS.resume.bind(keyboardJS)
}
