import { isHexDigit, parseHexDigit } from "./util";
import { ucs2decode, ucs2encode, utf8decoderaw, utf8encoderaw } from "./vendor/utf8";

const PLUS = /\+/g;
const SAFE_URL_ENCODE = /[a-zA-Z0-9*\-._]/;

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

export function utf8PercentEncodeString(c: string, percentEncodeSet: (code: number) => boolean): string {
  let output = '';
  for (let codePoint of ucs2decode(c)) {
    output += utf8PercentEncode(codePoint, percentEncodeSet);
  }
  return output;
}

export function utf8PercentDecodeString(input: string): string {
  return ucs2encode(utf8decoderaw(percentDecode(ucs2decode(input))));
}

// https://url.spec.whatwg.org/#urlencoded-parsing
export function parseUrlEncoded(input: string): Array<[string, string]> {
  // 1. Let sequences be the result of splitting input on 0x26 (&).
  const sequences = input.split('&');
  // 2. Let output be an initially empty list of name-value tuples where both name and value hold a string.
  const output: Array<[string, string]> = [];
  // 3. For each byte sequence bytes in sequences:
  for (const sequence of sequences) {
    // 1. If bytes is the empty byte sequence, then continue.
    if ('' === sequence) continue;
    // 2. If bytes contains a 0x3D (=), then let name be the bytes
    //    from the start of bytes up to but excluding its first 0x3D (=),
    //    and let value be the bytes, if any, after the first 0x3D (=) up to the end of bytes.
    //    If 0x3D (=) is the first byte, then name will be the empty byte sequence.
    //    If it is the last, then value will be the empty byte sequence.
    const equalsIndex = sequence.indexOf('=');
    let name: string;
    let value: string;
    if (equalsIndex !== -1) {
      name = sequence.slice(0, equalsIndex);
      value = sequence.slice(equalsIndex + 1);
    }
    // 3. Otherwise, let name have the value of bytes and let value be the empty byte sequence.
    else {
      name = sequence;
      value = '';
    }
    // 4. Replace any 0x2B (+) in name and value with 0x20 (SP).
    name = name.replace(PLUS, ' ');
    value = value.replace(PLUS, ' ');
    // 5. Let nameString and valueString be the result of running UTF-8 decode without BOM
    //    on the percent decoding of name and value, respectively.
    const nameString = utf8PercentDecodeString(name);
    const valueString = utf8PercentDecodeString(value);
    // 6. Append (nameString, valueString) to output.
    output.push([nameString, valueString]);
  }
  // 4. Return output.
  return output;
}

// https://url.spec.whatwg.org/#concept-urlencoded-serializer
export function serializeUrlEncoded(tuples: ReadonlyArray<[string, string]>): string {
  // 1. Let encoding be UTF-8.
  // 2. If encoding override is given, set encoding to the result of getting an output encoding from encoding override.
  // TODO encoding?
  // 3. Let output be the empty string.
  let output = '';
  // 4. For each tuple in tuples:
  for (let index = 0; index < tuples.length; index++) {
    const tuple = tuples[index];
    // 1. Let name be the result of serializing the result of encoding tuple’s name, using encoding.
    const name = serializeUrlEncodedBytes(tuple[0]);
    // 2. Let value be tuple’s value.
    // 3. (skipped, we're not parsing HTML)
    // 4. Set value to the result of serializing the result of encoding value, using encoding.
    const value = serializeUrlEncodedBytes(tuple[1]);
    // 5. If tuple is not the first pair in tuples, then append U+0026 (&) to output.
    if (index > 0) {
      output += '&';
    }
    // 6. Append name, followed by U+003D (=), followed by value, to output.
    output += `${name}=${value}`;
  }
  // 5. Return output.
  return output;
}

// https://url.spec.whatwg.org/#concept-urlencoded-byte-serializer
function serializeUrlEncodedBytes(input: string): string {
  // 1. Let output be the empty string.
  let output = '';
  // 2. For each byte in input, depending on byte:
  for (let index = 0; index < input.length; index++) {
    const byte = input[index];
    if (' ' === byte) {
      // Append U+002B (+) to output.
      output += '+';
    }
    else if (SAFE_URL_ENCODE.test(byte)) {
      // Append a code point whose value is byte to output.
      output += byte;
    }
    else {
      // Append byte, percent encoded, to output.
      output += percentEncode(byte.charCodeAt(0));
    }
  }
  // 3. Return output.
  return output;
}
