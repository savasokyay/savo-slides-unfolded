// @ts-check
// WP-32: number/text formatting shared by the panels. Numbers use a dot decimal separator and 4
// fixed decimals in both languages (docs/UI_STYLE.md "Typography and numbers").

/**
 * @param {unknown} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function fmt(value, decimals = 4) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(decimals);
  }
  return String(value);
}

/**
 * Format every numeric parameter of a narration/text template (ints stay ints).
 * @param {Record<string, unknown> | undefined} params
 * @returns {Record<string, unknown>}
 */
export function fmtParams(params) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    out[k] = typeof v === "number" ? fmt(v) : v === null || v === undefined ? "—" : v;
  }
  return out;
}

/**
 * Rating cell text: one decimal (4.5, 3.0), empty for missing.
 * @param {number | null | undefined} value
 */
export function fmtRating(value) {
  if (value === null || value === undefined || value === 0) return "";
  return value.toFixed(1);
}

/**
 * @param {number} value
 * @param {number} lo
 * @param {number} hi
 */
export function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), hi);
}

/**
 * Star string of a rating, rounded to the nearest half star: 4.5 -> "★★★★½", 0.5 -> "½", 3 -> "★★★".
 * Plain Unicode (no emoji presentation), so the colour comes from the surrounding text.
 * WP-83: cohort tables and cards.
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function fmtStars(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const half = Math.round(value * 2) / 2;
  const full = Math.floor(half);
  return "★".repeat(full) + (half - full >= 0.5 ? "½" : "");
}

/**
 * ISO calendar date (UTC) of an epoch-seconds timestamp; "—" when missing. The class submissions
 * carry the LOG day, so for them this is "the day it was logged", not the viewing date.
 * WP-83: cohort tables and cards.
 * @param {number | null | undefined} seconds
 * @returns {string}
 */
export function fmtDate(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}
