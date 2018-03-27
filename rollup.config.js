const path = require('path');

const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupTypescript2 = require('rollup-plugin-typescript2');
const rollupBabel = require('rollup-plugin-babel');
const rollupInject = require('rollup-plugin-inject');
const rollupReplace = require('rollup-plugin-replace');
const rollupAlias = require('rollup-plugin-alias');

const LOOSE = false;
const ES5 = false;

module.exports = {
  input: 'src/polyfill.ts',
  output: {
    file: 'dist/url.js',
    format: 'umd',
    name: 'URL',
    sourcemap: true
  },
  plugins: [
    LOOSE ? rollupAlias({
      'idna-uts46': path.resolve(__dirname, `src/loose/idna-uts46.js`)
    }) : undefined,
    rollupNodeResolve({
      jsnext: true,
      preferBuiltins: false // do not use punycode from Node
    }),
    rollupCommonJS({
      include: 'node_modules/**',
      namedExports: {
        'idna-uts46': ['toAscii']
      }
    }),
    rollupTypescript2({
      typescript: require('typescript')
    }),
    ES5 ? rollupBabel({
      include: 'node_modules/**',
      exclude: 'node_modules/idna-uts46/idna-map.js',
      plugins: [
        [
          require('./build/babel-transform-method'),
          {
            'codePointAt': path.resolve(__dirname, './src/polyfill/string-codepointat.ts')
          }
        ]
      ],
    }) : undefined,
    ES5 ? rollupInject({
      include: 'node_modules/**',
      modules: {
        'String.fromCodePoint': path.resolve(__dirname, 'src/polyfill/string-fromcodepoint.ts')
      }
    }) : undefined,
    rollupReplace({
      include: 'src/**',
      values: {
        LOOSE: LOOSE
      }
    })
  ].filter(Boolean)
};
