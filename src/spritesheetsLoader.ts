import LRentitySpritesheetPNG from 'factorio-data/data/graphics/LREntitySpritesheet.png'
import LRentitySpritesheetCompressedPNG from 'factorio-data/data/graphics/LREntitySpritesheetCompressed.png'
import LRentitySpritesheetJSON from 'factorio-data/data/graphics/LREntitySpritesheet.json'
import HRentitySpritesheetPNG from 'factorio-data/data/graphics/HREntitySpritesheet.png'
import HRentitySpritesheetCompressedPNG from 'factorio-data/data/graphics/HREntitySpritesheetCompressed.png'
import HRentitySpritesheetJSON from 'factorio-data/data/graphics/HREntitySpritesheet.json'
import iconSpritesheetPNG from 'factorio-data/data/graphics/iconSpritesheet.png'
import iconSpritesheetJSON from 'factorio-data/data/graphics/iconSpritesheet.json'
import utilitySpritesheetPNG from 'factorio-data/data/graphics/utilitySpritesheet.png'
import utilitySpritesheetJSON from 'factorio-data/data/graphics/utilitySpritesheet.json'
import tilesSpritesheetPNG from 'factorio-data/data/graphics/tileSpritesheet.png'
import tilesSpritesheetJSON from 'factorio-data/data/graphics/tileSpritesheet.json'
import * as PIXI from 'pixi.js'

import G from './common/globals'
import util from './common/util'

function getAllPromises() {
    return [
        [
            /* eslint-disable no-nested-ternary */
            G.quality.hr
                ? G.quality.compressed
                    ? HRentitySpritesheetCompressedPNG
                    : HRentitySpritesheetPNG
                : G.quality.compressed
                ? LRentitySpritesheetCompressedPNG
                : LRentitySpritesheetPNG,
            /* eslint-enable no-nested-ternary */
            G.quality.hr ? HRentitySpritesheetJSON : LRentitySpritesheetJSON
        ],
        [iconSpritesheetPNG, iconSpritesheetJSON],
        [utilitySpritesheetPNG, utilitySpritesheetJSON],
        [tilesSpritesheetPNG, tilesSpritesheetJSON]
    ].map(data => loadSpritesheet(data[0], data[1]))
}

function changeQuality(hr: boolean, compressed: boolean) {
    G.loadingScreen.show()

    G.BPC.clearData()

    Object.keys(PIXI.utils.TextureCache)
        .filter(texture => texture.includes('graphics/entity/'))
        .forEach(k => PIXI.utils.TextureCache[k].destroy(true))

    loadSpritesheet(
        /* eslint-disable no-nested-ternary */
        hr
            ? compressed
                ? HRentitySpritesheetCompressedPNG
                : HRentitySpritesheetPNG
            : compressed
            ? LRentitySpritesheetCompressedPNG
            : LRentitySpritesheetPNG,
        /* eslint-enable no-nested-ternary */
        hr ? HRentitySpritesheetJSON : LRentitySpritesheetJSON
    ).then(() => {
        G.BPC.initBP()
        G.loadingScreen.hide()
    })
}

function blobToImageBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
    if (window.createImageBitmap) {
        return createImageBitmap(blob)
    }

    // Polyfill
    return new Promise(resolve => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = URL.createObjectURL(blob)
    })
}

function loadSpritesheet(src: string, json: any) {
    return fetch(src)
        .then(response => response.blob())
        .then(blobToImageBitmap)
        .then(
            imageData =>
                new Promise(resolve => {
                    if (G.app.renderer.context.webGLVersion === 1) {
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        canvas.width = util.nearestPowerOf2(imageData.width)
                        canvas.height = util.nearestPowerOf2(imageData.height)
                        ctx.drawImage(imageData, 0, 0)
                        canvas.toBlob(blob => resolve(blobToImageBitmap(blob)))
                    } else {
                        return resolve(imageData)
                    }
                })
        )
        .then(imageData => {
            // if WebGL1, make the spritesheet a power of 2 so that it generates mipmaps
            // WebGL2 generates mipmaps even with non pow 2 textures
            const resource = new PIXI.resources.BaseImageResource(imageData)

            const baseTexture = new PIXI.BaseTexture(resource)
            // bind the baseTexture, this will also upload it to the GPU
            G.app.renderer.texture.bind(baseTexture)
            return new Promise(resolve => new PIXI.Spritesheet(baseTexture, json).parse(resolve))
        })
}

export default {
    getAllPromises,
    changeQuality
}
