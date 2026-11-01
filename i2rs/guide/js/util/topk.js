// @ts-check
// WP-141: the page-level TASK of a model page - "Predict a rating" (the walk the pages always had) or "Recommend top-K" (the same fitted model asked the other
// question: which K films would it put at the top of this user's list). Plain logic, checked under node against hand-derived cases
// (tests/app/js/topk_check.mjs); the page (pages/trace-page.js) and the parameter form (components/param-form.js) read the route through it.
//
// Route (the contract is docs/plans/2610101900-topk-task-switch.md section 7):
//   `task` = topk | predict (absent = predict)   - a REQUEST parameter, not view state: it is part of the trace key and travels to the API
//   `k`    = the list length, 10 | 20 on the control (a deep link may name any 1..50)   - the user-based pages use `k` for the neighbour count; a model page never does,
//            so on a model page `k` is the list length and never reaches the engine config (`configParams`)
//   `cand` = unseen | all (absent = unseen)      - `all` keeps the films the user has rated in the ranking, marked "seen" (display only)
// A default stays out of the URL like every other parameter: `task=topk` alone is "top-10 of the unseen films".
// The switch is drawn only when the server says the engine can do it (`/api/meta` `engine_tasks`): a server without that field (an old one) answers no top-K
// request, so the page stays exactly as it was.

/** the list lengths the control offers */
export const K_CHOICES = [10, 20];
/** the list length when the route names none (the server's own default is the same: config `topk.k_default`) */
export const K_DEFAULT = 10;
/** the longest list a deep link may ask for (the server's `topk.k_max`) */
export const K_MAX = 50;

/**
 * Whether the server offers the top-K task for an engine.
 * @param {{engine_tasks?: Record<string, string[]>} | null | undefined} meta `/api/meta`
 * @param {string} engine the trace engine alias ("mf", "dnn", ...)
 * @returns {boolean}
 */
export function topkOffered(meta, engine) {
  const tasks = meta?.engine_tasks?.[engine];
  return Array.isArray(tasks) && tasks.includes("topk");
}

/**
 * WP-141a: what the page-level task switch shows. It is drawn on EVERY trace page (uCF, iCF, content, MF, neural) as soon as the server reports its tasks per engine
 * (`/api/meta` `engine_tasks`); the top-K choice is live only for an engine that offers it - on the others it is a placeholder, switched off, with "future work" as its tip
 * (an offline copy says the same: its bundle lists top-K for no engine, and that is the state of the method too). A server that reports no tasks for the engine (an old one)
 * draws no switch at all: the page is what it was.
 * @param {{engine_tasks?: Record<string, string[]>} | null | undefined} meta `/api/meta`
 * @param {string} engine the trace engine alias ("ucf", "icf", "cb", "mf", "dnn")
 * @returns {{shown: boolean, topkEnabled: boolean, tipKey: string}} `tipKey` is the i18n key of the top-K choice's tip
 */
export function taskSwitchFor(meta, engine) {
  const tasks = meta?.engine_tasks?.[engine];
  if (!Array.isArray(tasks)) return { shown: false, topkEnabled: false, tipKey: "task.topk_tip" };
  if (tasks.includes("topk")) return { shown: true, topkEnabled: true, tipKey: "task.topk_tip" };
  return { shown: true, topkEnabled: false, tipKey: "task.topk_future" };
}

/**
 * WP-166: the engines whose page OPENS on the top-K task - when the route names neither a task nor a film. The neural page: its demo runs on a stored model, a top-K list
 * needs no film, and a prediction for a film the user rated asks for a retrain (413 on a big set). The matrix-factorization page keeps predict as it was.
 */
export const TOPK_OPENING_ENGINES = ["dnn"];

/**
 * WP-166: the task a route stands for when it does not name one: top-K on an opening engine, unless the route names a film (a film is a prediction request - every
 * lecture link that carries `i` keeps its meaning), predict everywhere else.
 * @param {string} engine the trace engine alias ("mf", "dnn", ...)
 * @param {Record<string, string | undefined>} params the route parameters
 * @returns {"predict" | "topk"}
 */
export function openingTask(engine, params) {
  const film = params.i !== undefined && params.i !== "";
  return TOPK_OPENING_ENGINES.includes(engine) && !film ? "topk" : "predict";
}

