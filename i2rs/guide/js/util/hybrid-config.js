// @ts-check
// WP-222: the route <-> engine-config translation of the hybrid page (`#/combine?m=weighted&bases=ucf,icf&w=gd&...`), as pure functions so tests/app/js/hybrid_config_check.mjs can pin it under
// node. The route's keys (design note 2.1, amendments 2 and 3): `m` (method), `bases` (comma list), `w` (weights), `hf` (holdout_frac), `hc` (holdout_max_per_user), `mr` (min_ratings), `wc`
// (constraint), `gs` (gd_steps), `gss` (gd_step_scale), `rl` (ridge_lambda), `fo` (fit_on), plus the generic `clip` and `seed`. A default stays out of the route (a plain deep link stays short)
// and out of the request (the engine's own default applies). `lam` is the MMR lambda of the content page's top-K task and `cs` the kNN pages' cosine support: neither is a hybrid key.
// The global `configFromParams` (pages/trace-page.js) hands a hybrid route (`m` is one of HYBRID_METHODS) to `hybridConfigFromParams` and returns its answer whole: `mr` is the model pages'
// "min raters" there and would otherwise reach the engine as `min_raters`, a field the hybrid config (extra="forbid") does not have.
// WP-222b: the switching walk (`#/combine?m=switching`) adds its own keys, read on a switching route only (the contract's route_params, tests/fixtures/hybrid_trace_contract_switching.json):
// `sr` (switch_rule: bucket | neighbours), `sh` (switch_holdout_frac: the newest share of the ACTIVE user's own ratings), `cr` (criterion: rmse | mae), `so` (select_on: heldout | train, the
// labelled foil), `cfb` (cf_base: icf | ucf, the neighbour rule's collaborative base), `mn` (min_neighbours). `bases`, `hc` and `mr` serve both walks.

/** the methods the hybrid page's route names (`m`): the learned blend, the bucket of models / the cold-start rule (WP-222b), the meta-level hybrid (planned: its walk is not built yet) */
export const HYBRID_METHODS = /** @type {const} */ (["weighted", "switching", "meta"]);
/** the base recommenders, in the engine's order (the order of the weights) */
export const HYBRID_BASES = /** @type {const} */ (["ucf", "icf", "mf", "cb"]);
/** which weight vector predicts the target (`w`) */
export const WEIGHTS = /** @type {const} */ (["ridge", "gd", "equal"]);
/** WP-222b: the switching walk's rules (`sr`): the bucket of models (one winner for the user) or the cold-start neighbour rule (one choice per film) */
export const SWITCH_RULES = /** @type {const} */ (["bucket", "neighbours"]);
/** WP-222b: the error that picks the bucket's winner (`cr`); the leaderboard shows both */
export const CRITERIA = /** @type {const} */ (["rmse", "mae"]);
/** WP-222b: the collaborative base of the neighbour rule (`cfb`); the content base is always `cb` */
export const CF_BASES = /** @type {const} */ (["icf", "ucf"]);

/** @param {unknown} raw @returns {boolean} whether the route's `m` names a hybrid method */
export function isHybridMethod(raw) {
  return typeof raw === "string" && /** @type {readonly string[]} */ (HYBRID_METHODS).includes(raw);
}

/**
 * The bases a `bases` route value names: known ids only, in the engine's order whatever the order in the link, no repeats. Fewer than two (a blend of one is no blend: the engine answers 422)
 * or nothing known - the default (all four), so null.
 * @param {unknown} raw e.g. "icf,ucf"
 * @returns {string[] | null}
 */
export function basesFromParam(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const named = new Set(raw.split(",").map((part) => part.trim()));
  const chosen = HYBRID_BASES.filter((id) => named.has(id));
  return chosen.length >= 2 ? [...chosen] : null;
}

/**
 * The `bases` route value of a set of ticked boxes: undefined for the default (all four), else the engine's order as a comma list.
 * @param {readonly string[]} chosen
 * @returns {string | undefined}
 */
export function basesParam(chosen) {
  const ordered = HYBRID_BASES.filter((id) => chosen.includes(id));
  return ordered.length === HYBRID_BASES.length || ordered.length < 2 ? undefined : ordered.join(",");
}

