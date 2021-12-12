import { join } from 'path'
import { fusebox, sparky, pluginLink, pluginReplace } from 'fuse-box'
import { IDevServerProps } from 'fuse-box/devServer/devServerProps'
import { IPublicConfig } from 'fuse-box/config/IConfig'
import { IRunResponse } from 'fuse-box/core/IRunResponse'
import { IRunProps } from 'fuse-box/config/IRunProps'

const port = Number(process.env.PORT) || 8080

const p = (p: string): string => join(__dirname, p)

const HEADERS_FILE = p('../src/_headers')
const EXPORTER_DATA = p('../../exporter/data/output')

class Context {
    public readonly paths = {
        dist: p('../dist'),
    }
    public runDev(runProps?: IRunProps): Promise<IRunResponse> {
        return fusebox(this.getConfig(true)).runDev(runProps)
    }
    public runProd(runProps?: IRunProps): Promise<IRunResponse> {
        return fusebox(this.getConfig()).runProd(runProps)
    }
    private getConfig(runServer = false): IPublicConfig {
        return {
            compilerOptions: {
                tsConfig: p('../tsconfig.json'),
            },
            entry: p('../src/index.ts'),
            target: 'browser',
            webIndex: { template: p('../src/index.html') },
            devServer: runServer && this.getServerConfig(),
            resources: {
                resourcePublicRoot: '/assets',
            },
            plugins: [
                pluginLink(/transcoder\.(.+?)\.(js|wasm)$/, { useDefault: true }),
                pluginReplace({
                    __CORS_PROXY_URL__: runServer
                        ? 'https://api.allorigins.win/raw?url='
                        : '/corsproxy?url=',
                    __STATIC_URL__: '/data',
                }),
            ],
            cache: { enabled: runServer, strategy: 'memory' },
            hmr: { plugin: p('./hmr.ts') },
            sourceMap: {
                css: !runServer,
                project: true,
                vendor: false,
            },
            watcher: {
                root: [p('../src'), p('../../editor/src')],
            },
        }
    }
    private getServerConfig(): IDevServerProps {
        return {
            httpServer: { port },
            hmrServer: { port },
            proxy: [
                {
                    path: '/data',
                    options: {
                        target: `http://localhost:8888`,
                        // pathRewrite: { '^/api': '' },
                    },
                },
            ],
        }
    }
}

const { src, rm, task } = sparky(Context)

task('dev', async ctx => {
    rm(ctx.paths.dist)
    await ctx.runDev({
        bundles: { distRoot: ctx.paths.dist },
    })
})

task('build', async ctx => {
    rm(ctx.paths.dist)
    await ctx.runProd({
        bundles: {
            distRoot: ctx.paths.dist,
            app: 'js/app.$hash.js',
            vendor: 'js/vendor.$hash.js',
            styles: 'css/styles.$hash.css',
        },
    })

    await src(HEADERS_FILE).dest(ctx.paths.dist, 'src').exec()

    await src(`${EXPORTER_DATA}/**/**.*`).dest(`${ctx.paths.dist}/data`, 'output').exec()
})