/**
 * The task the page runs: top-K only when the server offers it (an old server would reject the request); then the route's own word (`topk` | `predict`, exact words),
 * and for a route that names none, the task it stands for (`opening`: `openingTask`; predict where the caller says nothing).
 * @param {string | undefined} raw the `task` route parameter
 * @param {boolean} offered `topkOffered`
 * @param {"predict" | "topk"} [opening] `openingTask` of the route
 * @returns {"predict" | "topk"}
 */
export function taskFor(raw, offered, opening = "predict") {
  if (!offered) return "predict";
  if (raw === "topk" || raw === "predict") return raw;
  return opening;
}

/**
 * The `task` route parameter of a task: only top-K is written (predict is the default and the URL of every older link).
 * @param {"predict" | "topk"} task
 * @returns {string | undefined}
 */
export function taskParam(task) {
  return task === "topk" ? "topk" : undefined;
}

/**
 * WP-166: the `task` route parameter a reader's CHOICE on the switch writes. Top-K is always written; predict is written only where leaving it out would not mean
 * predict - an opening engine's route without a film - so a default stays out of the URL and an older link keeps its meaning.
 * @param {string} engine
 * @param {"predict" | "topk"} task the chosen task
 * @param {Record<string, string | undefined>} params the route parameters (the film decides)
 * @returns {string | undefined}
 */
export function taskChoiceParam(engine, task, params) {
  if (task === "topk") return "topk";
  return openingTask(engine, params) === "topk" ? "predict" : undefined;
}

/**
 * The list length of a `k` route parameter: a whole number 1..K_MAX, else the default.
 * @param {string | undefined} raw
 * @returns {number}
 */
export function kFor(raw) {
  if (raw === undefined || raw === "") return K_DEFAULT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= K_MAX ? n : K_DEFAULT;
}

/**
 * The `k` route parameter of a list length (the default stays out of the URL).
 * @param {number} k
 * @returns {string | undefined}
 */
export function kParam(k) {
  return k === K_DEFAULT ? undefined : String(k);
}

/**
 * The candidate set of a `cand` route parameter.
 * @param {string | undefined} raw
 * @returns {"unseen" | "all"}
 */
export function candidatesFor(raw) {
  return raw === "all" ? "all" : "unseen";
}

/**
 * The `cand` route parameter of a candidate set (the default stays out of the URL).
 * @param {"unseen" | "all"} candidates
 * @returns {string | undefined}
 */
export function candidatesParam(candidates) {
  return candidates === "all" ? "all" : undefined;
}

/**
 * WP-176 (stage 4): the MMR lambda of a `lam` route parameter on the content page - the number the reader typed, whatever it is (the server answers 422 `cb_lambda_invalid` for a
 * number outside [0, 1] and the page shows its sentence); null when the route names none or something that is no number (the engine's own default, `cb.mmr.lambda`, then applies).
 * @param {string | undefined} raw
 * @returns {number | null}
 */
