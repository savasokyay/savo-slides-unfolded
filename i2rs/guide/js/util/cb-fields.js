// @ts-check
// WP-176: the content page's FIELD choice in the URL and in the request.
//
// The content page builds its item profiles from the fields the reader picks (config/algorithms.yaml `cb.fields_available`: genres, keywords, directors, ...; the overview text).
// Three route parameters carry the choice (design note §8): `f` the selected fields (a comma list), `fw` their weights (`genres:1,keywords:2`) and `tf` the term-frequency damping
// (`raw` | `sqrt` | `log`). The engine's defaults stay out of the URL (a plain deep link stays short): `f` is absent while the choice is the default one, `fw` names only the fields
// whose weight is not the default 1, `tf` is absent for `raw`. Pure functions over plain values, hand-derived in tests/app/js/cb_fields_check.mjs under node.

/** the weight a selected field has when the request does not name it (algorithms.yaml `cb.fields_available.<field>.weight`) */
export const DEFAULT_WEIGHT = 1;
/** the damping choices the engine accepts (`cb.tf`) */
export const TF_MODES = ["raw", "sqrt", "log"];

/**
 * `genres,keywords` -> ["genres", "keywords"]: trimmed, empty entries and repeats dropped, the order kept.
 * @param {unknown} raw the `f` route parameter
 * @returns {string[]}
 */
