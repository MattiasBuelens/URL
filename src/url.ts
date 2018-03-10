/* Any copyright is dedicated to the Public Domain.
* http://creativecommons.org/publicdomain/zero/1.0/ */

const relative = Object.create(null);
relative['ftp'] = 21;
relative['file'] = 0;
relative['gopher'] = 70;
relative['http'] = 80;
relative['https'] = 443;
relative['ws'] = 80;
relative['wss'] = 443;

const relativePathDotMapping = Object.create(null);
relativePathDotMapping['%2e'] = '.';
relativePathDotMapping['.%2e'] = '..';
relativePathDotMapping['%2e.'] = '..';
relativePathDotMapping['%2e%2e'] = '..';

function isRelativeScheme(scheme: string): boolean {
  return relative[scheme] !== undefined;
}

function invalid(url: jURL) {
  clear(url);
  url._isInvalid = true;
}

function IDNAToASCII(url: jURL, h: string): string {
  if ('' == h) {
    invalid(url);
  }
  // XXX
  return h.toLowerCase();
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

const EOF = undefined,
    ALPHA = /[a-zA-Z]/,
    ALPHANUMERIC = /[a-zA-Z0-9\+\-\.]/;

const enum ParserState {
  SCHEME_START,
  SCHEME,
  SCHEME_DATA,
  NO_SCHEME,
  RELATIVE_OR_AUTHORITY,
  RELATIVE,
  RELATIVE_SLASH,
  AUTHORITY_FIRST_SLASH,
  AUTHORITY_SECOND_SLASH,
  AUTHORITY_IGNORE_SLASHES,
  AUTHORITY,
  FILE_HOST,
  HOST,
  HOSTNAME,
  PORT,
  RELATIVE_PATH_START,
  RELATIVE_PATH,
  QUERY,
  FRAGMENT
}

function parse(url: jURL, input: string, stateOverride?: ParserState, base?: jURL) {
  let state: ParserState = stateOverride || ParserState.SCHEME_START,
      cursor = 0,
      buffer = '',
      seenAt = false,
      seenBracket = false,
      errors: string[] = [];

  function err(message: string) {
    errors.push(message);
  }

  loop: while ((input[cursor - 1] != EOF || cursor == 0) && !url._isInvalid) {
    const c = input[cursor];
    switch (state) {
      case ParserState.SCHEME_START:
        if (c && ALPHA.test(c)) {
          buffer += c.toLowerCase(); // ASCII-safe
          state = ParserState.SCHEME;
        } else if (!stateOverride) {
          buffer = '';
          state = ParserState.NO_SCHEME;
          continue;
        } else {
          err('Invalid scheme.');
          break loop;
        }
        break;

      case ParserState.SCHEME:
        if (c && ALPHANUMERIC.test(c)) {
          buffer += c.toLowerCase(); // ASCII-safe
        } else if (':' == c) {
          url._scheme = buffer;
          buffer = '';
          if (stateOverride) {
            break loop;
          }
          if (isRelativeScheme(url._scheme)) {
            url._isRelative = true;
          }
          if ('file' == url._scheme) {
            state = ParserState.RELATIVE;
          } else if (url._isRelative && base && base._scheme == url._scheme) {
            state = ParserState.RELATIVE_OR_AUTHORITY;
          } else if (url._isRelative) {
            state = ParserState.AUTHORITY_FIRST_SLASH;
          } else {
            state = ParserState.SCHEME_DATA;
          }
        } else if (!stateOverride) {
          buffer = '';
          cursor = 0;
          state = ParserState.NO_SCHEME;
          continue;
        } else if (EOF == c) {
          break loop;
        } else {
          err('Code point not allowed in scheme: ' + c);
          break loop;
        }
        break;

      case ParserState.SCHEME_DATA:
        if ('?' == c) {
          url._query = '?';
          state = ParserState.QUERY;
        } else if ('#' == c) {
          url._fragment = '#';
          state = ParserState.FRAGMENT;
        } else {
          // XXX error handling
          if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
            url._schemeData += percentEscape(c);
          }
        }
        break;

      case ParserState.NO_SCHEME:
        if (!base || !(isRelativeScheme(base._scheme))) {
          err('Missing scheme.');
          invalid(url);
        } else {
          state = ParserState.RELATIVE;
          continue;
        }
        break;

      case ParserState.RELATIVE_OR_AUTHORITY:
        if ('/' == c && '/' == input[cursor + 1]) {
          state = ParserState.AUTHORITY_IGNORE_SLASHES;
        } else {
          err('Expected /, got: ' + c);
          state = ParserState.RELATIVE;
          continue;
        }
        break;

      case ParserState.RELATIVE:
        url._isRelative = true;
        if ('file' != url._scheme)
          url._scheme = base._scheme;
        if (EOF == c) {
          url._host = base._host;
          url._port = base._port;
          url._path = base._path.slice();
          url._query = base._query;
          url._username = base._username;
          url._password = base._password;
          break loop;
        } else if ('/' == c || '\\' == c) {
          if ('\\' == c)
            err('\\ is an invalid code point.');
          state = ParserState.RELATIVE_SLASH;
        } else if ('?' == c) {
          url._host = base._host;
          url._port = base._port;
          url._path = base._path.slice();
          url._query = '?';
          url._username = base._username;
          url._password = base._password;
          state = ParserState.QUERY;
        } else if ('#' == c) {
          url._host = base._host;
          url._port = base._port;
          url._path = base._path.slice();
          url._query = base._query;
          url._fragment = '#';
          url._username = base._username;
          url._password = base._password;
          state = ParserState.FRAGMENT;
        } else {
          const nextC = input[cursor + 1];
          const nextNextC = input[cursor + 2];
          if (
              'file' != url._scheme || !ALPHA.test(c) ||
              (nextC != ':' && nextC != '|') ||
              (EOF != nextNextC && '/' != nextNextC && '\\' != nextNextC && '?' != nextNextC && '#' != nextNextC)) {
            url._host = base._host;
            url._port = base._port;
            url._username = base._username;
            url._password = base._password;
            url._path = base._path.slice();
            url._path.pop();
          }
          state = ParserState.RELATIVE_PATH;
          continue;
        }
        break;

      case ParserState.RELATIVE_SLASH:
        if ('/' == c || '\\' == c) {
          if ('\\' == c) {
            err('\\ is an invalid code point.');
          }
          if ('file' == url._scheme) {
            state = ParserState.FILE_HOST;
          } else {
            state = ParserState.AUTHORITY_IGNORE_SLASHES;
          }
        } else {
          if ('file' != url._scheme) {
            url._host = base._host;
            url._port = base._port;
            url._username = base._username;
            url._password = base._password;
          }
          state = ParserState.RELATIVE_PATH;
          continue;
        }
        break;

      case ParserState.AUTHORITY_FIRST_SLASH:
        if ('/' == c) {
          state = ParserState.AUTHORITY_SECOND_SLASH;
        } else {
          err("Expected '/', got: " + c);
          state = ParserState.AUTHORITY_IGNORE_SLASHES;
          continue;
        }
        break;

      case ParserState.AUTHORITY_SECOND_SLASH:
        state = ParserState.AUTHORITY_IGNORE_SLASHES;
        if ('/' != c) {
          err("Expected '/', got: " + c);
          continue;
        }
        break;

      case ParserState.AUTHORITY_IGNORE_SLASHES:
        if ('/' != c && '\\' != c) {
          state = ParserState.AUTHORITY;
          continue;
        } else {
          err('Expected authority, got: ' + c);
        }
        break;

      case ParserState.AUTHORITY:
        if ('@' == c) {
          if (seenAt) {
            err('@ already seen.');
            buffer += '%40';
          }
          seenAt = true;
          for (let i = 0; i < buffer.length; i++) {
            const cp = buffer[i];
            if ('\t' == cp || '\n' == cp || '\r' == cp) {
              err('Invalid whitespace in authority.');
              continue;
            }
            // XXX check URL code points
            if (':' == cp && null === url._password) {
              url._password = '';
              continue;
            }
            const tempC = percentEscape(cp);
            (null !== url._password) ? url._password += tempC : url._username += tempC;
          }
          buffer = '';
        } else if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
          cursor -= buffer.length;
          buffer = '';
          state = ParserState.HOST;
          continue;
        } else {
          buffer += c;
        }
        break;

      case ParserState.FILE_HOST:
        if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
          if (buffer.length == 2 && ALPHA.test(buffer[0]) && (buffer[1] == ':' || buffer[1] == '|')) {
            state = ParserState.RELATIVE_PATH;
          } else if (buffer.length == 0) {
            state = ParserState.RELATIVE_PATH_START;
          } else {
            url._host = IDNAToASCII(url, buffer);
            buffer = '';
            state = ParserState.RELATIVE_PATH_START;
          }
          continue;
        } else if ('\t' == c || '\n' == c || '\r' == c) {
          err('Invalid whitespace in file host.');
        } else {
          buffer += c;
        }
        break;

      case ParserState.HOST:
      case ParserState.HOSTNAME:
        if (':' == c && !seenBracket) {
          // XXX host parsing
          url._host = IDNAToASCII(url, buffer);
          buffer = '';
          state = ParserState.PORT;
          if (ParserState.HOSTNAME == stateOverride) {
            break loop;
          }
        } else if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
          url._host = IDNAToASCII(url, buffer);
          buffer = '';
          state = ParserState.RELATIVE_PATH_START;
          if (stateOverride) {
            break loop;
          }
          continue;
        } else if ('\t' != c && '\n' != c && '\r' != c) {
          if ('[' == c) {
            seenBracket = true;
          } else if (']' == c) {
            seenBracket = false;
          }
          buffer += c;
        } else {
          err('Invalid code point in host/hostname: ' + c);
        }
        break;

      case ParserState.PORT:
        if (/[0-9]/.test(c)) {
          buffer += c;
        } else if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c || stateOverride) {
          if ('' != buffer) {
            const temp = parseInt(buffer, 10);
            if (temp != relative[url._scheme]) {
              url._port = temp + '';
            }
            buffer = '';
          }
          if (stateOverride) {
            break loop;
          }
          state = ParserState.RELATIVE_PATH_START;
          continue;
        } else if ('\t' == c || '\n' == c || '\r' == c) {
          err('Invalid code point in port: ' + c);
        } else {
          invalid(url);
        }
        break;

      case ParserState.RELATIVE_PATH_START:
        if ('\\' == c)
          err("'\\' not allowed in path.");
        state = ParserState.RELATIVE_PATH;
        if ('/' != c && '\\' != c) {
          continue;
        }
        break;

      case ParserState.RELATIVE_PATH:
        if (EOF == c || '/' == c || '\\' == c || (!stateOverride && ('?' == c || '#' == c))) {
          if ('\\' == c) {
            err('\\ not allowed in relative path.');
          }
          let tmp;
          if (tmp = relativePathDotMapping[buffer.toLowerCase()]) {
            buffer = tmp;
          }
          if ('..' == buffer) {
            url._path.pop();
            if ('/' != c && '\\' != c) {
              url._path.push('');
            }
          } else if ('.' == buffer && '/' != c && '\\' != c) {
            url._path.push('');
          } else if ('.' != buffer) {
            if ('file' == url._scheme && url._path.length == 0 && buffer.length == 2 && ALPHA.test(buffer[0]) && buffer[1] == '|') {
              buffer = buffer[0] + ':';
            }
            url._path.push(buffer);
          }
          buffer = '';
          if ('?' == c) {
            url._query = '?';
            state = ParserState.QUERY;
          } else if ('#' == c) {
            url._fragment = '#';
            state = ParserState.FRAGMENT;
          }
        } else if ('\t' != c && '\n' != c && '\r' != c) {
          buffer += percentEscape(c);
        }
        break;

      case ParserState.QUERY:
        if (!stateOverride && '#' == c) {
          url._fragment = '#';
          state = ParserState.FRAGMENT;
        } else if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
          url._query += percentEscapeQuery(c);
        }
        break;

      case ParserState.FRAGMENT:
        if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
          url._fragment += c;
        }
        break;
    }

    cursor++;
  }
}

