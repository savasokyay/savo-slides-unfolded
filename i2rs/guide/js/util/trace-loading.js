// @ts-check
// WP-140: the LOADING of a trace, as plain logic checked under node (tests/app/js/trace_loading_check.mjs); the page (pages/trace-page.js) and the strip that shows it
// (components/trace-loading.js) read it.
//
// A model page's trace is slow because it is a FIT: a factor model is trained for the pair (the rating is held out, so the model must be trained again without it) and the neural
// model takes seconds. Before this the whole page waited for it - the title, the summary, even the selected user and film, which arrive in ~25 ms - and the trace on screen
// stayed clickable while its successor loaded. The states of a page's trace:
//   idle     nothing asked for yet (a page just opened, or left)
//   loading  the FIRST trace of the page is on its way: nothing to show yet - the panels are placeholders
//   ready    a trace is on screen and no request is running
//   stale    a trace is on screen and a NEW one is on its way: the old one is faded, inert and still there (it comes back if the request fails)
//   error    the first trace failed: there is no trace
//   failed   WP-222: a request FAILED (a lost connection, a 502, a 500) while a trace is on screen: the trace is the page's again (live, not faded - it can still be walked) but it belongs
//            to the settings BEFORE the failed request, so the strip keeps a stamp saying so until a request succeeds (`start` takes the stamp's place with the loading look, `done` removes it)
//   previous WP-161: a request was REFUSED (the server asks for the person's word, 413 `trace_too_large`) while a trace is on screen: that trace belongs to the pair BEFORE
//            the one asked for, so it stays faded, inert and stamped "previous pair" (not given back as if nothing had been asked) until a decision starts a new request
// Events: start (a request begins - a newer one replaces the running one), done (its trace is drawn), fail (it failed while the old trace still stands: the state is `failed`), broken (it failed
// after the old trace was gone), refused (WP-161: the server wants a decision before it trains), reset (the page is mounted or left).

/** the loading look (strip, placeholders, faded trace) appears only when a request outlasts this - a user-based page's trace comes in ~70-150 ms and would flicker */
export const LOAD_DELAY_MS = 150;

/** @typedef {"idle" | "loading" | "ready" | "stale" | "previous" | "failed" | "error"} LoadState */
/** @typedef {"start" | "done" | "fail" | "broken" | "refused" | "reset"} LoadEvent */

/**
 * The state after an event.
 * @param {LoadState} state
 * @param {LoadEvent} event
 * @returns {LoadState}
 */
export function nextLoadState(state, event) {
  switch (event) {
    case "start":
      // a trace on screen (ready, waiting for a newer one, or the previous pair's after a refusal) goes stale; with none, the first request keeps the page "loading"
      return state === "ready" || state === "stale" || state === "previous" || state === "failed" ? "stale" : "loading";
    case "done":
      return state === "loading" || state === "stale" ? "ready" : state;
    case "fail":
      // the old trace is still there: back to it - WP-222: as a trace the failed request left behind (`failed`, stamped), not as one nothing happened to; the first trace failed: no trace
      return state === "stale" ? "failed" : state === "loading" ? "error" : state;
    case "broken":
      return state === "loading" || state === "stale" ? "error" : state;
    case "refused":
      // WP-161: only a request that was running over a trace on screen can be refused into "the previous pair"; with no trace on screen the page has none to show
      return state === "stale" ? "previous" : state;
    case "reset":
      return "idle";
    default:
      return state;
  }
}

/**
 * Whether a request is running (the page keeps the trace it has, if any, frozen).
 * @param {LoadState} state
 * @returns {boolean}
 */
export function isBusy(state) {
  return state === "loading" || state === "stale";
}

/**
 * WP-161: whether the trace on screen is frozen - a request is running, or the request was refused and the trace is the previous pair's (the route's step / view changes wait).
 * @param {LoadState} state
 * @returns {boolean}
 */
export function isFrozen(state) {
  return isBusy(state) || state === "previous";
}

/**
 * The seconds a request has been running, one decimal, the decimal separator of the language ("3.2" / "3,2").
 * @param {number} ms
 * @param {string} [lang]
 * @returns {string}
 */
export function fmtElapsed(ms, lang = "en") {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const text = `${Math.floor(tenths / 10)}.${tenths % 10}`;
  return lang === "tr" ? text.replace(".", ",") : text;
}

