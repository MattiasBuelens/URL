const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupTypescript = require('rollup-plugin-typescript');

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
    rollupTypescript({
      typescript: require('typescript')
    })
  ]
};