function clear(url: jURL) {
  url._scheme = '';
  url._schemeData = '';
  url._username = '';
  url._password = null;
  url._host = '';
  url._port = '';
  url._path = [];
  url._query = '';
  url._fragment = '';
  url._isInvalid = false;
  url._isRelative = false;
}

// Does not process domain names or IP addresses.
// Does not handle encoding for the query parameter.
class jURL {
  _url: string;
  _scheme: string;
  _schemeData: string;
  _username: string;
  _password: string | null;
  _host: string;
  _port: string;
  _path: string[];
  _query: string;
  _fragment: string;
  _isInvalid: boolean;
  _isRelative: boolean;

  constructor(url: string, base?: string | jURL /* , encoding */) {
    if (base !== undefined && !(base instanceof jURL))
      base = new jURL(String(base));

    this._url = url;
    clear(this);

    const input = url.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
    // encoding = encoding || 'utf-8'

    parse(this, input, null, base);
  }

  toString(): string {
    return this.href;
  }

  get href(): string {
    if (this._isInvalid)
      return this._url;

    let authority = '';
    if ('' != this._username || null != this._password) {
      authority = this._username +
          (null != this._password ? ':' + this._password : '') + '@';
    }

    return this.protocol +
        (this._isRelative ? '//' + authority + this.host : '') +
        this.pathname + this._query + this._fragment;
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
    parse(this, pathname, ParserState.RELATIVE_PATH_START);
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

  set hash(hash): string {
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

export { jURL };
