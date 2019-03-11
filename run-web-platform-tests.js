'use strict';
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');
const wptRunner = require('wpt-runner');
const consoleReporter = require('wpt-runner/lib/console-reporter');
const {filteringReporter, countingReporter} = require('./wpt-reporters');
const minimatch = require('minimatch');

const readFileAsync = promisify(fs.readFile);

const testsPath = path.resolve(__dirname, 'web-platform-tests/url');
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

  failures += await test('./dist/url.js', []);

  // for the loose version, skip tests that require full IDNA UTS #46 support
  const skippedLooseTests = require('./test/skip-loose.json');
  failures += await test('./dist/url.loose.js', skippedLooseTests);

  process.exitCode = failures;
}

async function test(entryPointPath, skippedTests) {
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
  const code = await readFileAsync(entryPointPath, {encoding: 'utf8'});

  await wptRunner(testsPath, {
    rootURL: 'url/',
    reporter,
    setup(window) {
      window.fetch = createFetch(window.XMLHttpRequest, window.Promise);

      // load polyfill
      delete window.URL;
      delete window.URLSearchParams;
      window.eval(code);
    },
    filter(testPath) {
      return filterGlobs.some(glob => minimatch(testPath, glob));
    }
  });

  const {counts} = counter;
  console.log(`\nTotal: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
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
