const webpack = require("webpack");
const path = require("path");

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
		host: '127.0.0.1',
		port: 8080
	},
	optimization: {
		minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})],
		/*		splitChunks: {
                    cacheGroups: {
                        d3: {
                            test: /[\\/]node_modules[\\/]d3.*[\\/]/,
                            name: 'd3',
                            filename: '[name].bundle.js',
                            chunks: 'all',
                        },
                        leaflet: {
                            test: /[\\/]node_modules[\\/]leaflet.*[\\/]/,
                            name: 'leaflet',
                            filename: '[name].bundle.js',
                            chunks: 'all',
                        }
                    }
                } */
	},
	module:{
		rules:[
			{
				test:/\.css$/,
				use: [MiniCssExtractPlugin.loader, 'css-loader'],
			},
			{
				test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/,
				include: /node_modules/,
				use: ['file-loader']
			},
			{
				test: /\.(jpe?g|png|gif|svg|ico|xml|webmanifest)$/i,
				include: /favicons/,
				loader: "file-loader?name=/favicons/[name].[ext]"
			},
			{
				test: /\.(jpe?g|png|gif|svg|ico|xml|webmanifest)$/i,
				include: /images/,
				loader: "file-loader",
				options: {
					outputPath: 'images/',
					publicPath: 'images/',
					name: '[name].[ext]'
				}
			},
			{
				test: /\.(txt)$/i,
				loader: "file-loader?name=/[name].[ext]"
			}
		]
	},

	// https://webpack.js.org/concepts/plugins/
	plugins: [
		new HtmlWebpackPlugin({
			template: './src/index.html',
			inject: true,
//			chunks: ['index'],
			filename: 'index.html'
		}),
		new MiniCssExtractPlugin({
			filename: '[name].css',
			chunkFilename: '[name].css',
		}),
	],
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist')
	}
};