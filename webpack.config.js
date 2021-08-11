const HtmlWebpackPlugin = require("html-webpack-plugin")
const path = require("path")
const webpack = require("webpack")

module.exports = {
    entry: "./src/content2.js",
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, "dist"),
        publicPath: "",
    },
    optimization: {
        minimize: false,
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
            {
                test: /\.(png|jpg|gif)$/,
                use: [
                    {
                        loader: "file-loader",
                    },
                ],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Foam-CAD",
            template: __dirname + "/src/index.html",
            file: "index.html",
            inject: "body",
        }),
        new webpack.HotModuleReplacementPlugin(),
    ],
    devServer: {
        contentBase: "./dist",
        open: true,
        hot: true,
    },
}
