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

export default {
    decode: (str: string) => new Promise((resolve, reject) => {
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
    }),
    encode: (bPOrBook: any) => new Promise((resolve, reject) => {
        try {
            resolve('0' + btoa(pako.deflate(
                JSON.stringify(bPOrBook.toObject())
                    .replace(/(:".+?")/g, (_: string, capture: string) => capture.replace(/_/g, '-'))
                , { to: 'string' }))
            )
        } catch (e) {
            reject(e)
        }
    })
}
