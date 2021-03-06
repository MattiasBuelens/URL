/* Any copyright is dedicated to the Public Domain.
* http://creativecommons.org/publicdomain/zero/1.0/ */

import {
  isC0ControlPercentEncode,
  isFragmentPercentEncode,
  isPathPercentEncode,
  isQueryPercentEncode,
  isQueryPercentEncodeSpecial,
  isUserinfoPercentEncode,
  utf8PercentEncode,
  utf8PercentEncodeString
} from "./encode";
import { EMPTY_HOST, Host, HostType, parseHost, serializeHost } from "./host";
import { emptyParams, newURLSearchParams, setParamsQuery, URLSearchParams } from "./search-params";
import { ALPHA, fromCodeUnits, isAlpha, isAlphanumeric, isDigit, toAsciiLowercase } from "./util";
import { ucs2decode, ucs2encode } from "./vendor/ucs2";
import { OPAQUE_ORIGIN, serializeTupleOrigin } from "./origin";
import { toUSVString } from "./usvstring";

const defaultPorts = Object.create(null);
defaultPorts['ftp'] = 21;
defaultPorts['file'] = 0;
defaultPorts['gopher'] = 70;
defaultPorts['http'] = 80;
defaultPorts['https'] = 443;
defaultPorts['ws'] = 80;
defaultPorts['wss'] = 443;

const SINGLE_DOT = /^(?:\.|%2e)$/i;
const DOUBLE_DOT = /^(?:\.|%2e){2}$/i;

function isSingleDotPathSegment(input: string): boolean {
  return SINGLE_DOT.test(input);
}

function isDoubleDotPathSegment(input: string): boolean {
  return DOUBLE_DOT.test(input);
}

function isSpecialScheme(scheme: string): boolean {
  return defaultPorts[scheme] !== undefined;
}

function isSpecial(url: UrlRecord): boolean {
  return isSpecialScheme(url._scheme);
}

function includesCredentials(url: UrlRecord): boolean {
  return url._username !== '' || url._password !== '';
}

// https://url.spec.whatwg.org/#start-with-a-windows-drive-letter
function startsWithWindowsDriveLetter(input: number[]): boolean {
  // its length is greater than or equal to 2
  const length = input.length;
  if (!(length >= 2)) {
    return false;
  }
  // its first two code points are a Windows drive letter
  if (!isWindowsDriveLetterRaw(input.slice(0, 2))) {
    return false;
  }
  // its length is 2 or its third code point is U+002F (/), U+005C (\), U+003F (?), or U+0023 (#).
  if (length !== 2) {
    const c = input[2];
    if (!(0x2F === c || 0x5C === c || 0x3F === c || 0x23 === c)) {
      return false;
    }
  }
  return true;
}

// https://url.spec.whatwg.org/#windows-drive-letter
function isWindowsDriveLetter(input: string): boolean {
  // A Windows drive letter is two code points, of which the first is an ASCII alpha
  // and the second is either U+003A (:) or U+007C (|).
  return input.length === 2
      && ALPHA.test(input[0])
      && (':' === input[1] || '|' === input[1]);
}

function isWindowsDriveLetterRaw(input: number[]): boolean {
  return input.length === 2 && isWindowsDriveLetter(fromCodeUnits(input));
}

// https://url.spec.whatwg.org/#normalized-windows-drive-letter
function isNormalizedWindowsDriveLetter(input: string): boolean {
  // A normalized Windows drive letter is a Windows drive letter of which the second code point is U+003A (:).
  return isWindowsDriveLetter(input)
      && (':' === input[1]);
}

function shortenPath(url: UrlRecord) {
  // 1. Let path be url’s path.
  const path = url._path;
  // 2. If path is empty, then return.
  if (path.length === 0) {
    return;
  }
  // 3. If url’s scheme is "file", path’s size is 1, and path[0] is a normalized Windows drive letter, then return.
  if ('file' === url._scheme && path.length === 1 && isNormalizedWindowsDriveLetter(path[0])) {
    return;
  }
  // 4. Remove path’s last item.
  path.pop();
}

function cannotHaveUsernamePasswordPort(url: UrlRecord): boolean {
  return (null === url._host || EMPTY_HOST === url._host) ||
      url._cannotBeABaseURL ||
      'file' === url._scheme;
}

const EOF = -1;
const TAB_OR_NEWLINE = /\t|\n|\r/g;
const LEADING_OR_TRAILING_C0_CONTROL_OR_SPACE = /^[\x00-\x1f ]+|[\x00-\x1f ]+$/g;

const enum ParserState {
  SCHEME_START,
  SCHEME,
  NO_SCHEME,
  SPECIAL_RELATIVE_OR_AUTHORITY,
  PATH_OR_AUTHORITY,
  RELATIVE,
  RELATIVE_SLASH,
  SPECIAL_AUTHORITY_SLASHES,
  SPECIAL_AUTHORITY_IGNORE_SLASHES,
  AUTHORITY,
  HOST,
  HOSTNAME,
  PORT,
  FILE,
  FILE_SLASH,
  FILE_HOST,
  PATH_START,
  PATH,
  CANNOT_BE_A_BASE_URL_PATH,
  QUERY,
  FRAGMENT
}

