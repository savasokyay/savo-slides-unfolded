// @ts-check
// WP-243: the plain logic of the feature-combination page (`#/dnn?arch=features`, the hybrid week's centrepiece). Pure and import-free, so tests/app/js/dnn_features_check.mjs checks it under
// node against hand-derived cases; trace-page.js, components/network-panel.js and components/curve-panel.js only call it.
//   * opening: the page opens on what the lesson is about - the network's diagram in the first panel and the training curve in the code box - not on the co-rated matrix and the source code;
//   * the join: which stages feed the join (the concatenation) and how many numbers each hands over - the diagram's answer to "where is the interaction";
//   * the ids-only reference: the validation error of the ids-only network the trace carries (the stored comparison variant), the one number the curve's chart can draw it from;
//   * the default pair: the page opens on a pair, not on an empty form.

/** The seed of the pair the page opens on (the "Random pick" endpoint's own seeded draw, with the pickers' guards): the same pair at every opening, so the lecture starts where the notes say. */
export const DEFAULT_PICK_SEED = 11;

/**
 * Whether the page is the feature-combination page (the neural page on its `features` architecture).
 * @param {string} engine
 * @param {Record<string, string | undefined> | null | undefined} params the route's parameters
 * @returns {boolean}
 */
export function isFeaturePage(engine, params) {
  return engine === "dnn" && params?.arch === "features";
}

/**
 * Which tabs the page opens on. The feature page opens its sub-matrix panel on the diagram and its code box on the training curve (the matrix and the source are one click away, and the
 * walk still drives both from its first step that carries something for them); every other page opens on its first tab. A tab whose view the trace lacks (a top-K trace has no network and
 * no curve) is not asked for.
 * @param {{engine: string, features: boolean, topk: boolean, hasNetwork: boolean, hasCurve: boolean}} input
 * @returns {{networkFirst: boolean, curveFirst: boolean}}
 */
export function openingTabs({ engine, features, topk, hasNetwork, hasCurve }) {
  const on = engine === "dnn" && features && !topk;
  return { networkFirst: on && hasNetwork, curveFirst: on && hasCurve };
}

/**
 * Whether a route that names no pair should be opened on the default pair: the feature page, reached without a user, a film or a task (a link that names any of them is the reader's own
 * choice) and without the choice to train (`model=fit`: the reader asked for a fresh training, which is not what an opening should start).
 * @param {{engine: string, params: Record<string, string | undefined>}} input
 * @returns {boolean}
 */
export function wantsDefaultPair({ engine, params }) {
  if (!isFeaturePage(engine, params)) return false;
  const named = (/** @type {string | undefined} */ v) => v !== undefined && v !== "";
  return !named(params.u) && !named(params.i) && !named(params.task) && params.model !== "fit";
}

/**
 * The stages that hand their output to the join (the concatenation), in the diagram's order, with the number of values each hands over.
 * @param {{layers?: {id: string, label_key: string, size: number}[], edges?: [string, string][]} | null | undefined} view the trace's network view
 * @returns {{id: string, label_key: string, size: number}[]}
 */
export function joinParts(view) {
  const layers = view?.layers ?? [];
  const into = new Set((view?.edges ?? []).filter(([, to]) => to === "concat").map(([from]) => from));
  return layers.filter((l) => into.has(l.id)).map((l) => ({ id: l.id, label_key: l.label_key, size: l.size }));
}

/**
 * The ids-only network's validation error the trace carries (the stored variant of the same settings with only the `ids` group on), for a reference line on the curve.
 * @param {{result?: {comparison?: {ids_only?: {valid_metric?: unknown, best_epoch?: unknown}} | null}} | null | undefined} trace
 * @returns {{value: number, epoch: number | null} | null}
 */
export function curveReference(trace) {
  const ids = trace?.result?.comparison?.ids_only;
  const value = Number(ids?.valid_metric);
  if (!ids || ids.valid_metric === null || ids.valid_metric === undefined || !Number.isFinite(value)) return null;
  const epoch = Number(ids.best_epoch);
  return { value, epoch: ids.best_epoch === null || ids.best_epoch === undefined || !Number.isFinite(epoch) ? null : epoch };
}

