import Ajv, { KeywordDefinition } from 'ajv'
import FD from 'factorio-data'
import pako from 'pako'
import blueprintSchema from './blueprintSchema.json'
import { Blueprint } from './Blueprint'
import { Book } from './Book'

class ModdedBlueprintError {
    public errors: Ajv.ErrorObject[]
    public constructor(errors: Ajv.ErrorObject[]) {
        this.errors = errors
    }
}

class TrainBlueprintError {
    public errors: Ajv.ErrorObject[]
    public constructor(errors: Ajv.ErrorObject[]) {
        this.errors = errors
    }
}

const trainEntityNames = ['locomotive', 'cargo_wagon', 'fluid_wagon']

const keywords: Record<string, KeywordDefinition> = {
    entityName: {
        validate: (data: string) => !!FD.entities[data],
        errors: false,
        schema: false,
    },
    itemName: {
        validate: (data: string) => !!FD.items[data],
        errors: false,
        schema: false,
    },
    recipeName: {
        validate: (data: string) => !!FD.recipes[data],
        errors: false,
        schema: false,
    },
    tileName: {
        validate: (data: string) => !!FD.tiles[data] || data === 'landfill',
        errors: false,
        schema: false,
    },
    objectWithItemNames: {
        validate: (data: object) => Object.keys(data).every(key => !!FD.items[key]),
        errors: false,
        schema: false,
    },
}

const validate = new Ajv({ keywords, verbose: true }).compile(blueprintSchema)

const nameMigrations: Record<string, string> = {
    // if (blueprintVersion < getFactorioVersion(0, 17, 0))
    '"raw-wood"': '"wood"',
    '"science-pack-1"': '"automation-science-pack"',
    '"science-pack-2"': '"logistic-science-pack"',
    '"science-pack-3"': '"chemical-science-pack"',
    '"high-tech-science-pack"': '"utility-science-pack"',
    // ',"recipe":"steel-axe"': ''
    // ',"recipe":"iron-axe"': ''

    // if (blueprintVersion < getFactorioVersion(0, 17, 10))
    '"grass-1"': '"landfill"',
}
const nameMigrationsRegex = new RegExp(Object.keys(nameMigrations).join('|'), 'g')

function decode(str: string): Promise<Blueprint | Book> {
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(
                pako
                    .inflate(atob(str.slice(1)), { to: 'string' })
                    .replace(nameMigrationsRegex, match => nameMigrations[match])
                    .replace(/("[^,]{3,}?")/g, (_: string, capture: string) =>
                        capture.replace(/-/g, '_')
                    )
            )
            console.log(data)
            if (!validate(data)) {
                const trainRelated = !!validate.errors.find(e => trainEntityNames.includes(e.data))
                if (trainRelated) {
                    reject(new TrainBlueprintError(validate.errors))
                } else {
                    const moddedBlueprint = !!validate.errors.find(e => keywords[e.keyword])
                    if (moddedBlueprint) {
                        reject(new ModdedBlueprintError(validate.errors))
                    } else {
                        reject(validate.errors)
                    }
                }
            }
            resolve(
                data.blueprint_book === undefined
                    ? new Blueprint(data.blueprint)
                    : new Book(data.blueprint_book)
            )
        } catch (e) {
            reject(e)
        }
    })
}

function encode(bpOrBook: Blueprint | Book): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const keyName = bpOrBook instanceof Blueprint ? 'blueprint' : 'blueprint_book'
            const data = { [keyName]: bpOrBook.serialize() }
            const string = JSON.stringify(data).replace(
                /(:".+?"|"[a-z]+?_module(|_[0-9])")/g,
                (_: string, capture: string) => capture.replace(/_/g, '-')
            )
            resolve(`0${btoa(pako.deflate(string, { to: 'string' }))}`)
        } catch (e) {
            reject(e)
        }
    })
}

function getBlueprintOrBookFromSource(source: string): Promise<Blueprint | Book> {
    if (source === undefined) return Promise.resolve(new Blueprint())

    // trim whitespace
    const DATA = source.replace(/\s/g, '')

    let bpString
    if (DATA[0] === '0') {
        bpString = Promise.resolve(DATA)
    } else {
        bpString = new Promise((resolve, reject) => {
            const url = `https://${DATA.replace(/https?:\/\//g, '')}`
            try {
                resolve(new URL(url))
            } catch (e) {
                reject(e)
            }
        }).then((url: URL) => {
            const corsProxy = './api/proxy?url='

            console.log(`Loading data from: ${url}`)
            const pathParts = url.pathname.slice(1).split('/')

            const fetchData = (url: string): Promise<Response> =>
                fetch(url).then(response => {
                    if (response.ok) return response
                    throw new Error('Network response was not ok.')
                })

            // TODO: add dropbox support https://www.dropbox.com/s/ID?raw=1
            switch (url.hostname.split('.')[0]) {
                case 'pastebin':
                    return fetchData(
                        `${corsProxy}https://pastebin.com/raw/${pathParts[0]}`
                    ).then(r => r.text())
                case 'hastebin':
                    return fetchData(
                        `${corsProxy}https://hastebin.com/raw/${pathParts[0]}`
                    ).then(r => r.text())
                case 'gist':
                    return fetchData(`https://api.github.com/gists/${pathParts[1]}`).then(r =>
                        r.json().then(data => data.files[Object.keys(data.files)[0]].content)
                    )
                case 'gitlab':
                    // https://gitlab.com/gitlab-org/gitlab-ce/issues/24596
                    return fetchData(
                        `${corsProxy}https://gitlab.com/snippets/${pathParts[1]}/raw`
                    ).then(r => r.text())
                case 'factorioprints':
                    return fetchData(
                        `https://facorio-blueprints.firebaseio.com/blueprints/${pathParts[1]}.json`
                    ).then(r => r.json().then(data => data.blueprintString))
                case 'docs':
                    return fetchData(
                        `https://docs.google.com/document/d/${pathParts[2]}/export?format=txt`
                    ).then(r => r.text())
                default:
                    return fetchData(url.href).then(r => r.text())
            }
        })
    }

    return bpString.then(decode)
}

export { ModdedBlueprintError, TrainBlueprintError }
export { encode, getBlueprintOrBookFromSource }
