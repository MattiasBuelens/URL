import { toASCII } from 'punycode';

export function toAscii(domain: string): string {
  return toASCII(domain.toLowerCase());
}
