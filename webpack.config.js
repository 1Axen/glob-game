const { watch } = require("fs");
const path = require("path");

module.exports = {
  mode: "development",
  entry: "./client/app.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, "./public"),
    filename: "app.js",
  },
  watch: true,
};
