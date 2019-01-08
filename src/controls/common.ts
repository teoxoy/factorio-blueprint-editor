// TODO: Move the following items into proper locations
// The following items are objects which are commonly by controls

import G from '../globals'

const colors = {
    editor: {
        sprite: {
            background: { color: 0x646464, alpha: 0.7 }
        }
    }
}

const styles = {
    dialog: {
        title: new PIXI.TextStyle({
            fill: G.colors.text.normal,
            fontFamily: G.fontFamily,
            fontWeight: '500',
            fontSize: 20
        })
    }
}

export default {
    styles,
    colors
}
