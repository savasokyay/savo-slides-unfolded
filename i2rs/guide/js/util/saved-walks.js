// @ts-check
// WP-192: the "Only users with a saved walk" switch beside "Random pick" (docs/plans/2610171557-precomputed-walks-design.md, "UI" and "Endpoint"). A walk that was computed and saved
// beforehand opens at once. The exact question `GET /api/trace/precomputed?dataset=&engine=cb&task=&m=&f=&fw=&tf=&gw=&mk=&ma=&k=&lam=` -> `{users: [u...], pairs: [[u, i]...]}` lists the
// saved entries whose configuration equals the form's as it stands (the endpoint's own parameters: src/i2rs/app/routers/trace.py `precomputed`; the form's are the last eight).
// WP-203: with the switch on, Random pick no longer draws among the walks of the form AS IT STANDS (a form with no saved walk greyed the button, a form with two kept returning the same two;
// the user's findings on the kNN page). It goes THROUGH the saved walks of the page and task, one after another, and writes the form of each walk into the page's form:
//   - the inventory `GET /api/trace/precomputed/forms?dataset=&engine=cb&task=&m=` (WP-202) -> `{forms: [{params, resolved, users, pairs}]}`: every form that has walks on disk, in the order the
//     store's index first lists it, `params` in the page's own spelling (a default is not named);
//   - the order of a walk-through: the walks of the form that is on screen first (when it is saved), then the other forms in the inventory's order; each press goes one step on and the
//     counter reads "i/N" where the seed used to be; at N = 1 the press shows the same walk again;
//   - a press writes the walk's `params` into the form (the eight route parameters, the others the saved forms cannot name back to their defaults), the pair into the route.
// This module is the plain logic - the questions, the readings, the order, the step, the patch, the inventory, the remembered tick. Pure functions, hand-derived in
// tests/app/js/saved_walks_check.mjs under node.

import { parseFieldList, parseFieldWeights, TF_MODES } from "./cb-fields.js";

/** localStorage key prefix of the remembered tick: one per page (a convenience, never state that must persist) */
export const SAVED_WALKS_STORAGE = "i2rs.savedwalks.";

/** the route parameters that make up the form of a content-based walk, in the order the endpoint lists them (`m` is the method, the others the form's fields; WP-196 follow-up: `gw`, the
 *  feature weighting, and `ma`, the per-user model's ridge penalty, are read by the endpoint too - a form with either set must not be offered the default form's walks; WP-195c stage 2: and `mk`,
 *  the model's kind (the small network), which the server's signature puts before `ma`) */
export const FORM_PARAMS = ["f", "fw", "tf", "gw", "mk", "ma", "k", "lam"];

/** WP-203: the route parameters that are part of a content-based REQUEST but that the saved forms cannot name (the key the store matches on is the eight above): the minimum shared terms, the
 *  hybrid strategy with its blend weight and threshold, and the top-K candidate set. A walk is saved with their defaults, so writing a saved form into the page clears them too - and a form
 *  that has any of them set is not "the form of a saved walk", whatever the eight say (the trace id holds them, the walk would be computed, not opened). */
export const FORM_EXTRAS = ["mst", "hyb", "alpha", "mcfn", "cand"];

/** WP-203: how many forms the tip's inventory lists before it says "+n more", and how many field names a row shows before "+k": the bubble must fit without a scroll box */
export const INVENTORY_ROWS = 12;
export const FIELDS_SHOWN = 3;

/**
 * The question to the server: the dataset, the engine alias, the task and the method, then the form's own route parameters as they stand in the URL (a parameter the URL does
 * not carry is not asked: the server's defaults are the form's defaults). Empty values are dropped.
 * @param {{dataset: string, engine: string, task: string, method: string, params: Record<string, string | undefined>}} opts
 * @returns {Record<string, string>}
 */
export function savedWalksQuery({ dataset, engine, task, method, params }) {
  /** @type {Record<string, string>} */
  const query = { dataset, engine, task, m: method };
  for (const name of FORM_PARAMS) {
    const value = params[name];
    if (typeof value === "string" && value !== "") query[name] = value;
  }
  return query;
}

