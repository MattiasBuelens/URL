import { isC0ControlPercentEncode, utf8PercentEncodeString, utf8StringPercentDecode } from "./encode";
import { IPv6Address, parseIPv6, serializeIPv6 } from "./host/ipv6";
import { IPv4Address, parseIPv4, serializeIPv4 } from "./host/ipv4";
import idna from "idna-uts46";

export const enum HostType {
  DOMAIN,
  IPV4,
  IPV6,
  OPAQUE,
  EMPTY
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

export type EmptyHost = {
  _type: HostType.EMPTY
};

export const EMPTY_HOST: EmptyHost = {
  _type: HostType.EMPTY
};

export type Host = DomainHost | IPv4Host | IPv6Host | OpaqueHost | EmptyHost;

// https://url.spec.whatwg.org/#forbidden-host-code-point
// U+0000 NULL, U+0009 TAB, U+000A LF, U+000D CR, U+0020 SPACE, U+0023 (#), U+0025 (%), U+002F (/), U+003A (:), U+003F (?), U+0040 (@), U+005B ([), U+005C (\), or U+005D (]).
const FORBIDDEN_HOST_CODE_POINT = /[\0\t\n\r #%/:?@\[\\\]]/;
const FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT = /[\0\t\n\r #/:?@\[\\\]]/;

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
  const domain = utf8StringPercentDecode(input);
  // 4. Let asciiDomain be the result of running domain to ASCII on domain.
  // 5. If asciiDomain is failure, validation error, return failure.
  const asciiDomain = domainToAscii(domain);
  // 6. If asciiDomain contains a forbidden host code point, validation error, return failure.
  if (FORBIDDEN_HOST_CODE_POINT.test(asciiDomain)) {
    throw new TypeError('Invalid code point in host');
  }
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
  return asciiDomain === '' ? EMPTY_HOST : {
    _type: HostType.DOMAIN,
    _domain: asciiDomain
  };
}

function domainToAscii(domain: string): string {
  // 1. If beStrict is not given, set it to false.
  const beStrict = false;
  // 2. Let result be the result of running Unicode ToASCII with domain_name set to domain,
  //    UseSTD3ASCIIRules set to beStrict, CheckHyphens set to false, CheckBidi set to true,
  //    CheckJoiners set to true, processing_option set to Nontransitional_Processing,
  //    and VerifyDnsLength set to beStrict.
  // 3. If result is a failure value, validation error, return failure.
  // TODO This adds a *lot* of code... Make 'light' version?
  const result = idna.toAscii(domain, {
    transitional: false,
    useStd3ASCII: beStrict,
    verifyDnsLength: beStrict
  });
  // 4. Return result.
  return result;
}

function parseOpaqueHost(input: string): OpaqueHost | EmptyHost {
  // 1. If input contains a forbidden host code point excluding U+0025 (%), validation error, return failure.
  if (FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT.test(input)) {
    throw new TypeError('Invalid code point in opaque host');
  }
  // 2. Let output be the empty string.
  // 3. For each code point in input, UTF-8 percent encode it using the C0 control percent-encode set,
  // and append the result to output.
  const output = utf8PercentEncodeString(input, isC0ControlPercentEncode);
  // 4. Return output.
  return output === '' ? EMPTY_HOST : {
    _type: HostType.OPAQUE,
    _data: output
  };
}

export function serializeHost(host: Host): string {
  switch (host._type) {
    case HostType.DOMAIN:
      return host._domain;
    case HostType.IPV4:
      return serializeIPv4(host._address);
    case HostType.IPV6:
      return `[${serializeIPv6(host._address)}]`;
    case HostType.OPAQUE:
      return host._data;
    case HostType.EMPTY:
      return '';
  }
}
