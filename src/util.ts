export const isArray: typeof Array.isArray = Array.isArray || function (x) {
  return Object.prototype.toString.call(x) === '[object Array]';
};

export function isSequence<T>(x: any): x is Iterable<T> {
  if (x == null) {
    return false;
  }
  if (typeof Symbol !== 'undefined') {
    return typeof x[Symbol.iterator] === 'function';
  } else {
    return isArray(x);
  }
}

export function sequenceToArray<T>(x: Iterable<T>): T[] {
  if (isArray(x)) {
    return x;
  } else {
    return Array.from(x);
  }
}