function parse(input: string, base: UrlRecord | null): UrlRecord;
function parse(input: string, base: UrlRecord | null, url: UrlRecord, stateOverride: ParserState): void;
function parse(input: string, base: UrlRecord | null, url: UrlRecord | null = null, stateOverride: ParserState | null = null): UrlRecord | void {
  // 1. If url is not given:
  if (!url) {
    // 1. Set url to a new URL.
    url = new UrlRecord();
    // 2. If input contains any leading or trailing C0 control or space, validation error.
    // 3. Remove any leading and trailing C0 control or space from input.
    input = input.replace(LEADING_OR_TRAILING_C0_CONTROL_OR_SPACE, '');
  }
  // 2. If input contains any ASCII tab or newline, validation error.
  // 3. Remove all ASCII tab or newline from input.
  input = input.replace(TAB_OR_NEWLINE, '');
  // 4. Let state be state override if given, or scheme start state otherwise.
  let state: ParserState = stateOverride !== null ? stateOverride : ParserState.SCHEME_START;
  // 5. If base is not given, set it to null.
  base = base || null;
  // 6. Let encoding be UTF-8.
  // 7. If encoding override is given, set encoding to the result of getting an output encoding from encoding override.
  // TODO encoding
  // 8. Let buffer be the empty string.
  let buffer: number[] = [];
  // 9. Let the @ flag, [] flag, and passwordTokenSeenFlag be unset.
  let seenAt = false;
  let seenBracket = false;
  let passwordTokenSeenFlag = false;
  // 10. Let pointer be a pointer to first code point in input.
  const codePoints = ucs2decode(input);
  const length = codePoints.length;
  let cursor = 0;

  // 11. Keep running the following state machine by switching on state.
  //     If after a run pointer points to the EOF code point, go to the next step.
  //     Otherwise, increase pointer by one and continue with the state machine.
  while (cursor <= length) {
    const c = cursor < length ? codePoints[cursor] : EOF;
    switch (state) {
      case ParserState.SCHEME_START:
        // 1. If c is an ASCII alpha, append c, lowercased, to buffer, and set state to scheme state.
        if (isAlpha(c)) {
          buffer.push(toAsciiLowercase(c)); // ASCII-safe
          state = ParserState.SCHEME;
        }
        // 2. Otherwise, if state override is not given, set state to no scheme state, and decrease pointer by one.
        else if (stateOverride === null) {
          buffer.length = 0;
          state = ParserState.NO_SCHEME;
          continue;
        }
        // 3. Otherwise, validation error, return failure.
        else {
          throw new TypeError(`Invalid scheme`);
        }
        break;

      case ParserState.SCHEME:
        // 1. If c is an ASCII alphanumeric, U+002B (+), U+002D (-), or U+002E (.), append c, lowercased, to buffer.
        if (isAlphanumeric(c) || 0x2B === c || 0x2D === c || 0x2E === c) {
          buffer.push(toAsciiLowercase(c)); // ASCII-safe
        }
        // 2. Otherwise, if c is U+003A (:), then:
        else if (0x3A === c) {
          const bufferString = ucs2encode(buffer);
          // 1. If state override is given, then:
          if (stateOverride !== null) {
            // 1. If url’s scheme is a special scheme and buffer is not a special scheme, then return.
            if (isSpecialScheme(url._scheme) && !isSpecialScheme(bufferString)) {
              return;
            }
            // 2. If url’s scheme is not a special scheme and buffer is a special scheme, then return.
            if (!isSpecialScheme(url._scheme) && isSpecialScheme(bufferString)) {
              return;
            }
            // 3. If url includes credentials or has a non-null port, and buffer is "file", then return.
            if ((includesCredentials(url) || url._port !== null) && 'file' === bufferString) {
              return;
            }
            // 4. If url’s scheme is "file" and its host is an empty host or null, then return.
            if (url._scheme === 'file' && (url._host === EMPTY_HOST || url._host === null)) {
              return;
            }
          }
          // 2. Set url’s scheme to buffer.
          url._scheme = bufferString;
          // 3. If state override is given, then:
          if (stateOverride !== null) {
            // 1. If url’s port is url’s scheme’s default port, then set url’s port to null.
            if (isSpecial(url) && url._port === defaultPorts[url._scheme]) {
              url._port = null;
            }
            // 2. Return.
            return;
          }
          // 4. Set buffer to the empty string.
          buffer.length = 0;
          // 5. If url’s scheme is "file", then:
          if ('file' === url._scheme) {
            // 1. If remaining does not start with "//", validation error.
            // 2. Set state to file state.
            state = ParserState.FILE;
          }
          // 6. Otherwise, if url is special, base is non-null, and base’s scheme is equal to url’s scheme,
          // set state to special relative or authority state.
          else if (isSpecial(url) && base && base._scheme === url._scheme) {
            state = ParserState.SPECIAL_RELATIVE_OR_AUTHORITY;
          }
          // 7. Otherwise, if url is special, set state to special authority slashes state.
          else if (isSpecial(url)) {
            state = ParserState.SPECIAL_AUTHORITY_SLASHES;
          }
          // 8. Otherwise, if remaining starts with an U+002F (/),
          // set state to path or authority state and increase pointer by one.
          else if (0x2F === codePoints[cursor + 1]) {
            state = ParserState.PATH_OR_AUTHORITY;
            cursor += 1;
          }
          // 9. Otherwise, set url’s cannot-be-a-base-URL flag,
          // append an empty string to url’s path,
          // and set state to cannot-be-a-base-URL path state.
          else {
            url._cannotBeABaseURL = true;
            url._path.push('');
            state = ParserState.CANNOT_BE_A_BASE_URL_PATH;
          }
        }
        // 3. Otherwise, if state override is not given,
        // set buffer to the empty string, state to no scheme state,
        // and start over (from the first code point in input).
        else if (stateOverride === null) {
          buffer.length = 0;
          state = ParserState.NO_SCHEME;
          cursor = 0;
          continue;
        }
        // 4. Otherwise, validation error, return failure.
        else {
          throw new TypeError(`Invalid scheme`);
        }
        break;

      case ParserState.NO_SCHEME:
        // 1. If base is null, or base’s cannot-be-a-base-URL flag is set
        //    and c is not U+0023 (#), validation error, return failure.
        if (!base || (base._cannotBeABaseURL && 0x23 !== c)) {
          throw new TypeError('Invalid scheme');
        }
        // 2. Otherwise, if base’s cannot-be-a-base-URL flag is set and c is U+0023 (#),
        //    set url’s scheme to base’s scheme, url’s path to a copy of base’s path,
        //    url’s query to base’s query, url’s fragment to the empty string,
        //    set url’s cannot-be-a-base-URL flag, and set state to fragment state.
        else if (base._cannotBeABaseURL && 0x23 === c) {
          url._scheme = base._scheme;
          url._path = base._path.slice();
          url._query = base._query;
          url._fragment = '';
          url._cannotBeABaseURL = true;
          state = ParserState.FRAGMENT;
        }
        // 3. Otherwise, if base’s scheme is not "file",
        //    set state to relative state and decrease pointer by one.
        else if ('file' !== base._scheme) {
          state = ParserState.RELATIVE;
          cursor -= 1;
        }
        // 4. Otherwise, set state to file state and decrease pointer by one.
        else {
          state = ParserState.FILE;
          cursor -= 1;
        }
        break;

      case ParserState.SPECIAL_RELATIVE_OR_AUTHORITY:
        // If c is U+002F (/) and remaining starts with U+002F (/),
        // then set state to special authority ignore slashes state and increase pointer by one.
        if (0x2F === c && 0x2F === codePoints[cursor + 1]) {
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
        }
        // Otherwise, validation error, set state to relative state and decrease pointer by one.
        else {
          state = ParserState.RELATIVE;
          cursor -= 1;
        }
        break;

      case ParserState.PATH_OR_AUTHORITY:
        // If c is U+002F (/), then set state to authority state.
        if (0x2F === c) {
          state = ParserState.AUTHORITY;
        }
        // Otherwise, set state to path state, and decrease pointer by one.
        else {
          state = ParserState.PATH;
          cursor -= 1;
        }
        break;

      case ParserState.RELATIVE:
        // Set url’s scheme to base’s scheme,
        url._scheme = base!._scheme;
        // and then, switching on c:
        if (EOF === c) {
          // The EOF code point
          // Set url’s username to base’s username,
          // url’s password to base’s password,
          // url’s host to base’s host,
          // url’s port to base’s port,
          // url’s path to a copy of base’s path,
          // and url’s query to base’s query.
          url._username = base!._username;
          url._password = base!._password;
          url._host = base!._host;
          url._port = base!._port;
          url._path = base!._path.slice();
          url._query = base!._query;
        } else if (0x2F === c) {
          // U+002F (/)
          // Set state to relative slash state.
          state = ParserState.RELATIVE_SLASH;
        } else if (0x3F === c) {
          // U+003F (?)
          // Set url’s username to base’s username,
          // url’s password to base’s password,
          // url’s host to base’s host,
          // url’s port to base’s port,
          // url’s path to a copy of base’s path,
          // url’s query to the empty string,
          // and state to query state.
          url._username = base!._username;
          url._password = base!._password;
          url._host = base!._host;
          url._port = base!._port;
          url._path = base!._path.slice();
          url._query = '';
          state = ParserState.QUERY;
        } else if (0x23 === c) {
          // U+0023 (#)
          // Set url’s username to base’s username,
          // url’s password to base’s password,
          // url’s host to base’s host,
          // url’s port to base’s port,
          // url’s path to a copy of base’s path,
          // url’s query to base’s query,
          // url’s fragment to the empty string,
          // and state to fragment state.
          url._username = base!._username;
          url._password = base!._password;
          url._host = base!._host;
          url._port = base!._port;
          url._path = base!._path.slice();
          url._query = base!._query;
          url._fragment = '';
          state = ParserState.FRAGMENT;
        } else {
          // Otherwise
          // If url is special and c is U+005C (\), validation error,
          // set state to relative slash state.
          if (0x5C === c && isSpecial(url)) {
            state = ParserState.RELATIVE_SLASH;
          }
          // Otherwise, run these steps:
          else {
            // 1. Set url’s username to base’s username,
            //    url’s password to base’s password,
            //    url’s host to base’s host,
            //    url’s port to base’s port,
            //    url’s path to a copy of base’s path,
            //    and then remove url’s path’s last item, if any.
            url._username = base!._username;
            url._password = base!._password;
            url._host = base!._host;
            url._port = base!._port;
            url._path = base!._path.slice();
            url._path.pop();
            // 2. Set state to path state, and decrease pointer by one.
            state = ParserState.PATH;
            cursor -= 1;
          }
        }
        break;

      case ParserState.RELATIVE_SLASH:
        // 1. If url is special and c is U+002F (/) or U+005C (\), then:
        if (isSpecial(url) && (0x2F === c || 0x5C === c)) {
          // 1. If c is U+005C (\), validation error.
          // 2. Set state to special authority ignore slashes state.
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
        }
        // Otherwise, if c is U+002F (/), then set state to authority state.
        else if (0x2F === c) {
          state = ParserState.AUTHORITY;
          // Otherwise, set url’s username to base’s username,
          // url’s password to base’s password,
          // url’s host to base’s host,
          // url’s port to base’s port,
          // state to path state,
          // and then, decrease pointer by one.
        } else {
          url._username = base!._username;
          url._password = base!._password;
          url._host = base!._host;
          url._port = base!._port;
          state = ParserState.PATH;
          cursor -= 1;
        }
        break;

      case ParserState.SPECIAL_AUTHORITY_SLASHES:
        // If c is U+002F (/) and remaining starts with U+002F (/),
        // then set state to special authority ignore slashes state and increase pointer by one.
        if (0x2F === c && 0x2F === codePoints[cursor + 1]) {
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
          cursor += 1;
        }
        // Otherwise, validation error,
        // set state to special authority ignore slashes state,
        // and decrease pointer by one.
        else {
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
          continue;
        }
        break;

      case ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES:
        // If c is neither U+002F (/) nor U+005C (\),
        // then set state to authority state and decrease pointer by one.
        if (0x2F !== c && 0x5C !== c) {
          state = ParserState.AUTHORITY;
          cursor -= 1;
        }
        // Otherwise, validation error.
        break;

      case ParserState.AUTHORITY:
        // 1. If c is U+0040 (@), then:
        if (0x40 === c) {
          // 1. Validation error.
          // 2. If the @ flag is set, prepend "%40" to buffer.
          if (seenAt) {
            buffer.unshift(0x25, 0x34, 0x30);
          }
          // 3. Set the @ flag.
          seenAt = true;
          // 4. For each codePoint in buffer:
          for (let codePoint of buffer) {
            // 1. If codePoint is U+003A (:) and passwordTokenSeenFlag is unset,
            //    then set passwordTokenSeenFlag and continue.
            if (0x3A === codePoint && !passwordTokenSeenFlag) {
              passwordTokenSeenFlag = true;
              continue;
            }
            // 2. Let encodedCodePoints be the result of running UTF-8 percent encode codePoint
            //    using the userinfo percent-encode set.
            const encodedCodePoints = ucs2encode(utf8PercentEncode(codePoint, isUserinfoPercentEncode));
            // 3. If passwordTokenSeenFlag is set, then append encodedCodePoints to url’s password.
            if (passwordTokenSeenFlag) {
              url._password += encodedCodePoints;
            }
            // 4. Otherwise, append encodedCodePoints to url’s username.
            else {
              url._username += encodedCodePoints;
            }
          }
          // 5. Set buffer to the empty string.
          buffer.length = 0;
        }
        // 2. Otherwise, if one of the following is true:
        //    - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
        //    - url is special and c is U+005C (\)
        else if (
            (EOF === c || 0x2F === c || 0x3F === c || 0x23 === c) ||
            (isSpecial(url) && (0x5C === c))
        ) {
          // then:
          // 1. If @ flag is set and buffer is the empty string, validation error, return failure.
          if (seenAt && 0 === buffer.length) {
            // e.g. http://user@/foo
            throw new TypeError('Invalid host');
          }
          // 2. Decrease pointer by the number of code points in buffer plus one,
          //    set buffer to the empty string, and set state to host state.
          cursor -= buffer.length + 1;
          buffer.length = 0;
          state = ParserState.HOST;
        }
        // 3. Otherwise, append c to buffer.
        else {
          buffer.push(c);
        }
        break;

      case ParserState.HOST:
      case ParserState.HOSTNAME:
        // 1. If state override is given and url’s scheme is "file",
        // then decrease pointer by one and set state to file host state.
        if (stateOverride !== null && 'file' === url._scheme) {
          cursor -= 1;
          state = ParserState.FILE_HOST;
        }
        // 2. Otherwise, if c is U+003A (:) and the [] flag is unset, then:
        else if (0x3A === c && !seenBracket) {
          // 1. If buffer is the empty string, validation error, return failure.
          if (0 === buffer.length) {
            throw new TypeError('Invalid host');
          }
          // 2. Let host be the result of host parsing buffer with url is special.
          // 3. If host is failure, then return failure.
          const host = parseHost(ucs2encode(buffer), isSpecial(url));
          // 4. Set url’s host to host, buffer to the empty string, and state to port state.
          url._host = host;
          buffer.length = 0;
          state = ParserState.PORT;
          // 5. If state override is given and state override is hostname state, then return.
          if (stateOverride === ParserState.HOSTNAME) {
            return;
          }
        }
        // 3. Otherwise, if one of the following is true:
        //    - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
        //    - url is special and c is U+005C (\)
        else if (
            (EOF === c || 0x2F === c || 0x3F === c || 0x23 === c) ||
            (isSpecial(url) && (0x5C === c))
        ) {
          // then decrease pointer by one, and then:
          cursor -= 1;
          // 1. If url is special and buffer is the empty string, validation error, return failure.
          if (isSpecial(url) && 0 === buffer.length) {
            throw new TypeError('Invalid host');
          }
          // 2. Otherwise, if state override is given, buffer is the empty string,
          //    and either url includes credentials or url’s port is non-null,
          //    validation error, return.
          if (stateOverride !== null && 0 === buffer.length && (includesCredentials(url) || url._port !== null)) {
            return;
          }
          // 3. Let host be the result of host parsing buffer with url is special.
          // 4. If host is failure, then return failure.
          const host = parseHost(ucs2encode(buffer), isSpecial(url));
          // 5. Set url’s host to host, buffer to the empty string, and state to path start state.
          url._host = host;
          buffer.length = 0;
          state = ParserState.PATH_START;
          // 6. If state override is given, then return.
          if (stateOverride !== null) {
            return;
          }
        }
        // 4. Otherwise:
        else {
          // 1. If c is U+005B ([), then set the [] flag.
          if (0x5B === c) {
            seenBracket = true;
          }
          // 2. If c is U+005D (]), then unset the [] flag.
          else if (0x5D === c) {
            seenBracket = false;
          }
          // 3. Append c to buffer.
          buffer.push(c);
        }
        break;

      case ParserState.PORT:
        // 1. If c is an ASCII digit, append c to buffer.
        if (isDigit(c)) {
          buffer.push(c);
        }
        // 2. Otherwise, if one of the following is true:
        //    - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
        //    - url is special and c is U+005C (\)
        //    - state override is given
        else if (
            (EOF === c || 0x2F === c || 0x3F === c || 0x23 === c) ||
            (isSpecial(url) && (0x5C === c)) ||
            (stateOverride !== null)
        ) {
          // then:
          // 1. If buffer is not the empty string, then:
          if (0 !== buffer.length) {
            // 1. Let port be the mathematical integer value that is represented
            //    by buffer in radix-10 using ASCII digits for digits with values 0 through 9.
            const port = parseInt(ucs2encode(buffer), 10);
            // 2. If port is greater than 2^16 − 1, validation error, return failure.
            if (port > (1 << 16) - 1) {
              throw new TypeError('Invalid port');
            }
            // 3. Set url’s port to null, if port is url’s scheme’s default port, and to port otherwise.
            url._port = (port === defaultPorts[url._scheme]) ? null : port;
            // 4. Set buffer to the empty string.
            buffer.length = 0;
          }
          // 2. If state override is given, then return.
          if (stateOverride !== null) {
            return;
          }
          // 3. Set state to path start state, and decrease pointer by one.
          state = ParserState.PATH_START;
          cursor -= 1;
        }
        // 3. Otherwise, validation error, return failure.
        else {
          throw new TypeError(`Invalid port`);
        }
        break;

      case ParserState.FILE:
        // 1. Set url’s scheme to "file".
        url._scheme = 'file';
        // 2. If c is U+002F (/) or U+005C (\), then:
        if (0x2F === c || 0x5C === c) {
          // 1. If c is U+005C (\), validation error.
          // 2. Set state to file slash state.
          state = ParserState.FILE_SLASH;
        }
        // 3. Otherwise, if base is non-null and base’s scheme is "file", switch on c:
        else if (base && base._scheme === 'file') {
          if (EOF === c) {
            // The EOF code point
            // Set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // and url’s query to base’s query.
            url._host = base!._host;
            url._path = base!._path.slice();
            url._query = base!._query;
          } else if (0x3F === c) {
            // U+003F (?)
            // Set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // url’s query to the empty string,
            // and state to query state.
            url._host = base!._host;
            url._path = base!._path.slice();
            url._query = '';
            state = ParserState.QUERY;
          } else if (0x23 === c) {
            // U+0023 (#)
            // Set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // url’s query to base’s query,
            // url’s fragment to the empty string,
            // and state to fragment state.
            url._host = base!._host;
            url._path = base!._path.slice();
            url._query = base!._query;
            url._fragment = '';
            state = ParserState.FRAGMENT;
          } else {
            // Otherwise
            // 1. If the substring from pointer in input does not start with a Windows drive letter,
            // then set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // and then shorten url’s path.
            if (!startsWithWindowsDriveLetter(codePoints.slice(cursor))) {
              url._host = base!._host;
              url._path = base!._path.slice();
              shortenPath(url);
            }
            // 2. Otherwise, validation error.
            // 3. Set state to path state, and decrease pointer by one.
            state = ParserState.PATH;
            cursor -= 1;
          }
        }
        // 4. Otherwise, set state to path state, and decrease pointer by one.
        else {
          state = ParserState.PATH;
          cursor -= 1;
        }
        break;

      case ParserState.FILE_SLASH:
        // 1. If c is U+002F (/) or U+005C (\), then:
        if (0x2F === c || 0x5C === c) {
          // 1. If c is U+005C (\), validation error.
          // 2. Set state to file host state.
          state = ParserState.FILE_HOST;
        }
        // 2. Otherwise:
        else {
          // 1. If base is non-null, base’s scheme is "file",
          // and the substring from pointer in input does not start with a Windows drive letter,
          // then:
          if (base && 'file' === base._scheme && !startsWithWindowsDriveLetter(codePoints.slice(cursor))) {
            // 1. If base’s path[0] is a normalized Windows drive letter, then append base’s path[0] to url’s path.
            if (isNormalizedWindowsDriveLetter(base._path[0])) {
              url._path.push(base._path[0]);
            }
            // 2. Otherwise, set url’s host to base’s host.
            else {
              url._host = base._host;
            }
          }
          // 2. Set state to path state, and decrease pointer by one.
          state = ParserState.PATH;
          cursor -= 1;
        }
        break;

      case ParserState.FILE_HOST:
        // 1. If c is the EOF code point, U+002F (/), U+005C (\), U+003F (?), or U+0023 (#),
        // then decrease pointer by one and then:
        if (EOF === c || 0x2F === c || 0x5C === c || 0x3F === c || 0x23 === c) {
          cursor -= 1;
          // 1. If state override is not given and buffer is a Windows drive letter,
          //    validation error, set state to path state.
          if (stateOverride === null && isWindowsDriveLetterRaw(buffer)) {
            state = ParserState.PATH;
          }
          // 2. Otherwise, if buffer is the empty string, then:
          else if (0 === buffer.length) {
            // 1. Set url’s host to the empty string.
            url._host = EMPTY_HOST;
            // 2. If state override is given, then return.
            if (stateOverride !== null) {
              return;
            }
            // 3. Set state to path start state.
            state = ParserState.PATH_START;
          }
          // 3. Otherwise, run these steps:
          else {
            // 1. Let host be the result of host parsing buffer with url is special.
            // 2. If host is failure, then return failure.
            let host = parseHost(ucs2encode(buffer), isSpecial(url));
            // 3. If host is "localhost", then set host to the empty string.
            if (host._type === HostType.DOMAIN && 'localhost' === host._domain) {
              host = EMPTY_HOST;
            }
            // 4. Set url’s host to host.
            url._host = host;
            // 5. If state override is given, then return.
            if (stateOverride !== null) {
              return;
            }
            // 6. Set buffer to the empty string and state to path start state.
            buffer.length = 0;
            state = ParserState.PATH_START;
          }
        }
        // 2. Otherwise, append c to buffer.
        else {
          buffer.push(c);
        }
        break;

      case ParserState.PATH_START:
        // 1. If url is special, then:
        if (isSpecial(url)) {
          // 1. If c is U+005C (\), validation error.
          // 2. Set state to path state.
          state = ParserState.PATH;
          // 3. If c is neither U+002F (/) nor U+005C (\), then decrease pointer by one.
          if (0x2F !== c && 0x5C !== c) {
            cursor -= 1;
          }
        }
        // 2. Otherwise, if state override is not given and c is U+003F (?),
        //    set url’s query to the empty string and state to query state.
        else if (stateOverride === null && 0x3F === c) {
          url._query = '';
          state = ParserState.QUERY;
        }
        // 3. Otherwise, if state override is not given and c is U+0023 (#),
        //    set url’s fragment to the empty string and state to fragment state.
        else if (stateOverride === null && 0x23 === c) {
          url._fragment = '';
          state = ParserState.FRAGMENT;
        }
        // 4. Otherwise, if c is not the EOF code point:
        else if (EOF !== c) {
          // 1. Set state to path state.
          state = ParserState.PATH;
          // 2. If c is not U+002F (/), then decrease pointer by one.
          if (0x2F !== c) {
            cursor -= 1;
          }
        }
        break;

      case ParserState.PATH:
        // 1. If one of the following is true
        //    - c is the EOF code point or U+002F (/)
        //    - url is special and c is U+005C (\)
        //    - state override is not given and c is U+003F (?) or U+0023 (#)
        if (
            (EOF === c || 0x2F === c) ||
            (isSpecial(url) && 0x5C === c) ||
            (stateOverride === null && (0x3F === c || 0x23 === c))
        ) {
          // then:
          let bufferString = ucs2encode(buffer);
          // 1. If url is special and c is U+005C (\), validation error.
          // 2. If buffer is a double-dot path segment, shorten url’s path,
          //    and then if neither c is U+002F (/), nor url is special and c is U+005C (\),
          //    append the empty string to url’s path.
          if (isDoubleDotPathSegment(bufferString)) {
            shortenPath(url);
            if (0x2F !== c && !(isSpecial(url) && 0x5C === c)) {
              url._path.push('');
            }
          }
          // 3. Otherwise, if buffer is a single-dot path segment
          //    and if neither c is U+002F (/), nor url is special and c is U+005C (\),
          //    append the empty string to url’s path.
          else if (
              isSingleDotPathSegment(bufferString) &&
              (0x2F !== c && !(isSpecial(url) && 0x5C === c))
          ) {
            url._path.push('');
          }
          // 4. Otherwise, if buffer is not a single-dot path segment, then:
          else if (!isSingleDotPathSegment(bufferString)) {
            // 1. If url’s scheme is "file", url’s path is empty, and buffer is a Windows drive letter, then:
            if ('file' === url._scheme && url._path.length === 0 && isWindowsDriveLetterRaw(buffer)) {
              // 1. If url’s host is neither the empty string nor null,
              //    validation error, set url’s host to the empty string.
              if (EMPTY_HOST !== url._host && null !== url._host) {
                url._host = EMPTY_HOST;
              }
              // 2. Replace the second code point in buffer with U+003A (:).
              // (Note that isWindowsDriveLetter(buffer) implies buffer.length === 2)
              buffer[1] = 0x3A;
              bufferString = ucs2encode(buffer);
            }
            // 2. Append buffer to url’s path.
            url._path.push(bufferString);
          }
          // 5. Set buffer to the empty string.
          buffer.length = 0;
          // 6. If url’s scheme is "file" and c is the EOF code point, U+003F (?), or U+0023 (#),
          //    then while url’s path’s size is greater than 1 and url’s path[0] is the empty string,
          //    validation error, remove the first item from url’s path.
          if ('file' === url._scheme && (EOF === c || 0x3F === c || 0x23 === c)) {
            while (url._path.length > 1 && '' === url._path[0]) {
              url._path.shift();
            }
          }
          // 7. If c is U+003F (?), then set url’s query to the empty string and state to query state.
          if (0x3F === c) {
            url._query = '';
            state = ParserState.QUERY;
          }
          // 8. If c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
          else if (0x23 === c) {
            url._fragment = '';
            state = ParserState.FRAGMENT;
          }
        }
        // 2. Otherwise, run these steps:
        else {
          // 1. If c is not a URL code point and not U+0025 (%), validation error.
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          // 3. UTF-8 percent encode c using the path percent-encode set,
          //    and append the result to buffer.
          buffer.push(...utf8PercentEncode(c, isPathPercentEncode));
        }
        break;

      case ParserState.CANNOT_BE_A_BASE_URL_PATH:
        // 1. If c is U+003F (?), then set url’s query to the empty string and state to query state.
        if (0x3F === c) {
          url._query = '';
          state = ParserState.QUERY;
        }
        // 2. Otherwise, if c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
        else if (0x23 === c) {
          url._fragment = '';
          state = ParserState.FRAGMENT;
        }
        // 3. Otherwise:
        else {
          // 1. If c is not the EOF code point, not a URL code point, and not U+0025 (%), validation error.
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          // 3. If c is not the EOF code point,
          //    UTF-8 percent encode c using the C0 control percent-encode set,
          //    and append the result to url’s path[0].
          if (EOF !== c) {
            url._path[0] += ucs2encode(utf8PercentEncode(c, isC0ControlPercentEncode));
          }
        }
        break;

      case ParserState.QUERY:
        // 1. If encoding is not UTF-8 and one of the following is true
        //     - url is not special
        //     - url’s scheme is "ws" or "wss"
        //    then set encoding to UTF-8.
        // TODO encoding
        // 2. If state override is not given and c is U+0023 (#),
        //    then set url’s fragment to the empty string and state to fragment state.
        if (stateOverride === null && 0x23 === c) {
          url._fragment = '';
          state = ParserState.FRAGMENT;
        }
        // 3. Otherwise, if c is not the EOF code point:
        else if (EOF !== c) {
          // 1. If c is not a URL code point and not U+0025 (%), validation error.
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.

          // 3. Let bytes be the result of encoding c using encoding.
          // 4. If bytes starts with `&#` and ends with 0x3B (;), then:
          // TODO encoding
          // Note: This cannot happen, since in our case we always use UTF-8 encoding.

          // 5. Otherwise, for each byte in bytes:
          // 5.1. If one of the following is true
          //      - byte is less than 0x21 (!)
          //      - byte is greater than 0x7E (~)
          //      - byte is 0x22 ("), 0x23 (#), 0x3C (<), or 0x3E (>)
          //      - byte is 0x27 (') and url is special
          //      then append byte, percent encoded, to url’s query.
          // 5.2. Otherwise, append a code point whose value is byte to url’s query.
          url._query += ucs2encode(utf8PercentEncode(
              c,
              isSpecial(url) ? isQueryPercentEncodeSpecial : isQueryPercentEncode
          ));
        }
        break;

      case ParserState.FRAGMENT:
        // Switching on c:
        if (EOF === c) {
          // The EOF code point
          // Do nothing
        }
        else if (0x00 === c) {
          // U+0000 NULL
          // Validation error.
        }
        else {
          // Otherwise
          // 1. If c is not a URL code point and not U+0025 (%), validation error.
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          // 3. UTF-8 percent encode c using the fragment percent-encode set and append the result to url’s fragment.
          url._fragment += ucs2encode(utf8PercentEncode(c, isFragmentPercentEncode));
        }
        break;
    }

    cursor++;
  }

  // 12. Return url.
  return url;
}

