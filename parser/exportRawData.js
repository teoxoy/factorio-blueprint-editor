const fse = require('fs-extra')
const lua2js = require('lua2js')
const execSync = require('child_process').execSync

const factorioDirectory = process.argv[2]

//run /c game.write_file("defines.lua", serpent.block(_G.defines, {comments=false}))

// Load Order:
// data.lua
// data-updates.lua
// data-final-fixes.lua

const reqLualibRegex = /.*?require\s*\(*['"]([^.]+?)['"]\)*/g
const reqRegex = /require\s*\(*['"](.+?)['"]\)*/g

let loadedModules = []

function searchLoadRemoveDependencies(contents, regex, baseFolder) {
    let newModules = []
    let match = regex.exec(contents)
    while (match !== null) {
        let dep = match[1]
        if (!loadedModules.includes(dep)) {
            //load module
            loadedModules.push(dep)
            newModules.push({
                index: match.index,
                name: dep
            })
        }
        match = regex.exec(contents)
    }

    let offset = 0
    for (let i = 0; i < newModules.length; i++) {
        let startPart = contents.slice(0, newModules[i].index + offset)
        let endPart = contents.slice(newModules[i].index + offset)
        let depData = readRequireOfFile(baseFolder, newModules[i].name.replace(/\./g, '/') + '.lua') + '\n'
        contents = startPart + depData + endPart
        offset += depData.length
    }

    // remove all requires
    contents = contents.replace(regex, '')

    return contents
}

function readRequireOfFile(baseFolder, pathCon) {
    let contents = fse.readFileSync(factorioDirectory + baseFolder + pathCon).toString()

    contents = searchLoadRemoveDependencies(contents, reqLualibRegex, 'core/lualib/')
    contents = searchLoadRemoveDependencies(contents, reqRegex, baseFolder)

    // remove last return
    contents = contents.replace(/return\s*\b.+?\b\s*$/g, '')

    // if a return is an obj, convert the return with the filename
    contents = contents.replace(/return\s(\{(.|\n)+?\})\s*$/g, function(match, capture){
        let split = pathCon.split('/')
        return split[split.length - 1].replace('.lua', '') + ' = ' + capture
    })

    if (pathCon.includes('autoplace_utils')) {
        contents = contents.replace(/M/g, 'autoplace_utils')
    }

    return contents
}

const fileOrder = [
    'core/lualib/dataloader.lua',
    'core/data.lua',
    'base/data.lua',
    'base/data-updates.lua'
]

let mainFileData = ''

for (let i = 0; i < fileOrder.length; i++) {
    let splitPath = fileOrder[i].split('/')
    let data = readRequireOfFile(splitPath[0] + '/', splitPath.slice(1).join('/'))
    mainFileData += data + '\n'
}

mainFileData = mainFileData
    // var = require(...) results in var = var = {}
    .replace(/\b[a-zA-Z_-]+?\b\s*(=\s*\b[a-zA-Z_-]+?\b\s*)=\s*\{/g, function(match, capture){
        return match.replace(capture, '')
    })

mainFileData = fse.readFileSync('./defines.lua').toString() + mainFileData

fse.writeFileSync('./temp.lua', mainFileData)

const data = lua2js.parser.parse(mainFileData)
fse.writeFileSync('./temp.js', `
require("lua2js").runtime;
${data}
require("fs").writeFileSync('./temp.json', JSON.stringify(Tget($get($, 'data'), 'raw').toObject(), null, 2));
`)
execSync('node temp.js')
