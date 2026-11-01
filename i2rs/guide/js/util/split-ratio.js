// @ts-check
// WP-107 (h2) / (e2): the arithmetic of a draggable divider between two panels (components/splitter.js draws and listens, this
// decides). A split is the share of the FIRST panel in the pair's combined size, in percent; the two sizes always add up to the same
// total (the divider moves the line between them, never the pair's outer edges). Plain logic, no DOM, no clock.
//   range  = {min, max, def}: the allowed shares and the default (percent); the divider of the vertical case (flowchart over table)
//            has a range that depends on the window, so callers pass a fresh one each time.
//   storage: `window.localStorage` or nothing; every read and write is in try / catch (a private window throws) - a split is a
//            convenience, the page renders correctly without it.

/** @typedef {{min: number, max: number, def: number}} SplitRange */

/** the keyboard step, in percentage points (the instructor's spec: two points per key press) */
export const KEY_STEP = 2;

/**
 * @param {number} pct
 * @param {SplitRange} range
 * @returns {number} `pct` held inside the range (both ends allowed)
 */
export function clampRatio(pct, range) {
  return Math.min(range.max, Math.max(range.min, pct));
}

/**
 * The share after a drag: the first panel was `startBefore` px of a pair `total` px big when the drag began, and the pointer has moved
 * `delta` px along the divider's axis since.
 * @param {number} startBefore
 * @param {number} delta
 * @param {number} total
 * @param {SplitRange} range
 * @returns {number}
 */
export function ratioFromDrag(startBefore, delta, total, range) {
  if (!(total > 0)) return range.def;
  return clampRatio(((startBefore + delta) / total) * 100, range);
}

/**
 * @param {number} current
 * @param {number} direction -1 or +1
 * @param {SplitRange} range
 * @param {number} [step]
 * @returns {number}
 */
export function stepRatio(current, direction, range, step = KEY_STEP) {
  return clampRatio(current + direction * step, range);
}

/**
 * What a key does to a focused divider. A vertical divider (between side-by-side panels, axis "x") moves with Left / Right, a
 * horizontal one (panels stacked, axis "y") with Up / Down; Home and End go to the ends of the range.
 * @param {string} key
 * @param {"x" | "y"} axis
 * @returns {{type: "step", direction: -1 | 1} | {type: "min"} | {type: "max"} | null}
 */
export function keyAction(key, axis) {
  if (key === "Home") return { type: "min" };
  if (key === "End") return { type: "max" };
  const [less, more] = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  if (key === less) return { type: "step", direction: -1 };
  if (key === more) return { type: "step", direction: 1 };
  return null;
}

/**
 * @param {unknown} raw what was stored
 * @param {SplitRange} range
 * @returns {number} the stored share when it is a plain number inside the range; the default for anything else
 */
export function parseRatio(raw, range) {
  return plainShare(raw, range) ?? range.def;
}

/**
 * @param {unknown} raw
 * @param {SplitRange} range
 * @returns {number | null} the number when `raw` is a plain decimal string inside the range, else null
 */
function plainShare(raw, range) {
  if (typeof raw !== "string" || !/^\d+(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return value >= range.min && value <= range.max ? value : null;
}

/**
 * The share the reader chose and the browser kept - null when there is none (nothing stored, not a plain number, outside the range, or
 * a storage that cannot be read). A divider with no choice FOLLOWS the default, which may itself move with the window (the flowchart /
 * table divider: the chart's natural height); one with a choice keeps it.
 * @param {{getItem: (key: string) => string | null} | null | undefined} storage
 * @param {string} key
 * @param {SplitRange} range
 * @returns {number | null}
 */
export function readRatio(storage, key, range) {
  try {
    return plainShare(storage?.getItem(key), range);
  } catch {
    return null;
  }
}

/**
 * @param {{getItem: (key: string) => string | null} | null | undefined} storage
 * @param {string} key
 * @param {SplitRange} range
 * @returns {number} the stored share, or the default
 */
export function loadRatio(storage, key, range) {
  return readRatio(storage, key, range) ?? range.def;
}

/**
 * Removes a stored share (a reset to the default leaves nothing behind).
 * @param {{removeItem?: (key: string) => void} | null | undefined} storage
 * @param {string} key
 */
export function clearRatio(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Stores a share with one decimal.
 * @param {{setItem: (key: string, value: string) => void} | null | undefined} storage
 * @param {string} key
 * @param {number} pct
 */
export function saveRatio(storage, key, pct) {
  try {
    storage?.setItem(key, pct.toFixed(1));
  } catch {
    /* the share then lasts as long as the page */
  }
}
