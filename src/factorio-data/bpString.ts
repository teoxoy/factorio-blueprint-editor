import pako from 'pako'
import Ajv from 'ajv'
import FD from 'factorio-data'
import blueprintSchema from '../blueprintSchema.json'
import Blueprint from './blueprint'
import { Book } from './book'

const validate = new Ajv()
    .addKeyword('entityName', {
        validate: (data: string) => !!FD.entities[data],
        errors: false,
        schema: false
    })
    .addKeyword('itemName', {
        validate: (data: string) => !!FD.items[data],
        errors: false,
        schema: false
    })
    .addKeyword('objectWithItemNames', {
        validate: (data: object) => {
            for (const k in data) {
                if (!FD.items[k]) {
                    return false
                }
            }
            return true
        },
        errors: false,
        schema: false
    })
    .addKeyword('recipeName', {
        validate: (data: string) => !!FD.recipes[data],
        errors: false,
        schema: false
    })
    .addKeyword('tileName', {
        validate: (data: string) => !!FD.tiles[data] || data === 'landfill',
        errors: false,
        schema: false
    })
    .compile(blueprintSchema)

const nameMigrations: { [key: string]: string } = {
    // if (blueprintVersion < getFactorioVersion(0, 17, 0))
    '"raw-wood"': '"wood"',
    '"science-pack-1"': '"automation-science-pack"',
    '"science-pack-2"': '"logistic-science-pack"',
    '"science-pack-3"': '"chemical-science-pack"',
    '"high-tech-science-pack"': '"utility-science-pack"',
    // ',"recipe":"steel-axe"': ''
    // ',"recipe":"iron-axe"': ''

    // if (blueprintVersion < getFactorioVersion(0, 17, 10))
    '"grass-1"': '"landfill"'
}
const nameMigrationsRegex = new RegExp(Object.keys(nameMigrations).join('|'), 'g')

function decode(str: string): Promise<Blueprint | Book> {
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(
                pako
                    .inflate(atob(str.slice(1)), { to: 'string' })
                    .replace(nameMigrationsRegex, match => nameMigrations[match])
                    .replace(/("[^,]{3,}?")/g, (_: string, capture: string) => capture.replace(/-/g, '_'))
            )
            console.log(data)
            if (!validate(data)) {
                reject(validate.errors)
            }
            resolve(data.blueprint_book === undefined ? new Blueprint(data.blueprint) : new Book(data.blueprint_book))
        } catch (e) {
            reject(e)
        }
    })
}

function encode(bpOrBook: Blueprint | Book) {
    return new Promise((resolve: (value: string) => void, reject) => {
        const data = encodeSync(bpOrBook)
        if (data.value) {
            resolve(data.value)
        } else {
            reject(data.error)
        }
    })
}

function encodeSync(bpOrBook: Blueprint | Book): { value?: string; error?: string } {
    try {
        return {
            value: `0${btoa(
                pako.deflate(
                    JSON.stringify(bpOrBook.toObject()).replace(
                        /(:".+?"|"[a-z]+?_module(|_[0-9])")/g,
                        (_: string, capture: string) => capture.replace(/_/g, '-')
                    ),
                    { to: 'string' }
                )
            )}`
        }
    } catch (e) {
        return { error: e }
    }
}

function getBlueprintOrBookFromSource(source: string): Promise<Blueprint | Book> {
    if (source === undefined) {
        return Promise.resolve(new Blueprint())
    }

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
            // Other CORS Proxies:
            // https://crossorigin.me/
            // https://cors-anywhere.herokuapp.com/
            const corsProxy = 'https://api.allorigins.win/raw?url='

            console.log(`Loading data from: ${url}`)
            const pathParts = url.pathname.slice(1).split('/')

            function fetchData(url: string) {
                return fetch(url).then(response => {
                    if (response.ok) {
                        return response
                    }
                    throw new Error('Network response was not ok.')
                })
            }

            // TODO: add dropbox support https://www.dropbox.com/s/ID?raw=1
            switch (url.hostname.split('.')[0]) {
                case 'pastebin':
                    return fetchData(`${corsProxy}https://pastebin.com/raw/${pathParts[0]}`).then(r => r.text())
                case 'hastebin':
                    return fetchData(`${corsProxy}https://hastebin.com/raw/${pathParts[0]}`).then(r => r.text())
                case 'gist':
                    return fetchData(`https://api.github.com/gists/${pathParts[1]}`).then(r =>
                        r.json().then(data => data.files[Object.keys(data.files)[0]].content)
                    )
                case 'gitlab':
                    // https://gitlab.com/gitlab-org/gitlab-ce/issues/24596
                    return fetchData(`${corsProxy}https://gitlab.com/snippets/${pathParts[1]}/raw`).then(r => r.text())
                case 'factorioprints':
                    return fetchData(`https://facorio-blueprints.firebaseio.com/blueprints/${pathParts[1]}.json`).then(
                        r => r.json().then(data => data.blueprintString)
                    )
                case 'docs':
                    return fetchData(`https://docs.google.com/document/d/${pathParts[2]}/export?format=txt`).then(r =>
                        r.text()
                    )
                default:
                    return fetchData(url.href).then(r => r.text())
            }
        })
    }

    return bpString.then(decode).catch(err => {
        console.error(err)
        return new Blueprint()
    })
}

export default {
    encode,
    encodeSync,
    getBlueprintOrBookFromSource
}
