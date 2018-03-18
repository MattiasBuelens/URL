import { isC0ControlPercentEncode, utf8PercentEncodeString } from "./encode";
import { DIGIT, HEX_DIGIT, swap, Tuple8 } from "./util";

export const enum HostType {
  DOMAIN_OR_IPV4,
  IPV6,
  OPAQUE
}

export interface DomainOrIPV4Host {
  _type: HostType.DOMAIN_OR_IPV4;
  _domainOrAddress: string;
}

export type IPv6Address = Tuple8<number>; // eight 16-bit unsigned integers

export interface IPv6Host {
  _type: HostType.IPV6;
  _address: IPv6Address;
}

export interface OpaqueHost {
  _type: HostType.OPAQUE;
  _data: string;
}

export type Host = DomainOrIPV4Host | IPv6Host | OpaqueHost | '';

export function parseHost(input: string, isSpecial: boolean): Host {
  // 1. If input starts with U+005B ([), then:
  if ('[' === input[0]) {
    // 1. If input does not end with U+005D (]), validation error, return failure.
    if (']' !== input[input.length - 1]) {
      throw new TypeError('Invalid IPv6 address');
    }
    // 2. Return the result of IPv6 parsing input with its leading U+005B ([) and trailing U+005D (]) removed.
    return {
      _type: HostType.IPV6,
      _address: parseIPv6(input.slice(1, -1))
    };
  }
  // 2. If isSpecial is false, then return the result of opaque-host parsing input.
  if (!isSpecial) {
    return parseOpaqueHost(input);
  }
  // TODO steps 3 to 9
  return {
    _type: HostType.DOMAIN_OR_IPV4,
    _domainOrAddress: input
  };
}

function parseOpaqueHost(input: string): OpaqueHost {
  // TODO 1. If input contains a forbidden host code point excluding U+0025 (%), validation error, return failure.
  // 2. Let output be the empty string.
  // 3. For each code point in input, UTF-8 percent encode it using the C0 control percent-encode set,
  // and append the result to output.
  const output = utf8PercentEncodeString(input, isC0ControlPercentEncode);
  // 4. Return output.
  return {
    _type: HostType.OPAQUE,
    _data: output
  };
}

// https://url.spec.whatwg.org/#concept-ipv6-parser
function parseIPv6(input: string): IPv6Address {
  const size = input.length;
  // 1. Let address be a new IPv6 address whose IPv6 pieces are all 0.
  const address: IPv6Address = [0, 0, 0, 0, 0, 0, 0, 0];
  // 2. Let pieceIndex be 0.
  let pieceIndex = 0;
  // 3. Let compress be null.
  let compress: number | null = null;
  // 4. Let pointer be a pointer into input, initially 0 (pointing to the first code point).
  let pointer = 0;
  // 5. If c is U+003A (:), then:
  if (pointer < size && ':' === input[pointer]) {
    // 1. If remaining does not start with U+003A (:), validation error, return failure.
    if (!(pointer + 1 < size && ':' === input[pointer + 1])) {
      throw new TypeError();
    }
    // 2. Increase pointer by 2.
    pointer += 2;
    // 3. Increase pieceIndex by 1 and then set compress to pieceIndex.
    pieceIndex += 1;
    compress = pieceIndex;
  }
  // 6. While c is not the EOF code point:
  while (pointer < size) {
    // 1. If pieceIndex is 8, validation error, return failure.
    if (pieceIndex === 8) {
      throw new TypeError('Too many groups');
    }
    // 2. If c is U+003A (:), then:
    if (':' === input[pointer]) {
      // 1. If compress is non-null, validation error, return failure.
      if (null !== compress) {
        throw new TypeError('Too many :: groups');
      }
      // 2. Increase pointer and pieceIndex by 1, set compress to pieceIndex, and then continue.
      pointer += 1;
      pieceIndex += 1;
      compress = pieceIndex;
      continue;
    }
    // 3. Let value and length be 0.
    let value = 0;
    let length = 0;
    // 4. While length is less than 4 and c is an ASCII hex digit,
    //    set value to value × 0x10 + c interpreted as hexadecimal number,
    //    and increase pointer and length by 1.
    while (length < 4 && pointer < size && HEX_DIGIT.test(input[pointer])) {
      value = value << 4 | parseInt(input[pointer], 16);
      pointer += 1;
      length += 1;
    }
    // 5. If c is U+002E (.), then:
    if ('.' === input[pointer]) {
      // IPv4-mapped IPv6 address, e.g. ::ffff:192.168.0.1
      // 1. If length is 0, validation error, return failure.
      if (length === 0) {
        throw new TypeError();
      }
      // 2. Decrease pointer by length.
      pointer -= length;
      // 3. If pieceIndex is greater than 6, validation error, return failure.
      if (pieceIndex > 6) {
        throw new TypeError();
      }
      // 4. Let numbersSeen be 0.
      let numbersSeen = 0;
      // 5. While c is not the EOF code point:
      while (pointer < size) {
        // 1. Let ipv4Piece be null.
        let ipv4Piece: number | null = null;
        // 2. If numbersSeen is greater than 0, then:
        if (numbersSeen > 0) {
          // 1. If c is a U+002E (.) and numbersSeen is less than 4, then increase pointer by 1.
          if ('.' === input[pointer] && numbersSeen < 4) {
            pointer += 1;
          }
          // 2. Otherwise, validation error, return failure.
          else {
            throw new TypeError();
          }
        }
        // 3. If c is not an ASCII digit, validation error, return failure.
        if (!DIGIT.test(input[pointer])) {
          throw new TypeError();
        }
        // 4. While c is an ASCII digit:
        while (pointer < size && DIGIT.test(input[pointer])) {
          // 1. Let number be c interpreted as decimal number.
          const number = parseInt(input[pointer], 10);
          // 2. If ipv4Piece is null, then set ipv4Piece to number.
          //    Otherwise, if ipv4Piece is 0, validation error, return failure.
          //    Otherwise, set ipv4Piece to ipv4Piece × 10 + number.
          if (ipv4Piece === null) {
            ipv4Piece = number;
          } else if (ipv4Piece === 0) {
            throw new TypeError();
          } else {
            ipv4Piece = ipv4Piece * 10 + number;
            // 3. If ipv4Piece is greater than 255, validation error, return failure.
            if (ipv4Piece > 255) {
              throw new TypeError();
            }
          }
          // 4. Increase pointer by 1.
          pointer += 1;
        }
        // 5. Set address[pieceIndex] to address[pieceIndex] × 0x100 + ipv4Piece.
        address[pieceIndex] = address[pieceIndex] << 8 | ipv4Piece!;
        // 6. Increase numbersSeen by 1.
        numbersSeen += 1;
        // 7. If numbersSeen is 2 or 4, then increase pieceIndex by 1.
        if (numbersSeen === 2 || numbersSeen === 4) {
          pieceIndex += 1;
        }
      }
      // 6. If numbersSeen is not 4, validation error, return failure.
      if (numbersSeen !== 4) {
        throw new TypeError();
      }
      // 7. Break.
      break;
    }
    // 6. Otherwise, if c is U+003A (:):
    else if (':' === input[pointer]) {
      // 7. Increase pointer by 1.
      pointer += 1;
      // 8. If c is the EOF code point, validation error, return failure.
      if (pointer === size) {
        throw new TypeError();
      }
    }
    // 7. Otherwise, if c is not the EOF code point, validation error, return failure.
    else if (pointer < size) {
      throw new TypeError();
    }
    // 8. Set address[pieceIndex] to value.
    address[pieceIndex] = value;
    // 9. Increase pieceIndex by 1.
    pieceIndex += 1;
  }
  // 7. If compress is non-null, then:
  if (compress !== null) {
    // 1. Let swaps be pieceIndex − compress.
    let swaps = pieceIndex - compress;
    // 2. Set pieceIndex to 7.
    pieceIndex = 7;
    // 3. While pieceIndex is not 0 and swaps is greater than 0,
    //    swap address[pieceIndex] with address[compress + swaps − 1],
    //    and then decrease both pieceIndex and swaps by 1.
    while (pieceIndex !== 0 && swaps > 0) {
      swap(address, pieceIndex, compress + swaps - 1);
      pieceIndex -= 1;
      swaps -= 1;
    }
  }
  // 8. Otherwise, if compress is null and pieceIndex is not 8, validation error, return failure.
  else if (pieceIndex !== 8) {
    throw new TypeError();
  }
  // 9. Return address.
  return address;
}

