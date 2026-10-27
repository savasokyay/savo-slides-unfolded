// @ts-check
// WP-108 (c): the candidate table's columns that appear WITH the walk. A rank cannot be known before every similarity is computed, and
// the shrunk weight not before significance weighting ran, so the engine tags such a column with the phase it belongs to
// (`Column.phase`: "weighting" | "selection"); until the player reaches that phase the cell shows "?" (not known yet) instead of the number - it still
// holds the number (hidden), so the column never changes width. The rule is plain logic (hand-checked under node,
// tests/app/js/column_phase_check.mjs); components/data-table.js applies it.

/**
 * Whether the player has reached a column's phase.
 * @param {string[]} phaseIds the trace's phases in order (`trace.phases[].id`)
 * @param {string | null | undefined} currentId the phase the player is in now
 * @param {string | null | undefined} columnPhase the phase the column belongs to; none = the column fills as the walk goes
 * @returns {boolean} true when the column is to show its numbers
 */
export function phaseReached(phaseIds, currentId, columnPhase) {
  if (!columnPhase) return true; // an untagged column is never masked
  const at = phaseIds.indexOf(columnPhase);
  if (at < 0) return true; // the trace has no such phase (the iCF default has no weighting phase): nothing to wait for
  const now = currentId ? phaseIds.indexOf(currentId) : -1;
  return now >= at;
}

/**
 * WP-108 (e-ii): the phase one CELL belongs to. A column may tag single VALUES (`Column.phase_by_value`, e.g. the status column:
 * `{"selected": "selection", "cut_by_k": "selection"}`) - `selected` is only known once the ranking has been made, while `undefined` /
 * `few_corated` / `non_positive` come out of the similarity itself and show with their row. The value map wins over the column's own
 * `phase`; a value it does not list falls back to the column's phase; none at all = known as soon as the row is shown.
 * @param {{ phase?: string | null, phase_by_value?: Record<string, string> | null }} column
 * @param {unknown} value the cell's value (matched as a string: a status is text)
 * @returns {string | null}
 */
export function cellPhase(column, value) {
  const byValue = column.phase_by_value;
  if (byValue && value !== null && value !== undefined) {
    const phase = byValue[String(value)];
    if (phase) return phase;
  }
  return column.phase || null;
}

/**
 * How a candidate's rank moved when significance weighting was applied: ranks count from 1 (the best), so a SMALLER number is a rise.
 * @param {number | null | undefined} raw the rank by the raw similarity w
 * @param {number | null | undefined} ranked the rank by the shrunk weight w'
 * @returns {{dir: "up" | "down", from: number, to: number} | null} null when either rank is missing or they are equal
 */
export function rankMove(raw, ranked) {
  if (typeof raw !== "number" || typeof ranked !== "number" || raw === ranked) return null;
  return { dir: ranked < raw ? "up" : "down", from: raw, to: ranked };
}
