import { ucs2decode } from "./vendor/utf8";

export const ALPHA = /[a-zA-Z]/;
export const DIGIT = /[0-9]/;
export const HEX_DIGIT = /[0-9a-fA-F]/;
export const ALPHANUMERIC = /[a-zA-Z0-9+\-.]/;

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

export function compareArrays(arr1: number[], arr2: number[]): number {
  const length1 = arr1.length;
  const length2 = arr1.length;
  const lengthMin = Math.min(length1, length2);

  let pos = 0;
  while (pos < lengthMin && arr1[pos] === arr2[pos]) {
    ++pos;
  }

  if (pos < lengthMin) {
    return (arr1[pos] > arr2[pos]) ? 1 : -1;
  }

  if (length1 === length2) {
    return 0;
  }

  return (length1 > length2) ? 1 : -1;
}

export function compareByCodePoints(left: string, right: string): number {
  return compareArrays(ucs2decode(left), ucs2decode(right));
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
