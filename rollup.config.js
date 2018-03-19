const rollupNodeResolve = require('rollup-plugin-node-resolve');
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
    rollupTypescript({
      typescript: require('typescript')
    })
  ]
};
