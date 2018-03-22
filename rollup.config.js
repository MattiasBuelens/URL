const path = require('path');

const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupTypescript2 = require('rollup-plugin-typescript2');
const rollupInject = require('rollup-plugin-inject');
const rollupReplace = require('rollup-plugin-replace');
const rollupAlias = require('rollup-plugin-alias');

const LOOSE = false;

module.exports = {
  input: 'src/polyfill.ts',
  output: {
    file: 'dist/url.js',
    format: 'umd',
    name: 'URL',
    sourcemap: true
  },
  plugins: [
    rollupAlias(LOOSE ? {
      'idna-uts46': path.resolve(__dirname, `src/loose/idna-uts46.js`)
    } : {}),
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
    rollupInject({
      include: 'node_modules/**',
      modules: {
        'String.fromCodePoint': path.resolve(__dirname, 'src/polyfill/string-fromcodepoint.ts')
      }
    }),
    rollupTypescript2({
      typescript: require('typescript')
    }),
    rollupReplace({
      include: 'src/**',
      values: {
        LOOSE: LOOSE
      }
    })
  ]
};
