const path = require('path');

const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');
const rollupTypescript2 = require('rollup-plugin-typescript2');
const rollupBabel = require('rollup-plugin-babel');
const rollupInject = require('rollup-plugin-inject');
const rollupReplace = require('rollup-plugin-replace');
const rollupAlias = require('rollup-plugin-alias');

function config(name, {loose = false, es5 = false} = {}) {
  return {
    input: 'src/polyfill.ts',
    output: [{
      file: `dist/${name}.js`,
      format: 'umd',
      name: 'URL',
      sourcemap: true
    }, {
      file: `dist/${name}.mjs`,
      format: 'es',
      sourcemap: true
    },],
    plugins: [
      loose ? rollupAlias({
        'idna-uts46': path.resolve(__dirname, `src/loose/idna-uts46.js`)
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
        typescript: require('typescript')
      }),
      es5 ? rollupBabel({
        include: 'node_modules/**',
        exclude: 'node_modules/idna-uts46/idna-map.js',
        plugins: [
          [
            require('./build/babel-transform-method'),
            {
              'codePointAt': path.resolve(__dirname, './src/polyfill/string-codepointat.ts'),
              'normalize': path.resolve(__dirname, './src/polyfill/string-normalize.ts')
            }
          ]
        ],
      }) : undefined,
      es5 ? rollupInject({
        include: 'node_modules/**',
        modules: {
          'String.fromCodePoint': path.resolve(__dirname, 'src/polyfill/string-fromcodepoint.ts')
        }
      }) : undefined,
      rollupReplace({
        include: 'src/**',
        values: {
          LOOSE: loose
        }
      })
    ].filter(Boolean)
  };
}

module.exports = [
  config('url', {}),
  config('url.loose', {loose: true}),
  config('url.es5', {loose: true, es5: true})
];
