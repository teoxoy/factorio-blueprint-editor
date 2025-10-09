import {
    ColorSource,
    Container,
    Graphics,
    Sprite,
    Text,
    CanvasTextMetrics,
    RenderTexture,
} from 'pixi.js'
import FD, { Color, ColorWithAlpha, getColor } from '../../core/factorioData'
import { styles } from '../style'
import G from '../../common/globals'
import { IngredientPrototype, IconData, ProductPrototype, ItemPrototype } from 'factorio:prototype'

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
    return (
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
}

const rect_map: Map<string, RenderTexture> = new Map()

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
): Sprite {
    const key = `${width}-${height}-${background}-${alpha}-${border}-${pressed}`
    const existing_texture = rect_map.get(key)
    if (existing_texture) {
        return new Sprite(existing_texture)
    }

    const rectangle = new Graphics()
    rectangle.alpha = alpha
    rectangle.rect(0, 0, width, height).fill(background)

    if (border > 0) {
        rectangle
            .moveTo(0, height)
            .lineTo(0, 0)
            .lineTo(width, 0)
            .stroke({
                width: 1,
                color: ShadeColor(background, pressed ? -12.5 : 22.5),
                alignment: 1,
            })
            .lineTo(width, height)
            .lineTo(0, height)
            .stroke({
                width: 1,
                color: ShadeColor(background, pressed ? 10 : -7.5),
                alignment: 1,
            })
    }
    if (border > 1) {
        rectangle
            .moveTo(1, height - 1)
            .lineTo(1, 1)
            .lineTo(width - 1, 1)
            .stroke({
                width: 1,
                color: ShadeColor(background, pressed ? -10 : 20),
                alignment: 1,
            })
            .lineTo(width - 1, height - 1)
            .lineTo(1, height - 1)
            .stroke({
                width: 1,
                color: ShadeColor(background, pressed ? 7.5 : -5),
                alignment: 1,
            })
    }
    if (border > 2) {
        rectangle
            .moveTo(2, height - 2)
            .lineTo(2, 2)
            .lineTo(width - 2, 2)
            .stroke({
                width: 1,
                color: ShadeColor(background, pressed ? -7.5 : 17.5),
                alignment: 1,
            })
            .lineTo(width - 2, height - 2)
            .lineTo(2, height - 2)
            .stroke({
                width: 1,
                color: ShadeColor(background, pressed ? 5 : -2.5),
                alignment: 1,
            })
    }

    const renderTexture = RenderTexture.create({
        width: width,
        height: height,
    })

    G.app.renderer.render({ container: rectangle, target: renderTexture })

    rectangle.destroy()

    rect_map.set(key, renderTexture)

    const s = new Sprite(renderTexture)

    return s
}