// -- WP-244: what the trace now says about the side inputs, the ids-only network's epochs and a missing comparison ------------------------------------------------------------------------------
// The trace (src/i2rs/engines/dnn: `result.side_inputs`, `result.comparison.ids_only.history`, `result.comparison_missing`, `views.network.layers[].nonzero`) is read here and nowhere else: the
// panels only draw what these functions return.

/** The side-input groups in the order the panel draws them (the user's side, then the film's; the terms before the numbers) and which ones are made of terms. */
export const SIDE_GROUPS = /** @type {const} */ ([
  { key: "user_profile", terms: true },
  { key: "item_content", terms: true },
  { key: "user_stats", terms: false },
  { key: "item_numeric", terms: false },
]);

/** The codes of `result.comparison_missing` (engine.py `COMPARISON_MISSING`): each has a sentence `curve.comparison_missing.<code>` */
export const COMPARISON_MISSING = ["store_not_consulted", "ids_only_itself", "no_ids_group", "no_stored_ids_only_variant", "stored_variant_without_metric"];

/** @param {unknown} v @returns {number | null} */
const finiteOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The side-input groups the trace carries (only the groups that are ON: the engine leaves the others out), in the panel's order.
 * @param {any} trace
 * @returns {{key: string, terms: boolean, data: any}[]}
 */
export function sideGroups(trace) {
  const side = trace?.result?.side_inputs;
  if (!side || typeof side !== "object") return [];
  return SIDE_GROUPS.flatMap(({ key, terms }) => {
    const data = side[key];
    const ok = terms ? data && typeof data === "object" && !Array.isArray(data) : Array.isArray(data) && data.length > 0;
    return ok ? [{ key, terms, data }] : [];
  });
}

/**
 * The rows (indices into the network view's `layers`) of the stages that ARE side inputs: the walk's highlight names a stage by its row.
 * @param {{layers?: {id: string}[]} | null | undefined} view
 * @returns {number[]}
 */
export function sideRows(view) {
  const ids = new Set(SIDE_GROUPS.map((g) => g.key));
  return (view?.layers ?? []).flatMap((l, row) => (ids.has(l.id) ? [row] : []));
}

/**
 * What a box of the diagram says about its width: "16 of 2000" when only some of its numbers are non-zero for this pair (a film with 16 terms in a 2000-term vocabulary, a ReLU layer with
 * dead units), the plain width otherwise (a vector whose numbers are all non-zero, or an engine that does not say).
 * @param {{size: number, nonzero?: number | null}} layer
 * @returns {{nonzero: number, size: number} | null} null: say the plain width
 */
export function nonzeroOf(layer) {
  const nz = finiteOrNull(layer?.nonzero);
  const n = finiteOrNull(layer?.size);
  return nz !== null && n !== null && nz >= 0 && nz < n ? { nonzero: nz, size: n } : null;
}

/**
 * The ids-only network's epoch history the trace carries (the stored variant of the same settings with only the `ids` group on), for a second pair of curves; null when there is none (an older
 * sidecar, or no stored variant: the chart then keeps its dashed reference line).
 * @param {any} trace
 * @returns {{epochs: number[], train: (number | null)[], valid: (number | null)[], kept: number | null, best: number | null, stopReason: string | null} | null}
 */
export function idsOnlyHistory(trace) {
  const ids = trace?.result?.comparison?.ids_only;
  const rows = Array.isArray(ids?.history) ? ids.history.filter((r) => r && finiteOrNull(r.epoch) !== null) : [];
  if (!rows.length) return null;
  const train = rows.map((r) => finiteOrNull(r.train_loss));
  const valid = rows.map((r) => finiteOrNull(r.valid_metric));
  if (!train.some((v) => v !== null) && !valid.some((v) => v !== null)) return null;
  return {
    epochs: rows.map((r) => r.epoch),
    train,
    valid,
    kept: finiteOrNull(ids.kept_epoch),
    best: finiteOrNull(ids.best_epoch),
    stopReason: typeof ids.stop_reason === "string" ? ids.stop_reason : null,
  };
}

