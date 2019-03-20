import * as PIXI from 'pixi.js'
import FD from 'factorio-data'
import { AdjustmentFilter } from '@pixi/filter-adjustment'
import G from '../common/globals'

/**
 * Shade Color
 *
 * @param color - The color to shade
 * @param percent - How many percent the color shall be shaded (+ makes it brigther / - makes it darker)
 */
function ShadeColor(color: number, percent: number): number {
    const amt = Math.round(2.55 * percent)
    const R = (color >> 16) + amt
    const G = ((color >> 8) & 0x00ff) + amt
    const B = (color & 0x0000ff) + amt
    /* eslint-disable no-nested-ternary */
    return (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
    /* eslint-enable no-nested-ternary */
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
function DrawRectangle(
    width: number,
    height: number,
    background: number,
    alpha = 1,
    border = 0,
    pressed = false
): PIXI.Graphics {
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
            rectangle
                .lineStyle(1, ShadeColor(background, pressed ? -10 : 20), 1, 0)
                .moveTo(1, height - 1)
                .lineTo(1, 1)
                .lineTo(width - 1, 1)
                .lineStyle(1, ShadeColor(background, pressed ? 7.5 : -5), 1, 0)
                .lineTo(width - 1, height - 1)
                .lineTo(1, height - 1)
        }
        if (border > 2) {
            rectangle
                .lineStyle(1, ShadeColor(background, pressed ? -7.5 : 17.5), 1, 0)
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

/**
 * Draw Control Face
 *
 * @param w - Width
 * @param h - Height
 * @param f - Factor
 * @param c - Background Color
 * @param c - Background Alpha
 * @param p0 - Percent shade for brightest border
 * @param p1 - Percent shade for bright border
 * @param p2 - Percent shade for dark border
 * @param p3 - Percent shade for darkest border
 */
function DrawControlFace(
    w: number,
    h: number,
    f: number,
    c: number,
    a: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number
): PIXI.Graphics {
    const wf = w * f
    const hf = h * f

    const mask: PIXI.Graphics = new PIXI.Graphics()
    mask.beginFill(0x000000)
        .drawRoundedRect(0, 0, wf, hf, 6)
        .endFill()

    const face: PIXI.Graphics = new PIXI.Graphics()
    face.beginFill(c, a)
        .drawRect(0, 0, wf, hf)
        .endFill()
        .lineStyle(f, ShadeColor(c, p3), a, 0)
        .moveTo(wf, 0)
        .lineTo(wf, hf)
        .lineTo(0, hf)
        .lineStyle(f, ShadeColor(c, p2), a, 0)
        .moveTo(wf - f, f)
        .lineTo(wf - f, hf - f)
        .lineTo(f, hf - f)
        .lineStyle(f, ShadeColor(c, p1), a, 0)
        .moveTo(wf - f, f)
        .lineTo(f, f)
        .lineTo(f, hf - f)
        .lineStyle(f, ShadeColor(c, p0), a, 0)
        .moveTo(wf, 0)
        .lineTo(0, 0)
        .lineTo(0, hf)
    face.cacheAsBitmap = true
    face.scale.set(1 / f, 1 / f)
    face.mask = mask

    return face
}

/**
 * Create Icon from Sprite Item information
 * @param item - Item to create Sprite from
 * @param setAnchor - Temporar parameter to disable anchoring (this parameter may be removed again in the future)
 */
function CreateIcon(itemName: string, setAnchor: boolean = true): PIXI.DisplayObject {
    // inventory group icon is not present in FD.items
    const iconName = FD.items[itemName]
        ? FD.items[itemName].icon
        : FD.inventoryLayout.find(g => g.name === itemName).icon

    if (iconName !== undefined) {
        const icon = PIXI.Sprite.from(iconName)
        if (setAnchor) {
            icon.anchor.set(0.5, 0.5)
        }
        return icon
    }

    const icons = FD.items[itemName].icons
    if (icons !== undefined) {
        const img = new PIXI.Container()
        for (const icon of icons) {
            const sprite = PIXI.Sprite.from(icon.icon)
            if (icon.scale) {
                sprite.scale.set(icon.scale, icon.scale)
            }
            if (icon.shift) {
                sprite.position.set(icon.shift[0], icon.shift[1])
            }
            if (icon.tint) {
                const t = icon.tint
                sprite.filters = [
                    new AdjustmentFilter({
                        red: t.r,
                        green: t.g,
                        blue: t.b,
                        alpha: t.a || 1
                    })
                ]
            }
            if (setAnchor) {
                sprite.anchor.set(0.5, 0.5)
            }

            if (!setAnchor && icon.shift) {
                sprite.position.x += sprite.width / 2
                sprite.position.y += sprite.height / 2
            }

            img.addChild(sprite)
        }
        return img
    }
}

/**
 * Creates an icon with amount on host at coordinates
 * @param host - PIXI.Container on top of which the icon shall be created
 * @param x - Horizontal position of icon from top left corner
 * @param y - Vertical position of icon from top left corner
 * @param name - Name if item
 * @param amount - Amount to show
 */
function CreateIconWithAmount(host: PIXI.Container, x: number, y: number, name: string, amount: number) {
    const icon: PIXI.DisplayObject = CreateIcon(name, false)
    icon.position.set(x, y)
    host.addChild(icon)

    const amountString: string = amount < 1000 ? amount.toString() : `${Math.floor(amount / 1000)}k`
    const size: PIXI.TextMetrics = PIXI.TextMetrics.measureText(amountString, G.styles.icon.amount)
    const text = new PIXI.Text(amountString, G.styles.icon.amount)
    text.position.set(x + 33 - size.width, y + 33 - size.height)
    host.addChild(text)
}

function CreateRecipe(
    host: PIXI.Container,
    x: number,
    y: number,
    ingredients: FD.IngredientOrResult[],
    results: FD.IngredientOrResult[],
    time: number
) {
    let nextX = x

    for (const i of ingredients) {
        CreateIconWithAmount(host, nextX, y, i.name, i.amount)
        nextX += 36
    }

    nextX += 2
    const timeText = `=${time}s>`
    const timeSize: PIXI.TextMetrics = PIXI.TextMetrics.measureText(timeText, G.styles.dialog.label)
    const timeObject: PIXI.Text = new PIXI.Text(timeText, G.styles.dialog.label)
    timeObject.position.set(nextX, 6 + y)
    host.addChild(timeObject)
    nextX += timeSize.width + 6

    for (const r of results) {
        CreateIconWithAmount(host, nextX, y, r.name, r.amount)
        nextX += 36
    }
}

export default {
    ShadeColor,
    DrawRectangle,
    DrawControlFace,
    CreateIcon,
    CreateIconWithAmount,
    CreateRecipe
}
