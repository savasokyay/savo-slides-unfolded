// @ts-check
// WP-152: the MF page's sub-matrix panel has two tabs - the matrix ("Co-rated sub-matrix", or the "Ranked list" of the top-K task) and the "Factor matrices" -
// and the player decides which one is open. WP-154: the neural page's panel has two as well - the matrix and the "Network" diagram - under the same rule, the second
// tab's view being `network` there. Pure functions, checked under node against hand-derived cases (tests/app/js/panel_tab_check.mjs); the page only calls them and draws.
//
// The rule is read from what the step highlights (`highlight.view`, the panel the engine says the step is about), never from a list of step names:
//   * the step highlights the second tab's view (`factors` / `network`) - alone or together with the sub-matrix - -> the second tab (the MF predict step names both
//     cells, the factor tab shows R^ = mu + b_u + b_i + P Q^T; the neural result step names the sub-matrix cell and the output stage, the diagram shows the output);
//   * it highlights only the sub-matrix (`submatrix`) -> the first tab, so the cell the narration points at is never behind a covered tab;
//   * it highlights neither (an epoch drives the curve and the latent space below the block) -> the tab that is open stays.
// The MF top-K task has no such highlights to read (the ranked list is driven by the step's table references, the factor row by `factors` highlights, and a
// step often drives both), so it follows the PHASE instead: the setup, scoring and exclusion phases are the factor row's story, the ranking, the cut and the
// list are the Ranked list's - one switch in the whole walk, not a flicker at every score. A neural top-K trace carries no network view (measured: its `views` is
// empty, no step names `network`): its second tab is not offered, and a trace that did have one would have no rule yet (the open tab stays).
// A tab the reader clicked holds until the walk leaves the node (the flowchart box) it was clicked on, then the player drives again.

/** @typedef {"matrix" | "factors" | "network" | "flow"} PanelTab WP-245: `flow` is the first tab of the feature page's strip (the flowchart; the sub-matrix panel has no tabs there) */
/** @typedef {{tab: PanelTab, node: string | null}} ManualChoice */

/** the phase the top-K walk turns from the factor row to the Ranked list at (`rank`: the scores are all in, the list is sorted) */
const TOPK_LIST_FROM = "rank";
/** WP-243: the phase of the pick, the hidden target, the features and the network's construction (the walk's first four steps on the neural pages) */
const SETUP_PHASE = "setup";

/**
 * The second tab of a page's sub-matrix panel: the MF page's factor matrices, the neural page's network diagram (null: the page has no tabs).
 * @param {string} engine "ucf" | "icf" | "cb" | "mf" | "dnn"
 * @returns {"factors" | "network" | null}
 */
export function secondTabFor(engine) {
  if (engine === "mf") return "factors";
  if (engine === "dnn") return "network";
  return null;
}

/**
 * The tab a step drives, or null when it drives neither.
 * @param {{highlights?: {view?: string}[], node_id?: string | null} | null | undefined} step the trace step (its OWN highlights: the player's frame also carries the persisted ones of earlier steps; WP-245: and its flowchart node)
 * @param {{engine?: string, topk?: boolean, phaseIds?: string[], phaseId?: string | null, hasView?: boolean, networkFirst?: boolean, first?: "matrix" | "flow"}} [opts] `engine`: the page ("mf" by default); `topk`: the top-K
 *   task (the MF page's phase decides); `phaseIds`: the trace's phases in order; `phaseId`: the phase the step is in; `hasView`: whether the trace has the second tab's view at
 *   all (BPR, EASE: no factor view; a neural top-K trace: no network view); WP-243 `networkFirst`: the feature page opens on the diagram - the setup phase's steps (the pick and the hidden
 *   target, which name the sub-matrix only) leave the open tab alone instead of turning to the matrix, so the diagram stays up until the walk names it itself; WP-245 `first`: the strip's first tab -
 *   "matrix" (the sub-matrix panel's strip) or "flow" (the feature page: the Network is the second tab of the FLOWCHART panel; a step that names the network turns to it, a step that names only its
 *   flowchart node turns to the flowchart, the same rule the sub-matrix strip follows with its cells - and a step that names neither leaves the open tab)
 * @returns {PanelTab | null}
 */
