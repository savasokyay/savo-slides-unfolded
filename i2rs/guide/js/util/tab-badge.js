// @ts-check
// NOTE (WP-107 e2): UNUSED. The candidate table was a tab of the flowchart panel for one round (WP-107 e), and this decided the badge on
// its tab. The user then asked for the flowchart and the table stacked, both always visible (e2), so no page imports this any more. It is
// kept - with its node check (tests/app/js/tab_badge_check.mjs) - because the rule it holds (a step needs two or more rows in focus to be
// worth a badge; a cut table counts only its listed rows) is what a future mark for something that happened in a hidden panel would need.
// WP-107 (e): the small badge on the "Candidate neighbours" tab of the flowchart panel (uCF / iCF). The candidate table lives in a
// tab now, so a step that HIGHLIGHTS rows of it (the selected neighbours at rank_select) would pass unnoticed while the flowchart is on
// screen. The badge says how many rows the step has in focus - and only while that tab is not the open one (there the rows are
// visible). Switching tabs by itself is the instructor's call, not the page's.
// Measured on a uCF trace (sub-steps counted): 138 show ONE focus row (the candidate whose similarity is being computed - a constant
// "1" is noise, not a signal), rank_select shows all 45, predict none. So a step has to highlight at least `MIN_ROWS` rows to be
// badged (lead decision 2026-10-05).
// A long table is cut (the iCF one lists 50 of its 62 candidates): a focus row beyond the list has nothing to show, so it is not counted.

/** fewer focus rows than this are no event worth a badge */
export const MIN_ROWS = 2;

/**
 * @param {{tables?: Record<string, {focus_rows?: number[]} | undefined>} | null | undefined} frame a player frame (`frame.tables[id].focus_rows`)
 * @param {string} tableId the candidate table's id in the trace
 * @param {boolean} tabOpen whether the table's tab is the one on screen
 * @param {number} [rowCount] how many rows the table actually lists (omitted: every focus row counts)
 * @returns {number} the number shown in the badge; 0 = no badge
 */
export function tabBadgeCount(frame, tableId, tabOpen, rowCount = Infinity) {
  if (tabOpen) return 0;
  const rows = frame?.tables?.[tableId]?.focus_rows;
  const n = Array.isArray(rows) ? rows.filter((r) => r < rowCount).length : 0;
  return n >= MIN_ROWS ? n : 0;
}
