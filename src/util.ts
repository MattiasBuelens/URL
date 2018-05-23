import * as stable from 'stable';

export const ALPHA = /[a-zA-Z]/;
export const DIGIT = /[0-9]/;
export const HEX_DIGIT = /[0-9a-fA-F]/;
export const ALPHANUMERIC = /[a-zA-Z0-9+\-.]/;

export const HEX_PREFIX = /^0x/i;
export const ONLY_DEC = /^[0-9]+$/;
export const ONLY_HEX = /^[0-9a-fA-F]+$/;
export const ONLY_OCT = /^[0-7]+$/;

export type Tuple8<T> = [T, T, T, T, T, T, T, T];

const objectToString = Object.prototype.toString;
export const isArray: typeof Array.isArray = Array.isArray || function (x) {
  return objectToString.call(x) === '[object Array]';
};

export const supportsSymbolIterator = (typeof Symbol !== 'undefined' && typeof Symbol.iterator === 'symbol');

export function isSequence<T>(x: any): x is Iterable<T> {
  if (x == null) {
    return false;
  }
  if (isArray(x)) {
    return true;
  } else if (supportsSymbolIterator) {
    return typeof x[Symbol.iterator] === 'function';
  } else {
    return false;
  }
}

export function sequenceToArray<T>(x: Iterable<T>): T[] {
  if (isArray(x)) {
    return x;
  } else {
    // Assert: supportsSymbolIterator === true
    // Symbol.iterator support implies Array.from support
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

export function replaceArray<T>(dest: T[], src: T[]): void {
  for (let i = 0; i < src.length; i++) {
    dest[i] = src[i];
  }
  dest.length = src.length;
}

export const stableSort = stable.inplace;

const mathMin = Math.min;
const stringFromCharCode = String.fromCharCode;
const MAX_SIZE = 0x4000;

export function fromCodeUnits(codeUnits: number[]): string {
  const length = codeUnits.length;
  // Prevent stack overflow when apply()ing with long array
  // by splitting input in smaller slices
  const parts: string[] = [];
  for (let start = 0; start < length; start += MAX_SIZE) {
    const end = mathMin(start + MAX_SIZE, length);
    parts.push(stringFromCharCode.apply(null, codeUnits.slice(start, end)));
  }
  return parts.join('');
}
