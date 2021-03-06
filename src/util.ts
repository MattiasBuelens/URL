export const ALPHA = /[a-zA-Z]/;
export const DIGIT = /[0-9]/;
export const HEX_DIGIT = /[0-9a-fA-F]/;

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

export function isUpperAlpha(codePoint: number): boolean {
  return (codePoint >= 0x41 && codePoint <= 0x5A) // A to Z
}

export function isLowerAlpha(codePoint: number): boolean {
  return (codePoint >= 0x61 && codePoint <= 0x7A); // a to z
}

export function isAlpha(codePoint: number): boolean {
  return isUpperAlpha(codePoint) || isLowerAlpha(codePoint);
}

export function isDigit(codePoint: number): boolean {
  return (codePoint >= 0x30 && codePoint <= 0x39) // 0 to 9
}

export function isAlphanumeric(codePoint: number): boolean {
  return isDigit(codePoint) || isAlpha(codePoint);
}

export function isHexDigit(codePoint: number): boolean {
  return isDigit(codePoint) // 0 to 9
      || (codePoint >= 0x41 && codePoint <= 0x46) // A to F
      || (codePoint >= 0x61 && codePoint <= 0x66); // a to f
}

export function toAsciiLowercase(codePoint: number): number {
  return isUpperAlpha(codePoint) ? codePoint + 0x20 : codePoint;
}

export function parseHexDigit(codePoint: number): number {
  if (isDigit(codePoint)) { // 0 to 9
    return codePoint - 0x30;
  } else if (codePoint >= 0x41 && codePoint <= 0x46) { // A to F
    return codePoint - 0x41 + 0xA;
  } else if (codePoint >= 0x61 && codePoint <= 0x66) { // a to f
    return codePoint - 0x61 + 0xA;
  }
  return -1;
}

export function toHexDigit(digit: number, lower: boolean = false): number {
  if (0x0 <= digit && digit <= 0x9) {
    return digit + 0x30;
  } else if (0xA <= digit && digit <= 0xF) {
    return digit + (lower ? (0x61 - 0xA) : (0x41 - 0xA));
  }
  return -1;
}

export function replaceArray<T>(dest: T[], src: T[]): void {
  for (let i = 0; i < src.length; i++) {
    dest[i] = src[i];
  }
  dest.length = src.length;
}

export { inplaceStableSort } from './vendor/stable';

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