export function drivenTab(step, opts = {}) {
  const { engine = "mf", topk = false, phaseIds = [], phaseId = null, hasView = true, networkFirst = false, first = "matrix" } = opts; // WP-245: `first`, the strip's first tab
  const second = secondTabFor(engine);
  if (second === null || !hasView) return first; // no second view: nothing to open (the tab itself says so, or is not offered); WP-245: the strip's first tab
  if (topk) {
    if (engine !== "mf") return null; // a neural top-K trace with a network view would need a rule of its own: none yet, the open tab stays
    const from = phaseIds.indexOf(TOPK_LIST_FROM);
    const now = phaseId ? phaseIds.indexOf(phaseId) : -1;
    return from >= 0 && now >= from ? "matrix" : "factors";
  }
  const views = new Set((step?.highlights || []).map((h) => h.view));
  if (views.has(second)) return second;
  if (networkFirst && phaseId === SETUP_PHASE) return null; // WP-243: the open tab (the diagram) stays through the pick and the hidden target
  if (first === "flow") return step?.node_id ? "flow" : null; // WP-245: the feature page's strip: a step that names its flowchart node and not the network turns to the flowchart
  if (views.has("submatrix")) return "matrix";
  return null;
}

/**
 * The tab a forward walk has on screen just before step `upTo`, with nothing clicked: what a link to step `upTo` that names no `panel` starts from. A step that drives neither tab
 * leaves the open one, so the tab at a step depends on the steps before it (a link to epoch 8 of a neural walk must show what the walk shows there: the diagram, switched to at the
 * `build` step) - the walk is replayed from step 0 with the same rule.
 * @param {{highlights?: {view?: string}[], phase?: string | null, node_id?: string | null}[] | null | undefined} steps the trace's steps (each its own highlights, its phase id and, WP-245, its flowchart node)
 * @param {number} upTo the step the link opens on (steps `0 .. upTo - 1` are walked; 0: the matrix)
 * @param {{engine?: string, topk?: boolean, phaseIds?: string[], hasView?: boolean, networkFirst?: boolean, first?: "matrix" | "flow"}} [opts] as `drivenTab` (the phase of each step comes from the step; WP-245: `first`); WP-243: with
 *   `networkFirst` the walk starts on the diagram (step 0: the network)
 * @returns {PanelTab}
 */
export function tabBefore(steps, upTo, opts = {}) {
  /** @type {PanelTab} */
  let tab = opts.networkFirst && opts.hasView !== false ? "network" : (opts.first ?? "matrix"); // WP-245: the strip's first tab
  const walked = Math.min(Math.max(0, Math.floor(upTo)), steps?.length ?? 0);
  for (let i = 0; i < walked; i += 1) {
    const step = /** @type {NonNullable<typeof steps>} */ (steps)[i];
    tab = drivenTab(step, { ...opts, phaseId: step.phase ?? null }) ?? tab;
  }
  return tab;
}

/**
 * The tab to show at a step and the reader's standing choice after it.
 * @param {{driven: PanelTab | null, current: PanelTab, manual: ManualChoice | null, node: string | null}} input `driven`: `drivenTab`'s answer; `current`: the tab that is open;
 *   `manual`: the reader's click (and the node it was made on); `node`: the flowchart node of this step
 * @returns {{tab: PanelTab, manual: ManualChoice | null}}
 */
export function nextPanelTab({ driven, current, manual, node }) {
  if (manual && manual.node === node) return { tab: manual.tab, manual }; // a click holds while the walk stays on its node
  return { tab: driven ?? current, manual: null }; // the walk moved on (or nothing was clicked): the player drives again
}

/**
 * The route parameter of a tab (`panel`). View state like `vals` and `nb`: written with `router.replace`, no part of the trace's key, never sent to the API.
 * @param {PanelTab} tab
 * @returns {PanelTab}
 */
export function panelParam(tab) {
  return tab === "factors" || tab === "network" || tab === "flow" ? tab : "matrix"; // WP-245: the feature page names its flowchart tab
}

/**
 * The tab a `panel` route parameter names on a page, null when it names none (absent, malformed, or the OTHER page's second tab: `panel=network` means nothing on the MF page).
 * @param {unknown} raw
 * @param {string} [engine] the page ("mf" by default)
 * @param {"matrix" | "flow"} [first] WP-245: the strip's first tab; on the feature page (`flow`) the old `panel=matrix` of a saved link means the tab that is not the Network, the flowchart
 * @returns {PanelTab | null}
 */
