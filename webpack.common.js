'use strict'
// https://medium.com/webpack/webpack-4-mode-and-optimization-5423a6bc597a
const path = require('path')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const FaviconsWebpackPlugin = require('webapp-webpack-plugin') // favicons-webpack-plugin
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

const extractPlugin = new ExtractTextPlugin({
    filename: '[name].css',
    allChunks: true
})

const babelLoader = {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
      presets: [['@babel/preset-env', { useBuiltIns: 'entry' }]]
    }
}

module.exports = {
    target: 'web',
    entry: {
        main: './src/app'
    },
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.js', '.json', '.ts']
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    babelLoader
                ]
            },
            {
                test: /\.ts?$/,
                exclude: /node_modules/,
                use: [
                    babelLoader,
                    {
                        loader: 'ts-loader',
                        options: { transpileOnly: true }
                    }
                ]
            },
            {
                test: /normalize.css/,
                use: extractPlugin.extract({
                    use: ['css-loader']
                })
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            hash: true
        }),
        extractPlugin,
        new FaviconsWebpackPlugin({
            logo: './src/logo.png'
        }),
        // https://github.com/ProvidenceGeeks/website-frontend/pull/142
        new CopyWebpackPlugin([
            { from: 'src/spritesheets', to: 'spritesheets'/*'factorio-data/bundles/[name].[hash].[ext]'*/ }
        ]),
        new CleanWebpackPlugin(['dist/*.*'], { exclude: ['.git'] }),
        new ForkTsCheckerWebpackPlugin({
            tslint: true,
            watch: ['./src']
        })
    ]
}
