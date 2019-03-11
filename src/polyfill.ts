import { jURL } from "./url";
import { URLSearchParams as jURLSearchParams } from "./search-params";

declare global {
  interface Window {
    forceJURL?: boolean;
  }
}

const scope = typeof self !== 'undefined' ? self
    : typeof window !== 'undefined' ? window
        : undefined;

const OriginalURL = scope && scope.URL;
const OriginalURLSearchParams = scope && scope.URLSearchParams;

// feature detect for URL constructor
let hasWorkingUrl = false;
if (OriginalURL && OriginalURLSearchParams && !(scope && scope.forceJURL)) {
  try {
    const u = new OriginalURL('b', 'http://a');
    u.pathname = 'c%20d';
    hasWorkingUrl = u.href === 'http://a/c%20d';
  } catch (e) {
  }
}

let URL: typeof window.URL;
let URLSearchParams: typeof window.URLSearchParams;
if (hasWorkingUrl) {
  URL = OriginalURL!;
  URLSearchParams = OriginalURLSearchParams!;
} else {
  URL = jURL as any;
  URLSearchParams = jURLSearchParams as any;
  // Copy over the static methods
  if (OriginalURL) {
    URL.createObjectURL = function (blob) {
      // IE extension allows a second optional options argument.
      // http://msdn.microsoft.com/en-us/library/ie/hh772302(v=vs.85).aspx
      return (OriginalURL.createObjectURL as Function).apply(OriginalURL, arguments);
    };
    URL.revokeObjectURL = function (url) {
      OriginalURL.revokeObjectURL(url);
    };
  }
}

export { URL, URLSearchParams };