function parseSilent(input: string, base: UrlRecord | null, url: UrlRecord, stateOverride: ParserState): void {
  try {
    parse(input, base, url, stateOverride);
  } catch {
    // ignore
  }
}

function serializeUrl(url: UrlRecord, excludeFragment: boolean = false): string {
  // 1. Let output be url’s scheme and U+003A (:) concatenated.
  let output = url._scheme + ':';
  // 2. If url’s host is non-null:
  if (null !== url._host) {
    // 1. Append "//" to output.
    output += '//';
    // 2. If url includes credentials, then:
    if (includesCredentials(url)) {
      // 1. Append url’s username to output.
      output += url._username;
      // 2. If url’s password is not the empty string, then append U+003A (:), followed by url’s password, to output.
      if ('' !== url._password) {
        output += `:${url._password}`;
      }
      // 3. Append U+0040 (@) to output.
      output += '@';
    }
    // 3. Append url’s host, serialized, to output.
    output += serializeHost(url._host);
    // 4. If url’s port is non-null, append U+003A (:) followed by url’s port, serialized, to output.
    if (null !== url._port) {
      output += `:${url._port}`;
    }
  }
  // 3. Otherwise, if url’s host is null and url’s scheme is "file", append "//" to output.
  else if (null === url._host && 'file' === url._scheme) {
    output += '//';
  }
  // 4. If url’s cannot-be-a-base-URL flag is set, append url’s path[0] to output.
  if (url._cannotBeABaseURL) {
    output += url._path[0];
  }
  // 5. Otherwise, then for each string in url’s path, append U+002F (/) followed by the string to output.
  else {
    for (let part of url._path) {
      output += `/${part}`;
    }
  }
  // 6. If url’s query is non-null, append U+003F (?), followed by url’s query, to output.
  if (null !== url._query) {
    output += `?${url._query}`;
  }
  // 7. If the exclude fragment flag is unset and url’s fragment is non-null, append U+0023 (#), followed by url’s fragment, to output.
  if (!excludeFragment && null !== url._fragment) {
    output += `#${url._fragment}`;
  }
  // 8. Return output.
  return output;
}

