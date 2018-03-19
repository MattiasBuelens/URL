// https://github.com/jcranmer/idna-uts46
declare module 'idna-uts46' {

  export interface ToAsciiOptions {
    transitional?: boolean;
    useStd3ASCII?: boolean;
    verifyDnsLength?: boolean;
  }

  export interface ToUnicodeOptions {
    useStd3ASCII?: boolean;
  }

  export function toAscii(domain: string, options?: ToAsciiOptions): string;

  export function toUnicode(domain: string, options?: ToUnicodeOptions): string;

}
