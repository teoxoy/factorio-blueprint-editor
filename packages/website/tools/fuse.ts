import { join } from 'path'
import { fusebox, sparky, pluginLink } from 'fuse-box'
import { IDevServerProps } from 'fuse-box/devServer/devServerProps'
import { Context as FuseBoxContext } from 'fuse-box/core/context'
import { wrapContents } from 'fuse-box/plugins/pluginStrings'
import { minify as luamin } from 'luamin'
import { IPublicConfig } from 'fuse-box/config/IConfig'
import { IRunResponse } from 'fuse-box/core/IRunResponse'
import { IRunProps } from 'fuse-box/config/IRunProps'

const port = Number(process.env.PORT) || 8080

const p = (p: string): string => join(__dirname, p)

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
                this.luaPlugin,
                pluginLink(/basis_transcoder\.(js|wasm)$/, { useDefault: true }),
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
    private readonly luaPlugin = (ctx: FuseBoxContext): void => {
        ctx.ict.on('bundle_resolve_module', props => {
            const m = props.module
            if (!m.captured && m.extension === '.lua') {
                m.captured = true
                m.read()
                m.contents = wrapContents(`\`${luamin(m.contents)}\``, true)
            }
            return props
        })
    }
}

const { rm, task } = sparky(Context)

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
})