export class UrlRecord {
  _scheme: string = '';
  _username: string = '';
  _password: string = '';
  _host: Host | null = null;
  _port: number | null = null;
  _path: string[] = [];
  _query: string | null = null;
  _fragment: string | null = null;
  _cannotBeABaseURL: boolean = false;
}

// https://url.spec.whatwg.org/#concept-url-origin
function getOrigin(url: UrlRecord): string {
  switch (url._scheme) {
    case 'blob': {
      // Let url be the result of parsing URL’s path[0].
      // Return a new opaque origin, if url is failure, and url’s origin otherwise.
      let blobUrl: UrlRecord;
      try {
        blobUrl = parse(url._path[0], null);
      } catch (e) {
        return OPAQUE_ORIGIN;
      }
      return getOrigin(blobUrl);
    }
    case 'ftp':
    case 'gopher':
    case 'http':
    case 'https':
    case 'ws':
    case 'wss':
      // Return a tuple consisting of URL’s scheme, URL’s host, URL’s port, and null.
      // Note: URL's host cannot be null, see table at https://url.spec.whatwg.org/#concept-url-host
      return serializeTupleOrigin(url._scheme, url._host!, url._port);
    case 'file':
      // Unfortunate as it is, this is left as an exercise to the reader. When in doubt, return a new opaque origin.
      return OPAQUE_ORIGIN;
    default:
      // Return a new opaque origin.
      return OPAQUE_ORIGIN;
  }
}

