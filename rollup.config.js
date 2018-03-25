const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupTypescript2 = require('rollup-plugin-typescript2');

module.exports = {
  input: 'src/polyfill.ts',
  output: {
    file: 'dist/url.js',
    format: 'umd',
    name: 'URL',
    sourcemap: true
  },
  plugins: [
    rollupNodeResolve({
      jsnext: true,
      preferBuiltins: false // do not use punycode from Node
    }),
    rollupCommonJS({
      include: 'node_modules/**'
    }),
    rollupTypescript2({
      typescript: require('typescript')
    })
  ]
};
