// @ts-check
// WP-105a: the heat grid writes its column headers (film titles) vertically, at most two lines. These pure functions
// decide WHAT is written (the clipping rule) and how wide the sticky label column is; plain values in, plain values
// out, so they are checked under node against hand-derived cases (tests/app/js/heat_head_check.mjs). heat-grid.js
// builds the DOM from them and measures the label widths.

/** Characters per header line (the header is ~100 px tall at 12 px type). */
export const HEAD_CHARS_PER_LINE = 16;

/** Share of a line a word-boundary cut must keep, otherwise the line is cut at the character limit. */
const MIN_KEPT = 0.5;

/**
 * Cut `text` to at most `limit` characters, ending in an ellipsis when something was removed. The cut falls on the
 * last space when that keeps at least half of the line, and a dangling `:,;-` is dropped before the ellipsis.
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
function ellipsize(text, limit) {
  if (text.length <= limit) return text;
  let cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  if (space >= limit * MIN_KEPT) cut = cut.slice(0, space);
  return `${cut.replace(/[\s:,;–-]+$/, "")}…`;
}

/**
 * The lines a column header shows: at most two, each at most `perLine` characters; the full label stays in the
 * header's `title`. Rules, in order:
 * 1. a label that fits on one line stays one line;
 * 2. a label "<name> (YYYY)" whose name fits on one line puts the year on the second line;
 * 3. WP-135: a longer "<name> (YYYY)" never loses its year: the NAME is broken and clamped, and the year ends the second line whole -
 *    the first line breaks at the last space within `perLine` characters (at `perLine` when the first word is longer), the rest of
 *    the name gets what is left of the second line (`perLine` less the year and a space) and an ellipsis when it does not fit;
 * 4. otherwise (no year) the first line breaks at the last space within `perLine` characters (at `perLine` when the first
 *    word is longer), and the rest becomes the second line, ellipsized when it is longer than `perLine`.
 * @param {string | null | undefined} label
 * @param {number} [perLine]
 * @returns {{lines: string[], clipped: boolean}}
 */
export function clampHeadLabel(label, perLine = HEAD_CHARS_PER_LINE) {
  const text = String(label ?? "").trim();
  if (text.length <= perLine) return { lines: [text], clipped: false };
  const withYear = /^(.*\S)\s+(\(\d{4}\))$/.exec(text);
  if (withYear && withYear[1].length <= perLine) return { lines: [withYear[1], withYear[2]], clipped: false };
  if (withYear) {
    const [, name, year] = withYear;
    const nameSpace = name.lastIndexOf(" ", perLine);
    const nameAt = nameSpace > 0 ? nameSpace : perLine;
    const nameRest = name.slice(nameAt).trim();
    const budget = Math.max(1, perLine - year.length - 1); // room for the rest of the name beside the year on the second line
    const kept = ellipsize(nameRest, budget);
    return { lines: [name.slice(0, nameAt).trimEnd(), `${kept} ${year}`], clipped: kept !== nameRest };
  }
  const space = text.lastIndexOf(" ", perLine);
  const at = space > 0 ? space : perLine;
  const first = text.slice(0, at).trimEnd();
  const rest = text.slice(at).trim();
  const second = ellipsize(rest, perLine);
  return { lines: [first, second], clipped: second !== rest };
}

/**
 * Width of the sticky label column: the widest measured label, rounded up, kept between `min` and `max` pixels (every
 * row is its own grid, so one shared number keeps the columns of all rows aligned and tells the scroll code how much
 * of the box the labels cover).
 * @param {number[]} widths measured label widths (px)
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number}
 */
export function labelColumnWidth(widths, min = 72, max = 150) {
  const widest = Math.max(0, ...widths.filter((w) => Number.isFinite(w)));
  return Math.min(max, Math.max(min, Math.ceil(widest)));
}
