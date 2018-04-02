const unpairedSurrogateRe =
    /(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;

// https://github.com/nodejs/node/blob/6de1a12e496b58b1ab1c150b3cee8a8d45040edb/lib/internal/url.js#L66
export function toUSVString(val: string): string {
  const str = `${val}`;
  // As of V8 5.5, `str.search()` (and `unpairedSurrogateRe[@@search]()`) are
  // slower than `unpairedSurrogateRe.exec()`.
  const match = unpairedSurrogateRe.exec(str);
  if (!match) {
    return str;
  }
  return _toUSVString(str, match.index);
}

const UNICODE_REPLACEMENT_CHARACTER = 0xFFFD;
// If a UTF-16 character is a surrogate.
const IsUnicodeSurrogate = (ch: number) => (ch & 0xF800) === 0xD800;
// If a UTF-16 surrogate is a low/trailing one.
const IsUnicodeSurrogateTrail = (ch: number) => (ch & 0x400) !== 0;

const stringFromCharCode = String.fromCharCode;

// https://heycam.github.io/webidl/#dfn-obtain-unicode
// https://github.com/nodejs/node/blob/6de1a12e496b58b1ab1c150b3cee8a8d45040edb/src/node_url.cc#L2143
function _toUSVString(input: string, start: number): string {
  const n = input.length;
  const output: number[] = [];
  for (let i = start; i < n; i++) {
    let c = input.charCodeAt(i);
    if (!IsUnicodeSurrogate(c)) {
      output.push(c);
    } else if (IsUnicodeSurrogateTrail(c) || (i === n - 1)) {
      output.push(UNICODE_REPLACEMENT_CHARACTER);
    } else {
      const d = input.charCodeAt(i + 1);
      if (IsUnicodeSurrogateTrail(d)) {
        output.push(c, d);
        i++;
      } else {
        output.push(UNICODE_REPLACEMENT_CHARACTER);
      }
    }
  }
  return input.slice(0, start) + stringFromCharCode(...output);
}