export function tabFromParam(raw, engine = "mf", first = "matrix") { // WP-245
  const second = secondTabFor(engine);
  if (raw === "matrix") return first;
  if (raw === "flow") return first === "flow" ? "flow" : null; // WP-245: only the feature page has this tab
  return second !== null && raw === second ? second : null;
}

// -- WP-158: the lower boxes ------------------------------------------------------------------------------------------------------------------------------------
// The MF and the neural page's two lower panels each gain a tab: the FORMULA panel's second tab is the "Latent space", the CODE panel's the "Training curve" (they used to be
// two panels of their own under the block). Each panel decides for itself, from what the step carries - its OWN highlights and the formula / source line it names - and
// never from a list of step names:
//   * formula box: the step's embedding highlight PERSISTS (the initialisation, every epoch, early stopping: the frame on screen is the story) -> the latent space; else the
//     step carries a formula -> the formula; else it carries nothing for this box -> the tab that is open stays;
//   * code box: the step names the curve -> the training curve; else it carries a source line -> the code; else nothing -> the open tab stays.
// An embedding highlight that does NOT persist is the engine marking the user's and the film's points on the PREDICT and the forward-pass steps ("the two vectors sit here"):
// steps whose subject is the formula (measured: MF predict, DNN embedding lookups), so it only accompanies the formula - else the central formula of the course would sit behind
// the scatter and a neural walk would flip formula / latent / formula at every lookup. The first step starts on the box's first tab (Formula / Code). Because a step that carries
// nothing leaves the open tab, the tab at a step depends on the steps before it: a link to a step replays the walk (`lowerTabBefore`). WP-158b: but a box is never left EMPTY
// once its second view has appeared - a step that carries nothing for the box (the result step has no formula and no source line) shows the second view when an earlier step of
// the walk drove it (the last latent frame, the whole training curve) instead of "No formula at this step" / "No code reference"; before the second view has ever appeared (the
// pick and holdout steps, ahead of the training) the open tab stays, placeholder and all (`lowerStepTab`). A box whose second view does not exist
// (EASE is closed form, a top-K trace carries no curve / latent view) keeps its first tab. A click holds until the walk leaves the flowchart node it was made on (the same rule as
// the sub-matrix panel).

/** @typedef {"formula" | "latent"} FormulaBoxTab */
/** @typedef {"code" | "curve"} CodeBoxTab */
/** @typedef {FormulaBoxTab | CodeBoxTab} LowerTab */
/** @typedef {{tab: LowerTab, node: string | null}} LowerManual */

/** the two lower boxes and the route parameter of each (view state like `panel`) */
export const LOWER_BOXES = /** @type {const} */ ({ formula: { first: "formula", second: "latent", param: "fbox" }, code: { first: "code", second: "curve", param: "cbox" } });

/**
 * The tab the step drives in the FORMULA box, null when it carries nothing for it (the open tab stays).
 * @param {{highlights?: {view?: string, persist?: boolean}[], formula?: unknown} | null | undefined} step the trace step (its OWN highlights; `formula` is null / absent when it has none)
 * @param {{hasLatent?: boolean}} [opts] `hasLatent`: whether the trace has the latent-space view at all (false: the box keeps the formula)
 * @returns {FormulaBoxTab | null}
 */
export function formulaBoxTab(step, opts = {}) {
  const { hasLatent = true } = opts;
  if (!hasLatent) return "formula";
  if ((step?.highlights || []).some((h) => h.view === "embedding" && h.persist === true)) return "latent";
  return step?.formula ? "formula" : null;
}

/**
 * The tab the step drives in the CODE box, null when it carries nothing for it (the open tab stays).
 * @param {{highlights?: {view?: string}[], code?: unknown} | null | undefined} step the trace step (`code` is null / absent when it names no source line)
 * @param {{hasCurve?: boolean}} [opts] `hasCurve`: whether the trace has a training curve at all (false: the box keeps the code)
 * @returns {CodeBoxTab | null}
 */
export function codeBoxTab(step, opts = {}) {
  const { hasCurve = true } = opts;
  if (!hasCurve) return "code";
  if ((step?.highlights || []).some((h) => h.view === "curve")) return "curve";
  return step?.code ? "code" : null;
}

