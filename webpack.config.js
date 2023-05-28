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

    // https://webpack.js.org/configuration/dev-server/
    devServer: {
        host: '127.0.0.1', port: 8080
    }, optimization: {
        minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})]
    }, module: {
        rules: [{
            test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'],
        }, {
            test: /\.(png|jpg|jpeg|gif|svg|ico)$/, exclude: /node_modules/, use: ['file-loader']
        }, {
            test: /\.(png|jpg)$/, exclude: /node_modules/, loader: 'url-loader'
        }, {
            test: /\.json$/, include: path.resolve(__dirname, 'data'),
            loader: 'json-loader', type: 'javascript/auto'
        }]
    },

    // https://webpack.js.org/concepts/plugins/
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html', inject: true,
            filename: 'index.html'
        }),
        new MiniCssExtractPlugin(),
        new CopyWebpackPlugin({
            patterns: [{
                from: 'src/data', to: 'data', globOptions: {ignore: ['.*'],},
            }, {
                from: 'src/images', to: 'images', globOptions: {ignore: ['.*'],},
            },
            ],
        }),
    ],
    output: {
        filename: 'main.js', path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
    }
};