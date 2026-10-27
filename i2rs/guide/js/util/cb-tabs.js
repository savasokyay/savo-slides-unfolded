// @ts-check
// WP-176 (stages 2 and 3): the tabs of the content page's sub-matrix panel, per method, which tab a step opens - and the tabs of its lower-right table panel.
//
// The content page has two methods (WP-177b: the route's `m`): "item" - the TF-IDF item profiles and their cosine predict a rating - and "profile" - the user's taste profile and the
// relevance score of a film. The panel's tabs follow the method:
//   item:    Profile matrix (the films x terms table)  |  TF-IDF (the target film's terms: tf, df, idf, weight)  |  Feature selection (the terms scored against the user's liked films)
//   profile: Taste profile (the profile view and the table that explains its score)  |  TF-IDF  |  Feature selection
// Like the MF and the neural page's second tab (util/panel-tab.js), the PLAYER decides which tab is open from what the step carries -
// never from a list of step names - and a tab the reader clicked holds until the walk leaves the flowchart node it was clicked on (`nextPanelTab` of panel-tab.js, which only
// compares strings, is the same rule). What a step carries:
//   * it references the `tfidf` table (the profile step: the film's description becomes terms)  -> the TF-IDF tab - before the sub-matrix: the step also marks the target's row there,
//     but the table is what is new at that step;
//   * it highlights the `profile` view (the taste-profile step; on the profile method also the result step, which carries the feature table too) -> the taste-profile tab;
//   * it references the `feature_scores` table, or belongs to the feature-selection PHASE         -> the feature-selection tab. A pair whose scores are undefined (too few disliked films)
//     has the phase and the step but no table: the tab then says why, so the phase (the trace's own word, not a step name) is the second test;
//   * it highlights the sub-matrix (`submatrix`)                                                -> the matrix tab, so the row the narration points at is never behind a covered tab;
//   * it carries none of those                                                                  -> the tab that is open stays.
// A tab the method does not have is never driven (the profile method has no matrix tab: a step that highlights the sub-matrix leaves the open tab).
// WP-195c: the page's third method, "model" - the per-user content model (a regressor learned from ONE user's own rated films, docs/plans/2610171557-per-user-content-model-design.md): its
// panel is `Profile matrix | Weights | Fit`. The matrix is the films x terms table the model trains on (a step that highlights the sub-matrix), "Weights" is the `profile` view (the learned
// weights over the target film's TF-IDF row) with the `weights` table under it (a step that highlights the `profile` view), and "Fit" is the fit summary (the step of the `fit` phase).
// WP-199: with the small network as the model's kind (`mk=mlp`) the panel has a fourth tab, `Profile matrix | Weights | Fit | Network`: the diagram of the network (the engine's `network` view:
// the film's terms, the hidden units, the output deviation). The regression has none. A step that LIGHTS a stage of the diagram (`network` highlight, style active or result: the forward pass of
// the prediction step, the output of the result step) drives it - before the Weights tab, whose `profile` highlight those steps keep carrying; the fit step marks the whole network as
// context (style neighbor) and stays on the Fit tab, whose curve is its subject (a neighbor highlight alone never drives).
// Pure functions, checked under node against hand-derived cases (tests/app/js/cb_tabs_check.mjs); the page only calls them and draws.

/** @typedef {"matrix" | "profile" | "tfidf" | "features" | "fit" | "network"} CbTab */

/** the tabs of each method, in the order of the strip (the first is the method's own view) */
const TABS = /** @type {const} */ ({ item: ["matrix", "tfidf", "features"], profile: ["profile", "tfidf", "features"], model: ["matrix", "profile", "fit"] });
/** WP-199: the small network's panel (the model method with `mk=mlp`) */
const NETWORK_TABS = /** @type {const} */ (["matrix", "profile", "fit", "network"]);

/** the phase of the supervised feature selection (the trace's id; the request key `feature_selection: false` leaves it out - no route parameter has that name) */
const FEATURE_PHASE = "feature_selection";

/** WP-195c: the phase in which the per-user model is fitted (the trace's id; the step that carries the ridge formula and the training error) */
const FIT_PHASE = "fit";

/**
 * @param {unknown} method the route's `m`
 * @returns {"item" | "profile" | "model"} "profile" for `profile`, "model" for `model` (WP-195c), "item" for anything else (the page's default)
 */
export function methodOf(method) {
  return method === "profile" ? "profile" : method === "model" ? "model" : "item";
}

