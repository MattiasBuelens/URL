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
  const outputName = `${name}${loose ? '.loose' : ''}${es5 ? '' : '.es6'}${minify ? '.min' : ''}`;
  return {
    input: `src/${name}.ts`,
    output: [
      {
        file: `dist/${outputName}.js`,
        format: 'umd',
        name: 'URLPolyfill',
        sourcemap: minify
      },
      esm ? {
        file: `dist/${outputName}.mjs`,
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
        tsconfig: './tsconfig.json'
      }),
      es5 ? rollupBabel({
        exclude: 'node_modules/idna-uts46/idna-map.js',
        extensions: ['.ts', '.js'],
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
        filename: `${outputName}.stats.html`,
        sourcemap: true
      }) : undefined
    ].filter(Boolean)
  };
}

function types(name) {
  return {
    input: `src/${name}.ts`,
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
  types('polyfill'),
  config('polyfill', { es5: true, esm: true }),
  config('polyfill', { es5: true, minify: true }),
  config('polyfill', { es5: false, esm: true }),
  config('polyfill', { loose: true, es5: true, esm: true }),
  config('polyfill', { loose: true, es5: true, minify: true }),

  types('ponyfill'),
  config('ponyfill', { es5: true, esm: true }),
  config('ponyfill', { es5: false, esm: true }),
  config('ponyfill', { loose: true, es5: true, esm: true })
];
