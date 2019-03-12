const path = require('path');
const ts = require('typescript');

const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupDts = require('rollup-plugin-dts');
const rollupBabel = require('rollup-plugin-babel');
const {terser: rollupTerser} = require('rollup-plugin-terser');
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
          'stable': ['inplace'],
          'unorm': ['nfc', 'nfd', 'nfkc', 'nfkd']
        }
      }),
      rollupDts.ts({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          target: es5 ? ts.ScriptTarget.ES5 : ts.ScriptTarget.ES2015
        }
      }),
      es5 ? rollupBabel({
        exclude: 'node_modules/idna-uts46/idna-map.js',
        babelrc: false,
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
        include: ['node_modules/**'],
        exclude: ['node_modules/punycode/**'],
        modules: {
          'String.fromCodePoint': path.resolve(__dirname, 'src/polyfill/string-fromcodepoint.ts')
        }
      }) : undefined,
      minify ? rollupTerser(
          {
            toplevel: true,
            compress: {
              reduce_funcs: false
            },
            mangle: {
              properties: {
                regex: /^_/
              }
            },
            sourcemap: true
          }
      ) : undefined,
      minify ? rollupVisualizer({
        filename: `${name}.stats.html`,
        sourcemap: true
      }) : undefined
    ].filter(Boolean)
  };
}

function types(name) {
  return {
    input: 'src/polyfill.ts',
    output: {
      file: `dist/types/${name}.d.ts`,
      format: 'es'
    },
    plugins: [
      rollupDts.dts({
        tsconfig: './tsconfig.json'
      })
    ]
  };
}

module.exports = [
  types('url'),
  config('url', { es5: true, esm: true }),
  config('url.min', { es5: true, minify: true }),
  config('url.es6', { es5: false, esm: true }),
  config('url.loose', { loose: true, es5: true, esm: true }),
  config('url.loose.min', { loose: true, es5: true, minify: true })
];
