'use strict';
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');
const wptRunner = require('wpt-runner');
const consoleReporter = require('wpt-runner/lib/console-reporter');
const {filteringReporter, countingReporter} = require('./wpt-reporters');
const minimatch = require('minimatch');

const readFileAsync = promisify(fs.readFile);

const testsPath = path.resolve(__dirname, './web-platform-tests/url');
const filterGlobs = process.argv.length >= 3 ? process.argv.slice(2) : [
  'url-constructor.html',
  'url-origin.html',
  'url-searchparams.any.html',
  'url-setters.html',
  'url-tojson.html',
  'urlsearchparams-*.html'
];

main().catch(e => {
  console.error(e.stack);
  process.exitCode = 1;
});

async function main() {
  let failures = 0;

  failures += await test('polyfill.js', true, []);
  failures += await test('polyfill.min.js', true, []);
  failures += await test('polyfill.es6.js', true, []);
  failures += await test('ponyfill.js', false, []);
  failures += await test('ponyfill.es6.js', false, []);

  // for the loose versions, skip tests that require full IDNA UTS #46 support
  const skippedLooseTests = require('./skip-loose.json');
  failures += await test('polyfill.loose.js', true, skippedLooseTests);
  failures += await test('polyfill.loose.min.js', true, skippedLooseTests);
  failures += await test('ponyfill.loose.js', false, skippedLooseTests);

  process.exitCode = failures;
}

async function test(fileName, isPolyfill, skippedTests) {
  console.log(`>>> ${fileName}`);

  // count individual test results
  const counter = countingReporter(consoleReporter);
  // ignore specific test failures
  const reporter = filteringReporter(counter, {
    filter(name) {
      return !(
          // ignore URL setter tests for HTML elements
          name.startsWith('<a>')
          || name.startsWith('<area>')
          // ignore explicitly skipped tests
          || skippedTests.some(test => name.includes(test))
      );
    }
  });

  // load entry point
  const code = await readFileAsync(path.join(__dirname, '../dist/', fileName), {encoding: 'utf8'});

  await wptRunner(testsPath, {
    rootURL: 'url/',
    reporter,
    setup(window) {
      window.fetch = createFetch(window.XMLHttpRequest, window.Promise);

      // load polyfill
      delete window.URL;
      delete window.URLSearchParams;
      window.eval(code);
      if (!isPolyfill) {
        window.URL = window.URLPolyfill.URL;
        window.URLSearchParams = window.URLPolyfill.URLSearchParams;
      }
    },
    filter(testPath) {
      return filterGlobs.some(glob => minimatch(testPath, glob));
    }
  });

  const {counts} = counter;
  console.log(`\nTotal: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
  console.log();

  return counts.fail;
}

// Silly fetch polyfill just to make the following line work in URL tests:
// fetch("resources/urltestdata.json").then(res => res.json()).then(runURLTests)
function createFetch(XMLHttpRequest, Promise) {
  return function fetch(url) {
    return new Promise((resolve, reject) => {
      var request = new XMLHttpRequest();
      request.open('GET', url);
      request.responseType = 'json';
      request.onload = () => {
        const json = request.response;
        resolve({
          json() {
            return Promise.resolve(json);
          }
        });
      };
      request.onerror = () => {
        reject(new TypeError('Network error'));
      };
      request.send();
    });
  }
}