/**
 * WP-158b: what a step drives in one lower box. The step's own answer (`formulaBoxTab` / `codeBoxTab`); when it carries nothing for the box, the box's SECOND view if an earlier
 * step of the walk drove it (the walk has shown that view: a box that has begun to show the training does not go back to an empty first tab at the end of it), else null (the open tab
 * stays: before the training - the pick and holdout steps - the placeholder remains). Read from the steps before this one, never from the walk's history, so a jump, a step back
 * and a link all give the same answer. A box whose second view does not exist never has an earlier step that drives it.
 * @param {"formula" | "code"} box
 * @param {{highlights?: {view?: string, persist?: boolean}[], formula?: unknown, code?: unknown}[] | null | undefined} steps the trace's steps
 * @param {number} index the step
 * @param {{hasLatent?: boolean, hasCurve?: boolean}} [opts] whether the trace has the box's second view
 * @returns {LowerTab | null}
 */
export function lowerStepTab(box, steps, index, opts = {}) {
  const list = steps ?? [];
  const own = box === "formula" ? formulaBoxTab(list[index], opts) : codeBoxTab(list[index], opts);
  if (own !== null) return own;
  const { second } = LOWER_BOXES[box];
  for (let i = 0; i < Math.min(Math.max(0, Math.floor(index)), list.length); i += 1) {
    if ((box === "formula" ? formulaBoxTab(list[i], opts) : codeBoxTab(list[i], opts)) === second) return second;
  }
  return null;
}

/**
 * The tab to show in one lower box at a step: the reader's click while the walk stays on the node it was made on, else the player's answer, else the tab that is open.
 * @param {{driven: LowerTab | null, current: LowerTab, manual: LowerManual | null, node: string | null}} input
 * @returns {{tab: LowerTab, manual: LowerManual | null}}
 */
export function nextLowerTab({ driven, current, manual, node }) {
  if (manual && manual.node === node) return { tab: manual.tab, manual };
  return { tab: driven ?? current, manual: null };
}

/**
 * WP-243: the tab a lower box opens on - its first tab, except the code box of the feature page, which opens on the training curve (when the trace has one).
 * @param {"formula" | "code"} box
 * @param {{hasCurve?: boolean, curveFirst?: boolean}} [opts]
 * @returns {LowerTab}
 */
export function lowerOpeningTab(box, opts = {}) {
  return box === "code" && opts.curveFirst === true && opts.hasCurve !== false ? "curve" : LOWER_BOXES[box].first;
}

/**
 * The tab a forward walk has on screen just before step `upTo` in one lower box, with nothing clicked: what a link to step `upTo` that names no tab starts from (a step that carries
 * nothing for the box leaves the open tab, so it depends on the steps before it - the walk is replayed from step 0, which opens on the box's first tab).
 * @param {"formula" | "code"} box
 * @param {{highlights?: {view?: string, persist?: boolean}[], formula?: unknown, code?: unknown}[] | null | undefined} steps the trace's steps
 * @param {number} upTo the step the link opens on (steps `0 .. upTo - 1` are walked; 0: the first tab)
 * @param {{hasLatent?: boolean, hasCurve?: boolean, curveFirst?: boolean}} [opts] whether the trace has the box's second view; WP-243 `curveFirst`: the code box opens on the training curve
 * @returns {LowerTab}
 */
export function lowerTabBefore(box, steps, upTo, opts = {}) {
  /** @type {LowerTab} */
  let tab = lowerOpeningTab(box, opts);
  const walked = Math.min(Math.max(0, Math.floor(upTo)), steps?.length ?? 0);
  for (let i = 0; i < walked; i += 1) {
    tab = lowerStepTab(box, steps, i, opts) ?? tab; // WP-158b: the step's own answer, else the second view once the walk has shown it
  }
  return tab;
}

/**
 * The tab a lower box's route parameter (`fbox` | `cbox`) names, null when it names none (absent, malformed, or the OTHER box's tab).
 * @param {"formula" | "code"} box
 * @param {unknown} raw
 * @returns {LowerTab | null}
 */
export function lowerFromParam(box, raw) {
  const { first, second } = LOWER_BOXES[box];
  return raw === first || raw === second ? /** @type {LowerTab} */ (raw) : null;
}