/**
 * Draw Control Face
 *
 * @param w - Width
 * @param h - Height
 * @param f - Factor
 * @param c - Background Color
 * @param a - Background Alpha
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
): Container {
    const out = new Container()

    const wf = w * f
    const hf = h * f

    const mask = new Graphics()
    mask.roundRect(0, 0, wf, hf, 6).fill(0x000000)

    const face = new Graphics()
    face.rect(0, 0, wf, hf)
        .fill(colorAndAlphaToColorSource(c, a))
        .moveTo(wf, 0)
        .lineTo(wf, hf)
        .lineTo(0, hf)
        .stroke({ width: f, color: ShadeColor(c, p3), alpha: a, alignment: 1 })
        .moveTo(wf - f, f)
        .lineTo(wf - f, hf - f)
        .lineTo(f, hf - f)
        .stroke({ width: f, color: ShadeColor(c, p2), alpha: a, alignment: 1 })
        .moveTo(wf - f, f)
        .lineTo(f, f)
        .lineTo(f, hf - f)
        .stroke({ width: f, color: ShadeColor(c, p1), alpha: a, alignment: 1 })
        .moveTo(wf, 0)
        .lineTo(0, 0)
        .lineTo(0, hf)
        .stroke({ width: f, color: ShadeColor(c, p0), alpha: a, alignment: 1 })
    face.scale.set(1 / f, 1 / f)
    face.mask = mask

    out.addChild(mask)
    out.addChild(face)
    out.cacheAsTexture(true)

    return out
}

/** Create Icon from Sprite Item information */
function CreateIcon(
    itemName: string,
    maxSize = 32,
    setAnchor = true,
    darkBackground = false
): Container {
    if (darkBackground) {
        const item = FD.items[itemName]
        if (item) {
            if (item.dark_background_icons) {
                return generateIcons(item.dark_background_icons)
            } else if (item.dark_background_icon) {
                return generateIcon(item.dark_background_icon, item.dark_background_icon_size)
            }
        }
    }

    const item =
        FD.items[itemName] ||
        FD.fluids[itemName] ||
        FD.recipes[itemName] ||
        FD.signals[itemName] ||
        // inventory group icon is not present in FD.items
        FD.inventoryLayout.find(g => g.name === itemName)

    if (item.icons) {
        return generateIcons(item.icons)
    } else if (item.icon) {
        return generateIcon(item.icon, item.icon_size)
    } else {
        throw new Error('Internal Error!')
    }

    function generateIcon(filename: string, icon_size: number = 64): Sprite {
        const texture = G.getTexture(filename, 0, 0, icon_size, icon_size)
        const sprite = new Sprite(texture)
        sprite.scale.set(maxSize / icon_size)
        if (setAnchor) {
            sprite.anchor.set(0.5)
        }
        return sprite
    }

    function generateIcons(icons: readonly IconData[]): Container {
        const img = new Container()
        for (const icon of icons) {
            const sprite = generateIcon(icon.icon, icon.icon_size)
            if (icon.scale) {
                sprite.scale.set(icon.scale, icon.scale)
            }
            if (icon.shift) {
                sprite.position.set(icon.shift[0], icon.shift[1])
            }
            if (icon.tint) {
                applyTint(sprite, getColor(icon.tint))
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
 * @param host - Container on top of which the icon shall be created
 * @param x - Horizontal position of icon from top left corner
 * @param y - Vertical position of icon from top left corner
 * @param name - Name if item
 * @param amount - Amount to show
 */
function CreateIconWithAmount(
    host: Container,
    x: number,
    y: number,
    name: string,
    amount: number = 1
): void {
    const icon = CreateIcon(name, undefined, false)
    icon.position.set(x, y)
    host.addChild(icon)

    const amountString = amount < 1000 ? amount.toString() : `${Math.floor(amount / 1000)}k`
    const text = new Text({ text: amountString, style: styles.icon.amount })
    text.anchor.set(1, 1)
    text.position.set(x + 33, y + 33)
    host.addChild(text)
}

function CreateRecipe(
    host: Container,
    x: number,
    y: number,
    ingredients: readonly IngredientPrototype[],
    results: readonly ProductPrototype[],
    energy_required: number = 0.5
): void {
    let nextX = x

    for (const i of ingredients) {
        CreateIconWithAmount(host, nextX, y, i.name, i.amount)
        nextX += 36
    }

    nextX += 2
    const timeText = `=${energy_required}s>`
    const timeSize = CanvasTextMetrics.measureText(timeText, styles.dialog.label)
    const timeObject = new Text({ text: timeText, style: styles.dialog.label })
    timeObject.position.set(nextX, 6 + y)
    host.addChild(timeObject)
    nextX += timeSize.width + 6

    for (const r of results) {
        CreateIconWithAmount(host, nextX, y, r.name, r.amount)
        nextX += 36
    }
}

function colorAndAlphaToColorSource(color: number, a: number): ColorSource {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    return { r, g, b, a }
}

function applyTint(s: { tint: ColorSource; alpha: number }, tint: ColorWithAlpha): void {
    const r = tint.r || 0
    const g = tint.g || 0
    const b = tint.b || 0
    s.tint = rgbToColorSource(r, g, b)
    s.alpha = tint.a || 1
}

function rgbToColorSource(r: number, g: number, b: number): ColorSource {
    return Math.floor(r * 255) * 0x10000 + Math.floor(g * 255) * 0x100 + Math.floor(b * 255)
}

export default {
    ShadeColor,
    DrawRectangle,
    DrawControlFace,
    CreateIcon,
    CreateIconWithAmount,
    CreateRecipe,
    applyTint,
    colorAndAlphaToColorSource,
    rgbToColorSource,
}
