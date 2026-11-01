// @ts-check
// WP-244: the feature page's sub-matrix panel has a second tab, "Side inputs" (the numbers each side input hands the network: the film's terms, the user's profile, the two numeric groups). Like every
// other strip of the page the player decides which tab is open from what the step highlights (never from a list of step names), and a tab the reader clicked holds until the walk leaves the
// flowchart node it was clicked on (`nextPanelTab` in util/panel-tab.js does the holding; it is generic over the tab names). Pure functions, checked under node (tests/app/js/dnn_features_check.mjs).
//   * the step LIGHTS a stage that IS a side input (an `active` highlight on a network row of `sideRows`: the build step marks every box as a `neighbor`, which lights none) -> the side tab, so the
//     numbers behind the lit box are the ones on screen;
//   * it highlights the sub-matrix (the pick, the hidden target, the result's cell) -> the matrix, so the cell the narration points at is never behind a covered tab;
//   * it highlights neither -> the tab that is open stays.
// WP-248: and a third tab, "Values" - the vectors the network passes on, stage by stage, with the stage the step is on lit and the stages that feed it marked. A step that lights any OTHER stage of the diagram
// (an embedding, a tower layer, the join, an MLP layer) opens it; the order of the rules keeps what they were: a lit side input -> its numbers (side), the sub-matrix -> the matrix (the result step lights the
// output stage AND the predicted cell: the cell wins), and only then a lit stage -> values. `hasValues` is opt-in so a caller that has no such tab (and the older checks) keeps the two-tab rules.

/** @typedef {"matrix" | "side" | "values"} SideTab */

/**
 * The tab a step drives, or null when it drives neither.
 * @param {{highlights?: {view?: string, rows?: number[], style?: string}[]} | null | undefined} step the trace step (its OWN highlights)
 * @param {{sideRows?: number[], hasSide?: boolean, hasValues?: boolean}} [opts] `sideRows`: the rows of the network view that are side inputs; `hasSide`: whether the trace carries any side input at all (false: no side tab);
 *   WP-248 `hasValues`: whether the Values tab exists (the trace carries a network view)
 * @returns {SideTab | null}
 */
export function sideDrivenTab(step, opts = {}) {
  const { sideRows = [], hasSide = true, hasValues = false } = opts;
  if (!hasSide && !hasValues) return "matrix";
  const rows = new Set(sideRows);
  const highlights = step?.highlights ?? [];
  const lit = highlights.filter((h) => h.view === "network" && h.style === "active" && (h.rows ?? []).length > 0); // `active` only: the build step's `neighbor` on every box is not a lit stage
  if (hasSide && lit.some((h) => (h.rows ?? []).some((r) => rows.has(r)))) return "side";
  if (highlights.some((h) => h.view === "submatrix")) return "matrix";
  if (hasValues && lit.length > 0) return "values"; // WP-248
  return null;
}

/**
 * The tab a forward walk has on screen just before step `upTo`, with nothing clicked: what a link to step `upTo` that names no side tab starts from (a step that drives neither leaves the open tab,
 * so it depends on the steps before it - the walk is replayed from step 0, which opens on the matrix).
 * @param {{highlights?: {view?: string, rows?: number[]}[]}[] | null | undefined} steps
 * @param {number} upTo
 * @param {{sideRows?: number[], hasSide?: boolean, hasValues?: boolean}} [opts]
 * @returns {SideTab}
 */
export function sideTabBefore(steps, upTo, opts = {}) {
  /** @type {SideTab} */
  let tab = "matrix";
  const walked = Math.min(Math.max(0, Math.floor(upTo)), steps?.length ?? 0);
  for (let i = 0; i < walked; i += 1) tab = sideDrivenTab(/** @type {NonNullable<typeof steps>} */ (steps)[i], opts) ?? tab;
  return tab;
}

/**
 * The tab a `hbox` route parameter names, null when it names none.
 * @param {unknown} raw
 * @returns {SideTab | null}
 */
export function sideTabFromParam(raw) {
  return raw === "matrix" || raw === "side" || raw === "values" ? raw : null; // WP-248: + values
}
