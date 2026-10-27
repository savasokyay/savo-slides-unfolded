// @ts-check
// WP-222: the tabs of the weighted hybrid's sub-matrix panel - Bases | Weights | Blend - and which tab a step opens, in the way the content page's tabs work (util/cb-tabs.js): the PLAYER
// decides from what the step carries, never from a list of step names, and a tab the reader clicked holds until the walk leaves the flowchart node it was clicked on (`nextPanelTab` of
// util/panel-tab.js, which only compares strings, is the same rule). What the walk carries (design note 2.3; engines/hybrid/explain_weighted.py):
//   * it references the `contributions` table (the blend: what each base says about the target and how much it counts) -> Blend, whose profile view of the weights and whose table that is;
//   * it references the `bases` or the `heldout` table (the split, every base fitted, the base predictions, the comparison with the three weight vectors) -> Bases;
//   * it highlights the `curve` view or references the `trajectory` table (the equal start, every gradient step, the closed form) -> Weights;
//   * it highlights the `profile` view with none of the above (the result) -> Blend;
//   * it carries none of those -> the tab that is open stays (the first tab, Bases, opens the walk).
// Order matters where a step carries two: the blend step carries `contributions` AND highlights `profile` (Blend either way); the comparison carries `bases` AND highlights `profile` and is
// Bases (its table now holds the three weight vectors); the closed-form step highlights `curve` AND `profile` and stays on Weights (the curve keeps its last point and gains the flat closed-form
// line). Pure functions, checked under node against hand-derived cases AND the code-agent's contract fixture (tests/app/js/hybrid_tabs_check.mjs); the page only calls them and draws.
// WP-222b: the switching walk (`#/combine?m=switching`, engines/hybrid/explain_switching.py) shares the strip's mechanics with three tabs of its own - Bases | Leaderboard | Answer - and
// drives them by its own tables (its contract has no views): the `answers` table (the chosen recommender's answer about the target) -> Answer; the `leaderboard` (one row per base scored,
// the choice) -> Leaderboard, ahead of the held-out table the neighbour rule's choice step references as well; the split, the bases fitted and their predictions -> Bases, as in the
// weighted walk. The two walks never share a trace, so one `hybridDrivenTab` serves both; which tabs exist is the method's (`hybridTabsFor`), as are the loops (`hybridLoopsFor`).

/** @typedef {"bases" | "weights" | "blend" | "board" | "answer"} HybridTab */ // WP-222b

/**
 * The loops of the weighted hybrid's walk (config/flowcharts/hybrid_weighted.yaml), each ONE step of the player's step counter (util/macro-steps.js: a run of consecutive steps of one loop is one
 * macro step, two loops are never merged): the bases being fitted (`fit_bases`, one step per base) and the gradient descent (`gd`, one step per iteration, the folded middle of a long descent
 * included). The counter then counts the algorithm's own steps - pick, split, fit the bases, predict, equal start, descend, closed form, compare, blend, result - whatever the number of bases
 * and of gradient steps.
 */
export const HYBRID_LOOPS = [["fit_bases"], ["gd"]];

/**
 * WP-222b: the loops of the switching walk (config/flowcharts/hybrid_switching.yaml): the bases being fitted (`fit_bases`, one step per base) and the scores (`score`, one step per base: its
 * row of the leaderboard). The counter then counts pick, split, fit the bases, predict, score, choose, answer, result - whatever the number of bases.
 */
export const HYBRID_SWITCH_LOOPS = [["fit_bases"], ["score"]];

/**
 * WP-235a: the loops the player plays as ONE macro step on a click (components/trace-player.js `bursts`): the rows of a table that each come with ONE number - the bases being fitted (a fit time per
 * base, the other columns still "?"), the bases scored on the switching walk - are shown one after the other, `HYBRID_BURST_MS` apart, instead of one click each. The gradient steps are NOT here:
 * the walk goes through them one by one (their counter, their trend, the point on the curve are the lesson).
 * @param {string | null | undefined} method the route's `m`
 * @returns {string[][]}
 */
export function hybridBurstsFor(method) {
  return method === "switching" ? HYBRID_SWITCH_LOOPS : [["fit_bases"]];
}

/** WP-235a: the distance in ms between two rows of a burst loop at speed 1 (the player's speed divides it) */
export const HYBRID_BURST_MS = 350;

/** the tabs, in the order of the strip (the first opens the walk) */
export const HYBRID_TABS = /** @type {const} */ (["bases", "weights", "blend"]);

