const fse = require('fs-extra')
const nsg = require('node-sprite-generator')
const Jimp = require('jimp')
const util = require('util')

const factorioDirectory = process.argv[2]
const bundlesOutDir = process.argv[3] + 'bundles/'
const spritesheetsOutDir = process.argv[3] + 'spritesheets/'

function nameMapping(imagePath) {
    const sP = imagePath.split('/')
    return sP.splice(sP.length - 2).join('/').split('.')[0]
}

let rawData = JSON.parse(fse.readFileSync('./temp.json').toString()
    .replace(/"(up|down|left|right|north|south|west|east)"/g, function(match, capture) {
        if (capture === 'north' || capture === 'up') return '"0"'
        if (capture === 'east' || capture === 'left') return '"2"'
        if (capture === 'south' || capture === 'down') return '"4"'
        if (capture === 'west' || capture === 'right') return '"6"'
    }))

let tiles = {}
for (const k in rawData.tile) {
    if (rawData.tile[k].minable) tiles[k] = rawData.tile[k]
}
console.log('Tiles: ' + Object.keys(tiles).length)
fse.writeFileSync(bundlesOutDir + 'tileBundle.json', JSON.stringify(tiles, null, 2).replace(/__base__|__core__/g, 'factorio-data'))

console.log('Recipes: ' + Object.keys(rawData.recipe).length)
fse.writeFileSync(bundlesOutDir + 'recipeBundle.json', JSON.stringify(rawData.recipe, null, 2).replace(/__base__|__core__/g, 'factorio-data'))

let inventory = []
let items = {}
let placeableEntities = ['curved-rail']

const blacklistedGroups = [
    'environment',
    'enemies',
    'other'
]

for (const k in rawData['item-group']) {
    const group = rawData['item-group'][k]
    if (!blacklistedGroups.includes(group.name)) {
        group.subgroups = []
        inventory.push(group)
    }
}

for (const k in rawData['item-subgroup']) {
    const subgroup = rawData['item-subgroup'][k]
    subgroup.items = []
    for (const group of inventory) {
        if (group.name === subgroup.group) {
            group.subgroups.push(subgroup)
            break
        }
    }
}

function findAllItems(data) {
    if (data.constructor === Object) {
        if (data.hasOwnProperty('subgroup')) {
            addItem(data)
        } else {
            for (const k in data) {
                if (data.hasOwnProperty(k)) {
                    findAllItems(data[k])
                }
            }
        }
    }
}

findAllItems(rawData)

for (const k in rawData['fluid']) {
    const fluid = rawData['fluid'][k]
    fluid.subgroup = 'fluid'
    addItem(fluid)
}

function addItem(item) {
    if ((item.flags && item.flags.includes('hidden')) || !(item.icon || item.icons) || !item.order || item.collision_box) return
    for (let j = 0; j < inventory.length; j++) {
        for (let k = 0; k < inventory[j].subgroups.length; k++) {
            if (inventory[j].subgroups[k].name === item.subgroup) {
                inventory[j].subgroups[k].items.push(item)
                if (item.place_result) placeableEntities.push(item.place_result)
                items[item.name] = item
                return
            }
        }
    }
}

console.log('Items: ' + Object.keys(items).length)
fse.writeFileSync(bundlesOutDir + 'itemBundle.json', JSON.stringify(items, null, 2).replace(/"((__base__|__core__)\/.+?)"/g, function(match, capture) {
    return '"icon:' + nameMapping(capture) + '"'
}))

// sort and remove extra info from inventoryBundle
inventory.sort(sortByOrder)
for (let i = 0; i < inventory.length; i++) {
    inventory[i].subgroups.sort(sortByOrder)
    for (let j = 0; j < inventory[i].subgroups.length; j++) {
        inventory[i].subgroups[j].items.sort(sortByOrder)
        for (let k = 0; k < inventory[i].subgroups[j].items.length; k++) {
            removeExtraInfo(inventory[i].subgroups[j].items[k])
        }
        removeExtraInfo(inventory[i].subgroups[j])
    }
    removeExtraInfo(inventory[i])
}

