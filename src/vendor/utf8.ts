/*! https://mths.be/utf8js v3.0.0 by @mathias */

import { ucs2decode, ucs2encode } from "./ucs2";

const stringFromCharCode = String.fromCharCode;

function checkScalarValue(codePoint: number) {
  if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
    throw new Error(
        'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
        ' is not a scalar value'
    );
  }
}

/*--------------------------------------------------------------------------*/

function createByte(codePoint: number, shift: number): number {
  return ((codePoint >> shift) & 0x3F) | 0x80;
}

function encodeCodePoint(codePoint: number, output: number[]) {
  if ((codePoint & 0xFFFFFF80) === 0) { // 1-byte sequence
    output.push(codePoint);
    return;
  }
  if ((codePoint & 0xFFFFF800) === 0) { // 2-byte sequence
    output.push(((codePoint >> 6) & 0x1F) | 0xC0);
  }
  else if ((codePoint & 0xFFFF0000) === 0) { // 3-byte sequence
    checkScalarValue(codePoint);
    output.push(((codePoint >> 12) & 0x0F) | 0xE0);
    output.push(createByte(codePoint, 6));
  }
  else if ((codePoint & 0xFFE00000) === 0) { // 4-byte sequence
    output.push(((codePoint >> 18) & 0x07) | 0xF0);
    output.push(createByte(codePoint, 12));
    output.push(createByte(codePoint, 6));
  }
  output.push((codePoint & 0x3F) | 0x80);
}

function utf8encoderaw(codePoints: number[]): number[] {
  const bytes: number[] = [];
  for (let codePoint of codePoints) {
    encodeCodePoint(codePoint, bytes);
  }
  return bytes;
}

function utf8encode(string: string): string {
  const bytes = utf8encoderaw(ucs2decode(string));
  let byteString = '';
  for (let byte of bytes) {
    byteString += stringFromCharCode(byte);
  }
  return byteString;
}

/*--------------------------------------------------------------------------*/

let byteArray: number[];
let byteCount: number;
let byteIndex: number;

function readContinuationByte(): number {
  if (byteIndex >= byteCount) {
    throw new Error('Invalid byte index');
  }

  const continuationByte = byteArray[byteIndex] & 0xFF;
  byteIndex++;

  if ((continuationByte & 0xC0) === 0x80) {
    return continuationByte & 0x3F;
  }

  // If we end up here, it’s not a continuation byte
  throw new Error('Invalid continuation byte');
}

function decodeSymbol(): number | false {
  let byte1: number;
  let byte2: number;
  let byte3: number;
  let byte4: number;
  let codePoint: number;

  if (byteIndex > byteCount) {
    throw new Error('Invalid byte index');
  }

  if (byteIndex === byteCount) {
    return false;
  }

  // Read first byte
  byte1 = byteArray[byteIndex] & 0xFF;
  byteIndex++;

  // 1-byte sequence (no continuation bytes)
  if ((byte1 & 0x80) === 0) {
    return byte1;
  }

  // 2-byte sequence
  if ((byte1 & 0xE0) === 0xC0) {
    byte2 = readContinuationByte();
    codePoint = ((byte1 & 0x1F) << 6) | byte2;
    if (codePoint >= 0x80) {
      return codePoint;
    } else {
      throw new Error('Invalid continuation byte');
    }
  }

  // 3-byte sequence (may include unpaired surrogates)
  if ((byte1 & 0xF0) === 0xE0) {
    byte2 = readContinuationByte();
    byte3 = readContinuationByte();
    codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
    if (codePoint >= 0x0800) {
      checkScalarValue(codePoint);
      return codePoint;
    } else {
      throw new Error('Invalid continuation byte');
    }
  }

  // 4-byte sequence
  if ((byte1 & 0xF8) === 0xF0) {
    byte2 = readContinuationByte();
    byte3 = readContinuationByte();
    byte4 = readContinuationByte();
    codePoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0C) |
        (byte3 << 0x06) | byte4;
    if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
      return codePoint;
    }
  }

  throw new Error('Invalid UTF-8 detected');
}

function utf8decoderaw(bytes: number[]): number[] {
  byteArray = bytes.slice();
  byteCount = byteArray.length;
  byteIndex = 0;
  const codePoints: number[] = [];
  let tmp: number | false;
  while ((tmp = decodeSymbol()) !== false) {
    codePoints.push(tmp);
  }
  return codePoints;
}

function utf8decode(byteString: string): string {
  return ucs2encode(utf8decoderaw(ucs2decode(byteString)));
}

/*--------------------------------------------------------------------------*/

export const version = '3.0.0';
export {
  utf8encode,
  utf8encoderaw,
  utf8decode,
  utf8decoderaw
};
