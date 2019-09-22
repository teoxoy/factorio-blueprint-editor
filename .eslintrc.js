module.exports = {
    env: {
        browser: true,
        es6: true,
        node: true
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
        project: './packages/*/tsconfig.json'
    },
    plugins: ['@typescript-eslint', 'import', 'prettier'],
    settings: {
        'import/extensions': ['.ts'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts']
        },
        'import/resolver': {
            ts: {
                directory: './packages/*/tsconfig.json'
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