function sortByOrder(a, b) {
    // https://forums.factorio.com/viewtopic.php?f=25&t=3236#p23818
    // https://forums.factorio.com/viewtopic.php?f=25&t=24163#p152955
    if (a.order < b.order) return -1
    if (a.order > b.order) return 1
    return 0
}

function removeExtraInfo(obj) {
    for (const k of Object.keys(obj)) {
        if (!['subgroups', 'items', 'name', 'icon', 'icons'].includes(k)) delete obj[k]
    }
}

fse.writeFileSync(bundlesOutDir + 'inventoryBundle.json', JSON.stringify(inventory, null, 2).replace(/"((__base__|__core__)\/.+?)"/g, function(match, capture) {
    return '"icon:' + nameMapping(capture) + '"'
}))

let paths = []
for (let i = 0, l = inventory.length; i < l; i++) {
    paths.push(factorioDirectory + inventory[i].icon.replace(/__base__/g, 'base').replace(/__core__/g, 'core'))
    for (let j = 0, l2 = inventory[i].subgroups.length; j < l2; j++) {
        for (let k = 0, l3 = inventory[i].subgroups[j].items.length; k < l3; k++) {
            const item = inventory[i].subgroups[j].items[k]
            if (item.icon) {
                paths.push(factorioDirectory + item.icon.replace(/__base__/g, 'base').replace(/__core__/g, 'core'))
            } else {
                for (let l = 0; l < item.icons.length; l++) {
                    paths.push(factorioDirectory + item.icons[l].icon.replace(/__base__/g, 'base').replace(/__core__/g, 'core'))
                }
            }
        }
    }
}
paths = Array.from(new Set(paths).values())

console.log('Icon sprites: ' + paths.length)
nsg({
    src: paths,
    spritePath: spritesheetsOutDir + 'iconSpritesheet.png',
    stylesheet: './json-icon.tpl',
    stylesheetPath: spritesheetsOutDir + 'iconSpritesheet.json',
    stylesheetOptions: {
        prefix: 'icon:',
        nameMapping: nameMapping
    },
    compositor: 'jimp',
    layout: 'packed',
    layoutOptions: {
        padding: 2
    }
}, function(err) {
    if (err)
        console.log(err)
    else
        console.log('Icon sprite atlas generated!')
})

let entities = {}
function findAllEntities(data) {
    if (data.constructor === Object) {
        if (placeableEntities.includes(data.name) && data.hasOwnProperty('collision_box') && (!data.flags.includes('placeable-off-grid') || data.name === 'land-mine')) {
            entities[data.name] = data
        } else {
            for (let k in data) {
                if (data.hasOwnProperty(k)) {
                    findAllEntities(data[k])
                }
            }
        }
    }
}
findAllEntities(rawData)

const regexNameMatches = [
    'combinator',
    'underground-belt',
    'transport-belt',
    'splitter',
    'inserter',
    'turret',
    'mining-drill',
    'pump'
]

let nameMatches = [
    'assembling-machine-2',
    'assembling-machine-3',
    'pipe-to-ground',
    'oil-refinery',
    'chemical-plant',
    'heat-exchanger',
    'boiler',
    'train-stop'
]

for (let k in entities) {
    // Size
    const box = entities[k].selection_box
    entities[k].size = {
        width: Math.ceil(Math.abs(box[0][0]) + Math.abs(box[1][0])),
        height: Math.ceil(Math.abs(box[0][1]) + Math.abs(box[1][1]))
    }
    // Move out splitters and underground-belts from transport-belt fast_replaceable_group
    if (k.search('splitter') !== -1) {
        entities[k].fast_replaceable_group = 'splitter'
    }
    if (k.search('underground-belt') !== -1) {
        entities[k].fast_replaceable_group = 'underground-belt'
    }
    // Possible Rotations
    for (let j = 0; j < regexNameMatches.length; j++) {
        if (k.includes(regexNameMatches[j])) {
            nameMatches.push(k)
        }
    }
}
// Actual land size of the offshore pump
entities['offshore-pump'].size = { width: 1, height: 1 }

