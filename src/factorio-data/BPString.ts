import pako from 'pako'
import Ajv from 'ajv'
import blueprintSchema from '../blueprintSchema.json'
import factorioData from './factorioData'
import { Blueprint } from './blueprint'
import { Book } from './book'

const validate = new Ajv()
.addKeyword('entityName', {
    validate: (data: string) => factorioData.checkEntityName(data),
    errors: false,
    schema: false
})
.addKeyword('itemName', {
    validate: (data: string) => factorioData.checkItemName(data),
    errors: false,
    schema: false
})
.addKeyword('objectWithItemNames', {
    validate: (data: object) => {
        for (const k in data) {
            if (!factorioData.checkItemName(k)) return false
        }
        return true
    },
    errors: false,
    schema: false
})
.addKeyword('recipeName', {
    validate: (data: string) => factorioData.checkRecipeName(data),
    errors: false,
    schema: false
})
.addKeyword('tileName', {
    validate: (data: string) => factorioData.checkTileName(data),
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

function encode(bPOrBook: any) {
    return new Promise((resolve: (value: string) => void, reject) => {
        const data = encodeSync(bPOrBook)
        if (data.value) resolve(data.value)
        else reject(data.error)
    })
}

function encodeSync(bPOrBook: any): { value?: string; error?: string } {
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

export default {
    decode,
    encode,
    encodeSync
}
