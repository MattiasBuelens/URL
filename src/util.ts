export const ALPHA = /[a-zA-Z]/;
export const DIGIT = /[0-9]/;
export const HEX_DIGIT = /[0-9a-fA-F]/;
export const ALPHANUMERIC = /[a-zA-Z0-9+\-.]/;

export const HEX_PREFIX = /^0x/i;
export const ONLY_DEC = /^[0-9]+$/;
export const ONLY_HEX = /^[0-9a-fA-F]+$/;
export const ONLY_OCT = /^[0-7]+$/;

export type Tuple8<T> = [T, T, T, T, T, T, T, T];

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

export function swap<T>(array: T[], i: number, j: number) {
  const temp = array[i];
  array[i] = array[j];
  array[j] = temp;
}

export function isHexDigit(codePoint: number): boolean {
  return (codePoint >= 0x30 && codePoint <= 0x39) // 0 to 9
      || (codePoint >= 0x41 && codePoint <= 0x46) // A to F
      || (codePoint >= 0x61 && codePoint <= 0x66); // a to f
}

export function parseHexDigit(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint <= 0x39) { // 0 to 9
    return codePoint - 0x30;
  } else if (codePoint >= 0x41 && codePoint <= 0x46) { // A to F
    return codePoint - 0x41 + 0xA;
  } else if (codePoint >= 0x61 && codePoint <= 0x66) { // a to f
    return codePoint - 0x61 + 0xA;
  }
  return -1;
}
