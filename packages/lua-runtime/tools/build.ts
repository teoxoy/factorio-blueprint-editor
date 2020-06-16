import { promises as fs } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import glob from 'fast-glob'

const emsdkPath = join(__dirname, 'emsdk')
const emsdkReleasesPath = join(emsdkPath, 'emscripten-releases-tags.txt')
const emcc = join(emsdkPath, 'upstream/emscripten/emcc')
const emsdk = join(emsdkPath, 'emsdk')

const srcPath = join(__dirname, '../src')
const depsPath = join(__dirname, '../deps')
const distPath = join(__dirname, '../dist')
const cachePath = join(__dirname, './cache')

const luaBC = join(cachePath, 'lualib.bc')
const rapidjsonBC = join(cachePath, 'rapidjson.bc')

const emccConfigArgs = [
    '--em-config',
    join(emsdkPath, '.emscripten'),
    '--cache',
    join(emsdkPath, '.emscripten_cache'),
]

switch (process.argv[2]) {
    case 'setup':
        setup()
        break
    case 'compile-deps':
        compileDeps()
        break
    case 'compile':
        compile()
        break
}

async function setup(): Promise<void> {
    console.log('Setting up emsdk')

    await run('git', [
        'clone',
        '--depth',
        '1',
        'https://github.com/emscripten-core/emsdk.git',
        emsdkPath,
    ])
    const emsdkReleases = JSON.parse(await fs.readFile(emsdkReleasesPath, { encoding: 'utf8' }))
    const latestReleaseHash = emsdkReleases.releases[emsdkReleases.latest]
    const toolName = `releases-upstream-${latestReleaseHash}-64bit`
    await run(emsdk, ['install', toolName, '--embedded', '--shallow'])
    await run(emsdk, ['activate', toolName, '--embedded'])
}

async function compileDeps(): Promise<void> {
    await ensureEmcc()

    console.log('Compiling dependencies')
    await ensureDir(cachePath)
    await Promise.all([compileLua(), compileRapidJSON()])

    async function compileLua(): Promise<void> {
        const LUA_FILES = await glob('*.c', {
            ignore: ['lua.c', 'luac.c'],
            cwd: join(depsPath, 'lua'),
            absolute: true,
        })
        // prettier-ignore
        const lualib = [
            ...emccConfigArgs,
            '-s', 'WASM=1',
            '-DLUA_COMPAT_ALL',
            '-DLUA_USE_POSIX',
            '-DLUA_USE_STRTODHEX',
            '-DLUA_USE_AFORMAT',
            '-DLUA_USE_LONGLONG',
            '-g',
            '-x', 'c++',
            '-std=c++11',
            '-o', luaBC,
            '-r', ...LUA_FILES
        ]
        await run(emcc, lualib)
    }

    async function compileRapidJSON(): Promise<void> {
        const RAPIDJSON_FILES = await glob('*.cpp', {
            cwd: join(depsPath, 'lua-rapidjson'),
            absolute: true,
        })
        // prettier-ignore
        const rapidjson = [
            ...emccConfigArgs,
            '-s', 'WASM=1',
            `-I${depsPath}`,
            '-g',
            '-x', 'c++',
            '-std=c++11',
            '-o', rapidjsonBC,
            '-r', ...RAPIDJSON_FILES
        ]
        await run(emcc, rapidjson)
    }
}

async function compile(): Promise<void> {
    await ensureEmcc()

    const cached = await Promise.all([fs.stat(luaBC), fs.stat(rapidjsonBC)])
        .then(() => true)
        .catch(() => compileDeps())

    console.log('Compiling main', cached ? 'using cached dependencies' : '')
    await ensureDir(distPath)

    const dev = true

    // prettier-ignore
    const main = [
        ...emccConfigArgs,
        ...(dev ? [
            '-g3',
            // '-g4',
            // '--source-map-base', '.',
        ] : [
            '-O3',
        ]),
        '-s', 'WASM=1',
        '-s', 'MODULARIZE=1',
        // '-s', 'MODULARIZE_INSTANCE=1',
        '-s', 'EXPORT_ES6=1',
        '-s', 'USE_ES6_IMPORT_META=0',
        // '-s', 'ASSERTIONS=1',
        '-s', `EXPORTED_FUNCTIONS=['_run', '_passGetFileFnPtr', '_passIsLualibFnPtr']`,
        '-s', `EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap', 'addFunction', 'UTF8ToString', 'allocateUTF8', 'getValue']`,
        '-s', 'RESERVED_FUNCTION_POINTERS=2',
        '-s', 'DISABLE_EXCEPTION_CATCHING=0',
        '-s', 'ALLOW_MEMORY_GROWTH=1',
        '-s', 'FILESYSTEM=0',
        // '-s', 'SINGLE_FILE=1',
        '-s', 'STRICT=1',
        '-s', 'ENVIRONMENT="web"',
        '-s', 'EXIT_RUNTIME=1',
        `-I${depsPath}`,
        '-x', 'c++',
        '-std=c++11',
        '-o', join(distPath, 'main.js'),
        luaBC, rapidjsonBC, join(srcPath, 'main.cpp')
    ]
    await run(emcc, main)
}

async function run(command: string, args?: string[]): Promise<void> {
    await new Promise(resolve => {
        const proc = spawn(command, args)
        proc.stderr.on('data', data => process.stderr.write(data))
        proc.stdout.on('data', data => process.stdout.write(data))
        proc.on('close', resolve)
    })
}

async function ensureDir(path: string): Promise<void> {
    await fs.mkdir(path).catch(() => undefined)
}

async function ensureEmcc(): Promise<void> {
    await fs.stat(emcc).catch(() => setup())
}
