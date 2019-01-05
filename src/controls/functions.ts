/**
 * Shade Color
 *
 * @param color - The color to shade
 * @param percent - How many percent the color shall be shaded (+ makes it brigther / - makes it darker)
 */
function ShadeColor(color: number, percent: number): number  {
    const amt = Math.round(2.55 * percent)
    const R = (color >> 16) + amt
    const G = (color >> 8 & 0x00FF) + amt
    const B = (color & 0x0000FF) + amt
    // tslint:disable-next-line:whitespace
    return 0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)
}

/**
 * Draw Rectangle with Border
 *
 * @param width - Width of the Rectangle
 * @param height - Height of the Rectangle
 * @param background - Background Color of the Rectangle
 * @param alpha - Background Alpha of the Rectangle (1...no transparency)
 * @param border - Border Width of the Rectangle (0...no border)
 * @param pressed - True if the Rectangle Border shall apear as the Rectangle is pressed rather than raised
 */
function DrawRectangle(width: number, height: number, background: number, alpha = 1, border = 0, pressed = false): PIXI.Graphics {
    const rectangle = new PIXI.Graphics()
    rectangle.alpha = alpha
    rectangle.beginFill(background)
    if (border === 0) {
        rectangle.drawRect(0, 0, width, height)
    } else {
        if (border > 0) {
            rectangle
                .lineStyle(1, ShadeColor(background, pressed ? -12.5 : 22.5), 1, 0)
                .moveTo(0, height)
                .lineTo(0, 0)
                .lineTo(width, 0)
                .lineStyle(1, ShadeColor(background, pressed ? 10 : -7.5), 1, 0)
                .lineTo(width, height)
                .lineTo(0, height)
        }
        if (border > 1) {
            rectangle.lineStyle(1, ShadeColor(background, pressed ? -10 : 20), 1, 0)
                .moveTo(1, height - 1)
                .lineTo(1, 1)
                .lineTo(width - 1, 1)
                .lineStyle(1, ShadeColor(background, pressed ? 7.5 : -5), 1, 0)
                .lineTo(width - 1, height - 1)
                .lineTo(1, height - 1)
        }
        if (border > 2) {
            rectangle.lineStyle(1, ShadeColor(background, pressed ? -7.5 : 17.5), 1, 0)
                .moveTo(2, height - 2)
                .lineTo(2, 2)
                .lineTo(width - 2, 2)
                .lineStyle(1, ShadeColor(background, pressed ? 5 : -2.5), 1, 0)
                .lineTo(width - 2, height - 2)
                .lineTo(2, height - 2)
        }
    }
    rectangle.endFill()
    return rectangle
}

export default {
    ShadeColor,
    DrawRectangle
}
