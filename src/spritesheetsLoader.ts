import LRentitySpritesheetPNG from 'factorio-data/data/graphics/LREntitySpritesheet.png'
import LRentitySpritesheetJSON from 'factorio-data/data/graphics/LREntitySpritesheet.json'
import HRentitySpritesheetPNG from 'factorio-data/data/graphics/HREntitySpritesheet.png'
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
import { EntityContainer } from './containers/entity'

function getAllPromises() {
    return [
        G.hr ? [ HRentitySpritesheetPNG, HRentitySpritesheetJSON ] :
        [ LRentitySpritesheetPNG, LRentitySpritesheetJSON ],
        [ iconSpritesheetPNG, iconSpritesheetJSON ],
        [ utilitySpritesheetPNG, utilitySpritesheetJSON ],
        [ tilesSpritesheetPNG, tilesSpritesheetJSON ]
    ].map(data => loadSpritesheet(data[0], data[1]))
}

function changeQuality(hr: boolean) {
    G.loadingScreen.show()

    G.BPC.entities.children.forEach((eC: EntityContainer) => {
        eC.entitySprites.forEach(eS => eS.destroy())
        eC.entitySprites = []
    })

    Object.keys(PIXI.utils.TextureCache)
        .filter(texture => texture.includes('graphics/entity/'))
        .forEach(k => PIXI.utils.TextureCache[k].destroy(true))

    loadSpritesheet(
        hr ? HRentitySpritesheetPNG : LRentitySpritesheetPNG,
        hr ? HRentitySpritesheetJSON : LRentitySpritesheetJSON
    ).then(() => {
        G.BPC.entities.children.forEach((eC: EntityContainer) => eC.redraw(false, false))
        G.BPC.sortEntities()
        G.loadingScreen.hide()
    })
}

function loadSpritesheet(src: string, json: any) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.src = src
        image.onload = () => {
            const getPow2Canvas = () => {
                const c = document.createElement('canvas')
                c.width = util.nearestPowerOf2(image.width)
                c.height = util.nearestPowerOf2(image.height)
                c.getContext('2d').drawImage(image, 0, 0)
                return c
            }
            // if WebGL1, make the spritesheet a power of 2 so that it generates mipmaps
            // WebGL2 generates mipmaps even with non pow 2 textures
            const baseTexture = new PIXI.BaseTexture(G.app.renderer.context.webGLVersion === 1 ? getPow2Canvas() : image)
            // bind the baseTexture, this will also upload it to the GPU
            G.app.renderer.texture.bind(baseTexture)
            new PIXI.Spritesheet(baseTexture, json).parse(resolve)
        }
        image.onerror = reject
    })
}

export default {
    getAllPromises,
    changeQuality
}
