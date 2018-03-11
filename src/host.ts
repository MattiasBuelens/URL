import { percentEscape } from "./encode";

export function parseHost(input: string, isSpecial: boolean): string | undefined {
  // 1. If input starts with U+005B ([), then:
  if ('[' === input[0]) {
    // 1. If input does not end with U+005D (]), validation error, return failure.
    if (']' !== input[input.length - 1]) {
      return undefined;
    }
    // 2. Return the result of IPv6 parsing input with its leading U+005B ([) and trailing U+005D (]) removed.
    return parseIPv6(input.slice(1, -1));
  }
  // 2. If isSpecial is false, then return the result of opaque-host parsing input.
  if (!isSpecial) {
    return parseOpaqueHost(input);
  }
  // TODO steps 3 to 9
  return input;
}

function parseOpaqueHost(input: string): string | undefined {
  // TODO 1. If input contains a forbidden host code point excluding U+0025 (%), validation error, return failure.
  // 2. Let output be the empty string.
  let output = '';
  // 3. For each code point in input, UTF-8 percent encode it using the C0 control percent-encode set,
  // and append the result to output.
  for (let i = 0; i < input.length; i++) {
    output += percentEscape(input[i]);
  }
  // 4. Return output.
  return output;
}

function parseIPv6(input: string): string {
  // TODO
  return input;
}

export function serializeHost(host: string): string {
  // TODO
  return host;
}
