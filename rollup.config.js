const path = require('path');

const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupTypescript2 = require('rollup-plugin-typescript2');
const rollupBabel = require('rollup-plugin-babel');
const rollupUglify = require('rollup-plugin-uglify');
const rollupInject = require('rollup-plugin-inject');
const rollupAlias = require('rollup-plugin-alias');
const rollupVisualizer = require('rollup-plugin-visualizer');

function config(name, {
  loose = false,
  es5 = false,
  esm = false,
  minify = false
} = {}) {
  return {
    input: 'src/polyfill.ts',
    output: [
      {
        file: `dist/${name}.js`,
        format: 'umd',
        name: 'URL',
        sourcemap: minify
      },
      esm ? {
        file: `dist/${name}.mjs`,
        format: 'es',
        sourcemap: minify
      } : undefined
    ].filter(Boolean),
    plugins: [
      loose ? rollupAlias({
        'idna-uts46': path.resolve(__dirname, `src/loose/idna-uts46`),
        resolve: ['.ts', '.js']
      }) : undefined,
      rollupNodeResolve({
        jsnext: true,
        preferBuiltins: false // do not use punycode from Node
      }),
      rollupCommonJS({
        include: 'node_modules/**',
        namedExports: {
          'idna-uts46': ['toAscii'],
          'unorm': ['nfc', 'nfd', 'nfkc', 'nfkd']
        }
      }),
      rollupTypescript2({
        typescript: require('typescript'),
        rollupCommonJSResolveHack: true
      }),
      es5 ? rollupBabel({
        exclude: 'node_modules/idna-uts46/idna-map.js',
        plugins: [
          [
            require('./build/babel-transform-method'),
            {
              'codePointAt': path.resolve(__dirname, './src/polyfill/string-codepointat.ts'),
              'normalize': path.resolve(__dirname, './src/polyfill/string-normalize.ts'),
              'startsWith': path.resolve(__dirname, './src/polyfill/string-startswith.ts'),
              'endsWith': path.resolve(__dirname, './src/polyfill/string-endswith.ts'),
              'includes': path.resolve(__dirname, './src/polyfill/string-includes.ts')
            }
          ]
        ]
      }) : undefined,
      es5 ? rollupInject({
        include: 'node_modules/**',
        modules: {
          'String.fromCodePoint': path.resolve(__dirname, 'src/polyfill/string-fromcodepoint.ts')
        }
      }) : undefined,
      minify ? rollupUglify(
          {
            toplevel: true,
            mangle: {
              properties: {
                regex: /^_/
              }
            },
            sourceMap: true
          },
          require('uglify-es').minify
      ) : undefined,
      minify ? rollupVisualizer({
        filename: `${name}.stats.html`,
        sourcemap: true
      }) : undefined
    ].filter(Boolean)
  };
}

module.exports = [
  config('url', { es5: true, esm: true }),
  config('url.min', { es5: true, minify: true }),
  config('url.es6', { es5: false, esm: true }),
  config('url.loose', { loose: true, es5: true, esm: true }),
  config('url.loose.min', { loose: true, es5: true, minify: true })
];
