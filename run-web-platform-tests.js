'use strict';
const path = require('path');
const wptRunner = require('wpt-runner');
const minimatch = require('minimatch');

const { URL, URLSearchParams } = require('./dist/url.js');

const testsPath = path.resolve(__dirname, 'web-platform-tests/url');
const filterGlobs = process.argv.length >= 3 ? process.argv.slice(2) : ['url-constructor.html'];

function filter(testPath) {
  return filterGlobs.some(glob => minimatch(testPath, glob));
}

wptRunner(testsPath, { rootURL: 'url/', setup, filter })
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
