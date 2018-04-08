import punycode from 'punycode';

export function toAscii(domain: string): string {
  return punycode.toASCII(domain.toLowerCase());
}
