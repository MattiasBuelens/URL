// https://url.spec.whatwg.org/#concept-ipv4
import { HEX_PREFIX, ONLY_DEC, ONLY_HEX, ONLY_OCT } from "../util";

export type IPv4Address = number; // 32-bit unsigned integer

// https://url.spec.whatwg.org/#concept-ipv4-parser
// Note: returns undefined (rather than input) if input is a domain
export function parseIPv4(input: string): IPv4Address | undefined {
  // 1. Let validationErrorFlag be unset.
  // Note: ignoring validation errors
  // 2. Let parts be input split on U+002E (.).
  const parts = input.split('.');
  // 3. If the last item in parts is the empty string, then:
  if (parts[parts.length - 1] === '') {
    // 1. Set validationErrorFlag.
    // 2. If parts has more than one item, then remove the last item from parts.
    parts.pop();
  }
  // 4. If parts has more than four items, return input.
  if (parts.length > 4) {
    return undefined;
  }
  // 5. Let numbers be the empty list.
  const numbers: number[] = [];
  // 6. For each part in parts:
  for (const part of parts) {
    // 1. If part is the empty string, return input.
    if (part === '') {
      return undefined;
    }
    // 2. Let n be the result of parsing part using validationErrorFlag.
    const n = parseIPv4Number(part);
    // 3. If n is failure, return input.
    if (n === undefined) {
      return undefined;
    }
    // 4. Append n to numbers.
    numbers.push(n);
  }
  // 7. If validationErrorFlag is set, validation error.
  // 8. If any item in numbers is greater than 255, validation error.
  // 9. If any but the last item in numbers is greater than 255, return failure.
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i] > 255) {
      throw new TypeError();
    }
  }
  // 10. If the last item in numbers is greater than or equal to 256^(5 − the number of items in numbers),
  //     validation error, return failure.
  if (numbers[numbers.length - 1] >= (256 ** (5 - numbers.length))) {
    throw new TypeError();
  }
  // 11. Let ipv4 be the last item in numbers.
  // 12. Remove the last item from numbers.
  let ipv4 = numbers.pop()!;
  // 13. Let counter be zero.
  // 14. For each n in numbers:
  for (let counter = 0; counter < numbers.length; counter++) {
    const n = numbers[counter];
    // 1. Increment ipv4 by n × 256^(3 − counter).
    ipv4 += n * (256 ** (3 - counter));
    // 2. Increment counter by 1.
  }
  // 15. Return ipv4.
  return ipv4;
}

// https://url.spec.whatwg.org/#ipv4-number-parser
function parseIPv4Number(input: string): number | undefined {
  // 1. Let R be 10.
  let R = 10;
  let test = ONLY_DEC;
  // 2. If input contains at least two code points and the first two code points are either "0x" or "0X", then:
  if (HEX_PREFIX.test(input)) {
    // 1. Set validationErrorFlag.
    // 2. Remove the first two code points from input.
    input = input.slice(2);
    // 3. Set R to 16.
    R = 16;
    test = ONLY_HEX;
  }
  // 3. Otherwise, if input contains at least two code points and the first code point is U+0030 (0), then:
  else if (input.length >= 2 && '0' === input[0]) {
    // 1. Set validationErrorFlag.
    // 2. Remove the first code point from input.
    input = input.slice(1);
    // 3. Set R to 8.
    R = 8;
    test = ONLY_OCT;
  }
  // 4. If input is the empty string, then return zero.
  if ('' === input) {
    return 0;
  }
  // 5. If input contains a code point that is not a radix-R digit, then return failure.
  if (!test.test(input)) {
    return undefined;
  }
  // 6. Return the mathematical integer value that is represented by input in radix-R notation,
  //    using ASCII hex digits for digits with values 0 through 15.
  return parseInt(input, R);
}

// https://url.spec.whatwg.org/#concept-ipv4-serializer
export function serializeIPv4(address: IPv4Address): string {
  // 1. Let output be the empty string.
  let output: string[] = [];
  // 2. Let n be the value of address.
  let n = address;
  // 3. For each i in the range 1 to 4, inclusive:
  for (let i = 1; i <= 4; i++) {
    // 4. Prepend n % 256, serialized, to output.
    output.push(`${n & 0xFF}`);
    // 5. If i is not 4, then prepend U+002E (.) to output.
    if (i !== 4) {
      output.push('.');
    }
    // 6. Set n to floor(n / 256).
    n = n >>> 8;
  }
  // 4. Return output.
  return output.reverse().join('');
}
