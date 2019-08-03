const glob = require('glob')

const globPattern = './packages/**/tsconfig.json'

module.exports = {
    env: {
        browser: true,
        es6: true,
        node: true
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
        project: glob.sync(globPattern)
    },
    plugins: ['@typescript-eslint', 'import', 'prettier'],
    settings: {
        'import/extensions': ['.ts'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts']
        },
        'import/resolver': {
            typescript: {
                directory: globPattern
            }
        }
    },
    extends: [
        'eslint:recommended',
        './.eslint.base.yml',
        'plugin:@typescript-eslint/eslint-recommended', // Turn off conflicting rules

        'plugin:@typescript-eslint/recommended',
        './.eslint.typescript.yml',
        'prettier', // Turn off conflicting rules
        'prettier/@typescript-eslint', // Turn off conflicting rules

        './.eslint.import.yml'
    ],
    rules: {
        'prettier/prettier': 'warn'
    }
}
