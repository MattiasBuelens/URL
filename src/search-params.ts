import { jURL, setUrlQuery } from "./url";
import { isSequence, replaceArray, sequenceToArray, stableSort, supportsSymbolIterator } from "./util";
import { parseUrlEncoded, serializeUrlEncoded } from "./urlencode";
import { toUSVString } from "./usvstring";

export type URLSearchParamsInit = Array<[string, string]> | { [name: string]: string } | string;

function compareParams([key1]: [string, string], [key2]: [string, string]): number {
  return (key1 === key2) ? 0 : (key1 < key2) ? -1 : 1;
}

// region URL internals

interface URLSearchParamsInternals {
  readonly _list: Array<[string, string]>;
  _url: jURL | null;
}

export function setParamsUrl(params: URLSearchParams, url: jURL) {
  (params as any as URLSearchParamsInternals)._url = url;
}

export function emptyParams(params: URLSearchParams) {
  (params as any as URLSearchParamsInternals)._list.length = 0;
}

export function setParamsQuery(params: URLSearchParams, query: string) {
  replaceArray((params as any as URLSearchParamsInternals)._list, parseUrlEncoded(query));
}

// https://url.spec.whatwg.org/#concept-urlsearchparams-new
// Optimization: only called from URL constructor, which only passes string or null
export function newURLSearchParams(init: string | null): URLSearchParams {
  // 1. Let query be a new URLSearchParams object.
  const query: URLSearchParams = new URLSearchParams();
  if (init !== null) {
    // 4. Otherwise, init is a string, then set query’s list to the result of parsing init.
    // Note: toUSVString is not needed
    setParamsQuery(query, init);
  }
  // 5. Return query.
  return query;
}

// endregion

export class URLSearchParams implements Iterable<[string, string]> {
  private readonly _list: Array<[string, string]> = [];
  private _url: jURL | null = null;

  // https://url.spec.whatwg.org/#concept-urlsearchparams-new
  // URL Standard says the default value is '', but as undefined and '' have
  // the same result, undefined is used to prevent unnecessary parsing.
  // Default parameter is necessary to keep URLSearchParams.length === 0 in
  // accordance with Web IDL spec.
  constructor(init: URLSearchParamsInit = undefined!) {
    if (init === null || init === undefined) {
      this._list = [];
    }
    else if (typeof init === 'object' || typeof init === 'function') {
      // 2. If init is a sequence, then for each pair in init:
      if (isSequence(init)) {
        for (const rawPair of sequenceToArray(init)) {
          const pair = sequenceToArray(rawPair);
          // 1. If pair does not contain exactly two items, then throw a TypeError.
          if (pair.length !== 2) {
            throw new TypeError('Invalid name-value pair');
          }
          // 2. Append a new name-value pair whose name is pair’s first item,
          //    and value is pair’s second item, to query’s list.
          this._list.push([toUSVString(pair[0]), toUSVString(pair[1])]);
        }
      }
      // 3. Otherwise, if init is a record, then for each name → value in init,
      //    append a new name-value pair whose name is name and value is value, to query’s list.
      else {
        for (let name in init) {
          if (Object.prototype.hasOwnProperty.call(init, name)) {
            this._list.push([toUSVString(name), toUSVString(init[name])]);
          }
        }
      }
    }
    // 4. Otherwise, init is a string, then set query’s list to the result of parsing init.
    else {
      init = toUSVString(init);
      // https://url.spec.whatwg.org/#dom-urlsearchparams-urlsearchparams
      // 1. If init is a string and starts with U+003F (?), remove the first code point from init.
      if (init.length > 0 && '?' === init[0]) {
        init = init.slice(1);
      }
      this._list = parseUrlEncoded(init);
    }
  }

  private _update(): void {
    if (!this._url) {
      return;
    }
    // 1. Let query be the serialization of URLSearchParams object’s list.
    let query: string | null = serializeUrlEncoded(this._list);
    // 2. If query is the empty string, then set query to null.
    if ('' === query) {
      query = null;
    }
    // 3. Set url object’s url’s query to query.
    setUrlQuery(this._url, query);
  }

  append(name: string, value: string): void {
    name = toUSVString(name);
    value = toUSVString(value);
    // 1. Append a new name-value pair whose name is name and value is value, to list.
    this._list.push([name, value]);
    // 2. Run the update steps.
    this._update();
  }

