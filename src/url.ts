/* Any copyright is dedicated to the Public Domain.
* http://creativecommons.org/publicdomain/zero/1.0/ */

const defaultPorts = Object.create(null);
defaultPorts['ftp'] = 21;
defaultPorts['file'] = 0;
defaultPorts['gopher'] = 70;
defaultPorts['http'] = 80;
defaultPorts['https'] = 443;
defaultPorts['ws'] = 80;
defaultPorts['wss'] = 443;

function isSingleDotPathSegment(input: string): boolean {
  if (input === '.') {
    return true;
  }
  input = input.toLowerCase();
  return '%2e' === input;
}

function isDoubleDotPathSegment(input: string): boolean {
  if (input === '..') {
    return true;
  }
  input = input.toLowerCase();
  return '.%2e' === input ||
      '%2e.' === input ||
      '%2e%2e' === input;
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

function parseHost(input: string, isSpecial: boolean): string | undefined {
  // 1. If input starts with U+005B ([), then:
  if ('[' === input[0]) {
    // 1. If input does not end with U+005D (]), validation error, return failure.
    if (']' !== input[input.length - 1]) {
      return undefined;
    }
    // 2. Return the result of IPv6 parsing input with its leading U+005B ([) and trailing U+005D (]) removed.
    return parseIPv6(input.slice(1, -1));
  }
  // 2. If isSpecial is false, then return the result of opaque-host parsing input.
  if (!isSpecial) {
    return parseOpaqueHost(input);
  }
  // TODO steps 3 to 9
  return input;
}

function parseOpaqueHost(input: string): string | undefined {
  // TODO 1. If input contains a forbidden host code point excluding U+0025 (%), validation error, return failure.
  // 2. Let output be the empty string.
  let output = '';
  // 3. For each code point in input, UTF-8 percent encode it using the C0 control percent-encode set,
  // and append the result to output.
  for (let i = 0; i < input.length; i++) {
    output += percentEscape(input[i]);
  }
  // 4. Return output.
  return output;
}

function parseIPv6(input: string): string {
  // TODO
  return input;
}

function percentEscape(c: string): string {
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

function percentEscapeQuery(c: string) {
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

function startsWithWindowsDriveLetter(input: string, cursor: number): boolean {
  // its length is greater than or equal to 2
  const length = input.length - cursor;
  if (!(length >= 2)) {
    return false;
  }
  // its first two code points are a Windows drive letter
  if (!isWindowsDriveLetter(input.substr(cursor, 2))) {
    return false;
  }
  // its length is 2 or its third code point is U+002F (/), U+005C (\), U+003F (?), or U+0023 (#).
  if (length !== 2) {
    const c = input[cursor + 2];
    if (!('/' === c || '\\' === c || '?' === c || '#' === c)) {
      return false;
    }
  }
  return true;
}

function isWindowsDriveLetter(input: string): boolean {
  return input.length === 2
      && ALPHA.test(input[0])
      && (':' === input[1] || '|' === input[1]);
}

function isNormalizedWindowsDriveLetter(input: string): boolean {
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

const EOF = undefined;
const ALPHA = /[a-zA-Z]/;
const DIGIT = /[0-9]/;
const HEX_DIGIT = /[0-9a-fA-F]/;
const ALPHANUMERIC = /[a-zA-Z0-9+\-.]/;
const TAB_OR_NEWLINE = /\t|\n|\r/g;

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

function parse(url: UrlRecord, input: string, stateOverride?: ParserState | null, base?: UrlRecord | null): boolean {
  let errors: string[] = [];

  function err(message: string) {
    errors.push(message);
  }

  // 2. If input contains any ASCII tab or newline, validation error.
  if (TAB_OR_NEWLINE.test(input)) {
    err('Invalid tab or newline');
    // 3. Remove all ASCII tab or newline from input.
    input = input.replace(TAB_OR_NEWLINE, '');
  }

  // 4. Let state be state override if given, or scheme start state otherwise.
  let state: ParserState = stateOverride || ParserState.SCHEME_START;
  // 5. If base is not given, set it to null.
  base = base || null;
  // 6. Let encoding be UTF-8.
  // 7. If encoding override is given, set encoding to the result of getting an output encoding from encoding override.
  // TODO encoding
  // 8. Let buffer be the empty string.
  let buffer = '';
  // 9. Let the @ flag, [] flag, and passwordTokenSeenFlag be unset.
  let seenAt = false;
  let seenBracket = false;
  let passwordTokenSeenFlag = false;
  // 10. Let pointer be a pointer to first code point in input.
  let cursor = 0;

  // Keep running the following state machine by switching on state.
  // If after a run pointer points to the EOF code point, go to the next step.
  // Otherwise, increase pointer by one and continue with the state machine.
  while (input[cursor - 1] !== EOF || cursor === 0) {
    const c = input[cursor];
    switch (state) {
      case ParserState.SCHEME_START:
        // 1. If c is an ASCII alpha, append c, lowercased, to buffer, and set state to scheme state.
        if (c && ALPHA.test(c)) {
          buffer += c.toLowerCase(); // ASCII-safe
          state = ParserState.SCHEME;
        }
        // 2. Otherwise, if state override is not given, set state to no scheme state, and decrease pointer by one.
        else if (!stateOverride) {
          buffer = '';
          state = ParserState.NO_SCHEME;
          continue;
        }
        // 3. Otherwise, validation error, return failure.
        else {
          err('Invalid scheme.');
          return false;
        }
        break;

      case ParserState.SCHEME:
        // 1. If c is an ASCII alphanumeric, U+002B (+), U+002D (-), or U+002E (.), append c, lowercased, to buffer.
        if (c && ALPHANUMERIC.test(c)) {
          buffer += c.toLowerCase(); // ASCII-safe
        }
        // 2. Otherwise, if c is U+003A (:), then:
        else if (':' === c) {
          // 1. If state override is given, then:
          if (stateOverride) {
            // 1. If url’s scheme is a special scheme and buffer is not a special scheme, then return.
            if (isSpecialScheme(url._scheme) && !isSpecialScheme(buffer)) {
              return true;
            }
            // 2. If url’s scheme is not a special scheme and buffer is a special scheme, then return.
            if (!isSpecialScheme(url._scheme) && isSpecialScheme(buffer)) {
              return true;
            }
            // 3. If url includes credentials or has a non-null port, and buffer is "file", then return.
            if ((includesCredentials(url) || url._port !== null) && 'file' === buffer) {
              return true;
            }
            // 4. If url’s scheme is "file" and its host is an empty host or null, then return.
            if (url._scheme === 'file' && (url._host === '' || url._host === null)) {
              return true;
            }
          }
          // 2. Set url’s scheme to buffer.
          url._scheme = buffer;
          // 3. If state override is given, then:
          if (stateOverride) {
            // 1. If url’s port is url’s scheme’s default port, then set url’s port to null.
            if (isSpecial(url) && url._port === defaultPorts[url._scheme]) {
              url._port = null;
            }
            // 2. Return.
            return true;
          }
          // 4. Set buffer to the empty string.
          buffer = '';
          // 5. If url’s scheme is "file", then:
          if ('file' === url._scheme) {
            // 1. If remaining does not start with "//", validation error.
            if ('/' !== input[cursor + 1] || '/' !== input[cursor + 2]) {
              err(`Expected '//', got '${input.substr(cursor + 1, 2)}'`);
            }
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
          else if ('/' === input[cursor + 1]) {
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
        else if (!stateOverride) {
          buffer = '';
          state = ParserState.NO_SCHEME;
          cursor = 0;
          continue;
        }
        // 4. Otherwise, validation error, return failure.
        else {
          err('Code point not allowed in scheme: ' + c);
          return false;
        }
        break;

        // case ParserState.SCHEME_DATA:
        //   if ('?' == c) {
        //     url._query = '?';
        //     state = ParserState.QUERY;
        //   } else if ('#' == c) {
        //     url._fragment = '#';
        //     state = ParserState.FRAGMENT;
        //   } else {
        //     // XXX error handling
        //     if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
        //       url._schemeData += percentEscape(c);
        //     }
        //   }
        //   break;

      case ParserState.NO_SCHEME:
        // 1. If base is null, or base’s cannot-be-a-base-URL flag is set
        // and c is not U+0023 (#), validation error, return failure.
        if (!base || (base._cannotBeABaseURL && '#' !== c)) {
          err(''); // TODO
          return false;
        }
        // 2. Otherwise, if base’s cannot-be-a-base-URL flag is set and c is U+0023 (#),
        // set url’s scheme to base’s scheme, url’s path to a copy of base’s path,
        // url’s query to base’s query, url’s fragment to the empty string,
        // set url’s cannot-be-a-base-URL flag, and set state to fragment state.
        else if (base._cannotBeABaseURL && '#' === c) {
          url._scheme = base._scheme;
          url._path = base._path.slice();
          url._query = base._query;
          url._fragment = '';
          url._cannotBeABaseURL = true;
          state = ParserState.FRAGMENT;
        }
        // 3. Otherwise, if base’s scheme is not "file",
        // set state to relative state and decrease pointer by one.
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
        if ('/' === c && '/' === input[cursor + 1]) {
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
        }
        // Otherwise, validation error, set state to relative state and decrease pointer by one.
        else {
          err(`Expected '/', got '${c}'`);
          state = ParserState.RELATIVE;
          cursor -= 1;
        }
        break;

      case ParserState.PATH_OR_AUTHORITY:
        // If c is U+002F (/), then set state to authority state.
        if ('/' === c) {
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
        } else if ('/' === c) {
          // Set state to relative slash state.
          state = ParserState.RELATIVE_SLASH;
        } else if ('?' === c) {
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
        } else if ('#' === c) {
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
          // If url is special and c is U+005C (\), validation error,
          // set state to relative slash state.
          if ('\\' === c && isSpecial(url)) {
            err('\\ is an invalid code point.');
            state = ParserState.RELATIVE_SLASH;
          }
          // Otherwise, run these steps:
          else {
            // 1. Set url’s username to base’s username,
            // url’s password to base’s password,
            // url’s host to base’s host,
            // url’s port to base’s port,
            // url’s path to a copy of base’s path,
            // and then remove url’s path’s last item, if any.
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
        if (isSpecial(url) && ('/' === c || '\\' === c)) {
          // 1. If c is U+005C (\), validation error.
          if ('\\' == c) {
            err('\\ is an invalid code point.');
          }
          // 2. Set state to special authority ignore slashes state.
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
        }
        // Otherwise, if c is U+002F (/), then set state to authority state.
        else if ('/' === c) {
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
        if ('/' === c && '/' === input[cursor + 1]) {
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
          cursor += 1;
        }
        // Otherwise, validation error,
        // set state to special authority ignore slashes state,
        // and decrease pointer by one.
        else {
          err(`Expected '//', got '${input.substr(cursor, 2)}'`);
          state = ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES;
          continue;
        }
        break;

      case ParserState.SPECIAL_AUTHORITY_IGNORE_SLASHES:
        // If c is neither U+002F (/) nor U+005C (\),
        // then set state to authority state and decrease pointer by one.
        if ('/' !== c && '\\' !== c) {
          state = ParserState.AUTHORITY;
          cursor -= 1;
        }
        // Otherwise, validation error.
        else {
          err(`Expected authority, got: ${c}`);
        }
        break;

      case ParserState.AUTHORITY:
        // 1. If c is U+0040 (@), then:
        if ('@' === c) {
          // 1. Validation error.
          err('@ already seen.');
          // 2. If the @ flag is set, prepend "%40" to buffer.
          if (seenAt) {
            buffer = '%40' + buffer;
          }
          // 3. Set the @ flag.
          seenAt = true;
          // 4. For each codePoint in buffer:
          for (let i = 0; i < buffer.length; i++) {
            const codePoint = buffer[i];
            // 1. If codePoint is U+003A (:) and passwordTokenSeenFlag is unset,
            //    then set passwordTokenSeenFlag and continue.
            if (':' === codePoint && !passwordTokenSeenFlag) {
              passwordTokenSeenFlag = true;
              continue;
            }
            // 2. Let encodedCodePoints be the result of running UTF-8 percent encode codePoint
            //    using the userinfo percent-encode set.
            const encodedCodePoints = percentEscape(codePoint);
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
          buffer = '';
        }
        // 2. Otherwise, if one of the following is true:
        //    - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
        //    - url is special and c is U+005C (\)
        else if (
            (EOF === c || '/' === c || '?' === c || '#' === c) ||
            (isSpecial(url) && ('\\' === c))
        ) {
          // then:
          // 1. If @ flag is set and buffer is the empty string, validation error, return failure.
          if (seenAt && '' === buffer) {
            err(''); // TODO
            return false;
          }
          // 2. Decrease pointer by the number of code points in buffer plus one,
          // set buffer to the empty string, and set state to host state.
          cursor -= buffer.length + 1;
          buffer = '';
          state = ParserState.HOST;
        }
        // 3. Otherwise, append c to buffer.
        else {
          buffer += c;
        }
        break;

        // case ParserState.FILE_HOST:
        //   if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
        //     if (buffer.length == 2 && ALPHA.test(buffer[0]) && (buffer[1] == ':' || buffer[1] == '|')) {
        //       state = ParserState.RELATIVE_PATH;
        //     } else if (buffer.length == 0) {
        //       state = ParserState.RELATIVE_PATH_START;
        //     } else {
        //       url._host = IDNAToASCII(url, buffer);
        //       buffer = '';
        //       state = ParserState.RELATIVE_PATH_START;
        //     }
        //     continue;
        //   } else if ('\t' == c || '\n' == c || '\r' == c) {
        //     err('Invalid whitespace in file host.');
        //   } else {
        //     buffer += c;
        //   }
        //   break;

      case ParserState.HOST:
      case ParserState.HOSTNAME:
        // 1. If state override is given and url’s scheme is "file",
        // then decrease pointer by one and set state to file host state.
        if (stateOverride && 'file' === url._scheme) {
          cursor -= 1;
          state = ParserState.FILE_HOST;
        }
        // 2. Otherwise, if c is U+003A (:) and the [] flag is unset, then:
        else if (':' === c && !seenBracket) {
          // 1. If buffer is the empty string, validation error, return failure.
          if ('' === buffer) {
            err('Empty host');
            return false;
          }
          // 2. Let host be the result of host parsing buffer with url is special.
          const host = parseHost(buffer, isSpecial(url));
          // 3. If host is failure, then return failure.
          if (host === undefined) {
            return false;
          }
          // 4. Set url’s host to host, buffer to the empty string, and state to port state.
          url._host = host;
          buffer = '';
          state = ParserState.PORT;
          // 5. If state override is given and state override is hostname state, then return.
          if (stateOverride === ParserState.HOSTNAME) {
            return true;
          }

        }
        // 3. Otherwise, if one of the following is true:
        //    - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
        //    - url is special and c is U+005C (\)
        else if (
            (EOF === c || '/' === c || '?' === c || '#' === c) ||
            (isSpecial(url) && ('\\' === c))
        ) {
          // then decrease pointer by one, and then:
          cursor -= 1;
          // 1. If url is special and buffer is the empty string, validation error, return failure.
          if (isSpecial(url) && '' === buffer) {
            err(''); // TODO
            return false;
          }
          // 2. Otherwise, if state override is given, buffer is the empty string,
          //    and either url includes credentials or url’s port is non-null,
          //    validation error, return.
          if (stateOverride && '' === buffer && (includesCredentials(url) || url._port !== null)) {
            err(''); // TODO
            return true;
          }
          // 3. Let host be the result of host parsing buffer with url is special.
          const host = parseHost(buffer, isSpecial(url));
          // 4. If host is failure, then return failure.
          if (host === undefined) {
            return false;
          }
          // 5. Set url’s host to host, buffer to the empty string, and state to path start state.
          url._host = host;
          buffer = '';
          state = ParserState.PATH_START;
          // 6. If state override is given, then return.
          if (stateOverride) {
            return true;
          }
        }
        // 4. Otherwise:
        else {
          // 1. If c is U+005B ([), then set the [] flag.
          if ('[' === c) {
            seenBracket = true;
          }
          // 2. If c is U+005D (]), then unset the [] flag.
          else if (']' === c) {
            seenBracket = false;
          }
          // 3. Append c to buffer.
          buffer += c;
        }
        break;

      case ParserState.PORT:
        // 1. If c is an ASCII digit, append c to buffer.
        if (DIGIT.test(c)) {
          buffer += c;
        }
        // 2. Otherwise, if one of the following is true:
        //    - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
        //    - url is special and c is U+005C (\)
        //    - state override is given
        else if (
            (EOF === c || '/' === c || '?' === c || '#' === c) ||
            (isSpecial(url) && ('\\' === c)) ||
            stateOverride
        ) {
          // then:
          // 1. If buffer is not the empty string, then:
          if ('' != buffer) {
            // 1. Let port be the mathematical integer value that is represented
            // by buffer in radix-10 using ASCII digits for digits with values 0 through 9.
            const port = parseInt(buffer, 10);
            // 2. If port is greater than 2^16 − 1, validation error, return failure.
            if (port > 2 ** 16 - 1) {
              err('Invalid port');
              return false;
            }
            // 3. Set url’s port to null, if port is url’s scheme’s default port, and to port otherwise.
            url._port = (port === defaultPorts[url._scheme]) ? null : port;
            // 4. Set buffer to the empty string.
            buffer = '';
          }
          // 2. If state override is given, then return.
          if (stateOverride) {
            return true;
          }
          // 3. Set state to path start state, and decrease pointer by one.
          state = ParserState.PATH_START;
          cursor -= 1;
        }
        // 3. Otherwise, validation error, return failure.
        else {
          err(''); // TODO
          return false;
        }
        break;

      case ParserState.FILE:
        // 1. Set url’s scheme to "file".
        url._scheme = 'file';
        // 2. If c is U+002F (/) or U+005C (\), then:
        if ('/' === c || '\\' === c) {
          // 1. If c is U+005C (\), validation error.
          if ('\\' === c) {
            err(''); // TODO
          }
          // 2. Set state to file slash state.
          state = ParserState.FILE_SLASH;
        }
        // 3. Otherwise, if base is non-null and base’s scheme is "file", switch on c:
        else if (base && base._scheme === 'file') {
          if (EOF === c) {
            // Set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // and url’s query to base’s query.
            url._host = base!._host;
            url._path = base!._path.slice();
            url._query = base!._query;
          } else if ('?' === c) {
            // Set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // url’s query to the empty string,
            // and state to query state.
            url._host = base!._host;
            url._path = base!._path.slice();
            url._query = '';
            state = ParserState.QUERY;
          } else if ('#' === c) {
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
            // 1. If the substring from pointer in input does not start with a Windows drive letter,
            // then set url’s host to base’s host,
            // url’s path to a copy of base’s path,
            // and then shorten url’s path.
            if (!startsWithWindowsDriveLetter(input, cursor)) {
              url._host = base!._host;
              url._path = base!._path.slice();
              shortenPath(url);
            }
            // 2. Otherwise, validation error.
            else {
              err(''); // TODO
            }
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
        if ('/' === c || '\\' === c) {
          // 1. If c is U+005C (\), validation error.
          if ('\\' === c) {
            err(''); // TODO
          }
          // 2. Set state to file host state.
          state = ParserState.FILE_HOST;
        }
        // 2. Otherwise:
        else {
          // 1. If base is non-null, base’s scheme is "file",
          // and the substring from pointer in input does not start with a Windows drive letter,
          // then:
          if (base && 'file' === base._scheme && !startsWithWindowsDriveLetter(input, cursor)) {
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
        if (EOF === c || '/' === c || '\\' === c || '?' === c || '#' === c) {
          cursor -= 1;
          // 1. If state override is not given and buffer is a Windows drive letter,
          // validation error, set state to path state.
          if (!stateOverride && isWindowsDriveLetter(buffer)) {
            err(''); // TODO
            state = ParserState.PATH;
          }
          // 2. Otherwise, if buffer is the empty string, then:
          else if (buffer === '') {
            // 1. Set url’s host to the empty string.
            url._host = '';
            // 2. If state override is given, then return.
            if (stateOverride) {
              return true;
            }
            // 3. Set state to path start state.
            state = ParserState.PATH_START;
          }
          // 3. Otherwise, run these steps:
          else {
            // 1. Let host be the result of host parsing buffer with url is special.
            let host = parseHost(buffer, isSpecial(url));
            // 2. If host is failure, then return failure.
            if (host === undefined) {
              return false;
            }
            // 3. If host is "localhost", then set host to the empty string.
            if ('localhost' === host) {
              host = '';
            }
            // 4. Set url’s host to host.
            url._host = host;
            // 5. If state override is given, then return.
            if (stateOverride) {
              return true;
            }
            // 6. Set buffer to the empty string and state to path start state.
            buffer = '';
            state = ParserState.PATH_START;
          }
        }
        // 2. Otherwise, append c to buffer.
        else {
          buffer += c;
        }
        break;

      case ParserState.PATH_START:
        // 1. If url is special, then:
        if (isSpecial(url)) {
          // 1. If c is U+005C (\), validation error.
          if ('\\' == c) {
            err('\\ not allowed in path.');
          }
          // 2. Set state to path state.
          state = ParserState.PATH;
          // 3. If c is neither U+002F (/) nor U+005C (\), then decrease pointer by one.
          if ('/' !== c && '\\' !== c) {
            cursor -= 1;
          }
        }
        // 2. Otherwise, if state override is not given and c is U+003F (?),
        //    set url’s query to the empty string and state to query state.
        else if (!stateOverride && '?' === c) {
          url._query = '';
          state = ParserState.QUERY;
        }
        // 3. Otherwise, if state override is not given and c is U+0023 (#),
        //    set url’s fragment to the empty string and state to fragment state.
        else if (!stateOverride && '#' === c) {
          url._fragment = '';
          state = ParserState.FRAGMENT;
        }
        // 4. Otherwise, if c is not the EOF code point:
        else if (EOF !== c) {
          // 1. Set state to path state.
          state = ParserState.PATH;
          // 2. If c is not U+002F (/), then decrease pointer by one.
          if ('/' !== c) {
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
            (EOF === c || '/' === c) ||
            (isSpecial(url) && '\\' === c) ||
            (!stateOverride && ('?' == c || '#' == c))
        ) {
          // then:
          // 1. If url is special and c is U+005C (\), validation error.
          if (isSpecial(url) && '\\' === c) {
            err('\\ not allowed in path.');
          }
          // 2. If buffer is a double-dot path segment, shorten url’s path,
          //    and then if neither c is U+002F (/), nor url is special and c is U+005C (\),
          //    append the empty string to url’s path.
          if (isDoubleDotPathSegment(buffer)) {
            shortenPath(url);
            if ('/' !== c && !(isSpecial(url) && '\\' === c)) {
              url._path.push('');
            }
          }
          // 3. Otherwise, if buffer is a single-dot path segment
          //    and if neither c is U+002F (/), nor url is special and c is U+005C (\),
          //    append the empty string to url’s path.
          else if (
              isSingleDotPathSegment(buffer) &&
              ('/' !== c && !(isSpecial(url) && '\\' === c))
          ) {
            url._path.push('');
          }
          // 4. Otherwise, if buffer is not a single-dot path segment, then:
          else if (!isSingleDotPathSegment(buffer)) {
            // 1. If url’s scheme is "file", url’s path is empty, and buffer is a Windows drive letter, then:
            if ('file' === url._scheme && url._path.length === 0 && isWindowsDriveLetter(buffer)) {
              // 1. If url’s host is neither the empty string nor null,
              //    validation error, set url’s host to the empty string.
              if ('' !== url._host && null !== url._host) {
                err(''); // TODO
                url._host = '';
              }
              // 2. Replace the second code point in buffer with U+003A (:).
              // (Note that isWindowsDriveLetter(buffer) implies buffer.length === 2)
              buffer = buffer[0] + ':';
            }
            // 2. Append buffer to url’s path.
            url._path.push(buffer);
          }
          // 5. Set buffer to the empty string.
          buffer = '';
          // 6. If url’s scheme is "file" and c is the EOF code point, U+003F (?), or U+0023 (#),
          //    then while url’s path’s size is greater than 1 and url’s path[0] is the empty string,
          //    validation error, remove the first item from url’s path.
          if ('file' === url._scheme && (EOF === c || '?' == c || '#' == c)) {
            while (url._path.length > 1 && '' === url._path[0]) {
              err(''); // TODO
              url._path.shift();
            }
          }
          // 7. If c is U+003F (?), then set url’s query to the empty string and state to query state.
          if ('?' == c) {
            url._query = '';
            state = ParserState.QUERY;
          }
          // 8. If c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
          else if ('#' == c) {
            url._fragment = '';
            state = ParserState.FRAGMENT;
          }
        }
        // 2. Otherwise, run these steps:
        else {
          // 1. If c is not a URL code point and not U+0025 (%), validation error.
          // TODO Validate URL code point
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          if ('%' === c && !(HEX_DIGIT.test(input[cursor + 1]) && HEX_DIGIT.test(input[cursor + 2]))) {
            err('Invalid percent escape');
          }
          // 3. UTF-8 percent encode c using the path percent-encode set,
          //    and append the result to buffer.
          buffer += percentEscape(c);
        }
        break;

      case ParserState.CANNOT_BE_A_BASE_URL_PATH:
        // 1. If c is U+003F (?), then set url’s query to the empty string and state to query state.
        if ('?' === c) {
          url._query = '';
          state = ParserState.QUERY;
        }
        // 2. Otherwise, if c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
        else if ('#' === c) {
          url._fragment = '';
          state = ParserState.FRAGMENT;
        }
        // 3. Otherwise:
        else {
          // 1. If c is not the EOF code point, not a URL code point, and not U+0025 (%), validation error.
          // TODO Validate URL code point
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          if ('%' === c && !(HEX_DIGIT.test(input[cursor + 1]) && HEX_DIGIT.test(input[cursor + 2]))) {
            err('Invalid percent escape');
          }
          // 3. If c is not the EOF code point,
          //    UTF-8 percent encode c using the C0 control percent-encode set,
          //    and append the result to url’s path[0].
          if (EOF !== c) {
            url._path[0] += percentEscape(c);
          }
        }
        break;

      case ParserState.QUERY:
        // 1. If c is the EOF code point, or state override is not given and c is U+0023 (#), then:
        if (EOF === c || (!stateOverride && '#' === c)) {
          // 1. If url is not special or url’s scheme is either "ws" or "wss", set encoding to UTF-8.
          // 2. Set buffer to the result of encoding buffer using encoding.
          // TODO encoding
          // 3.  For each byte in buffer:
          for (let index = 0; index < buffer.length; index++) {
            url._query += percentEscapeQuery(buffer[index]);
          }
          // 4. Set buffer to the empty string.
          buffer = '';
          // 5. If c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
          if ('#' === c) {
            url._fragment = '';
            state = ParserState.FRAGMENT;
          }
        }
        // 2. Otherwise:
        else {
          // 1. If c is not a URL code point and not U+0025 (%), validation error.
          // TODO Validate URL code point
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          if ('%' === c && !(HEX_DIGIT.test(input[cursor + 1]) && HEX_DIGIT.test(input[cursor + 2]))) {
            err('Invalid percent escape');
          }
          // 3. Append c to buffer.
          buffer += c;
        }
        break;

      case ParserState.FRAGMENT:
        // Switching on c:
        if (EOF === c) {
          // Do nothing
        }
        else if ('\0' === c) {
          // Validation error.
          err('Invalid NULL character');
        }
        else {
          // 1. If c is not a URL code point and not U+0025 (%), validation error.
          // TODO Validate URL code point
          // 2. If c is U+0025 (%) and remaining does not start with two ASCII hex digits,
          //    validation error.
          if ('%' === c && !(HEX_DIGIT.test(input[cursor + 1]) && HEX_DIGIT.test(input[cursor + 2]))) {
            err('Invalid percent escape');
          }
          // 3. UTF-8 percent encode c using the fragment percent-encode set and append the result to url’s fragment.
          // TODO Handle encoding
          url._fragment += percentEscape(c);
        }
        break;
    }

    cursor++;
  }

  return true;
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
        output += ':' + url._password;
      }
      // 3. Append U+0040 (@) to output.
      output += '@';
    }
    // 3. Append url’s host, serialized, to output.
    output += serializeHost(url._host);
    // 4. If url’s port is non-null, append U+003A (:) followed by url’s port, serialized, to output.
    if (null !== url._port) {
      output += ':' + url._port;
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
    output += '/' + url._path.join('/');
  }
  // 6. If url’s query is non-null, append U+003F (?), followed by url’s query, to output.
  if (null !== url._query) {
    output += '?' + url._query;
  }
  // 7. If the exclude fragment flag is unset and url’s fragment is non-null, append U+0023 (#), followed by url’s fragment, to output.
  if (!excludeFragment && null !== url._fragment) {
    output += '#' + url._fragment;
  }
  // 8. Return output.
  return output;
}

function serializeHost(host: string): string {
  // TODO
  return host;
}

function clear(url: UrlRecord) {
  url._scheme = '';
  url._schemeData = '';
  url._username = '';
  url._password = '';
  url._host = null;
  url._port = null;
  url._path = [];
  url._query = null;
  url._fragment = null;
  url._cannotBeABaseURL = false;
}

// Does not process domain names or IP addresses.
// Does not handle encoding for the query parameter.
interface UrlRecord {
  _url: string;
  _scheme: string;
  _schemeData: string;
  _username: string;
  _password: string;
  _host: string | null;
  _port: number | null;
  _path: string[];
  _query: string | null;
  _fragment: string | null;
  _cannotBeABaseURL: boolean;
}

class URL {
  private _url: UrlRecord;

  constructor(url: string, base?: string | UrlRecord /* , encoding */) {
    // 1. Let parsedBase be null.
    let parsedBase: UrlRecord | null = null;
    // 2. If base is given, then:
    if (base !== undefined) {
      try {
        // 1. Let parsedBase be the result of running the basic URL parser on base.
        parsedBase = new URL(String(base));
      } catch (e) {
        // 2. If parsedBase is failure, then throw a TypeError exception.
        throw new TypeError('Invalid base URL');
      }
    }
    url = String(url);
    this._url = url;
    // 3. Let parsedURL be the result of running the basic URL parser on url with parsedBase.
    clear(this);
    const success = parse(this, url, null, parsedBase);
    // 4. If parsedURL is failure, throw a TypeError exception.
    if (!success) {
      throw new TypeError('Invalid URL');
    }
    // 5. Let query be parsedURL’s query, if that is non-null, and the empty string otherwise.
    const query = this._query || '';
    // 6. Let result be a new URL object.
    // 7. Set result’s url to parsedURL.
    // 8. Set result’s query object to a new URLSearchParams object using query, and then set that query object’s url object to result.
    // TODO URLSearchParams
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
    clear(this);
    parse(this, href);
  }

  get protocol(): string {
    return this._scheme + ':';
  }

  set protocol(protocol: string) {
    if (this._isInvalid)
      return;
    parse(this, protocol + ':', ParserState.SCHEME_START);
  }

  get host(): string {
    return this._isInvalid ? '' : this._port ?
        this._host + ':' + this._port : this._host;
  }

  set host(host: string) {
    if (this._isInvalid || !this._isRelative)
      return;
    parse(this, host, ParserState.HOST);
  }

  get hostname(): string {
    return this._host;
  }

  set hostname(hostname: string) {
    if (this._isInvalid || !this._isRelative)
      return;
    parse(this, hostname, ParserState.HOSTNAME);
  }

  get port(): string {
    return this._port;
  }

  set port(port: string) {
    if (this._isInvalid || !this._isRelative)
      return;
    parse(this, port, ParserState.PORT);
  }

  get pathname(): string {
    return this._isInvalid ? '' : this._isRelative ?
        '/' + this._path.join('/') : this._schemeData;
  }

  set pathname(pathname: string) {
    if (this._isInvalid || !this._isRelative)
      return;
    this._path = [];
    parse(this, pathname, ParserState.PATH_START);
  }

  get search(): string {
    return this._isInvalid || !this._query || '?' == this._query ?
        '' : this._query;
  }

  set search(search: string) {
    if (this._isInvalid || !this._isRelative)
      return;
    this._query = '?';
    if ('?' == search[0])
      search = search.slice(1);
    parse(this, search, ParserState.QUERY);
  }

  get hash(): string {
    return this._isInvalid || !this._fragment || '#' == this._fragment ?
        '' : this._fragment;
  }

  set hash(hash: string) {
    if (this._isInvalid)
      return;
    this._fragment = '#';
    if ('#' == hash[0])
      hash = hash.slice(1);
    parse(this, hash, ParserState.FRAGMENT);
  }

  get origin(): string {
    let host;
    if (this._isInvalid || !this._scheme) {
      return '';
    }
    // javascript: Gecko returns String(""), WebKit/Blink String("null")
    // Gecko throws error for "data://"
    // data: Gecko returns "", Blink returns "data://", WebKit returns "null"
    // Gecko returns String("") for file: mailto:
    // WebKit/Blink returns String("SCHEME://") for file: mailto:
    switch (this._scheme) {
      case 'data':
      case 'file':
      case 'javascript':
      case 'mailto':
        return 'null';
    }
    host = this.host;
    if (!host) {
      return '';
    }
    return this._scheme + '://' + host;
  }
}

export { URL as jURL };