/** WP-222b: the switching walk's tabs - Bases | Leaderboard | Answer; the first is the weighted walk's first too (the split and the bases fitted open both walks) */
export const HYBRID_SWITCH_TABS = /** @type {const} */ (["bases", "board", "answer"]);

/**
 * WP-222b: the tabs of a hybrid method's strip.
 * @param {string | null | undefined} method the route's `m` ("weighted" when it names none)
 * @returns {readonly HybridTab[]}
 */
export function hybridTabsFor(method) {
  return method === "switching" ? HYBRID_SWITCH_TABS : HYBRID_TABS;
}

/**
 * WP-222b: the loops of a hybrid method's walk, each one step of the player's counter.
 * @param {string | null | undefined} method the route's `m`
 * @returns {string[][]}
 */
export function hybridLoopsFor(method) {
  return method === "switching" ? HYBRID_SWITCH_LOOPS : HYBRID_LOOPS;
}

/**
 * The tab a step drives, or null when it drives none (the open tab stays).
 * @param {{highlights?: {view?: string}[], tables?: {table_id?: string}[]} | null | undefined} step the trace step (its OWN highlights and table references)
 * @returns {HybridTab | null}
 */
export function hybridDrivenTab(step) {
  const views = new Set((step?.highlights || []).map((h) => h.view ?? "submatrix"));
  const tables = new Set((step?.tables || []).map((t) => t.table_id));
  // WP-222b: the switching walk's tables come first - its choice step (the neighbour rule) references the held-out table as well, and the leaderboard is what that step is about
  if (tables.has("answers")) return "answer";
  if (tables.has("leaderboard")) return "board";
  if (tables.has("contributions")) return "blend";
  if (tables.has("bases") || tables.has("heldout")) return "bases";
  if (views.has("curve") || tables.has("trajectory")) return "weights";
  if (views.has("profile")) return "blend";
  return null;
}

/**
 * The tab a forward walk has on screen just before step `upTo`, with nothing clicked: what a link to step `upTo` that names no `panel` starts from. A step that drives no tab leaves the open
 * one, so the tab at a step depends on the steps before it - the walk is replayed from step 0, which opens on the first tab.
 * @param {{highlights?: {view?: string}[], tables?: {table_id?: string}[]}[] | null | undefined} steps the trace's steps
 * @param {number} upTo the step the link opens on (steps `0 .. upTo - 1` are walked)
 * @returns {HybridTab}
 */
export function hybridTabBefore(steps, upTo) {
  /** @type {HybridTab} */
  let tab = HYBRID_TABS[0];
  const walked = Math.min(Math.max(0, Math.floor(upTo)), steps?.length ?? 0);
  for (let i = 0; i < walked; i += 1) tab = hybridDrivenTab(/** @type {NonNullable<typeof steps>} */ (steps)[i]) ?? tab;
  return tab;
}

/**
 * The tab a `panel` route parameter names, null when it names none (absent, malformed, another page's tab - or, WP-222b, the other hybrid walk's: `weights` means nothing on the switching page).
 * @param {unknown} raw the `panel` route parameter
 * @param {readonly HybridTab[]} [tabs] the tabs of the strip on screen (the weighted walk's by default; WP-222b)
 * @returns {HybridTab | null}
 */
export function hybridTabFromParam(raw, tabs = HYBRID_TABS) {
  return typeof raw === "string" && /** @type {readonly string[]} */ (tabs).includes(raw) ? /** @type {HybridTab} */ (raw) : null; // WP-222b
}

/**
 * The index of the first step that references `tableId` (-1: none) - a table whose first step has not been reached is not shown (a panel would show a head row and no row at all).
 * @param {{tables?: {table_id?: string}[]}[] | null | undefined} steps
 * @param {string} tableId
 * @returns {number}
 */
export function firstReference(steps, tableId) {
  return (steps || []).findIndex((step) => (step.tables || []).some((t) => t.table_id === tableId));
}

/**
 * The index of the first step that highlights `view` (-1: none): the closed-form line of the curve appears at the first step that highlights the `profile` view (the closed-form step).
 * @param {{highlights?: {view?: string}[]}[] | null | undefined} steps
 * @param {string} view
 * @returns {number}
 */
export function firstHighlight(steps, view) {
  return (steps || []).findIndex((step) => (step.highlights || []).some((h) => (h.view ?? "submatrix") === view));
}
