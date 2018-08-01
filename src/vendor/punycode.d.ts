declare module 'punycode' {
  export function ucs2decode(string: string): number[];

  export function ucs2encode(codePoints: number[]): string;

  export function decode(string: string): string;

  export function encode(string: string): string;

  export function toUnicode(domain: string): string;

  export function toASCII(domain: string): string;
}