/**
 * WP-203: the question of the inventory - every form with saved walks for this data set, task and method (the form's own parameters are NOT part of it: the inventory is the same
 * whatever the form says, so it is asked once per page, task and method, not once per form).
 * @param {{dataset: string, engine: string, task: string, method: string}} opts
 * @returns {Record<string, string>}
 */
export function savedFormsQuery({ dataset, engine, task, method }) {
  return { dataset, engine, task, m: method };
}

/**
 * A stable key of a question (the same question is asked once).
 * @param {Record<string, string>} query
 * @returns {string}
 */
export function savedWalksKey(query) {
  return JSON.stringify(Object.keys(query).sort().map((name) => [name, query[name]]));
}

/** @typedef {{u: number, i: number | null}} SavedWalk a walk to open: the user's dense index and, for a prediction, the film's (null: a top-K walk names no film) */

/**
 * The walks an answer offers for a task: a top-K task opens on a user (`users`), a prediction on a pair (`pairs`). Anything that is not a dense index (a negative or fractional
 * number, a string, a malformed pair) is left out; the order is the server's; a repeated entry counts once. A missing or malformed answer (a 404, a server with no such uri) offers none.
 * @param {unknown} raw the endpoint's JSON
 * @param {string} task "predict" | "topk"
 * @returns {SavedWalk[]}
 */