for (let i = 0; i < nameMatches.length; i++) {
    entities[nameMatches[i]].possible_rotations = [0, 2, 4, 6]
}
entities['storage-tank'].possible_rotations = [0, 2]
entities['gate'].possible_rotations = [0, 2]
entities['steam-engine'].possible_rotations = [0, 2]
entities['steam-turbine'].possible_rotations = [0, 2]
entities['straight-rail'].possible_rotations = [0, 2]
entities['rail-signal'].possible_rotations = [0, 1, 2, 3, 4, 5, 6, 7]
entities['rail-chain-signal'].possible_rotations = [0, 1, 2, 3, 4, 5, 6, 7]
// End Possible Rotations

// switch dir 2 and 6 for pipe-to-ground
let dir2 = Object.assign({}, entities['pipe-to-ground'].pictures['2'])
entities['pipe-to-ground'].pictures['2'] = entities['pipe-to-ground'].pictures['6']
entities['pipe-to-ground'].pictures['6'] = dir2
// shift.y-1 for dir 4 wall patch of gate
let wp4 = entities['gate'].wall_patch['4'].layers[0]
wp4.shift = [wp4.shift[0], wp4.shift[1] - 1]
if (wp4.hr_version) {
    wp4.hr_version.shift = [wp4.hr_version.shift[0], wp4.hr_version.shift[1] - 1]
}
// fix shifts
entities['storage-tank'].pictures.window_background.shift = [0, 1]
entities['storage-tank'].pictures.window_background.hr_version.shift = [0, 1]

add_to_shift([0, -0.6875], entities['artillery-turret'].base_picture.layers[0])
add_to_shift([0, -0.6875], entities['artillery-turret'].cannon_barrel_pictures.layers[0])
add_to_shift([0, -0.6875], entities['artillery-turret'].cannon_base_pictures.layers[0])

function add_to_shift(shift, tab) {
    if (tab.shift) {
        tab.shift = [shift[0] + tab.shift[0], shift[1] + tab.shift[1]]
    } else {
        tab.shift = shift
    }
    if (tab.hr_version) {
        if (tab.hr_version.shift) {
            tab.hr_version.shift = [shift[0] + tab.hr_version.shift[0], shift[1] + tab.hr_version.shift[1]]
        } else {
            tab.hr_version.shift = shift
        }
    }
    return tab
}

// Fix inconsistent radiuses
entities['beacon'].supply_area_distance += 1
entities['roboport'].construction_radius += 4
entities['roboport'].logistics_radius += 4

console.log('Entities: ' + Object.keys(entities).length)
fse.writeFileSync(bundlesOutDir + 'entityBundle.json', JSON.stringify(entities, null, 2).replace(/"((__base__|__core__)\/.+?)"/g, function(match, capture) {
    return '"entity:' + nameMapping(capture) + '"'
}))

graphicsBundle()

