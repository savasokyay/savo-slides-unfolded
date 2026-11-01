// @ts-check
// WP-116 (round 2): the arithmetic of resizable table columns (components/col-resizer.js draws and listens, this decides) - the same split
// as util/split-ratio.js for the panel dividers. A table's column widths are SHARES of the table, in percent, adding up to 100; dragging the
// edge between two neighbouring columns moves width from one to the other, so the table's width never changes. Plain logic, no DOM, no clock.
// The reader's choice is kept in localStorage as a JSON array, one entry per table (`i2rs.cols.<page>.<table>`); every read and write is in
// try / catch (a private window throws) - column widths are a convenience, the page renders correctly without them.

import { KEY_STEP } from "./split-ratio.js";

/** the narrowest a column may be, in percent of the table */
export const MIN_SHARE = 6;
const TOTAL = 100;
const SUM_TOLERANCE = 0.5; // a stored array is rounded to one decimal, so its sum drifts by a few tenths at most

/**
 * @param {string} page e.g. "memory_cf"
 * @param {string} table e.g. "measures"
 * @returns {string} the localStorage key
 */
export function sharesKey(page, table) {
  return `i2rs.cols.${page}.${table}`;
}

/**
 * @param {number[]} shares any positive numbers (the defaults)
 * @returns {number[]} the same proportions, adding up to 100
 */
export function normalizeShares(shares) {
  const sum = shares.reduce((a, b) => a + b, 0);
  return sum > 0 ? shares.map((s) => (s * TOTAL) / sum) : shares.slice();
}

/**
 * Moves the edge between column `i` and column `i + 1` by `delta` percentage points (positive = right): column `i` grows by what column
 * `i + 1` loses. Neither column goes below `min`; a move that would is cut at the limit.
 * @param {number[]} shares
 * @param {number} i the left column of the pair
 * @param {number} delta may be +/-Infinity (the key End / Home: as far as it goes)
 * @param {number} [min]
 * @returns {number[]} a new array
 */
export function moveBoundary(shares, i, delta, min = MIN_SHARE) {
  const out = shares.slice();
  if (i < 0 || i >= shares.length - 1) return out;
  const lowest = min - shares[i]; // the most the pair's left column may lose is down to `min`
  const highest = shares[i + 1] - min; // ... and the most it may gain is what the right one has above `min`
  if (lowest > highest) return out; // the pair is already narrower than twice the minimum: leave it
  const d = Math.min(highest, Math.max(lowest, delta));
  out[i] += d;
  out[i + 1] -= d;
  return out;
}

/**
 * @param {number[]} shares
 * @param {number} i
 * @param {-1 | 1} direction
 * @param {number} [min]
 * @param {number} [step] percentage points (the panel dividers' two points per key press)
 * @returns {number[]}
 */
export function stepBoundary(shares, i, direction, min = MIN_SHARE, step = KEY_STEP) {
  return moveBoundary(shares, i, direction * step, min);
}

/**
 * @param {number} dxPx how far the pointer moved
 * @param {number} tablePx the table's width when the drag began
 * @returns {number} percentage points
 */
export function deltaShare(dxPx, tablePx) {
  return tablePx > 0 ? (dxPx / tablePx) * TOTAL : 0;
}

/**
 * @param {unknown} raw what was stored (a JSON string, or nothing)
 * @param {number} n how many columns the table has
 * @param {number} [min]
 * @returns {number[] | null} the stored shares when they are exactly `n` finite numbers, each at least `min`, adding up to 100; null for
 *   anything else (nothing stored, not JSON, another table's width, a hand-edited entry)
 */
export function parseShares(raw, n, min = MIN_SHARE) {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || value.length !== n) return null;
    if (!value.every((v) => typeof v === "number" && Number.isFinite(v) && v >= min - 1e-9)) return null;
    const sum = value.reduce((a, b) => a + b, 0);
    return Math.abs(sum - TOTAL) <= SUM_TOLERANCE ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {{getItem: (key: string) => string | null} | null | undefined} storage `window.localStorage`, or nothing
 * @param {string} key
 * @param {number} n
 * @param {number} [min]
 * @returns {number[] | null} the stored shares, or null (none, invalid, or a storage that cannot be read)
 */
export function readShares(storage, key, n, min = MIN_SHARE) {
  try {
    return parseShares(storage?.getItem(key), n, min);
  } catch {
    return null;
  }
}

/**
 * @param {{setItem: (key: string, value: string) => void} | null | undefined} storage
 * @param {string} key
 * @param {number[]} shares
 */
export function saveShares(storage, key, shares) {
  try {
    storage?.setItem(key, JSON.stringify(shares.map((s) => Math.round(s * 10) / 10)));
  } catch {
    /* the widths then last as long as the page */
  }
}

/**
 * Removes a stored choice (a reset to the defaults leaves nothing behind).
 * @param {{removeItem?: (key: string) => void} | null | undefined} storage
 * @param {string} key
 */
export function clearShares(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    /* nothing to clean up */
  }
}
