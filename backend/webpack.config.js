const path = require("path");

module.exports = {
  entry: "./src/server.ts", // file khởi chạy chính
  target: "node", // chạy trên môi trường Node.js
  mode: "development", // đổi sang "production" khi build release
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"), // output folder
  },
  resolve: {
    extensions: [".ts", ".js"], // cho phép import file .ts và .js
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // biên dịch file .ts
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
};
