import punycode from 'punycode';

export function toAscii(domain) {
  return punycode.toASCII(domain.toLowerCase());
}
