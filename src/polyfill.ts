import { URL as URLImpl, URLSearchParams as URLSearchParamsImpl } from "./ponyfill";

const scope = typeof self !== 'undefined' ? self
    : typeof window !== 'undefined' ? window
        : undefined;

const OriginalURL = scope && scope.URL;
const OriginalURLSearchParams = scope && scope.URLSearchParams;

// feature detect for URL constructor
let hasWorkingUrl = false;
if (OriginalURL && OriginalURLSearchParams) {
  try {
    const u = new OriginalURL('b', 'http://a');
    u.pathname = 'c%20d';
    hasWorkingUrl = u.href === 'http://a/c%20d';
  } catch (e) {
  }
}

export type URL = URLImpl;
export type URLSearchParams = URLSearchParamsImpl;

export const URL: typeof URLImpl = hasWorkingUrl
    ? OriginalURL! as any
    : URLImpl;
export const URLSearchParams: typeof URLSearchParamsImpl = hasWorkingUrl
    ? OriginalURLSearchParams! as any
    : URLSearchParamsImpl;

if (!hasWorkingUrl) {
  const GlobalURL: typeof window.URL = URL as any;
  const GlobalURLSearchParams: typeof window.URLSearchParams = URLSearchParams as any;
  // Copy over the static methods
  if (OriginalURL) {
    GlobalURL.createObjectURL = function (blob) {
      // IE extension allows a second optional options argument.
      // http://msdn.microsoft.com/en-us/library/ie/hh772302(v=vs.85).aspx
      return (OriginalURL.createObjectURL as Function).apply(OriginalURL, arguments);
    };
    GlobalURL.revokeObjectURL = function (url) {
      OriginalURL.revokeObjectURL(url);
    };
  }
  if (scope) {
    scope.URL = GlobalURL;
    scope.URLSearchParams = GlobalURLSearchParams;
  }
}