export function savedWalks(raw, task) {
  if (!raw || typeof raw !== "object") return [];
  const answer = /** @type {{users?: unknown, pairs?: unknown}} */ (raw);
  /** @param {unknown} v */
  const index = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;
  /** @type {SavedWalk[]} */
  const out = [];
  const seen = new Set();
  if (task === "topk") {
    for (const u of Array.isArray(answer.users) ? answer.users : []) {
      if (index(u) && !seen.has(u)) {
        seen.add(u);
        out.push({ u, i: null });
      }
    }
    return out;
  }
  for (const pair of Array.isArray(answer.pairs) ? answer.pairs : []) {
    if (!Array.isArray(pair) || pair.length !== 2 || !index(pair[0]) || !index(pair[1])) continue;
    const key = `${pair[0]}:${pair[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ u: pair[0], i: pair[1] });
  }
  return out;
}

// -- WP-203: the forms ----------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * @typedef {{
 *   params: Record<string, string>, sig: string, walks: SavedWalk[],
 *   fields: string[], k: number | null, lam: number | null, kind: "ridge" | "mlp" | null,
 *   weights: Record<string, number>, tf: string | null, gini: boolean,
 * }} SavedForm one form with saved walks: `params` the route parameters the page writes for it (a default is not named), `sig` their signature, `walks` its walks (ascending), and what
 *   the parameters mean once the defaults are applied (`resolved` in the endpoint's answer): the selected fields, the neighbour count or list length (null: every neighbour), the MMR
 *   lambda (top-K only) and the per-user model's kind (the `model` method only); `weights` (the fields whose weight is not the default), `tf` (the term damping, null: raw) and `gini`
 *   (the feature weighting) are read from the parameters - two forms that differ only in these must not look alike in the tip
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * The form's eight route parameters out of a bag of route (or endpoint) parameters: strings only, empty ones dropped, nothing else.
 * @param {Record<string, unknown>} params
 * @returns {Record<string, string>}
 */
export function routeForm(params) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const name of FORM_PARAMS) {
    const value = params[name];
    if (typeof value === "string" && value !== "") out[name] = value;
  }
  return out;
}

/**
 * Whether the route sets any request parameter the saved forms cannot name (`FORM_EXTRAS`).
 * @param {Record<string, unknown>} params
 * @returns {boolean}
 */
export function routeHasExtras(params) {
  return FORM_EXTRAS.some((name) => typeof params[name] === "string" && params[name] !== "");
}

/**
 * A comparable string of a form's eight parameters (the same form, the same string; an unnamed parameter and an empty one are the same).
 * @param {Record<string, string | undefined>} params
 * @returns {string}
 */
export function formSignature(params) {
  return FORM_PARAMS.map((name) => `${name}=${params[name] ?? ""}`).join("&");
}

/**
 * The inventory an answer holds, for a task: the forms that have at least one walk of that task, in the server's order; a form's `params` are read like the route's (the eight, strings), its
 * walks like `savedWalks` reads them. `null` when the answer is no inventory at all (a 404 - an older server has no such route -, a failed request, a stranger's shape): the caller falls
 * back to the exact question; `[]` is a real answer - nothing is saved.
 * @param {unknown} raw the inventory endpoint's JSON
 * @param {string} task "predict" | "topk"
 * @returns {SavedForm[] | null}
 */
export function savedForms(raw, task) {
  if (!isRecord(raw) || !Array.isArray(raw.forms)) return null;
  /** @type {SavedForm[]} */
  const out = [];
  for (const entry of raw.forms) {
    if (!isRecord(entry)) continue;
    const walks = savedWalks({ users: entry.users, pairs: entry.pairs }, task);
    if (!walks.length) continue;
    const params = routeForm(isRecord(entry.params) ? entry.params : {});
    const resolved = isRecord(entry.resolved) ? entry.resolved : {};
    const kind = resolved.model_kind === "ridge" || resolved.model_kind === "mlp" ? resolved.model_kind : null;
    out.push({
      params,
      sig: formSignature(params),
      walks,
      fields: Array.isArray(resolved.fields) ? resolved.fields.map(String) : parseFieldList(params.f),
      k: typeof resolved.k === "number" && Number.isInteger(resolved.k) ? resolved.k : null,
      lam: typeof resolved.lam === "number" && Number.isFinite(resolved.lam) ? resolved.lam : null,
      kind,
      ...termsOf(params),
    });
  }
  return out;
}

/**
 * What the parameters say about the terms: the weights off the default, the damping (null for raw), the Gini feature weighting.
 * @param {Record<string, string>} params
 * @returns {{weights: Record<string, number>, tf: string | null, gini: boolean}}
 */
function termsOf(params) {
  return { weights: parseFieldWeights(params.fw), tf: params.tf !== undefined && params.tf !== "raw" && TF_MODES.includes(params.tf) ? params.tf : null, gini: params.gw === "gini" };
}

/**
 * @typedef {{params: Record<string, string>, extras: boolean, u: number | null, i: number | null}} FormRoute the page as it stands: the form's eight route parameters (strings), whether the
 *   route sets a request parameter the saved forms cannot name, and the pair on screen (dense indices, null when the route names none)
 */

/**
 * Which forms of the inventory are the form on screen. By signature first (the route's eight parameters spelled like the inventory's); a deep link that spells the same form another way
 * (`tf=raw`, `lam=0.70`) is found by what the exact question answered: the form whose walks are exactly those. A route that sets a parameter the saved forms cannot name has none.
 * @param {SavedForm[]} forms
 * @param {FormRoute} route
 * @param {SavedWalk[]} exact the walks the exact question answered for the form on screen
 * @returns {number[]} indices into `forms`
 */
export function currentForms(forms, route, exact) {
  if (route.extras) return [];
  const sig = formSignature(route.params);
  const same = forms.flatMap((form, at) => (form.sig === sig ? [at] : []));
  if (same.length || !exact.length) return same;
  /** @param {SavedWalk[]} walks */
  const text = (walks) => walks.map((w) => `${w.u}:${w.i}`).join(",");
  const want = text(exact);
  return forms.flatMap((form, at) => (text(form.walks) === want ? [at] : []));
}

/** @typedef {{form: number, u: number, i: number | null}} SavedStep one walk of the walk-through: the form it belongs to (an index into the inventory) and the walk */

/**
 * The walk-through: the walks of the anchor forms first (the form that was on screen when it began), then every other form in the inventory's order; inside a form the walks are as the
 * server lists them (users, or pairs, ascending).
 * @param {SavedForm[]} forms
 * @param {string[]} anchor signatures of the forms that go first
 * @returns {SavedStep[]}
 */
export function walkSteps(forms, anchor) {
  /** @type {number[]} */
  const first = [];
  /** @type {number[]} */
  const rest = [];
  forms.forEach((form, at) => (anchor.includes(form.sig) ? first : rest).push(at));
  return [...first, ...rest].flatMap((at) => forms[at].walks.map((walk) => ({ form: at, u: walk.u, i: walk.i })));
}

/**
 * @typedef {{
 *   key: string, anchor: string[], cursor: number, count: number,
 *   shown: {u: number, i: number | null, sig: string} | null, loaded: string | null,
 * }} WalkCycle the walk-through in progress: `key` the page, task and method it belongs to, `anchor` the signatures of the forms it began with, `cursor` the step the last press landed on,
 *   `count` how many steps it has, `shown` the walk the last press opened (its form's signature included) and `loaded` the signature of the form the last press WROTE into the page (null:
 *   none yet). It outlives a press that rebuilds the page (the model's kind changes the layout) and ends with the page object.
 */

/**
 * What a press would do, from the inventory (or its stand-in), the page as it stands and the walk-through so far.
 * @param {{forms: SavedForm[] | null, exact: SavedWalk[], route: FormRoute, key: string, cycle: WalkCycle | null}} opts `forms` null: no inventory (an older server): the form on screen is the only
 *   form there is, with the walks the exact question answered
 * @returns {{forms: SavedForm[], steps: SavedStep[], anchor: string[], now: number[], live: boolean}} `live`: the walk-through goes on (same page, task and method; the form on screen is the
 *   one the last press wrote); `now` the forms that are the form on screen
 */
export function planWalks({ forms, exact, route, key, cycle }) {
  /** @type {SavedForm[]} */
  const known = forms ?? (exact.length ? [standIn(route.params, exact)] : []);
  const live = !!cycle && cycle.key === key && (cycle.shown === null || cycle.shown.sig === formSignature(route.params));
  const now = currentForms(known, route, exact);
  const anchor = live && cycle ? cycle.anchor : now.map((at) => known[at].sig);
  return { forms: known, steps: walkSteps(known, anchor), anchor, now, live };
}

/**
 * The one form an older server's exact answer makes: the form on screen and its walks (no resolved values: the fields are read from `f`, k and lambda from their parameters).
 * @param {Record<string, string>} params
 * @param {SavedWalk[]} walks
 * @returns {SavedForm}
 */
function standIn(params, walks) {
  const k = Number(params.k);
  const lam = Number(params.lam);
  return {
    params,
    sig: formSignature(params),
    walks,
    fields: parseFieldList(params.f),
    k: params.k !== undefined && Number.isInteger(k) ? k : null,
    lam: params.lam !== undefined && Number.isFinite(lam) ? lam : null,
    kind: params.mk === "mlp" ? "mlp" : null,
    ...termsOf(params),
  };
}

/**
 * One press of Random pick with the switch on: the step after the last one (the first one when the walk-through begins), skipping the walk that is on screen when there is another to go to;
 * at N = 1 it is the same walk again.
 * @param {ReturnType<typeof planWalks>} plan
 * @param {{route: FormRoute, key: string, cycle: WalkCycle | null}} state
 * @returns {{step: SavedStep, form: SavedForm, cursor: number, count: number, changed: boolean, cycle: WalkCycle} | null} null: nothing is saved. `changed`: the press writes a form other
 *   than the one on screen (the page says "form loaded from saved walk")
 */
export function pressWalk(plan, { route, key, cycle }) {
  const { forms, steps, anchor, now, live } = plan;
  if (!steps.length) return null;
  const base = live && cycle ? Math.min(cycle.cursor, steps.length - 1) : -1;
  /** @param {SavedStep} step */
  const onScreen = (step) => now.includes(step.form) && step.u === route.u && (step.i === null || step.i === route.i);
  let cursor = (base + 1) % steps.length;
  if (steps.length > 1 && onScreen(steps[cursor])) cursor = (cursor + 1) % steps.length;
  const step = steps[cursor];
  const form = forms[step.form];
  const changed = route.extras || !now.includes(step.form);
  return {
    step,
    form,
    cursor,
    count: steps.length,
    changed,
    cycle: {
      key,
      anchor,
      cursor,
      count: steps.length,
      shown: { u: step.u, i: step.i, sig: form.sig },
      loaded: changed ? form.sig : live && cycle ? cycle.loaded : null,
    },
  };
}

/**
 * The route patch that opens a walk: the saved form's eight parameters (the ones it does not name are cleared - a default is not in the URL), the parameters the saved forms cannot name
 * cleared too, and the pair (a top-K walk names a user only).
 * @param {SavedForm} form
 * @param {SavedStep} step
 * @returns {Record<string, string | undefined>}
 */
export function walkPatch(form, step) {
  /** @type {Record<string, string | undefined>} */
  const patch = {};
  for (const name of FORM_PARAMS) patch[name] = form.params[name];
  for (const name of FORM_EXTRAS) patch[name] = undefined;
  patch.u = String(step.u);
  if (step.i !== null) patch.i = String(step.i);
  return patch;
}

/**
 * "2/5": the step the last press landed on out of all of them.
 * @param {number} cursor 0-based
 * @param {number} count
 * @returns {string}
 */
export function counterText(cursor, count) {
  return `${cursor + 1}/${count}`;
}

/**
 * What the counter says now: the last press's "i/N" while the page still shows the walk it opened (same form, same user - and film for a prediction); an empty string once the reader has
 * moved on (another form by Apply, another user or film), so it never names a walk that is not on screen.
 * @param {WalkCycle | null} cycle
 * @param {FormRoute} route
 * @returns {string}
 */
export function counterNow(cycle, route) {
  if (!cycle || !cycle.shown || cycle.cursor < 0) return "";
  const { shown } = cycle;
  const here = !route.extras && formSignature(route.params) === shown.sig && route.u === shown.u && (shown.i === null || route.i === shown.i);
  return here ? counterText(cycle.cursor, cycle.count) : "";
}

/**
 * Whether the form on screen is the one the last press wrote into the page (so the note "form loaded from saved walk" is true): the walk-through's `loaded` signature is the route's.
 * @param {WalkCycle | null} cycle
 * @param {FormRoute} route
 * @returns {boolean}
 */
export function formWasLoaded(cycle, route) {
  return !!cycle && cycle.loaded !== null && !route.extras && cycle.loaded === formSignature(route.params);
}

/**
 * @typedef {{
 *   fields: string[], more: number, weights: Record<string, number>, tf: string | null, gini: boolean, k: number | null, lam: number | null, kind: "ridge" | "mlp" | null, count: number,
 *   current: boolean,
 * }} InventoryRow one form of the tip's list: its first `FIELDS_SHOWN` fields (`more`: how many are not shown) with the weights, term damping and Gini weighting that set it apart, the neighbour count or list
 *   length, the lambda, the model kind and how many walks (pairs, or users for a top-K task) it has; `current`: it is the form on screen
 */

/**
 * The tip's inventory: how many forms and walks the page and task have on disk and one row per form (at most `INVENTORY_ROWS`; `hidden` counts the forms that did not fit).
 * @param {SavedForm[]} forms
 * @param {number[]} now the forms that are the form on screen
 * @returns {{forms: number, walks: number, rows: InventoryRow[], hidden: number}}
 */
export function inventoryOf(forms, now) {
  const rows = forms.slice(0, INVENTORY_ROWS).map((form, at) => ({
    fields: form.fields.slice(0, FIELDS_SHOWN),
    more: Math.max(0, form.fields.length - FIELDS_SHOWN),
    weights: form.weights,
    tf: form.tf,
    gini: form.gini,
    k: form.k,
    lam: form.lam,
    kind: form.kind,
    count: form.walks.length,
    current: now.includes(at),
  }));
  return {
    forms: forms.length,
    walks: forms.reduce((sum, form) => sum + form.walks.length, 0),
    rows,
    hidden: Math.max(0, forms.length - rows.length),
  };
}

// -- the remembered tick ----------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * The remembered tick: "1" ticked, anything else (or no value, or no storage) unticked.
 * @param {{getItem: (key: string) => string | null} | null | undefined} storage
 * @param {string} page
 * @returns {boolean}
 */
export function readTick(storage, page) {
  try {
    return storage?.getItem(SAVED_WALKS_STORAGE + page) === "1";
  } catch {
    return false;
  }
}

/**
 * Remember the tick (a failing storage - a private window, blocked site data - is no error: the page works without it).
 * @param {{setItem: (key: string, value: string) => void} | null | undefined} storage
 * @param {string} page
 * @param {boolean} on
 */
export function writeTick(storage, page, on) {
  try {
    storage?.setItem(SAVED_WALKS_STORAGE + page, on ? "1" : "0");
  } catch {
    /* no storage: the tick is not remembered */
  }
}
