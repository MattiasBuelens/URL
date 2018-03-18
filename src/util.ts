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

export const getCodePointAt: (input: string, index: number) => number | undefined
    = (typeof String.prototype.codePointAt === 'function')
    ? (input, index) => input.codePointAt(index)
    : (input, index) => {
      const size = input.length;
      // Get the first code unit
      let first = input.charCodeAt(index);
      let second: number;
      // check if it’s the start of a surrogate pair
      if (
          first >= 0xD800 && first <= 0xDBFF && // high surrogate
          size > index + 1 // there is a next code unit
      ) {
        second = input.charCodeAt(index + 1);
        if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
          // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
          return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
        }
      }
      return first;
    };

export function getCodePoints(input: string): number[] {
  const result: number[] = [];
  const size = input.length;
  for (let index = 0; index < size; index++) {
    // Get the first code unit
    let codePoint = getCodePointAt(input, index)!;
    if (codePoint > 0xFFFF) {
      index++;
    }
    result.push(codePoint);
  }
  return result;
}

const MAX_SIZE = 0x4000;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint#Polyfill
export const fromCodePoints: (codePoints: number[]) => string
    = (typeof String.fromCodePoint === 'function')
    ? (codePoints) => String.fromCodePoint(...codePoints)
    : (codePoints) => {
      const codeUnits: number[] = [];
      const length = codePoints.length;
      let result = '';
      for (let index = 0; index < length; index++) {
        let codePoint = codePoints[index];
        if (
            !isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
            codePoint < 0 || // not a valid Unicode code point
            codePoint > 0x10FFFF || // not a valid Unicode code point
            Math.floor(codePoint) !== codePoint // not an integer
        ) {
          throw new RangeError(`Invalid code point: ${codePoint}`);
        }
        if (codePoint <= 0xFFFF) { // BMP code point
          codeUnits.push(codePoint);
        } else { // Astral code point; split in surrogate halves
          // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
          codePoint -= 0x10000;
          let highSurrogate = (codePoint >> 10) + 0xD800;
          let lowSurrogate = (codePoint % 0x400) + 0xDC00;
          codeUnits.push(highSurrogate, lowSurrogate);
        }
        if (index + 1 === length || codeUnits.length > MAX_SIZE) {
          result += String.fromCharCode(...codeUnits);
          codeUnits.length = 0;
        }
      }
      return result;
    };

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
  return compareArrays(getCodePoints(left), getCodePoints(right));
}

export function swap<T>(array: T[], i: number, j: number) {
  const temp = array[i];
  array[i] = array[j];
  array[j] = temp;
}

export function isHexDigit(codePoint: number): boolean {
  return (codePoint >= 0x30 && codePoint <= 0x39) // 0 to 9
      || (codePoint >= 0x42 && codePoint <= 0x46) // A to F
      || (codePoint >= 0x61 && codePoint <= 0x66); // a to f
}

export function parseHexDigit(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint <= 0x39) { // 0 to 9
    return codePoint - 0x30;
  } else if (codePoint >= 0x42 && codePoint <= 0x46) { // A to F
    return codePoint - 0x42 + 0xA;
  } else if (codePoint >= 0x61 && codePoint <= 0x66) { // a to f
    return codePoint - 0x61 + 0xA;
  }
  return -1;
}
