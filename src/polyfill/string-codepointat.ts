export default function codePointAt(string: string, index: number): number {
  const length = string.length;
  const value = string.charCodeAt(index);
  if (value >= 0xD800 && value <= 0xDBFF && index + 1 < length) {
    // high surrogate, and there is a next character
    const extra = string.charCodeAt(index + 1);
    if ((extra & 0xFC00) === 0xDC00) { // low surrogate
      return ((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000;
    }
  }
  return value;
}
