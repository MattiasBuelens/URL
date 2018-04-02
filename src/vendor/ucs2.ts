/*! https://mths.be/utf8js v3.0.0 by @mathias */

import { fromCodeUnits } from "../util";

// Taken from https://mths.be/punycode
export function ucs2decode(string: string): number[] {
  const output: number[] = [];
  let counter = 0;
  const length = string.length;
  while (counter < length) {
    const value = string.charCodeAt(counter++);
    if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
      // high surrogate, and there is a next character
      const extra = string.charCodeAt(counter++);
      if ((extra & 0xFC00) === 0xDC00) { // low surrogate
        output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
      } else {
        // unmatched surrogate; only append this code unit, in case the next
        // code unit is the high surrogate of a surrogate pair
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}

// Taken from https://mths.be/punycode
export function ucs2encode(array: number[]): string {
  let output: number[] = [];
  for (let value of array) {
    if (value > 0xFFFF) {
      value -= 0x10000;
      output.push(value >>> 10 & 0x3FF | 0xD800);
      value = 0xDC00 | value & 0x3FF;
    }
    output.push(value);
  }
  return fromCodeUnits(output);
}
