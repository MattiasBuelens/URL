// Original from stable by Two-Screen (MIT license)
// https://github.com/Two-Screen/stable/blob/v0.1.8/src/stable.js

/**
 * Compares its two arguments for order.
 *
 * Returns a negative integer, zero, or a positive integer
 * if the first argument is less than, equal to, or greater than the second.
 */
export type Comparator<T> = (a: T, b: T) => number;

// A stable array sort, because `Array#sort()` is not guaranteed stable.
// This is an implementation of merge sort, without recursion.

export function stableSort<T>(arr: ReadonlyArray<T>, comp: Comparator<T>): T[] {
  return exec(arr.slice(), comp);
}

export function inplaceStableSort<T>(arr: T[], comp: Comparator<T>): T[] {
  const result = exec(arr, comp);

  // This simply copies back if the result isn't in the original array,
  // which happens on an odd number of passes.
  if (result !== arr) {
    pass(result, null!, arr.length, arr);
  }

  return arr;
}

// Execute the sort using the input array and a second buffer as work space.
// Returns one of those two, containing the final result.
function exec<T>(arr: T[], comp: Comparator<T>): T[] {
  if (typeof (comp) !== 'function') {
    comp = function (a, b) {
      return String(a).localeCompare(b);
    }
  }

  // Short-circuit when there's nothing to sort.
  const len = arr.length;
  if (len <= 1) {
    return arr;
  }

  // Rather than dividing input, simply iterate chunks of 1, 2, 4, 8, etc.
  // Chunks are the size of the left or right hand in merge sort.
  // Stop when the left-hand covers all of the array.
  let buffer = new Array<T>(len);
  for (let chk = 1; chk < len; chk *= 2) {
    pass(arr, comp, chk, buffer);

    const tmp = arr;
    arr = buffer;
    buffer = tmp;
  }

  return arr;
}

// Run a single pass with the given chunk size.
function pass<T>(arr: T[], comp: Comparator<T>, chk: number, result: T[]) {
  const len = arr.length;
  let i = 0;
  // Step size / double chunk size.
  const dbl = chk * 2;
  // Bounds of the left and right chunks.
  let l, r, e;
  // Iterators over the left and right chunk.
  let li, ri;

  // Iterate over pairs of chunks.
  for (l = 0; l < len; l += dbl) {
    r = l + chk;
    e = r + chk;
    if (r > len) {
      r = len;
    }
    if (e > len) {
      e = len;
    }

    // Iterate both chunks in parallel.
    li = l;
    ri = r;
    while (true) {
      // Compare the chunks.
      if (li < r && ri < e) {
        // This works for a regular `sort()` compatible comparator,
        // but also for a simple comparator like: `a > b`
        if (comp(arr[li], arr[ri]) <= 0) {
          result[i++] = arr[li++];
        } else {
          result[i++] = arr[ri++];
        }
      } else if (li < r) {
        result[i++] = arr[li++];
      } else if (ri < e) {
        result[i++] = arr[ri++];
      } else {
        break;
      }
    }
  }
}
