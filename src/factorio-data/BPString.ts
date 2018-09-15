import zlib from 'zlib'
import { Buffer } from 'buffer'
import Ajv from 'ajv'
import blueprintSchema from '../blueprintSchema.json'
import factorioData from './factorioData'
import { Blueprint } from './blueprint'
import { Book } from './book'

const ajv = new Ajv()
ajv.addKeyword('entityName', {
    validate: (data: string) => factorioData.checkEntityName(data),
    errors: false,
    schema: false
})
ajv.addKeyword('itemName', {
    validate: (data: string) => factorioData.checkItemName(data),
    errors: false,
    schema: false
})
ajv.addKeyword('objectWithItemNames', {
    validate: (data: object) => {
        for (const k in data) {
            if (!factorioData.checkItemName(k)) return false
        }
        return true
    },
    errors: false,
    schema: false
})
ajv.addKeyword('recipeName', {
    validate: (data: string) => factorioData.checkRecipeName(data),
    errors: false,
    schema: false
})
ajv.addKeyword('tileName', {
    validate: (data: string) => factorioData.checkTileName(data),
    errors: false,
    schema: false
})
const validate = ajv.compile(blueprintSchema)

export default {
    decode: (str: string) => {
        let data
        try {
            data = JSON.parse(
                zlib
                .inflateSync(Buffer.from(str.slice(1), 'base64'))
                .toString('utf8')
                .replace(/("[^,]{3,}?")/g, (_, capture) => capture.replace(/-/g, '_'))
            )
        } catch (e) {
            return { error: e }
        }

        console.log(data)

        // data.blueprint.entities.forEach(e => {
        //     // if (e.control_behavior) {
        //     //     let d = e.control_behavior.circuit_condition
        //     //     if (d !== undefined) console.log(e.name + '\t\t\t\t' + d)
        //     // }
        //     if (e.filters !== undefined) console.log(e.name + '\t\t\t\t' + e.filters)
        // });

        if (!validate(data)) return { error: validate.errors }

        if (data.blueprint_book === undefined) return new Blueprint(data.blueprint)
        return new Book(data)
    },
    encode: (bPOrBook: any) => ('0' +
        zlib.deflateSync(JSON.stringify(bPOrBook.toObject()))
        .toString('base64')
        .replace(/(".+?")/g, (_, capture) => capture.replace(/_/g, '-'))
    )
}
