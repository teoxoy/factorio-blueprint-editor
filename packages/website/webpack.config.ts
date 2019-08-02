import path from 'path'
import webpack from 'webpack'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import TerserJSPlugin from 'terser-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import WebpackDevServer from 'webpack-dev-server'

const config = (_: unknown, { mode }: { mode: 'production' | 'development' }): webpack.Configuration => {
    const DEV = mode !== 'production'
    const sourceMapType = DEV ? 'inline-source-map' : 'source-map'
    const sourceMap = !!sourceMapType
    // hmr only works for css in the current config
    const hmr = true

    return {
        target: 'web',
        mode: DEV ? 'development' : 'production',
        devtool: sourceMapType,
        devServer: {
            contentBase: './dist',
            hot: hmr,
            before(_, server) {
                devServer = server
            }
        },
        stats: DEV ? 'minimal' : 'normal',
        entry: ['./src/index.ts', './src/index.styl'],
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                            experimentalWatchApi: true
                        }
                    }
                },
                {
                    test: /\.styl$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader,
                            options: {
                                hmr: DEV,
                                sourceMap
                            }
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                sourceMap
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap
                            }
                        },
                        {
                            loader: 'stylus-loader',
                            options: {
                                sourceMap
                            }
                        }
                    ]
                },
                {
                    test: /\.(jpg|png|svg)$/,
                    use: {
                        loader: 'file-loader',
                        options: {
                            name: DEV ? '[name].[ext]' : '[name].[contenthash:10].[ext]'
                        }
                    }
                },
                // {
                //     test: /\.svg$/,
                //     loader: 'svg-inline-loader'
                // }
                {
                    test: /\.html$/,
                    use: {
                        loader: 'html-loader',
                        options: {
                            minimize: !DEV,
                            attrs: ['img:src', 'link:href']
                        }
                    }
                }
            ]
        },
        plugins: [
            new CleanWebpackPlugin(),
            new HtmlWebpackPlugin({
                template: './src/index.html'
            }),
            reloadHtml,
            new MiniCssExtractPlugin({
                filename: DEV ? '[name].css' : '[name].[contenthash:10].css'
            })
        ],
        optimization: {
            moduleIds: 'hashed',
            runtimeChunk: 'single',
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    factorio_data: {
                        priority: 1,
                        test: /[\\/]node_modules[\\/]factorio-data[\\/]/,
                        name: 'factorio_data'
                    },
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendor'
                    }
                }
            },
            minimizer: [
                new TerserJSPlugin({ sourceMap }),
                new OptimizeCSSAssetsPlugin({ cssProcessorOptions: { map: sourceMap } })
            ]
        },
        resolve: {
            extensions: ['.js', '.ts', '.styl', '.html']
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: DEV ? '[name].js' : '[name].[contenthash:10].js'
        }
    }
}

/*
    Reload devServer when HTML changes (this doesn't happen automatically because we use HtmlWebpackPlugin)
    From https://github.com/jantimon/html-webpack-plugin/issues/100#issuecomment-368303060
*/
let devServer: WebpackDevServer
function reloadHtml(): void {
    const cache: Record<string, string> = {}
    const plugin = { name: 'CustomHtmlReloadPlugin' }
    // @ts-ignore
    this.hooks.compilation.tap(plugin, compilation => {
        // @ts-ignore
        compilation.hooks.htmlWebpackPluginAfterEmit.tap(plugin, data => {
            const orig = cache[data.outputName]
            const html = data.html.source()
            // plugin seems to emit on any unrelated change?
            if (orig && orig !== html) {
                // @ts-ignore
                devServer.sockWrite(devServer.sockets, 'content-changed')
            }
            cache[data.outputName] = html
        })
    })
}

export default config