function isURL(x: any): x is URL {
  if (x == null) {
    return false;
  }
  if (!(x instanceof URL)) {
    return false;
  }
  if (typeof x._url !== 'object') {
    // Bail out if internal URL record is missing
    return false;
  }
  return true;
}

export class URL {
  /** @internal */
  _url: UrlRecord;
  /** @internal */
  private readonly _query: URLSearchParams;

  constructor(url: string, base?: string | URL) {
    // 1. Let parsedBase be null.
    let parsedBase: UrlRecord | null = null;
    // 2. If base is given, then:
    if (base != null) {
      if (isURL(base)) {
        // Shortcut: if base is a URL, copy URL record
        parsedBase = base._url;
      } else {
        try {
          // 1. Let parsedBase be the result of running the basic URL parser on base.
          parsedBase = parse(String(base), null);
        } catch (e) {
          // 2. If parsedBase is failure, then throw a TypeError exception.
          throw new TypeError(`Invalid base URL: ${e.message}`);
        }
      }
    }
    let parsedURL: UrlRecord;
    try {
      // 3. Let parsedURL be the result of running the basic URL parser on url with parsedBase.
      parsedURL = parse(String(url), parsedBase);
    } catch (e) {
      // 4. If parsedURL is failure, throw a TypeError exception.
      throw new TypeError(`Invalid URL: ${e.message}`);
    }
    // 5. Let query be parsedURL’s query, if that is non-null, and the empty string otherwise.
    // Note: we keep the null to skip query parsing in newURLSearchParams
    const query = parsedURL._query;
    // 6. Let result be a new URL object.
    // 7. Set result’s url to parsedURL.
    this._url = parsedURL;
    // 8. Set result’s query object to a new URLSearchParams object using query,
    // and then set that query object’s url object to result.
    this._query = newURLSearchParams(query);
    this._query._url = this;
    // 9. Return result.
  }

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.href;
  }

  get href(): string {
    return serializeUrl(this._url);
  }

  set href(href: string) {
    let parsedURL: UrlRecord;
    try {
      // 1. Let parsedURL be the result of running the basic URL parser on the given value.
      parsedURL = parse(String(href), null);
    } catch (e) {
      // 2. If parsedURL is failure, throw a TypeError exception.
      throw new TypeError(`Invalid URL: ${e.message}`);
    }
    // 3. Set context object’s url to parsedURL.
    this._url = parsedURL;
    // 4. Empty context object’s query object’s list.
    emptyParams(this._query);
    // 5. Let query be context object’s url’s query.
    const query = this._url._query;
    // 6. If query is non-null, then set context object’s query object’s list to the result of parsing query.
    if (null !== query) {
      setParamsQuery(this._query, query);
    }
  }

  get origin(): string {
    return getOrigin(this._url);
  }

  get protocol(): string {
    return this._url._scheme + ':';
  }

  set protocol(protocol: string) {
    parseSilent(protocol + ':', null, this._url, ParserState.SCHEME_START);
  }

  get username(): string {
    return this._url._username;
  }

  set username(username: string) {
    if (cannotHaveUsernamePasswordPort(this._url)) {
      return;
    }
    // https://url.spec.whatwg.org/#set-the-username
    // 1. Set url’s username to the empty string.
    // 2. For each code point in username, UTF-8 percent encode it using the userinfo percent-encode set,
    //    and append the result to url’s username.
    this._url._username = utf8PercentEncodeString(username, isUserinfoPercentEncode);
  }

  get password(): string {
    return this._url._password;
  }

  set password(password: string) {
    if (cannotHaveUsernamePasswordPort(this._url)) {
      return;
    }
    // https://url.spec.whatwg.org/#set-the-password
    // 1. Set url’s password to the empty string.
    // 2. For each code point in password, UTF-8 percent encode it using the userinfo percent-encode set,
    //    and append the result to url’s password.
    this._url._password = utf8PercentEncodeString(password, isUserinfoPercentEncode);
  }

  get host(): string {
    // 1. Let url be context object’s url.
    const url = this._url;
    // 2. If url’s host is null, return the empty string.
    const host = url._host;
    if (null === host) {
      return '';
    }
    // 3. If url’s port is null, return url’s host, serialized.
    // 4. Return url’s host, serialized, followed by U+003A (:) and url’s port, serialized.
    const port = url._port;
    let result = serializeHost(host);
    if (null !== port) {
      result += `:${port}`;
    }
    return result;
  }

  set host(host: string) {
    // 1. If context object’s url’s cannot-be-a-base-URL flag is set, then return.
    if (this._url._cannotBeABaseURL) {
      return;
    }
    // 2. Basic URL parse the given value with context object’s url as url and host state as state override.
    parseSilent(host, null, this._url, ParserState.HOST);
  }

  get hostname(): string {
    // 1. If context object’s url’s host is null, return the empty string.
    const host = this._url._host;
    if (null === host) {
      return '';
    }
    // 2. Return context object’s url’s host, serialized.
    return serializeHost(host);
  }

  set hostname(hostname: string) {
    // 1. If context object’s url’s cannot-be-a-base-URL flag is set, then return.
    if (this._url._cannotBeABaseURL) {
      return;
    }
    // 2. Basic URL parse the given value with context object’s url as url and hostname state as state override.
    parseSilent(hostname, null, this._url, ParserState.HOSTNAME);
  }

  get port(): string {
    // 1. If context object’s url’s port is null, return the empty string.
    const port = this._url._port;
    if (null === port) {
      return '';
    }
    // 2. Return context object’s url’s port, serialized.
    return `${port}`;
  }

  set port(port: string) {
    // 1. If context object’s url cannot have a username/password/port, then return.
    if (cannotHaveUsernamePasswordPort(this._url)) {
      return;
    }
    // 2. If the given value is the empty string, then set context object’s url’s port to null.
    if ('' === port) {
      this._url._port = null;
    }
    // 3. Otherwise, basic URL parse the given value with context object’s url as url and port state as state override.
    else {
      parseSilent(port, null, this._url, ParserState.PORT);
    }
  }

  get pathname(): string {
    // 1. If context object’s url’s cannot-be-a-base-URL flag is set, then return context object’s url’s path[0].
    const path = this._url._path;
    if (this._url._cannotBeABaseURL) {
      return path[0];
    }
    // 2. If context object’s url’s path is empty, then return the empty string.
    if (path.length === 0) {
      return '';
    }
    // 3. Return U+002F (/), followed by the strings in context object’s url’s path (including empty strings), if any,
    //    separated from each other by U+002F (/).
    return '/' + path.join('/');
  }

  set pathname(pathname: string) {
    // 1. If context object’s url’s cannot-be-a-base-URL flag is set, then return.
    if (this._url._cannotBeABaseURL) {
      return;
    }
    // 2. Empty context object’s url’s path.
    this._url._path.length = 0;
    // 3. Basic URL parse the given value with context object’s url as url and path start state as state override.
    parseSilent(pathname, null, this._url, ParserState.PATH_START);
  }

  get search(): string {
    // 1. If context object’s url’s query is either null or the empty string, return the empty string.
    const query = this._url._query;
    if (null === query || '' === query) {
      return '';
    }
    // 2. Return U+003F (?), followed by context object’s url’s query.
    return `?${query}`;
  }

  set search(search: string) {
    search = toUSVString(search);
    // 1. Let url be context object’s url.
    const url = this._url;
    // 2. If the given value is the empty string,
    //    set url’s query to null,
    //    empty context object’s query object’s list,
    //    and then return.
    if ('' === search) {
      url._query = null;
      emptyParams(this._query);
      return;
    }
    // 3. Let input be the given value with a single leading U+003F (?) removed, if any.
    if ('?' === search[0]) {
      search = search.slice(1);
    }
    // 4. Set url’s query to the empty string.
    url._query = '';
    // 5. Basic URL parse input with url as url and query state as state override.
    parseSilent(search, null, url, ParserState.QUERY);
    // 6. Set context object’s query object’s list to the result of parsing input.
    setParamsQuery(this._query, search);
  }

  get searchParams(): URLSearchParams {
    // Return context object’s query object.
    return this._query;
  }

  get hash(): string {
    // 1. If context object’s url’s fragment is either null or the empty string, return the empty string.
    const fragment = this._url._fragment;
    if (null === fragment || '' === fragment) {
      return '';
    }
    // 2. Return U+0023 (#), followed by context object’s url’s fragment.
    return `#${fragment}`;
  }

  set hash(hash: string) {
    // 1. If the given value is the empty string, then set context object’s url’s fragment to null and return.
    if ('' === hash) {
      this._url._fragment = null;
      return;
    }
    // 2. Let input be the given value with a single leading U+0023 (#) removed, if any.
    if ('#' === hash[0]) {
      hash = hash.slice(1);
    }
    // 3. Set context object’s url’s fragment to the empty string.
    this._url._fragment = '';
    // 4. Basic URL parse input with context object’s url as url and fragment state as state override.
    parseSilent(hash, null, this._url, ParserState.FRAGMENT);
  }
}
