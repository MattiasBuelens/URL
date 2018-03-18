import { isC0ControlPercentEncode, utf8PercentDecodeString, utf8PercentEncodeString } from "./encode";
import { IPv6Address, parseIPv6, serializeIPv6 } from "./host/ipv6";
import { IPv4Address, parseIPv4, serializeIPv4 } from "./host/ipv4";

export const enum HostType {
  DOMAIN,
  IPV4,
  IPV6,
  OPAQUE
}

export interface DomainHost {
  _type: HostType.DOMAIN;
  _domain: string;
}

export interface IPv4Host {
  _type: HostType.IPV4;
  _address: IPv4Address;
}

export interface IPv6Host {
  _type: HostType.IPV6;
  _address: IPv6Address;
}

export interface OpaqueHost {
  _type: HostType.OPAQUE;
  _data: string;
}

export type Host = DomainHost | IPv4Host | IPv6Host | OpaqueHost | '';

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
  // 3. Let domain be the result of running UTF-8 decode without BOM on the string percent decoding of input.
  const domain = utf8PercentDecodeString(input);
  // 4. Let asciiDomain be the result of running domain to ASCII on domain.
  // 5. If asciiDomain is failure, validation error, return failure.
  // 6. If asciiDomain contains a forbidden host code point, validation error, return failure.
  // TODO steps 4 to 6
  const asciiDomain = domain;
  // 7. Let ipv4Host be the result of IPv4 parsing asciiDomain.
  const ipv4Host = parseIPv4(asciiDomain);
  // 8. If ipv4Host is an IPv4 address or failure, return ipv4Host.
  if (ipv4Host !== undefined) {
    return {
      _type: HostType.IPV4,
      _address: ipv4Host
    };
  }
  // 9. Return asciiDomain.
  return {
    _type: HostType.DOMAIN,
    _domain: asciiDomain
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
    case HostType.DOMAIN:
      return host._domain;
    case HostType.IPV4:
      return serializeIPv4(host._address);
    case HostType.IPV6:
      return `[${serializeIPv6(host._address)}]`;
    case HostType.OPAQUE:
      return host._data;
  }
}
