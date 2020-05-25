import { TextStyle } from 'pixi.js'

const colors = {
    text: {
        title: 0xffe6c0,
        normal: 0xfafafa,
        link: 0x03a9f4,
        accent: 0xff8a65,
    },
    controls: {
        button: {
            border: 1,
            background: { color: 0x646464, alpha: 1 },
            hover: { color: 0xb16925, alpha: 0.5 },
            active: { color: 0xb16925, alpha: 1 },
        },
        checkbox: {
            foreground: { color: 0xcccccc },
            background: { color: 0xcccccc, alpha: 0.5 },
            checkmark: { color: 0x000000, alpha: 1 },
            hover: { color: 0xb16925, alpha: 0.7 },
        },
        enable: {
            text: { color: 0xfafafa },
            hover: { color: 0xffba7a },
            active: { color: 0xff9e44 },
        },
        panel: {
            background: { color: 0x303030, alpha: 1, border: 2 },
        },
        slider: {
            slidebar: { color: 0xe2e2e2, p0: -95, p1: -80, p2: -10, p3: 0 },
            button: { color: 0x58585a, p0: 15, p1: 5, p2: -10, p3: -50 },
            hover: { color: 0xb16925, p0: 15, p1: 5, p2: -10, p3: -50 },
            value: { color: 0xb16925, p0: 15, p1: 5, p2: -10, p3: -50 },
        },
        slot: {
            hover: { color: 0xcccccc },
        },
        switch: {
            background: { color: 0x58585a, p0: 15, p1: 5, p2: -10, p3: -50 },
            hover: { color: 0xb16925, p0: 15, p1: 5, p2: -10, p3: -50 },
            line: { color: 0x646464, p0: -25, p1: -50, p2: 25, p3: 0 },
        },
        textbox: {
            foreground: { color: 0x000000 },
            background: { color: 0xe2e2e2, alpha: 1 },
            active: { color: 0xeeeeee, alpha: 1 },
        },
    },
    dialog: {
        background: { color: 0x303030, alpha: 1, border: 2 },
        line: { background: { color: 0x646464, alpha: 0.7, border: 1 } },
    },
    editor: {
        sprite: { background: { color: 0x646464, alpha: 0.7 } },
    },
    quickbar: {
        background: { color: 0x303030, alpha: 1, border: 2 },
    },
}

const fontFamily = "'Roboto', sans-serif"

const styles = {
    controls: {
        checkbox: new TextStyle({
            fill: colors.controls.checkbox.foreground.color,
            fontFamily,
            fontWeight: '300',
            fontSize: 14,
        }),
        enable: {
            text: new TextStyle({
                fill: colors.controls.enable.text.color,
                fontFamily,
                fontWeight: '500',
                fontSize: 14,
            }),
            hover: new TextStyle({
                fill: colors.controls.enable.hover.color,
                fontFamily,
                fontWeight: '500',
                fontSize: 14,
            }),
            active: new TextStyle({
                fill: colors.controls.enable.active.color,
                fontFamily,
                fontWeight: '500',
                fontSize: 14,
            }),
        },
        textbox: new TextStyle({
            fill: colors.controls.textbox.foreground.color,
            fontFamily,
            fontWeight: '500',
            fontSize: 14,
        }),
    },
    dialog: {
        title: new TextStyle({
            fill: colors.text.title,
            fontFamily,
            fontWeight: '500',
            fontSize: 20,
        }),
        label: new TextStyle({
            fill: colors.text.normal,
            fontFamily,
            fontWeight: '300',
            fontSize: 14,
        }),
    },
    icon: {
        amount: new TextStyle({
            fill: colors.text.normal,
            fontFamily,
            fontWeight: '500',
            fontSize: 13,
            stroke: 0x000000,
            strokeThickness: 2,
        }),
    },
    debug: {
        text: new TextStyle({
            fill: colors.text.normal,
            fontFamily,
        }),
    },
}

export { colors, styles }
