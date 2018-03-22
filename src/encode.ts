import { isHexDigit, parseHexDigit } from "./util";
import { utf8decoderaw, utf8encoderaw } from "./vendor/utf8";
import { ucs2decode, ucs2encode } from "./vendor/ucs2";

// https://url.spec.whatwg.org/#percent-encode
export function percentEncode(byte: number): string {
  return `%${byte <= 0xF ? '0' : ''}${byte.toString(16).toUpperCase()}`;
}

// https://url.spec.whatwg.org/#percent-decode
export function percentDecode(input: number[]): number[] {
  // 1. Let output be an empty byte sequence.
  let output: number[] = [];
  // 2. For each byte byte in input:
  const size = input.length;
  for (let index = 0; index < size; index++) {
    const byte = input[index];
    // 1. If byte is not 0x25 (%), then append byte to output.
    // 2. Otherwise, if byte is 0x25 (%) and the next two bytes after byte in input are not
    //    in the ranges 0x30 (0) to 0x39 (9), 0x41 (A) to 0x46 (F), and 0x61 (a) to 0x66 (f), all inclusive,
    //    append byte to output.
    // 3. Otherwise:
    if (0x25 === byte && index + 2 < size && isHexDigit(input[index + 1]) && isHexDigit(input[index + 2])) {
      // 1. Let bytePoint be the two bytes after byte in input, decoded, and then interpreted as hexadecimal number.
      const bytePoint = parseHexDigit(input[index + 1]) << 4 | parseHexDigit(input[index + 2]);
      // 2. Append a byte whose value is bytePoint to output.
      output.push(bytePoint);
      // 3. Skip the next two bytes in input.
      index += 2;
    }
    else {
      output.push(byte);
    }
  }
  // 3. Return output.
  return output;
}

// https://infra.spec.whatwg.org/#c0-control
export function isC0Control(code: number): boolean {
  return code >= 0x00 // U+0000 NULL
      && code <= 0x1F; // U+001F INFORMATION SEPARATOR ONE
}

// https://url.spec.whatwg.org/#c0-control-percent-encode-set
export function isC0ControlPercentEncode(code: number): boolean {
  return isC0Control(code)
      || code > 0x7E; // U+007E (~)
}

// https://url.spec.whatwg.org/#fragment-percent-encode-set
export function isFragmentPercentEncode(code: number): boolean {
  return isC0ControlPercentEncode(code)
      || code === 0x20 // U+0020 SPACE
      || code === 0x22 // U+0022 (")
      || code === 0x3C // U+003C (<)
      || code === 0x3E // U+003E (>)
      || code === 0x60; // U+0060 (`)
}

// https://url.spec.whatwg.org/#path-percent-encode-set
export function isPathPercentEncode(code: number): boolean {
  return isFragmentPercentEncode(code)
      || code === 0x23 // U+0023 (#)
      || code === 0x3F // U+003F (?)
      || code === 0x7B // U+007B ({)
      || code === 0x7D; // U+007D (})
}

// https://url.spec.whatwg.org/#userinfo-percent-encode-set
export function isUserinfoPercentEncode(code: number): boolean {
  return isPathPercentEncode(code)
      || code === 0x2F // U+002F (/)
      || code === 0x3A // U+003A (/)
      || code === 0x3B // U+003B (;)
      || code === 0x3D // U+003D (=)
      || code === 0x40 // U+0040 (@)
      || (code >= 0x5B && code <= 0x5E) // U+005B ([), U+005C (\), U+005D (]), U+005E (^)
      || code === 0x7C; // U+007C (|)
}

// https://url.spec.whatwg.org/#query-state
export function isQueryPercentEncode(code: number): boolean {
  return code < 0x21 // 0x21 (!)
      || code > 0x7E // 0x7E (~)
      || (code === 0x22) // 0x22 (")
      || (code === 0x23) // 0x23 (#)
      || (code === 0x3C) // 0x3C (<)
      || (code === 0x3E); // 0x3E (>)
}

// https://url.spec.whatwg.org/#utf-8-percent-encode
export function utf8PercentEncode(codePoint: number, percentEncodeSet: (code: number) => boolean): string {
  // 1. If codePoint is not in percentEncodeSet, then return codePoint.
  if (!percentEncodeSet(codePoint)) {
    return ucs2encode([codePoint]);
  }
  // 2. Let bytes be the result of running UTF-8 encode on codePoint.
  const bytes = utf8encoderaw([codePoint]);
  // 3. Percent encode each byte in bytes, and then return the results concatenated, in the same order.
  return bytes.map(percentEncode).join('');
}

export function utf8PercentEncodeString(input: string, percentEncodeSet: (code: number) => boolean): string {
  let output: string[] = [];
  for (let codePoint of ucs2decode(input)) {
    output.push(utf8PercentEncode(codePoint, percentEncodeSet));
  }
  return output.join('');
}

// https://url.spec.whatwg.org/#string-percent-decode
export function stringPercentDecode(codePoints: number[]): number[] {
  // 1. Let bytes be the UTF-8 encoding of input.
  const bytes = utf8encoderaw(codePoints);
  // 2. Return the percent decoding of bytes.
  return percentDecode(bytes);
}

export function utf8StringPercentDecode(input: string): string {
  return ucs2encode(utf8decoderaw(stringPercentDecode(ucs2decode(input))));
}
