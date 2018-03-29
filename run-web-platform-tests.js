'use strict';
const path = require('path');
const wptRunner = require('wpt-runner');
const consoleReporter = require('wpt-runner/lib/console-reporter');
const { filteringReporter } = require('./wpt-reporters');
const minimatch = require('minimatch');

const { URL, URLSearchParams } = require('./dist/url.js');

const testsPath = path.resolve(__dirname, 'web-platform-tests/url');
const filterGlobs = process.argv.length >= 3 ? process.argv.slice(2) : [
    'url-constructor.html',
    'url-origin.html',
    'url-setters.html',
    'url-tojson.html'
];

function filter(testPath) {
  return filterGlobs.some(glob => minimatch(testPath, glob));
}

// skip URL setter tests for HTML elements
const reporter = filteringReporter(consoleReporter, { filter: /^(?!<a>|<area>)/ });

wptRunner(testsPath, { rootURL: 'url/', setup, filter, reporter })
  .then(failures => {
    process.exitCode = failures;
  })
  .catch(e => {
    console.error(e.stack);
    process.exitCode = 1;
  });

function setup(window) {
  window.URL = URL;
  window.URLSearchParams = URLSearchParams;
}
