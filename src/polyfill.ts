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

let URLPolyfill: typeof URL;
let URLSearchParamsPolyfill: typeof URLSearchParams;
if (hasWorkingUrl) {
  URLPolyfill = OriginalURL!;
  URLSearchParamsPolyfill = OriginalURLSearchParams!;
} else {
  URLPolyfill = jURL as any;
  URLSearchParamsPolyfill = jURLSearchParams as any;
  // Copy over the static methods
  if (OriginalURL) {
    URLPolyfill.createObjectURL = function (blob) {
      // IE extension allows a second optional options argument.
      // http://msdn.microsoft.com/en-us/library/ie/hh772302(v=vs.85).aspx
      return (OriginalURL.createObjectURL as Function).apply(OriginalURL, arguments);
    };
    URLPolyfill.revokeObjectURL = function (url) {
      OriginalURL.revokeObjectURL(url);
    };
  }
}

export {
  URLPolyfill as URL,
  URLSearchParamsPolyfill as URLSearchParams
};
