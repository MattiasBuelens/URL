const rollupTypescript = require('rollup-plugin-typescript');

module.exports = {
  input: 'src/url.ts',
  output: {
    file: 'dist/url.js',
    format: 'umd',
    name: 'URL'
  },
  plugins: [
    rollupTypescript({
      typescript: require('typescript')
    })
  ]
};
