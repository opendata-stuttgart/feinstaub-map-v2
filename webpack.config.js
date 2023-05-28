const webpack = require("webpack");
const path = require("path");
const CopyWebpackPlugin = require('copy-webpack-plugin');

const TerserJSPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {

    // https://webpack.js.org/concepts/entry-points/#multi-page-application
    entry: {
        index: './src/js/index.js'
    },


    // TODO: check why main.js and index.css are not linked correctly in index.html
    // should be /dist/ instead of /src/?
    // https://webpack.js.org/configuration/dev-server/
    devServer: {
        host: '127.0.0.1', port: 8080
    }, optimization: {
        minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})]
    }, module: {
        rules: [{
            test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader']
        }, {
            test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/, exclude: /node_modules/, use: ['file-loader']
        }, {
            test: /\.(jpe?g|png|gif|svg|ico|xml|webmanifest)$/i, include: /images/, loader: "file-loader", options: {
                outputPath: 'images/', publicPath: 'dist/images/', name: '[name].[ext]'
            }
        }, {
            test: /\.json$/, include: path.resolve(__dirname, 'data'),
            loader: 'json-loader', type: 'javascript/auto', options: {
                outputPath: 'data/', publicPath: 'data/', name: '[name].[ext]'
            }
        }]
    },

    // https://webpack.js.org/concepts/plugins/
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html', inject: true,
            filename: 'index.html'
        }),
        new MiniCssExtractPlugin({
            filename: '[name].css', chunkFilename: '[name].css',
        }),
        new CopyWebpackPlugin({
            patterns: [{
                from: 'src/data', to: 'data', globOptions: {ignore: ['.*'],},},
            ],
        }),
    ],
    output: {
        filename: 'main.js', path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
    }
};