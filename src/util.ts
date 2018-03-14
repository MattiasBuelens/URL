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

export function getCodePointAt(input: string, index: number): number | undefined {
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
}

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
