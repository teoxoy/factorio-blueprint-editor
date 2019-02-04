import pako from 'pako'
import Ajv from 'ajv'
import blueprintSchema from '../blueprintSchema.json'
import FD from 'factorio-data'
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
            if (!FD.items[k]) return false
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
    validate: (data: string) => !!FD.tiles[data],
    errors: false,
    schema: false
})
.compile(blueprintSchema)

function decode(str: string): Promise<Blueprint | Book> {
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(
                pako.inflate(atob(str.slice(1)), { to: 'string' })
                .replace(/("[^,]{3,}?")/g, (_: string, capture: string) => capture.replace(/-/g, '_'))
            )
            console.log(data)
            if (!validate(data)) reject(validate.errors)
            resolve(data.blueprint_book === undefined ? new Blueprint(data.blueprint) : new Book(data))
        } catch (e) {
            reject(e)
        }
    })
}

function encode(bPOrBook: Blueprint | Book) {
    return new Promise((resolve: (value: string) => void, reject) => {
        const data = encodeSync(bPOrBook)
        if (data.value) resolve(data.value)
        else reject(data.error)
    })
}

function encodeSync(bPOrBook: Blueprint | Book): { value?: string; error?: string } {
    try {
        return { value: '0' + btoa(pako.deflate(
            JSON.stringify(bPOrBook.toObject())
                .replace(/(:".+?"|"[a-z]+?_module(|_[0-9])")/g, (_: string, capture: string) => capture.replace(/_/g, '-'))
            , { to: 'string' }))
        }
    } catch (e) {
        return { error: e }
    }
}

function findBPString(data: string) {
    const DATA = data.replace(/\s/g, '')

    if (DATA[0] === '0') return new Promise(resolve => resolve(DATA))

    // function isUrl(url: string) {
    //     try { return Boolean(new URL(url)) }
    //     catch (e) { return false }
    // }

    // Other CORS Proxies:
    // https://crossorigin.me/
    // https://cors-anywhere.herokuapp.com/
    const corsProxy = 'https://api.allorigins.ml/raw?url='

    // TODO: maybe add dropbox support https://www.dropbox.com/s/ID?raw=1
    return new Promise(resolve => resolve(new URL(DATA))).then((url: URL) => {
        console.log(`Loading data from: ${url}`)
        const pathParts = url.pathname.slice(1).split('/')
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
                return fetchData(`https://facorio-blueprints.firebaseio.com/blueprints/${pathParts[1]}.json`).then(r =>
                    r.json().then(data => data.blueprintString)
                )
            case 'docs':
                return fetchData(`https://docs.google.com/document/d/${pathParts[2]}/export?format=txt`).then(r => r.text())
            default:
                return fetchData(url.toString()).then(r => r.text())
        }
    })

    function fetchData(url: string) {
        return fetch(url).then(response => {
            if (response.ok) return response
            throw new Error('Network response was not ok.')
        })
    }
}

export default {
    decode,
    encode,
    encodeSync,
    findBPString
}
