declare module 'punycode' {
  interface ucs2 {
    decode(string: string): number[];

    encode(codePoints: number[]): string;
  }

  interface Punycode {
    decode(string: string): string;

    encode(string: string): string;

    toUnicode(domain: string): string;

    toASCII(domain: string): string;

    ucs2: ucs2;
    version: any;
  }

  var punycode: Punycode;
  export default punycode;
}
