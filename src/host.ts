import { isC0ControlPercentEncode, utf8PercentEncodeString } from "./encode";
import { IPv6Address, parseIPv6, serializeIPv6 } from "./host/ipv6";

export const enum HostType {
  DOMAIN_OR_IPV4,
  IPV6,
  OPAQUE
}

export interface DomainOrIPV4Host {
  _type: HostType.DOMAIN_OR_IPV4;
  _domainOrAddress: string;
}

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