async function graphicsBundle() {
    let paths = []
    let hrPaths = []
    let re = /"filename":\s*"([^.]+?\.png)"/g
    let str = JSON.stringify(entities)
    let match

    const excludeKeywords = [
        'explosion',
        'cloud',
        'smoke',
        'fire',
        'muzzle-flash',
        '-light\.padding',
        'steam\.png',
        '-shadow\.png',
        '-shadow-',
        'load-standup',
        'flamethrower-turret-gun(-[^e]|[^-])',
        'pump-[a-z]+?-liquid',
        'pump-[a-z]+?-glass',
        'accumulator-[a-z]+?-animation',
        'connector\/(hr-)?.-.-',
        'heated',
        'gun-turret-gun-[m12]',
        'roboport-recharging',
        'segment-visualisation',
        'graphics\/[^/]*$',
        '-light\.png',
        '-lights-color',
        'boiling-green',
        'power-switch-electricity',
        'electric-furnace-heater',
        'integration',
        'arrows',
        'hole',
        'rocket-over',
        'working',
        'hand-closed'
    ]
    const excludeKeywordsRegex = new RegExp(excludeKeywords.join('|'), 'g')

    while ((match = re.exec(str)) !== null) {
        let path = match[1].replace(/__base__/g, 'base').replace(/__core__/g, 'core')
        if (match[1].search(excludeKeywordsRegex) === -1) {
            if (match[1].search(/\/hr-/g) === -1) {
                if (!paths.includes(path)) {
                    paths.push(path)
                }
            } else {
                if (!hrPaths.includes(path)) {
                    hrPaths.push(path)
                }
            }
        }
    }
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-barrel-1.png')
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-barrel-5.png')
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-barrel-9.png')
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-barrel-13.png')

    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-barrel-1.png')
    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-barrel-5.png')
    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-barrel-9.png')
    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-barrel-13.png')

    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-base-1.png')
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-base-5.png')
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-base-9.png')
    paths.push('base/graphics/entity/artillery-wagon/artillery-wagon-cannon-base-13.png')

    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-base-1.png')
    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-base-5.png')
    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-base-9.png')
    hrPaths.push('base/graphics/entity/artillery-wagon/hr-artillery-wagon-cannon-base-13.png')

    console.log('Entity images: ' + paths.length)
    console.log('Entity HR images: ' + hrPaths.length)

    let cropImages = [
        ['artillery-wagon-cannon', 4, 4],
        ['flamethrower-turret-gun-extension', 5, 1],
        ['gun-turret-gun-extension', 5, 1],
        ['laser-turret-gun-start', 15, 1],
        ['burner-mining-drill', 4, 8],
        ['electric-mining-drill', 8, 8],
        ['pumpjack-horsehead', 8, 5],
        ['assembling-machine-[1-3]\.png', 8, 4],
        ['centrifuge', 8, 8],
        ['lab.png', 11, 3],
        ['[^e]-pump-', 8, 4],
        ['splitter', 8, 4],
        ['radar', 8, 8],
        ['steam-engine', 8, 4],
        ['steam-turbine', 4, 2],
        ['transport-belt', 16, 1],
        ['laser-turret-gun', 8, 1],
        ['beacon-antenna', 8, 4],
        ['roboport-door-', 16, 1],
        ['gate(-rail(-base)?)?-[a-z]+?(-(left|right))?\.png', 8, 2],
        ['arm', 4, 3],
        ['rail-signal\.png', 3, 1],
        ['rail-chain-signal\.png', 4, 1],
        ['power-switch', 2, 3]
    ]

    let addedHrPaths = []
    let imagesToCrop = []
    for (let i = 0; i < paths.length; i++) {
        let pArr = paths[i].split('/')
        if (pArr[pArr.length - 1] === 'electric-furnace-base.png') {
            pArr[pArr.length - 1] = 'electric-furnace.png'
        }
        pArr[pArr.length - 1] = 'hr-' + pArr[pArr.length - 1]
        let hrVersion = pArr.join('/')
        if (hrPaths.includes(hrVersion)) {
            paths[i] = hrVersion
            addedHrPaths.push(hrVersion)
        }
        paths[i] = factorioDirectory + paths[i]
        // Crop spritesheet
        for (let j = 0, len2 = cropImages.length; j < len2; j++) {
            if (paths[i].search(new RegExp(cropImages[j][0], 'g')) !== -1) {
                let p = './temp/' + nameMapping(paths[i]) + '.png'
                imagesToCrop.push({
                    path: paths[i],
                    outPath: p,
                    cropImgIndex: j
                })
                paths[i] = p
                break
            }
        }
    }

    for (let i = 0; i < hrPaths.length; i++) {
        if (!addedHrPaths.includes(hrPaths[i])) {
            paths.push(factorioDirectory + hrPaths[i])
        }
    }

    Promise.all(
        imagesToCrop
            .map(data => Jimp.read(data.path)
            .then(img => img
                .crop(0, 0, img.bitmap.width / cropImages[data.cropImgIndex][1], img.bitmap.height / cropImages[data.cropImgIndex][2])
                .write(data.outPath)
    ))).then(() => {
        console.log('Final entity images: ' + paths.length)
        nsg({
            src: paths,
            spritePath: spritesheetsOutDir + 'entitySpritesheet.png',
            stylesheet: './json-entity.tpl',
            stylesheetPath: spritesheetsOutDir + 'entitySpritesheet.json',
            stylesheetOptions: {
                prefix: 'entity:',
                nameMapping: nameMapping
            },
            compositor: 'jimp',
            layout: 'packed',
            layoutOptions: {
                padding: 2
            }
        }, function(err) {
            if (err) {
                console.log(err)
            } else {
                fse.remove('./temp')
                console.log('Entity sprite atlas generated!')
            }
        })
    })
}