/**
 * The epoch marks of the page's own run: the epoch with the lowest validation error and the epoch whose weights predict (they differ when early stopping was off: the last epoch predicts).
 * @param {any} trace
 * @returns {{best: number | null, kept: number | null}}
 */
export function runMarks(trace) {
  const r = trace?.result;
  const best = finiteOrNull(r?.best_epoch) ?? finiteOrNull(trace?.views?.curve?.marks?.best);
  return { best, kept: finiteOrNull(r?.kept_epoch) ?? best };
}

/**
 * Whether the trace walks the training epoch by epoch (a live fit: one step per epoch, each revealing the curve a little further). The stored history of a pretrained model is ONE step that
 * reveals the whole curve: its curve is drawn whole from the first step, not dotted until that step arrives.
 * @param {{steps?: {highlights?: {view?: string}[]}[]} | null | undefined} trace
 * @returns {boolean}
 */
export function hasEpochWalk(trace) {
  return (trace?.steps ?? []).filter((s) => (s.highlights ?? []).some((h) => h.view === "curve")).length > 1;
}

/**
 * The language key of the sentence that says why the page has no ids-only comparison; null when it has one (or when the trace does not say why: an older server).
 * @param {any} trace
 * @returns {string | null}
 */
export function comparisonHintKey(trace) {
  const code = trace?.result?.comparison_missing;
  if (trace?.result?.comparison || typeof code !== "string") return null;
  return `curve.comparison_missing.${COMPARISON_MISSING.includes(code) ? code : "store_not_consulted"}`;
}

/**
 * A signed weight as the panel and the walk's sentences draw it: "+0.15", "−0.18" (the typographic minus), two decimals.
 * @param {number} value
 * @returns {string}
 */
export function signed(value) {
  return `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(2)}`;
}

// -- WP-246: the feature network trains with its own recipe; the page's defaults, the model match and the tips' default numbers follow it ------------------------------------------------------------
// config/algorithms.yaml `dnn.by_architecture.<arch>` holds the defaults that apply to ONE architecture (the feature network: a tenth of the learning rate, batches of 128, a little weight decay and
// dropout, 30 epochs). The server hands the block with each entry's `trainer` expanded to the full block, so laying an entry over `dnn` one level deep gives the numbers the engine resolves.

/**
 * The neural page's defaults for an architecture: the generic `dnn` block with the architecture's own entry laid over it (one level deep: the entry's `trainer` is already the full trainer block).
 * An architecture with no entry (or no architecture: the plain page) keeps the generic block.
 * @param {Record<string, any> | null | undefined} dnn `algorithms.dnn`
 * @param {string | undefined} arch the route's `arch`
 * @returns {Record<string, any> | null | undefined}
 */
export function architectureDefaults(dnn, arch) {
  const entry = arch ? dnn?.by_architecture?.[arch] : undefined;
  return entry && typeof entry === "object" ? { ...dnn, ...entry } : dnn;
}

/**
 * The five numbers the neural form's tips name as defaults (`{lr}`, `{weight_decay}`, `{batch_size}`, `{dropout}`, `{max_epochs}` in `param_tip.net_*`), in the language's number format
 * (Turkish writes 0,001); an absent number is an empty string.
 * @param {Record<string, any> | null | undefined} defaults the page's defaults (`architectureDefaults`)
 * @param {string} lang "en" | "tr"
 * @returns {{lr: string, weight_decay: string, batch_size: string, dropout: string, max_epochs: string}}
 */
export function tipDefaults(defaults, lang) {
  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const show = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 8 }) : "");
  return { lr: show(defaults?.lr), weight_decay: show(defaults?.weight_decay), batch_size: show(defaults?.batch_size), dropout: show(defaults?.dropout), max_epochs: show(defaults?.trainer?.max_epochs) };
}
