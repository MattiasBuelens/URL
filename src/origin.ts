import { Host, serializeHost } from "./host";

export const enum OriginType {
  OPAQUE,
  TUPLE
}

// https://html.spec.whatwg.org/multipage/origin.html#concept-origin-opaque
export interface OpaqueOrigin {
  _type: OriginType.OPAQUE;
}

export function createOpaqueOrigin(): OpaqueOrigin {
  return {
    _type: OriginType.OPAQUE
  };
}

// https://html.spec.whatwg.org/multipage/origin.html#concept-origin-tuple
export interface TupleOrigin {
  _type: OriginType.TUPLE;
  _scheme: string;
  _host: Host | null;
  _port: number | null;
  _domain: string | null;
}

export function createTupleOrigin(scheme: string,
                                  host: Host | null,
                                  port: number | null,
                                  domain: string | null): TupleOrigin {
  return {
    _type: OriginType.TUPLE,
    _scheme: scheme,
    _host: host,
    _port: port,
    _domain: domain
  };
}

// https://html.spec.whatwg.org/multipage/origin.html#concept-origin
export type Origin = OpaqueOrigin | TupleOrigin;

// https://html.spec.whatwg.org/multipage/origin.html#ascii-serialisation-of-an-origin
export function serializeOrigin(origin: Origin): string {
  // 1. If origin is an opaque origin, then return "null".
  if (origin._type === OriginType.OPAQUE) {
    return 'null';
  }
  // 2. Otherwise, let result be origin's scheme.
  let result = origin._scheme;
  // 3. Append "://" to result.
  result += '://';
  // 4. Append origin's host, serialized, to result.
  if (origin._host !== null) {
    result += serializeHost(origin._host);
  }
  // 5. If origin's port is non-null, append a U+003A COLON character (:), and origin's port, serialized, to result.
  if (origin._port !== null) {
    result += `:${origin._port}`;
  }
  // 6. Return result.
  return result;
}