/**
 * @param {unknown} method the route's `m`
 * @param {unknown} [kind] WP-199: the per-user model's kind (the route's `mk`): "mlp" gives the small network's panel its fourth tab; any other value is the regression's three
 * @returns {CbTab[]} the tabs of that method's panel, in strip order
 */
export function cbTabsFor(method, kind) {
  return methodOf(method) === "model" && kind === "mlp" ? [...NETWORK_TABS] : [...TABS[methodOf(method)]];
}

/**
 * The tab a step drives, or null when it drives none of the method's tabs (the open tab stays).
 * @param {{phase?: string, highlights?: {view?: string, style?: string}[], tables?: {table_id?: string}[]} | null | undefined} step the trace step (its OWN highlights and table references, and its phase)
 * @param {CbTab[]} tabs the method's tabs (`cbTabsFor`)
 * @returns {CbTab | null}
 */
export function cbDrivenTab(step, tabs) {
  const views = new Set((step?.highlights || []).map((h) => h.view ?? "submatrix")); // a highlight with no view is the sub-matrix's
  const tables = new Set((step?.tables || []).map((t) => t.table_id));
  // WP-199: a stage of the diagram lit (active / result); a `neighbor` highlight is the whole network as context (the fit step) and drives nothing
  const lit = tabs.includes("network") && (step?.highlights || []).some((h) => h.view === "network" && h.style !== "neighbor");
  /** @type {CbTab | null} */
  const wanted = tables.has("tfidf")
    ? "tfidf"
    : lit
      ? "network"
      : views.has("profile")
        ? "profile"
        : step?.phase === FIT_PHASE
          ? "fit"
          : tables.has("feature_scores") || step?.phase === FEATURE_PHASE
            ? "features"
            : views.has("submatrix")
              ? "matrix"
              : null;
  return wanted !== null && tabs.includes(wanted) ? wanted : null;
}

/**
 * The tab a forward walk has on screen just before step `upTo`, with nothing clicked: what a link to step `upTo` that names no `panel` starts from. A step that drives none of the
 * tabs leaves the open one, so the tab at a step depends on the steps before it - the walk is replayed from step 0, which opens on the method's own tab.
 * @param {{phase?: string, highlights?: {view?: string}[], tables?: {table_id?: string}[]}[] | null | undefined} steps the trace's steps
 * @param {number} upTo the step the link opens on (steps `0 .. upTo - 1` are walked)
 * @param {CbTab[]} tabs the method's tabs
 * @returns {CbTab}
 */
export function cbTabBefore(steps, upTo, tabs) {
  let tab = tabs[0];
  const walked = Math.min(Math.max(0, Math.floor(upTo)), steps?.length ?? 0);
  for (let i = 0; i < walked; i += 1) tab = cbDrivenTab(/** @type {NonNullable<typeof steps>} */ (steps)[i], tabs) ?? tab;
  return tab;
}

/**
 * The tab a `panel` route parameter names on this method's panel, null when it names none (absent, malformed, or another method's tab: `panel=matrix` means nothing on the
 * profile method).
 * @param {unknown} raw the `panel` route parameter
 * @param {CbTab[]} tabs the method's tabs
 * @returns {CbTab | null}
 */
export function cbTabFromParam(raw, tabs) {
  return typeof raw === "string" && /** @type {string[]} */ (tabs).includes(raw) ? /** @type {CbTab} */ (raw) : null;
}

// -- the lower-right table panel (stage 3) --------------------------------------------------------------------------------------------------------------------------
// The panel under the flowchart shows ONE of three tables of the similarity walk, behind a small tab strip in its title row: the candidates (`items`), what each field adds to a
// candidate's similarity (`contributions`) and what each neighbour adds to the prediction (`prediction_contrib`). The step decides which, again from what it carries (its table
// references), with one rule for the first two, which the walk's loop carries TOGETHER at every candidate: a table the step carries and the previous step did not is "fresh"; the
// open tab stays when it is fresh, else the first fresh table in the order below wins; a step with nothing fresh keeps the open tab while the step still carries it, else the first
// table it carries; a step that carries none leaves the open tab. So the loop does not undo a reader's click on "Per field" at every candidate, while the ranking (the candidates
// again) and the prediction (its shares are fresh next to the ranked candidates) still bring their own table forward.

/** @typedef {"items" | "contributions" | "prediction_contrib" | "films"} CbTable */