export function parseFieldList(raw) {
  if (typeof raw !== "string") return [];
  const out = [];
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * `genres:1,keywords:2.5` -> {genres: 1, keywords: 2.5}. An entry with no name, no colon or a weight that is not a finite number >= 0 is dropped (the server would answer 422 for
 * it); a repeated field keeps its last weight.
 * @param {unknown} raw the `fw` route parameter
 * @returns {Record<string, number>}
 */
export function parseFieldWeights(raw) {
  /** @type {Record<string, number>} */
  const out = {};
  if (typeof raw !== "string") return out;
  for (const part of raw.split(",")) {
    const at = part.lastIndexOf(":");
    if (at <= 0) continue;
    const name = part.slice(0, at).trim();
    const text = part.slice(at + 1).trim();
    const weight = Number(text);
    if (name && text !== "" && Number.isFinite(weight) && weight >= 0) out[name] = weight;
  }
  return out;
}

/**
 * The `f` parameter of a selection: the selected fields in the registry's order, or undefined when that is the default selection (as a set).
 * @param {string[]} selected the fields that are ticked
 * @param {string[]} defaults the engine's default selection (`cb.fields`)
 * @param {string[]} order the registry's field order
 * @returns {string | undefined}
 */
export function formatFieldList(selected, defaults, order) {
  const sorted = order.filter((name) => selected.includes(name));
  const same = sorted.length === defaults.length && defaults.every((name) => sorted.includes(name));
  return sorted.length === 0 || same ? undefined : sorted.join(",");
}

/**
 * The `fw` parameter of a set of weights: only the SELECTED fields whose weight is not the default, in the registry's order; undefined when there is none.
 * @param {Record<string, number>} weights field -> weight
 * @param {string[]} selected the fields that are ticked
 * @param {string[]} order the registry's field order
 * @returns {string | undefined}
 */
export function formatFieldWeights(weights, selected, order) {
  const parts = order
    .filter((name) => selected.includes(name) && Number.isFinite(weights[name]) && weights[name] !== DEFAULT_WEIGHT)
    .map((name) => `${name}:${String(weights[name])}`);
  return parts.length ? parts.join(",") : undefined;
}

/** WP-176a (a): the values of the supervised term weighting (the request key `feature_weighting`, route `gw`): `none` is the engine default, `gini` scales every term by g(w) = a - Gini(w) */
export const FEATURE_WEIGHTINGS = ["none", "gini"];

/**
 * The route parameters -> the pieces of the engine config they name (`fields`, `weights`, `tf`, `feature_weighting`); a parameter that is absent or unusable adds nothing.
 * @param {Record<string, string | undefined>} params
 * @returns {{fields?: string[], weights?: Record<string, number>, tf?: string, feature_weighting?: string}}
 */
export function fieldConfigFromParams(params) {
  /** @type {{fields?: string[], weights?: Record<string, number>, tf?: string, feature_weighting?: string}} */
  const out = {};
  const fields = parseFieldList(params.f);
  if (fields.length) out.fields = fields;
  const weights = parseFieldWeights(params.fw);
  if (Object.keys(weights).length) out.weights = weights;
  if (params.tf !== undefined && TF_MODES.includes(params.tf)) out.tf = params.tf;
  // WP-176a (a): `gw=gini` (the form writes it only while the box is ticked; `gw=none` is read too, for an engine whose default is gini); `a` of g(w) is never a route parameter (the configuration's)
  if (params.gw !== undefined && FEATURE_WEIGHTINGS.includes(params.gw)) out.feature_weighting = params.gw;
  return out;
}

/**
 * The inverse of `fieldConfigFromParams` for an engine config as the API echoes it (the lecture doors and the pitfall gallery link with it): the default selection, the default
 * weights and `raw` stay out.
 * @param {{fields?: unknown, weights?: unknown, tf?: unknown, feature_weighting?: unknown}} config
 * @returns {Record<string, string>}
 */
export function fieldParamsFromConfig(config) {
  /** @type {Record<string, string>} */
  const p = {};
  const fields = Array.isArray(config.fields) ? config.fields.map(String) : [];
  if (fields.length && !(fields.length === 1 && fields[0] === "genres")) p.f = fields.join(",");
  const weights = config.weights && typeof config.weights === "object" ? /** @type {Record<string, number>} */ (config.weights) : {};
  const fw = formatFieldWeights(weights, Object.keys(weights), Object.keys(weights));
  if (fw) p.fw = fw;
  if (typeof config.tf === "string" && config.tf !== "raw" && TF_MODES.includes(config.tf)) p.tf = config.tf;
  if (config.feature_weighting === "gini") p.gw = "gini"; // WP-176a (a): `none` is the default and stays out
  return p;
}

/**
 * WP-176c: the state of the master box above the field chips, from how many of the registry's fields are ticked: "all" (checked), "none" (unchecked) or "some" (the square: a partial
 * choice, `indeterminate`).
 * @param {number} ticked the fields that are ticked
 * @param {number} total the fields of the registry
 * @returns {"all" | "some" | "none"}
 */
export function fieldsMasterState(ticked, total) {
  if (total > 0 && ticked >= total) return "all";
  return ticked > 0 ? "some" : "none";
}

/**
 * WP-176c: what a click on the master box does - every field ticked unticks them all; none or some ticks them all.
 * @param {number} ticked the fields that are ticked
 * @param {number} total the fields of the registry
 * @returns {boolean} true: tick every field; false: untick every field
 */
export function fieldsMasterTarget(ticked, total) {
  return fieldsMasterState(ticked, total) !== "all";
}

/**
 * WP-176c: whether Apply must wait - the engine builds the item profiles from at least one field (an empty `fields` list is a 422 `bad_engine_config`), and the route cannot carry an empty
 * choice (`formatFieldList` turns it into "absent = the default"), so a form with no field ticked would silently apply `genres`.
 * @param {number} ticked the fields that are ticked
 * @param {number} total the fields of the registry (0: no registry, nothing to block)
 * @returns {boolean}
 */
export function fieldsBlockApply(ticked, total) {
  return total > 0 && ticked === 0;
}

/**
 * WP-176d: why Apply must wait, or null when it need not. Two reasons, both a 422 at the API and a silent change on the page: no field is ticked (`no_field`: see `fieldsBlockApply`), or
 * every ticked field has a weight of 0 or less (`zero_weights`: `cb_weights_invalid` - the engine wants at least one ticked field with a weight above 0, so with all at 0 there is no profile).
 * A weight that is not a finite number counts as not above 0. The weights of the fields that are NOT ticked never matter (their boxes are disabled).
 * @param {number} ticked the fields that are ticked
 * @param {number} total the fields of the registry (0: no registry, nothing to wait for)
 * @param {number[]} tickedWeights the weight boxes' numbers of the ticked fields
 * @returns {"no_field" | "zero_weights" | null}
 */
export function fieldsApplyWait(ticked, total, tickedWeights) {
  if (fieldsBlockApply(ticked, total)) return "no_field";
  if (total > 0 && ticked > 0 && !tickedWeights.some((w) => Number.isFinite(w) && w > 0)) return "zero_weights";
  return null;
}

/**
 * WP-208: which of the content page's method-bound controls a method really READS. The panel drew the same set for every method, so a reader could tick a setting the method never looks at
 * (the taste profile has no neighbours: k, significance weighting and "min shared tags" did nothing; the per-user model learns its own weight per term: neither did those three). The
 * fields, their weights, tf and the Gini weighting build the item profiles every method starts from - they are always drawn; the list length and the MMR lambda belong to the top-K task alone
 * (the form adds them there). What is left, per method and task, measured against the engine (tests/app/test_cb_param_panel.py: moving a hidden setting moves no number, moving a drawn one
 * does):
 *   `k`     the neighbour count - the item method's prediction (in top-K the route's `k` is the LIST length instead, so the control is not drawn there, though the engine reads it);
 *   `sw`    significance weighting (mode and n) - the item method, both tasks;
 *   `mst`   the minimum number of shared terms - the item method, both tasks;
 *   `clip`  clipping to the rating scale - the per-user model only: the item method's prediction is an average of the user's own ratings, which never leaves the scale (0 of 40 films moved),
 *           and a taste profile's score is no rating;
 *   `model` the model's kind and its penalty - the per-user model only.
 * @typedef {"k" | "sw" | "mst" | "clip" | "model"} CbControl
 */
const CB_SHOWN = {
  item: { predict: ["k", "sw", "mst"], topk: ["sw", "mst"] },
  profile: { predict: [], topk: [] },
  model: { predict: ["clip", "model"], topk: ["clip", "model"] },
};

/**
 * @param {string | undefined} method the route's `m` (`item` | `profile` | `model`; anything else is the page's default, `item`)
 * @param {string | undefined} task `predict` | `topk` (anything else is `predict`)
 * @returns {Set<CbControl>} the method-bound controls to draw
 */
export function cbControlsFor(method, task) {
  const byTask = CB_SHOWN[/** @type {keyof typeof CB_SHOWN} */ (method && Object.hasOwn(CB_SHOWN, method) ? method : "item")]; // an own key: a route's `m=constructor` is no method
  return new Set(/** @type {CbControl[]} */ (byTask[task === "topk" ? "topk" : "predict"]));
}
