import { utf8encode } from "./vendor/utf8";
import { percentEncode, utf8PercentDecodeString } from "./encode";

export const PLUS = /\+/g;
export const SAFE_URL_ENCODE = /[a-zA-Z0-9*\-._]/;

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

export function serializeUrlEncoded(tuples: ReadonlyArray<[string, string]>): string {
  // 1. Let encoding be UTF-8.
  // 2. If encoding override is given, set encoding to the result of getting an output encoding from encoding override.
  // Note: we only support UTF-8
  // 3. Let output be the empty string.
  let output = '';
  // 4. For each tuple in tuples:
  for (let index = 0; index < tuples.length; index++) {
    const tuple = tuples[index];
    // 1. Let name be the result of serializing the result of encoding tuple’s name, using encoding.
    const name = serializeUrlEncodedBytes(utf8encode(tuple[0]));
    // 2. Let value be tuple’s value.
    // 3. (skipped, we're not parsing HTML)
    // 4. Set value to the result of serializing the result of encoding value, using encoding.
    const value = serializeUrlEncodedBytes(utf8encode(tuple[1]));
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