/** the tables of the lower-right panel, in strip order (the similarity walk's; the per-user model has its own, `cbTablesFor("model")`) */
export const CB_TABLES = /** @type {const} */ (["items", "contributions", "prediction_contrib"]);
/** the order a choice between fresh tables is made in: the prediction's own shares first, then the candidates */
const TABLE_PRIORITY = /** @type {const} */ (["prediction_contrib", "items", "contributions"]);
/**
 * WP-195c: the per-user model's lower-right tables - the films the model learned from (the rows of X, with the user's centred ratings: the `data` step) and what each term adds to the
 * prediction (the `predict` step). Its `weights` table is the Weights tab's, in the panel above (the learned weights are the profile view's row), so the strip does not repeat it.
 */
const MODEL_TABLES = /** @type {const} */ (["films", "contributions"]);
/** the model's order of choice between fresh tables: the prediction's term shares first */
const MODEL_PRIORITY = /** @type {const} */ (["contributions", "films"]);

/**
 * @param {unknown} method the route's `m`
 * @returns {readonly CbTable[]} the tables of that method's lower-right panel, in strip order
 */
export function cbTablesFor(method) {
  return methodOf(method) === "model" ? MODEL_TABLES : CB_TABLES;
}

/** @param {unknown} method @returns {readonly CbTable[]} */
const priorityOf = (method) => (methodOf(method) === "model" ? MODEL_PRIORITY : TABLE_PRIORITY);

/**
 * @param {{tables?: {table_id?: string}[]} | null | undefined} step
 * @param {readonly string[]} available the tables the trace has
 * @param {unknown} [method] the route's `m` (default: the similarity walk's tables)
 * @returns {CbTable[]} the lower-right tables the step references, in strip order
 */
export function cbTablesCarried(step, available, method) {
  const ids = new Set((step?.tables || []).map((t) => t.table_id));
  return /** @type {CbTable[]} */ (cbTablesFor(method).filter((id) => ids.has(id) && available.includes(id)));
}

/**
 * The table a step shows in the lower-right panel (the open one when the step brings none).
 * @param {{tables?: {table_id?: string}[]} | null | undefined} step
 * @param {{tables?: {table_id?: string}[]} | null | undefined} previous the step before it in the trace (null at the first)
 * @param {CbTable} current the table that is open
 * @param {readonly string[]} available the tables the trace has
 * @param {unknown} [method] the route's `m` (default: the similarity walk's tables)
 * @returns {CbTable}
 */
export function cbTableDriven(step, previous, current, available, method) {
  const carried = cbTablesCarried(step, available, method);
  if (!carried.length) return current;
  const before = cbTablesCarried(previous, available, method);
  const fresh = carried.filter((id) => !before.includes(id));
  if (fresh.length) return fresh.includes(current) ? current : /** @type {CbTable} */ (priorityOf(method).find((id) => fresh.includes(id)));
  return carried.includes(current) ? current : carried[0];
}

/**
 * The table a forward walk has on screen just before step `upTo`, nothing clicked: what a link to step `upTo` that names no `tbl` starts from (the walk is replayed from step 0,
 * which opens on the first table the trace has - the candidates).
 * @param {{tables?: {table_id?: string}[]}[] | null | undefined} steps
 * @param {number} upTo
 * @param {readonly string[]} available
 * @param {unknown} [method] the route's `m` (default: the similarity walk's tables)
 * @returns {CbTable}
 */
export function cbTableBefore(steps, upTo, available, method) {
  const tables = cbTablesFor(method);
  let tab = /** @type {CbTable} */ (tables.find((id) => available.includes(id)) ?? tables[0]);
  const walked = Math.min(Math.max(0, Math.floor(upTo)), steps?.length ?? 0);
  const list = steps ?? [];
  for (let i = 0; i < walked; i += 1) tab = cbTableDriven(list[i], i > 0 ? list[i - 1] : null, tab, available, method);
  return tab;
}

/**
 * The table a `tbl` route parameter names, null when it names none (absent, malformed, or a table the trace does not have).
 * @param {unknown} raw
 * @param {readonly string[]} available
 * @param {unknown} [method] the route's `m` (default: the similarity walk's tables)
 * @returns {CbTable | null}
 */
export function cbTableFromParam(raw, available, method) {
  return typeof raw === "string" && /** @type {readonly string[]} */ (cbTablesFor(method)).includes(raw) && available.includes(raw) ? /** @type {CbTable} */ (raw) : null;
}