export function serializeHost(host: Host): string {
  if ('' === host) {
    return host;
  }
  switch (host._type) {
    case HostType.DOMAIN_OR_IPV4:
      return host._domainOrAddress;
    case HostType.IPV6:
      // TODO Compress IPv6
      return `[${serializeIPv6(host._address)}]`;
    case HostType.OPAQUE:
      return host._data;
  }
}

// https://url.spec.whatwg.org/#concept-ipv6-serializer
function serializeIPv6(address: IPv6Address): string {
  // 1. Let output be the empty string.
  let output = '';
  // 2. Let compress be an index to the first IPv6 piece
  //    in the first longest sequences of address’s IPv6 pieces that are 0.
  // 3. If there is no sequence of address’s IPv6 pieces that are 0 that is longer than 1,
  //    then set compress to null.
  const compress: number | null = findFirstLongestZeroSequence(address);
  // 4. Let ignore0 be false.
  let ignore0 = false;
  // 5. For each pieceIndex in the range 0 to 7, inclusive:
  for (let pieceIndex = 0; pieceIndex < 8; pieceIndex++) {
    if (ignore0) {
      // 1. If ignore0 is true and address[pieceIndex] is 0, then continue.
      if (address[pieceIndex] === 0) {
        continue;
      }
      // 2. Otherwise, if ignore0 is true, set ignore0 to false.
      else {
        ignore0 = false;
      }
    }
    // 3. If compress is pieceIndex, then:
    if (compress === pieceIndex) {
      // 4. Let separator be "::" if pieceIndex is 0, and U+003A (:) otherwise.
      // 5. Append separator to output.
      output += (pieceIndex === 0) ? '::' : ':';
      // 6. Set ignore0 to true and continue.
      ignore0 = true;
      continue;
    }
    // 4. Append address[pieceIndex], represented as the shortest possible lowercase hexadecimal number, to output.
    output += address[pieceIndex].toString(16);
    // 5. If pieceIndex is not 7, then append U+003A (:) to output.
    if (pieceIndex !== 7) {
      output += ':';
    }
  }
  // 6. Return output.
  return output;
}

function findFirstLongestZeroSequence(address: IPv6Address): number | null {
  let longestStart = 0;
  let longestLength = 0;
  let currentStart = 0;
  let currentLength = 0;
  for (let pieceIndex = 0; pieceIndex < 8; pieceIndex++) {
    if (address[pieceIndex] === 0) {
      if (currentLength === 0) {
        // Start of new sequence
        currentStart = pieceIndex;
      }
      currentLength++;
    } else {
      // End of sequence
      if (currentLength > longestLength) {
        longestStart = currentStart;
        longestLength = currentLength;
      }
      // Reset for next sequence
      currentLength = 0;
    }
  }
  // End of final sequence
  if (currentLength > longestLength) {
    longestStart = currentStart;
    longestLength = currentLength;
  }
  return (longestLength > 0) ? longestStart : null;
}
