import LRentitySpritesheetCompressedPNG from 'factorio-data/data/graphics/LREntitySpritesheetCompressed.png'
import LRentitySpritesheetJSON from 'factorio-data/data/graphics/LREntitySpritesheet.json'
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

function getAllPromises(): Promise<void>[] {
    return [
        [
            G.hr ? HRentitySpritesheetCompressedPNG : LRentitySpritesheetCompressedPNG,
            G.hr ? HRentitySpritesheetJSON : LRentitySpritesheetJSON
        ],
        [iconSpritesheetPNG, iconSpritesheetJSON],
        [utilitySpritesheetPNG, utilitySpritesheetJSON],
        [tilesSpritesheetPNG, tilesSpritesheetJSON]
    ].map(data => loadSpritesheet(data[0] as string, data[1]))
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

function loadSpritesheet(src: string, json: any): Promise<void> {
    return fetch(src)
        .then(response => response.blob())
        .then(blobToImageBitmap)
        .then(
            imageData =>
                new Promise<ImageBitmap | HTMLImageElement>(resolve => {
                    if (G.app.renderer.context.webGLVersion === 1) {
                        // WebGL1 --> make the spritesheet a power of 2 so that it generates mipmaps
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        canvas.width = util.nearestPowerOf2(imageData.width)
                        canvas.height = util.nearestPowerOf2(imageData.height)
                        ctx.drawImage(imageData, 0, 0)
                        canvas.toBlob(blob => resolve(blobToImageBitmap(blob)))
                    } else {
                        // WebGL2 --> generates mipmaps even with non pow 2 textures
                        return resolve(imageData)
                    }
                })
        )
        .then(imageData => {
            const resource =
                imageData instanceof ImageBitmap
                    ? new PIXI.resources.ImageBitmapResource(imageData)
                    : new PIXI.resources.BaseImageResource(imageData)
            const baseTexture = new PIXI.BaseTexture(resource)
            // bind the baseTexture, this will also upload it to the GPU
            G.app.renderer.texture.bind(baseTexture)
            return new Promise(resolve => new PIXI.Spritesheet(baseTexture, json).parse(resolve))
        })
}

export default {
    getAllPromises
}
