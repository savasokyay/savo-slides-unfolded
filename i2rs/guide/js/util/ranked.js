// @ts-check
// WP-141: the logic of the top-K page's RANKED LIST - WHICH rows show, in WHICH order, which are in focus, where the K line stands - in plain values, so it can be
// checked under node against hand-derived cases (tests/app/js/ranked_list_check.mjs); components/ranked-list.js builds the DOM from it.
//
// The table is the trace's `ranked` table (docs/plans/2610101900-topk-task-switch.md section 7): one row per film of the candidate set that is SHOWN, in rank order
// (`rows[0]` is rank 1), each `{rank, item, title, score, seen, relevant, why}`. The player walks it with the same references every table has (`TableRef`:
// `reveal_upto`, `sort_by`, `focus_rows`) and with a `table` highlight in the "selected" style that marks the rows the cut keeps. The rules:
//  * BEFORE the ranking step the list is in CANDIDATE order (the film's index in the catalogue) - the order the scores were computed in - and shows the first
//    `reveal_upto` rows of the table (`reveal_upto` counts rows in the table's own order); the ranking step sets `sort_by: "score"` and the list stands in score order,
//    highest first, every row shown (the same rule as the candidate table: a sorted table is fully revealed);
//  * a column that belongs to a phase (`Column.phase`, the rank: "rank") shows "?" until the player has reached it (util/column-phase.js);
//  * the cut: once a `table` highlight in the "selected" style is in the frame (it persists), the rows it names are the K the user gets - the list draws a line under
//    the last of them and the rows below it are faded.

import { cellPhase, phaseReached } from "./column-phase.js";

/** the sort keys that run from the highest to the lowest (a score); every other key runs up (a rank) */
const DESCENDING = new Set(["score"]);

/**
 * Whether a table is the ranked table the list can draw: rows of films with a rank, a title and a score.
 * @param {any} table
 * @returns {boolean}
 */
export function isRankedTable(table) {
  const keys = new Set((table?.columns || []).map((/** @type {{key: string}} */ c) => c.key));
  return Boolean(table) && ["rank", "title", "score"].every((k) => keys.has(k)) && Array.isArray(table.rows);
}

/**
 * Whether the list draws the "relevant" column and the threshold chip: a model that ranks by a rating has a threshold and a boolean per row; a model that ranks by a
 * SCORE (BPR, EASE) has none (`meta.topk.threshold` null, every row's `relevant` null) - there is nothing to compare the score with (plan section 7a).
 * @param {any} table the `ranked` table
 * @param {{threshold?: number | null} | null | undefined} topk `trace.meta.topk`
 * @returns {boolean}
 */
export function hasRelevance(table, topk) {
  if (!(table?.columns || []).some((/** @type {{key: string}} */ c) => c.key === "relevant")) return false;
  if (topk && (topk.threshold === null || topk.threshold === undefined)) return false;
  return (table.rows || []).some((/** @type {{relevant?: unknown}} */ r) => typeof r.relevant === "boolean");
}

/**
 * The order the rows stand in: the table's `sort_by` when the player has set one, else the candidate order (ascending film index; the table's own order when a row
 * carries no index).
 * @param {{item?: number, [key: string]: any}[]} rows
 * @param {string | null | undefined} sortBy
 * @returns {number[]} row indices, in display order
 */
export function displayOrder(rows, sortBy) {
  const order = rows.map((_, i) => i);
  if (sortBy) {
    const down = DESCENDING.has(sortBy);
    order.sort((a, b) => {
      const va = rows[a][sortBy];
      const vb = rows[b][sortBy];
      if (va === vb) return a - b;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va < vb ? -1 : 1) * (down ? -1 : 1);
    });
    return order;
  }
  if (rows.every((r) => Number.isInteger(r.item))) order.sort((a, b) => /** @type {number} */ (rows[a].item) - /** @type {number} */ (rows[b].item) || a - b);
  return order;
}

/**
 * The rows the cut keeps: those a `table` highlight in the "selected" style names.
 * @param {{view?: string, rows?: number[], style?: string}[]} highlights the player's frame (persisted ones included)
 * @returns {Set<number>}
 */
export function selectedRows(highlights) {
  /** @type {Set<number>} */
  const rows = new Set();
  for (const h of highlights || []) {
    if (h.view !== "table" || h.style !== "selected") continue;
    for (const r of h.rows || []) rows.add(r);
  }
  return rows;
}

/**
 * @typedef {Object} RankedState
 * @property {number[]} order display order of ALL rows (indices into `table.rows`)
 * @property {boolean[]} visible per row index: whether the row is shown at this step
 * @property {number[]} focus the rows this step is about
 * @property {Set<number>} selected the rows the cut keeps (empty before the cut)
 * @property {number | null} cutAfter the position in `order` after which the K line stands (null: no cut yet)
 * @property {boolean} sorted whether the list stands in `sort_by` order (else candidate order)
 */

/**
 * What the list shows at a step.
 * The cut is named twice by the engine - a `table` highlight in the "selected" style and the step's `focus_rows` - and the rank says it a third time (the rows of rank <= K): when no
 * highlight names a row but the walk has reached the cut phase (`opts.cutReached`) and K is known (`opts.k`), the rows of rank <= K are the ones the cut keeps (plan 7b: either one
 * is enough).
 * @param {any} table the `ranked` table
 * @param {{tables?: Record<string, {reveal_upto: number | null, sort_by: string | null, focus_rows: number[]}>, highlights?: any[]}} frame the player's frame
 * @param {{cutReached?: boolean, k?: number | null}} [opts]
 * @returns {RankedState}
 */
export function rankedState(table, frame, opts = {}) {
  const rows = table.rows;
  const refs = frame.tables?.[table.table_id] || { reveal_upto: null, sort_by: null, focus_rows: [] };
  const revealed = refs.reveal_upto === null ? 0 : refs.reveal_upto;
  const sorted = Boolean(refs.sort_by);
  const order = displayOrder(rows, refs.sort_by);
  const visible = rows.map((/** @type {unknown} */ _r, /** @type {number} */ i) => sorted || i < revealed);
  const selected = new Set([...selectedRows(frame.highlights || [])].filter((r) => r >= 0 && r < rows.length));
  if (selected.size === 0 && opts.cutReached && typeof opts.k === "number" && Number.isFinite(opts.k)) {
    rows.forEach((/** @type {{rank?: number}} */ row, /** @type {number} */ i) => {
      if (typeof row.rank === "number" && row.rank <= /** @type {number} */ (opts.k)) selected.add(i);
    });
  }
  let cutAfter = null;
  if (selected.size) cutAfter = Math.max(...[...selected].map((r) => order.indexOf(r)));
  return { order, visible, focus: refs.focus_rows || [], selected, cutAfter, sorted };
}

/**
 * Whether a cell of a column shows its value at this step (a column of a phase is "?" until the phase is reached).
 * @param {{phase?: string | null, phase_by_value?: Record<string, string> | null}} column
 * @param {unknown} value
 * @param {string[]} phaseIds the trace's phases in order
 * @param {string | null | undefined} currentId the phase the player is in
 * @returns {boolean}
 */
export function cellKnown(column, value, phaseIds, currentId) {
  return phaseReached(phaseIds, currentId, cellPhase(column, value));
}