/** @param {unknown} raw @returns {number | null} a finite number, null for anything else (an empty string is not zero) */
function num(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The engine config a hybrid route stands for (`HybridConfig` fields, `config/algorithms.yaml: hybrid`). A value the engine would refuse is dropped, not sent: the walk then runs with the
 * default and the Parameters panel shows it (the server would answer 422 and the page a toast, for a link somebody mistyped).
 * @param {Record<string, string>} params
 * @returns {Record<string, unknown>}
 */
export function hybridConfigFromParams(params) {
  /** @type {Record<string, unknown>} */
  const config = {};
  if (params.m === "switching") config.method = "switching"; // `weighted` is the engine's default
  const bases = basesFromParam(params.bases);
  if (bases && bases.length < HYBRID_BASES.length) config.bases = bases;
  if (typeof params.w === "string" && /** @type {readonly string[]} */ (WEIGHTS).includes(params.w) && params.w !== "ridge") config.weights = params.w;
  const hf = num(params.hf);
  if (hf !== null && hf > 0 && hf < 1) config.holdout_frac = hf;
  // the per-user cap: a number of at least 1, or "none" (no cap: the engine's `null`); the default (60) stays out
  if (params.hc === "none") config.holdout_max_per_user = null;
  else {
    const hc = num(params.hc);
    if (hc !== null && hc >= 1) config.holdout_max_per_user = Math.round(hc);
  }
  const mr = num(params.mr);
  if (mr !== null && mr >= 2) config.min_ratings = Math.round(mr);
  if (params.wc === "none") config.constraint = "none"; // `sum_to_one` is the default: the weights are a weighted average
  const gs = num(params.gs);
  if (gs !== null && gs >= 1 && gs <= 200) config.gd_steps = Math.round(gs);
  const gss = num(params.gss);
  if (gss !== null && gss > 0 && gss < 2) config.gd_step_scale = gss;
  const rl = num(params.rl);
  if (rl !== null && rl >= 0) config.ridge_lambda = rl;
  if (params.fo === "train") config.fit_on = "train"; // the teaching foil; `heldout` is the default
  // WP-222b: the switching walk's keys, read on a switching route only (a weighted link that carried `cr=mae` by accident would otherwise change the request, and so the cache key, for nothing)
  if (params.m === "switching") {
    if (params.sr === "neighbours") config.switch_rule = "neighbours"; // `bucket` is the default
    const sh = num(params.sh);
    if (sh !== null && sh > 0 && sh <= 0.5) config.switch_holdout_frac = sh; // the engine: more than 0, at most a half
    if (params.cr === "mae") config.criterion = "mae"; // `rmse` is the default
    if (params.so === "train") config.select_on = "train"; // the teaching foil; `heldout` is the default
    if (params.cfb === "ucf") config.cf_base = "ucf"; // `icf` is the default
    const mn = num(params.mn);
    if (mn !== null && mn >= 1) config.min_neighbours = Math.round(mn);
  }
  if (params.clip === "1" || params.clip === "true") config.clip = true;
  const seed = num(params.seed);
  if (seed !== null && Number.isInteger(seed)) config.seed = seed;
  return config;
}

/**
 * The inverse: an engine config (as the API echoes it) -> the hybrid route's parameters, the defaults of the engine left out. The weighted walk is `m=weighted`.
 * @param {Record<string, any>} config
 * @param {Record<string, any>} [defaults] `config/algorithms.yaml: hybrid` (to leave out what equals it); without it only the engine's own constants are
 * @returns {Record<string, string>}
 */
export function hybridParamsFromConfig(config, defaults = {}) {
  /** @type {Record<string, string>} */
  const p = { m: config.method === "switching" ? "switching" : "weighted" };
  const bases = Array.isArray(config.bases) ? basesParam(config.bases) : undefined;
  if (bases) p.bases = bases;
  if (config.weights && config.weights !== "ridge") p.w = String(config.weights);
  if (typeof config.holdout_frac === "number" && config.holdout_frac !== (defaults.holdout_frac ?? 0.2)) p.hf = String(config.holdout_frac);
  if (config.holdout_max_per_user === null) p.hc = "none";
  else if (typeof config.holdout_max_per_user === "number" && config.holdout_max_per_user !== (defaults.holdout_max_per_user ?? 60)) p.hc = String(config.holdout_max_per_user);
  if (typeof config.min_ratings === "number" && config.min_ratings !== (defaults.min_ratings ?? 5)) p.mr = String(config.min_ratings);
  if (config.constraint === "none") p.wc = "none";
  if (typeof config.gd_steps === "number" && config.gd_steps !== (defaults.gd_steps ?? 30)) p.gs = String(config.gd_steps);
  if (typeof config.gd_step_scale === "number" && config.gd_step_scale !== (defaults.gd_step_scale ?? 1)) p.gss = String(config.gd_step_scale);
  if (typeof config.ridge_lambda === "number" && config.ridge_lambda !== (defaults.ridge_lambda ?? 0.01)) p.rl = String(config.ridge_lambda);
  if (config.fit_on === "train") p.fo = "train";
  // WP-222b: the switching walk's keys. The neighbour rule's bases are the engine's own ([cf_base, cb], which `cfb` says), so that link carries no `bases`
  if (p.m === "switching") {
    if (config.switch_rule === "neighbours") {
      p.sr = "neighbours";
      delete p.bases;
    }
    if (typeof config.switch_holdout_frac === "number" && config.switch_holdout_frac !== (defaults.switch_holdout_frac ?? 0.25)) p.sh = String(config.switch_holdout_frac);
    if (config.criterion === "mae") p.cr = "mae";
    if (config.select_on === "train") p.so = "train";
    if (config.cf_base === "ucf") p.cfb = "ucf";
    if (typeof config.min_neighbours === "number" && config.min_neighbours !== (defaults.min_neighbours ?? 1)) p.mn = String(config.min_neighbours);
  }
  if (config.clip === true) p.clip = "1";
  if (typeof config.seed === "number" && config.seed !== (defaults.seed ?? 0)) p.seed = String(config.seed);
  return p;
}
