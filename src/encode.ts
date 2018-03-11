export function percentEscape(c: string): string {
  const unicode = c.charCodeAt(0);
  if (unicode > 0x20 &&
      unicode < 0x7F &&
      // " # < > ? `
      [0x22, 0x23, 0x3C, 0x3E, 0x3F, 0x60].indexOf(unicode) == -1
  ) {
    return c;
  }
  return encodeURIComponent(c);
}

export function percentEscapeQuery(c: string) {
  // XXX This actually needs to encode c using encoding and then
  // convert the bytes one-by-one.

  const unicode = c.charCodeAt(0);
  if (unicode > 0x20 &&
      unicode < 0x7F &&
      // " # < > ` (do not escape '?')
      [0x22, 0x23, 0x3C, 0x3E, 0x60].indexOf(unicode) == -1
  ) {
    return c;
  }
  return encodeURIComponent(c);
}
