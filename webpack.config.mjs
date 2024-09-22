//webpack.config.mjs
import path from 'path';
import { fileURLToPath } from 'url';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production', // 使用生产模式，自动启用优化和压缩
  entry: './src/index.ts', // 入口文件
  output: {
    filename: 'index.js', // 输出文件名
    path: path.resolve(__dirname, 'dist'), // 输出目录
    library: {
      type: 'module', // 输出为 ES 模块
    },
    clean: true, // 每次构建前清理 dist 文件夹

  },
  experiments: {
    outputModule: true, // 启用输出模块实验特性
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'], // 自动解析这些扩展名
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // 匹配所有 .ts 文件
        use: 'ts-loader', // 使用 ts-loader 编译 TypeScript
        exclude: /node_modules/, // 排除 node_modules 文件夹
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'runtime/*', to: 'runtime/[name][ext]' }, // 复制 runtime 目录下的文件
        { from: 'assets/*', to: 'assets/[name][ext]' }, // 复制 assets 目录下的文件
      ],
    }),
  ],
  optimization: {
    minimize: false, // 启用代码压缩
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false, // 移除注释
          },
        },
        extractComments: false, // 不提取注释到单独的文件
      }),
    ],
  },
  devtool: 'source-map', // 生成 source map 以便调试
};

