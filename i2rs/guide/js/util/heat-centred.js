// @ts-check
// WP-132: the co-rated sub-matrix can show each rating as it was given ("raw") or CENTRED - the rating minus the centre the similarity subtracts from it
// (the user's mean on the course's rule, the film's mean on the item-mean fault): the number the formula really works with. What a cell shows is exactly
//     value - stats[axis][index][centre_stat]
// with the engine's own statistics (the group beside the name, the hover text of a user column); nothing else is computed in the browser, so the screen
// cannot disagree with the engine (tests/engines/test_col_stats.py pins that this difference equals the engine's centred value to 1e-9).
// These pure functions take the grid's view (util/heat-orient.js: `centre_on_rows` says whether the centre belongs to the entity a ROW stands for, else it
// belongs to the one a COLUMN stands for; `row_stats` / `col_stats` are the statistics of those two entities) and decide: whether the mode exists for the view,
// the centre of a cell, its text, its hover text, and the strength of its colour on the fixed diverging scale. Checked under node against hand-derived cases
// (tests/app/js/heat_centred_check.mjs); heat-grid.js builds the DOM from them.

import { fmtRating } from "./format.js";

/** @typedef {"raw" | "centred"} CellMode */

/** The minus sign of a difference: U+2212, not a hyphen (the hover sentence and the cell read "−0.60"). */
const MINUS = "−";

/** Decimals of the figure a cell shows, and of the figures in its hover text. */
export const CELL_DECIMALS = 2;
export const TITLE_DECIMALS = 4;

/**
 * Which mode a page asks for: the route parameter `vals` (`c` = centred, `r` = raw) when it is one of those, else the page's default - the item-based page
 * opens centred (the course's demo is the user-mean centred adjusted cosine), every other grid raw.
 * @param {string} engine the page's engine ("icf", "ucf", ...)
 * @param {unknown} vals the `vals` route parameter
 * @returns {CellMode}
 */
export function modeFor(engine, vals) {
  if (vals === "c") return "centred";
  if (vals === "r") return "raw";
  return engine === "icf" ? "centred" : "raw";
}

/**
 * The route parameter of a mode.
 * @param {CellMode} mode
 * @returns {"c" | "r"}
 */
export function valsParam(mode) {
  return mode === "centred" ? "c" : "r";
}

/**
 * Whether the centred mode exists for a view: the similarity subtracts a statistic that the grid has (`centre_stat` mean / median, from a centre axis whose
 * statistics list has one entry per row / column). A measure that centres on no shown number (a centre per PAIR, the scale midpoint, a library correlation,
 * a trained model) has no centred value to show: the mode is off and the switch says why.
 * @param {any} view a view from `orientView`
 * @returns {boolean}
 */
export function centredAvailable(view) {
  if (!view || typeof view.centre_on_rows !== "boolean") return false; // `orientView` sets it (false when no axis was named)
  if (view.centre_stat !== "mean" && view.centre_stat !== "median") return false;
  const list = view.centre_on_rows ? view.row_stats : view.col_stats;
  const labels = view.centre_on_rows ? view.row_labels : view.col_labels;
  // a centre on the COLUMN entity needs a statistics list with one entry per column (the item-based payload's users, when films are the rows); one on
  // the ROW entity needs one per row. A list of another length would put a user's centre on another user's cell.
  return Array.isArray(list) && Array.isArray(labels) && labels.length > 0 && list.length === labels.length;
}

/**
 * The centre of the cell (row r, column c): the statistic the formula subtracts, of the entity it belongs to; null when the view has none for that entity
 * (an entity with no ratings has no mean: the cell then keeps its raw figure).
 * @param {any} view
 * @param {number} r grid row
 * @param {number} c grid column
 * @returns {number | null}
 */
export function centreOf(view, r, c) {
  if (!centredAvailable(view)) return null;
  const entry = view.centre_on_rows ? view.row_stats[r] : view.col_stats[c];
  const value = entry ? entry[view.centre_stat] : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A difference as a cell writes it: two decimals, a sign on every non-zero figure (`+0.40`, `−0.60`), `0.00` for zero - also for a difference that rounds
 * to zero (never `−0.00`).
 * @param {number} diff
 * @param {number} [decimals]
 * @returns {string}
 */
export function signed(diff, decimals = CELL_DECIMALS) {
  const text = Math.abs(diff).toFixed(decimals);
  if (Number(text) === 0) return (0).toFixed(decimals);
  return `${diff < 0 ? MINUS : "+"}${text}`;
}

/**
 * The text of a centred cell.
 * @param {number} value the rating
 * @param {number} centre
 * @returns {string}
 */
export function centredText(value, centre) {
  return signed(value - centre);
}

/**
 * The hover text of a centred cell: the rating, the centre it lost (which statistic of which entity) and the result, with four decimals - the figures of
 * the group's hover text and of the formula panel: "3.5 − ū(u07) 4.1000 = −0.6000". The symbol is ū / ī for a user's / a film's mean, `med` for a median.
 * @param {{ value: number, centre: number, stat: "mean" | "median", entityKind: "user" | "item", entity: string }} p
 * @returns {string}
 */
export function centredTitle({ value, centre, stat, entityKind, entity }) {
  const symbol = stat === "median" ? "med" : entityKind === "item" ? "ī" : "ū";
  return `${fmtRating(value)} ${MINUS} ${symbol}(${entity}) ${centre.toFixed(TITLE_DECIMALS)} = ${signed(value - centre, TITLE_DECIMALS)}`;
}

/**
 * The half-range of the colour scale: half the rating scale, `(max - min) / 2` - the largest difference a rating can have from a centre in the middle of
 * the scale. FIXED for the dataset, not taken from the cells on screen, so a number has the same colour on every step and every pair.
 * @param {{ min?: number, max?: number } | null | undefined} scale `view.scale`
 * @returns {number} 2.25 for the 0.5-5 scale, 2 for 1-5; 2.25 when the scale is missing
 */
export function colourHalfRange(scale) {
  const span = typeof scale?.max === "number" && typeof scale?.min === "number" ? scale.max - scale.min : 4.5;
  return span > 0 ? span / 2 : 2.25;
}

/**
 * The colour of a difference on the diverging scale: which arm (`neg` below the centre, `pos` above, `zero` at it) and how far along it, 0..1 (the
 * difference over the half-range, clipped). A difference that writes as `0.00` is `zero`, so the figure and the colour never disagree.
 * @param {number} diff
 * @param {number} halfRange
 * @returns {{ arm: "neg" | "pos" | "zero", strength: number }}
 */
export function colourOf(diff, halfRange) {
  if (Number(Math.abs(diff).toFixed(CELL_DECIMALS)) === 0) return { arm: "zero", strength: 0 };
  return { arm: diff < 0 ? "neg" : "pos", strength: Math.min(1, Math.abs(diff) / halfRange) };
}
