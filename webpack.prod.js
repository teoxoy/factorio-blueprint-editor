'use strict'

const merge = require('webpack-merge')
const common = require('./webpack.common.js')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const Visualizer = require('webpack-visualizer-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
//const ClosureCompilerPlugin = require('webpack-closure-compiler')

// https://webpack.github.io/analyse/

module.exports = merge(common, {
    mode: 'production',
    profile: true,
    plugins: [
        new OptimizeCssAssetsPlugin({
            cssProcessorOptions: { discardComments: { removeAll: true } }
        }),
        new BundleAnalyzerPlugin({
            reportFilename: './stats/report.html',
            analyzerMode: 'static',
            openAnalyzer: false,
            generateStatsFile: true,
            statsFilename: './stats/stats.json'
        }),
        new Visualizer({
            filename: './stats/statistics.html'
        })
        // new ClosureCompilerPlugin({
        //     compiler: {
        //       language_in: 'ECMASCRIPT6',
        //       language_out: 'ECMASCRIPT5',
        //       compilation_level: 'ADVANCED'
        //     },
        //     jsCompiler: true,
        //     concurrency: 3,
        // })
    ]
})