export function lamFor(raw) {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The body fields a top-K request adds to the trace request; a predict request adds none (it stays byte-for-byte what it was), and a top-K request names no
 * film (`item` is left out). WP-176 (stage 4): on the content page (`cb`) the request also carries the MMR lambda when the route names one - a request parameter like the
 * list length, never an engine option.
 * @param {"predict" | "topk"} task
 * @param {Record<string, string | undefined>} params the route parameters
 * @param {string} [engine] the trace engine alias
 * @returns {Record<string, unknown>}
 */
export function requestExtras(task, params, engine = "") {
  if (task !== "topk") return {};
  const lam = engine === "cb" ? lamFor(params.lam) : null;
  return { task: "topk", k: kFor(params.k), candidates: candidatesFor(params.cand), ...(lam === null ? {} : { lam }) };
}

/**
 * The route parameters the ENGINE CONFIG is built from: on a model page `k` is the list length of the top-K task, not a neighbour count - the model's config has
 * no such field (the server would answer 422). WP-176 (stage 4): on the content page `k` is the neighbour count in the prediction task and the list length in the top-K task, and
 * `lam` is the MMR lambda there (a request parameter): in the top-K task neither reaches the engine config.
 * @param {string} engine
 * @param {Record<string, string>} params
 * @param {"predict" | "topk"} [task] the task on screen
 * @returns {Record<string, string>}
 */
export function configParams(engine, params, task = "predict") {
  // WP-222: a hybrid route with no `m` is the weighted walk (the sidebar row lights it by `route_default`): the hybrid's config is built from the route's method (util/hybrid-config.js)
  if (engine === "hybrid") return params.m ? params : { ...params, m: "weighted" };
  if (engine === "cb" && task === "topk") {
    const { k, lam, ...rest } = params; // eslint-disable-line no-unused-vars
    return rest;
  }
  if (engine !== "mf" && engine !== "dnn") return params;
  const { k, ...rest } = params; // eslint-disable-line no-unused-vars
  return rest;
}

/**
 * A count with the language's thousands separator: 5716 -> "5,716" (EN), "5.716" (TR).
 * @param {number} n
 * @param {string} lang
 * @returns {string}
 */
export function countText(n, lang) {
  return Number.isFinite(n) ? new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US").format(n) : "—";
}

/**
 * The text parameters of the summary bar's top-K line (`trace.topk_summary*`), from the trace's `meta.topk`.
 * @param {{k: number, n_candidates: number, n_items: number, n_seen?: number, n_relevant: number, threshold: number}} topk
 * @param {string} lang
 * @returns {Record<string, string | number>}
 */
export function summaryParams(topk, lang) {
  const shown = Math.min(topk.k, topk.n_candidates); // a short candidate set gives a short list: "relevant 1 / 1"
  return {
    k: topk.k,
    shown,
    candidates: countText(topk.n_candidates, lang),
    items: countText(topk.n_items, lang),
    seen: countText(topk.n_seen ?? 0, lang),
    relevant: topk.n_relevant,
    threshold: topk.threshold,
  };
}

/**
 * WP-176 (stage 4): the numbers of the summary bar's intra-list-similarity chip, from the trace's `meta.topk` - the mean pairwise cosine of the relevance list and of the MMR list
 * (four decimals) and the lambda that moved one into the other; null when there is no such pair (a list of one film has no pair: the engine sends null).
 * @param {{ils_before?: number | null, ils_after?: number | null, lambda?: number | null}} topk
 * @returns {{before: string, after: string, lam: string} | null}
 */
export function ilsParams(topk) {
  const { ils_before: before, ils_after: after, lambda } = topk;
  if (typeof before !== "number" || typeof after !== "number" || !Number.isFinite(before) || !Number.isFinite(after)) return null;
  return { before: before.toFixed(4), after: after.toFixed(4), lam: String(typeof lambda === "number" ? lambda : "") };
}

/**
 * WP-176a (c): what the summary bar's changes chip says - how far the MMR list is from the relevance list. The engine's own count of "places": the places of the final list that hold another
 * film than the relevance list's, of K, and how many films of the final list were not in the relevance list (`places_changed`, `n_new`, in the result and in `meta.topk`; the result's first).
 * A server without them (before WP-182's second delivery) still sends `n_moved`, the films moved, brought in or dropped - it can exceed K, so it is said without "of K". Null when the trace
 * carries none of them.
 * @param {{places_changed?: number | null, n_new?: number | null, n_moved?: number | null}} result trace.result
 * @param {{places_changed?: number | null, n_new?: number | null, k?: number | null, lambda?: number | null}} topk trace.meta.topk
 * @returns {{kind: "places", places: number, k: number, fresh: number, lam: string} | {kind: "moved", n: number, lam: string} | {kind: "none", lam: string} | null}
 */
export function changesParams(result, topk) {
  const lam = String(typeof topk.lambda === "number" ? topk.lambda : "");
  const places = result.places_changed ?? topk.places_changed;
  const fresh = result.n_new ?? topk.n_new;
  const k = topk.k;
  if (Number.isFinite(places) && Number.isFinite(fresh) && Number.isFinite(k) && /** @type {number} */ (k) > 0) {
    return places === 0 && fresh === 0 ? { kind: "none", lam } : { kind: "places", places: /** @type {number} */ (places), k: /** @type {number} */ (k), fresh: /** @type {number} */ (fresh), lam };
  }
  if (Number.isFinite(result.n_moved)) return /** @type {number} */ (result.n_moved) > 0 ? { kind: "moved", n: /** @type {number} */ (result.n_moved), lam } : { kind: "none", lam };
  return null;
}

/**
 * The options of the list-length control: the two the control offers, plus the length a deep link named when it is another one (so the pressed choice is always visible).
 * @param {number} k the list length on screen
 * @returns {number[]}
 */
export function kOptions(k) {
  return K_CHOICES.includes(k) ? [...K_CHOICES] : [...K_CHOICES, k].sort((a, b) => a - b);
}
