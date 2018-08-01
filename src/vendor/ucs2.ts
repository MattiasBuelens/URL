/*! https://mths.be/utf8js v3.0.0 by @mathias */

import { fromCodeUnits } from "../util";

export { ucs2decode } from 'punycode';

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