  delete(name: string): void {
    name = toUSVString(name);
    // 1. Remove all name-value pairs whose name is name from list.
    const list = this._list;
    let index = 0;
    while (index < list.length) {
      const tuple = list[index];
      if (tuple[0] === name) {
        list.splice(index, 1);
      } else {
        index++;
      }
    }
    // 2. Run the update steps.
    this._update();
  }

  get(name: string): string | null {
    name = toUSVString(name);
    // Return the value of the first name-value pair whose name is name in list, if there is such a pair,
    // and null otherwise.
    const list = this._list;
    for (const tuple of list) {
      if (tuple[0] === name) {
        return tuple[1];
      }
    }
    return null;
  }

  getAll(name: string): string[] {
    name = toUSVString(name);
    // Return the values of all name-value pairs whose name is name, in list, in list order,
    // and the empty sequence otherwise.
    const list = this._list;
    const values: string[] = [];
    for (const tuple of list) {
      if (tuple[0] === name) {
        values.push(tuple[1]);
      }
    }
    return values;
  }

  has(name: string): boolean {
    name = toUSVString(name);
    // Return true if there is a name-value pair whose name is name in list, and false otherwise.
    const list = this._list;
    for (const tuple of list) {
      if (tuple[0] === name) {
        return true;
      }
    }
    return false;
  }

  set(name: string, value: string): void {
    name = toUSVString(name);
    value = toUSVString(value);
    // 1. If there are any name-value pairs whose name is name, in list,
    //    set the value of the first such name-value pair to value and remove the others.
    const list = this._list;
    let found = false;
    let index = 0;
    while (index < list.length) {
      const tuple = list[index];
      if (tuple[0] === name) {
        if (found) {
          list.splice(index, 1);
        } else {
          tuple[1] = value;
          found = true;
          index++;
        }
      } else {
        index++;
      }
    }
    // 2. Otherwise, append a new name-value pair whose name is name and value is value, to list.
    if (!found) {
      list.push([name, value]);
    }
    // 2. Run the update steps.
    this._update();
  }

  sort(): void {
    // 1. Sort all name-value pairs, if any, by their names.
    //    Sorting must be done by comparison of code units.
    //    The relative order between name-value pairs with equal names must be preserved.
    stableSort(this._list, compareParams);
    // 2. Run the update steps.
    this._update();
  }

  toString() {
    // The stringification behavior must return the serialization of the URLSearchParams object’s list.
    return serializeUrlEncoded(this._list);
  }

  // The value pairs to iterate over are the list name-value pairs
  // with the key being the name and the value being the value.
  [Symbol.iterator]: () => URLSearchParamsIterator<[string, string]>; // implemented below

  // iterable<string, string>
  // https://www.w3.org/TR/WebIDL-1/#idl-iterable
  entries(): URLSearchParamsIterator<[string, string]> {
    return new URLSearchParamsIterator(this._list, selectEntry);
  }

  keys(): URLSearchParamsIterator<string> {
    return new URLSearchParamsIterator(this._list, selectKey);
  }

  values(): URLSearchParamsIterator<string> {
    return new URLSearchParamsIterator(this._list, selectValue);
  }

  forEach(callback: (value: string, key: string, iterable: URLSearchParams) => void): void {
    this._list.forEach(pair => callback(pair[1], pair[0], this));
  }
}

if (supportsSymbolIterator) {
  URLSearchParams.prototype[Symbol.iterator] = URLSearchParams.prototype.entries;
}

type PairSelector<T> = (pair: [string, string]) => T;

const selectEntry: PairSelector<[string, string]> = pair => [pair[0], pair[1]];
const selectKey: PairSelector<string> = pair => pair[0];
const selectValue: PairSelector<string> = pair => pair[1];

class URLSearchParamsIterator<T> implements Iterator<T> {
  private readonly _list: Array<[string, string]>;
  private readonly _selector: PairSelector<T>;
  private _index = 0;

  constructor(list: Array<[string, string]>, selector: PairSelector<T>) {
    this._list = list;
    this._selector = selector;
  }

  next(): IteratorResult<T> {
    if (this._index < this._list.length) {
      return { done: false, value: this._selector(this._list[this._index++]) };
    } else {
      return { done: true, value: undefined! };
    }
  }
}
