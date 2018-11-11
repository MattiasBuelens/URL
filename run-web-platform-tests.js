'use strict';
const path = require('path');
const wptRunner = require('wpt-runner');
const consoleReporter = require('wpt-runner/lib/console-reporter');
const { filteringReporter, countingReporter } = require('./wpt-reporters');
const minimatch = require('minimatch');

const { URL, URLSearchParams } = require('./dist/url.js');

const testsPath = path.resolve(__dirname, 'web-platform-tests/url');
const filterGlobs = process.argv.length >= 3 ? process.argv.slice(2) : [
    'url-constructor.html',
    'url-origin.html',
    'url-searchparams.any.html',
    'url-setters.html',
    'url-tojson.html',
    'urlsearchparams-*.html'
];

function filter(testPath) {
  return filterGlobs.some(glob => minimatch(testPath, glob));
}

// count individual test results
const counter = countingReporter(consoleReporter);
// skip URL setter tests for HTML elements
const reporter = filteringReporter(counter, { filter: /^(?!<a>|<area>)/ });

wptRunner(testsPath, { rootURL: 'url/', setup, filter, reporter })
  .then(failures => {
    const { counts } = counter;
    console.log(`\nTotal: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
    process.exitCode = counts.fail;
  })
  .catch(e => {
    console.error(e.stack);
    process.exitCode = 1;
  });

function setup(window) {
  window.Promise = Promise;
  window.fetch = createFetch(window.XMLHttpRequest, window.Promise);

  window.URL = URL;
  window.URLSearchParams = URLSearchParams;
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
