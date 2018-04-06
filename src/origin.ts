import { Host, serializeHost } from "./host";

// https://html.spec.whatwg.org/multipage/origin.html#concept-origin-opaque
// https://html.spec.whatwg.org/multipage/origin.html#ascii-serialisation-of-an-origin
export const OPAQUE_ORIGIN = 'null';

// https://html.spec.whatwg.org/multipage/origin.html#concept-origin-tuple
// https://html.spec.whatwg.org/multipage/origin.html#ascii-serialisation-of-an-origin
export function serializeTupleOrigin(scheme: string, host: Host, port: number | null): string {
  // 2. Otherwise, let result be origin's scheme.
  // 3. Append "://" to result.
  // 4. Append origin's host, serialized, to result.
  // 5. If origin's port is non-null, append a U+003A COLON character (:), and origin's port, serialized, to result.
  // 6. Return result.
  return `${scheme}://${serializeHost(host)}${port === null ? '' : `:${port}`}`;
}
