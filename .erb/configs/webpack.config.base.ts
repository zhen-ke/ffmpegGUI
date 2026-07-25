/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import { dependencies as externals } from '../../release/app/package.json';

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  // CI 环境（如 GitHub Actions）每次都是全新虚拟机，filesystem cache 会被丢弃。
  // 仅在本地开发时启用，避免 CI 上产生无效 I/O。
  cache: process.env.CI
    ? false
    : {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      },

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          // esbuild-loader 比 ts-loader 快一个数量级（即使 ts-loader 已开
          // transpileOnly）。类型检查交由 CI / IDE 负责，不阻塞打包。
          loader: 'esbuild-loader',
          options: {
            target: 'es2022',
            // .tsx 走 jsx=automatic，与 tsconfig 的 jsx: 'react-jsx' 对齐
            jsx: 'automatic',
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
  ],
};

export default configuration;