/**
 * WP-146: the strip's time and, once the server has said how long a fit on this data takes (the "too large" warning's estimate, the plan's D9), how long it is expected to take:
 * "3.2 s of about 100 s". Past the estimate it is the plain elapsed time again - an estimate that has run out is not repeated beside a number that has overtaken it.
 * @param {number} ms elapsed
 * @param {number | null | undefined} estimateSeconds
 * @returns {boolean} whether the estimate is shown
 */
export function showsEstimate(ms, estimateSeconds) {
  return typeof estimateSeconds === "number" && Number.isFinite(estimateSeconds) && estimateSeconds > 0 && Math.max(0, ms) < estimateSeconds * 1000;
}

/**
 * The algorithm's short name for the strip: the option label without its parenthesis ("FunkSVD (biased MF, SGD)" -> "FunkSVD").
 * @param {string} label
 * @returns {string}
 */
export function shortName(label) {
  return String(label).replace(/\s*\(.*\)\s*$/, "");
}

/**
 * WP-225 follow-up: whether the route asks for the feature network with the ids ALONE (`groups` = "ids": the ids-only variant, a model of its own) - the page names it so before its trace is here.
 * The groups come from the route (a comma / space / dash list), else from the engine's defaults.
 * @param {Record<string, string | undefined>} params
 * @param {Record<string, any>} defaults
 * @returns {boolean}
 */
export function isIdsOnly(params, defaults) {
  if ((params.arch || defaults.architecture) !== "features") return false;
  const raw = params.groups !== undefined && params.groups !== "" ? String(params.groups).split(/[,\s-]+/).filter(Boolean) : Array.isArray(defaults.groups) ? defaults.groups : [];
  return raw.length === 1 && raw[0] === "ids";
}

/**
 * A whole number from a route value, else the engine's default, else the fallback.
 * @param {string | undefined} raw
 * @param {unknown} dflt
 * @param {number} fallback
 * @returns {number}
 */
function whole(raw, dflt, fallback) {
  const fromRoute = raw === undefined || raw === "" ? NaN : Number(raw);
  if (Number.isFinite(fromRoute)) return Math.round(fromRoute);
  const fromDefault = Number(dflt);
  return Number.isFinite(fromDefault) && dflt !== null && dflt !== undefined && dflt !== "" ? Math.round(fromDefault) : fallback;
}

/**
 * The model a page is about, by the short name the trace itself carries (`result.algorithm_label`: "FunkSVD", "ALS", "BPR-MF", "EASE"; the neural page: "NeuMF", "GMF", ...), from the
 * route's own choice, else the engine's default - so the page title can name the model before its trace is here. The user-based, item-based and content pages name none.
 * @param {{engine: string, params: Record<string, string | undefined>, defaults?: Record<string, any> | null, t: (key: string, params?: Record<string, unknown>) => string}} opts
 * @returns {string | null}
 */
export function algorithmName({ engine, params, defaults, t }) {
  const d = defaults || {};
  if (engine === "mf") return shortName(t(`params.alg_${params.alg || d.algorithm || "funk_svd"}`));
  // the ids-only feature network keeps what its parenthesis says ("Feature network (ids only)" -> "Feature network, ids only": the strip's own sentence has a parenthesis after the name)
  if (engine === "dnn" && isIdsOnly(params, d)) return String(t("params.arch_features_ids")).replace(/\s*\((.*)\)\s*$/, ", $1");
  if (engine === "dnn") return shortName(t(`params.arch_${params.arch || d.architecture || "neumf"}`));
  return null;
}

/**
 * What the strip says while a trace is on its way: the model and a short summary of its settings - the route's own values, else the engine's defaults. The user-based, item-based
 * and content pages have no fit to name.
 * @param {{engine: string, params: Record<string, string | undefined>, defaults?: Record<string, any> | null, t: (key: string, params?: Record<string, unknown>) => string}} opts
 * @returns {{key: string, params: Record<string, unknown>}} an i18n key and its placeholders
 */
export function loadingWords({ engine, params, defaults, t }) {
  const d = defaults || {};
  const algorithm = algorithmName({ engine, params, defaults, t });
  if (engine === "mf") {
    if ((params.alg || d.algorithm || "funk_svd") === "ease") return { key: "trace.loading_closed", params: { algorithm } }; // a closed form: no epochs to count
    return { key: "trace.loading_fit", params: { algorithm, k: whole(params.nf, d.n_factors, 2), epochs: whole(params.ep, d.trainer?.max_epochs, 40) } };
  }
  if (engine === "dnn") return { key: "trace.loading_fit", params: { algorithm, k: whole(params.nf, d.n_factors, 8), epochs: whole(params.ep, d.trainer?.max_epochs, 40) } };
  return { key: "trace.loading_walk", params: {} };
}
