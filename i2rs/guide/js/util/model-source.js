// @ts-check
// WP-146: where the model of a model-page trace COMES FROM, as plain logic checked under node against hand-derived cases (tests/app/js/model_source_check.mjs); the page
// (pages/trace-page.js), the parameter form's "Model" row (components/model-source.js) and the "too large" warning (components/large-trace-warning.js) read it.
//
// A trace of the matrix-factorization or neural page needs a fitted model. It is either TRAINED for the request (seconds on the class data, minutes on the merged one) or taken from
// a model fitted at home on every rating of the data set (`i2rs model fit`, stored under data/models) - "pretrained". The server decides which (the plan is
// docs/plans/2610111350-pretrained-models.md, D2): a film the user has NOT rated and every top-K list may use the stored model; a film the user HAS rated is the held-out cell, so
// the model is trained again without that rating ("refit") whatever was asked. The route says only what the person chose:
//   `model` = pretrained | fit   (absent = automatic: the server picks)   - a REQUEST parameter: part of the trace key, sent as `model_source`
// A request that repeats after the "too large" warning adds `confirm_large: true`. The row and the warning are drawn only while `/api/meta` `features.pretrained_models` is true
// (a server without the stored-model layer, and an offline copy, know neither: the page is what it was).

/** the two sources a person can ask for; "automatic" is no choice at all - it stays out of the URL and out of the request */
export const SOURCES = /** @type {const} */ (["pretrained", "fit"]);

/** WP-153: the smallest estimate the server ever sends, in seconds - its bucket size (engines/mf/persist.py `estimate_seconds`: nearest 5 s, never below 5) */
export const SMALLEST_ESTIMATE_S = 5;

/** @typedef {"pretrained" | "fit"} Source */
/** @typedef {"pretrained" | "fit" | "refit"} UsedSource what a trace reports in `meta.model.source` */

/**
 * The source a `model` route parameter names, null for automatic (or anything else).
 * @param {string | undefined} raw
 * @returns {Source | null}
 */
export function sourceFor(raw) {
  return raw === "pretrained" || raw === "fit" ? raw : null;
}

/**
 * The `model` route parameter of a choice (automatic stays out of the URL).
 * @param {Source | null | undefined} choice
 * @returns {string | undefined}
 */
export function sourceParam(choice) {
  return choice === "pretrained" || choice === "fit" ? choice : undefined;
}

/**
 * Whether the page offers the choice: a model page, on a LIVE server that has the stored-model layer. An offline copy never does - and says so itself: its manifest is the live
 * `/api/meta` as it was when the copy was made (`export.py` writes it as it is, `mode: "static"` set), so a flag the live server carried would travel into the bundle; the page
 * does not trust it there (nothing in a bundle answers `/api/models`, and a trace frozen into it was fitted already).
 * @param {{mode?: string, features?: Record<string, boolean>} | null | undefined} meta `/api/meta`
 * @param {string} engine the trace engine alias ("mf", "dnn", ...)
 * @returns {boolean}
 */
export function pretrainedOffered(meta, engine) {
  return (engine === "mf" || engine === "dnn") && meta?.mode !== "static" && meta?.features?.pretrained_models === true;
}

/**
 * The body fields the choice adds to a trace request. Automatic adds none, so a request without a choice is byte for byte what it was.
 * @param {{offered: boolean, params: Record<string, string | undefined>, confirmLarge?: boolean}} opts
 * @returns {{model_source?: Source, confirm_large?: true}}
 */
export function modelRequestFields({ offered, params, confirmLarge = false }) {
  if (!offered) return {};
  /** @type {{model_source?: Source, confirm_large?: true}} */
  const out = {};
  const source = sourceFor(params.model);
  if (source) out.model_source = source;
  if (confirmLarge) out.confirm_large = true;
  return out;
}

// -- which stored model is the page's ---------------------------------------------------------------------------------------------------------------------------------

/**
 * @typedef {Object} ModelInfo one entry of `GET /api/models?ds=<name>`
 * @property {string} kind "mf" | "dnn"
 * @property {string} [algorithm]
 * @property {string} [cfghash]
 * @property {number} [seed]
 * @property {string} fitted_at UTC ISO
 * @property {number} [n_epochs]
 * @property {number | null} [seconds]
 * @property {Record<string, any>} [config] the resolved engine config the model was fitted with (the sidecar's)
 */

/**
 * Whether two config values are the same: numbers by value, arrays element by element, objects key by key.
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function same(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (typeof a === "object" && typeof b === "object") return covers(a, b) && covers(b, a);
  return a === b;
}

/**
 * Every key of `want` that `have` also has is the same (a key only one side has is not a difference: the page knows the settings it can show, the sidecar every field the engine
 * resolved).
 * @param {Record<string, any>} have
 * @param {Record<string, any>} want
 * @returns {boolean}
 */
function covers(have, want) {
  for (const key of Object.keys(want)) {
    if (!(key in have)) continue;
    if (!same(have[key], want[key])) return false;
  }
  return true;
}

/**
 * `overrides` laid over `defaults`, one level of nesting deep (the `trainer` block): what the page's settings resolve to.
 * @param {Record<string, any> | null | undefined} defaults the engine's block of `/api/config/algorithms`
 * @param {Record<string, any> | null | undefined} overrides the request's `config`
 * @returns {Record<string, any>}
 */
export function resolvedConfig(defaults, overrides) {
  /** @type {Record<string, any>} */
  const out = { ...(defaults || {}) };
  for (const [key, value] of Object.entries(overrides || {})) {
    const base = out[key];
    out[key] = value && typeof value === "object" && !Array.isArray(value) && base && typeof base === "object" && !Array.isArray(base) ? { ...base, ...value } : value;
  }
  return out;
}

/**
 * The stored model that was fitted with the page's settings: the newest entry of the engine whose resolved config agrees with what the page would send. (The server matches on a
 * hash of the resolved config; the page cannot reproduce that hash - Python writes `1.0` where JavaScript writes `1` - so it compares the settings themselves. The row it feeds is
 * information: at request time the server decides, and the trace says what it used.) An entry without a `config` is matched on the algorithm and the seed alone.
 * @param {ModelInfo[] | null | undefined} models
 * @param {{kind: string, defaults?: Record<string, any> | null, config?: Record<string, any> | null}} spec
 * @returns {ModelInfo | null}
 */
export function matchModel(models, { kind, defaults, config }) {
  if (!Array.isArray(models)) return null;
  const want = resolvedConfig(defaults, config);
  const name = kind === "dnn" ? want.architecture : want.algorithm;
  /** @type {ModelInfo | null} */
  let best = null;
  for (const m of models) {
    if (m.kind !== kind) continue;
    const agrees = m.config
      ? covers(m.config, want)
      : // (the sidecar's `algorithm` of a neural model is "dnn", not its architecture: only the factor models are told apart by it)
        (kind === "dnn" || m.algorithm === undefined || name === undefined || m.algorithm === name) && (m.seed === undefined || want.seed === undefined || Number(m.seed) === Number(want.seed));
    if (!agrees) continue;
    if (best === null || String(m.fitted_at) > String(best.fitted_at)) best = m;
  }
  return best;
}

// -- words and numbers --------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * `YYYY-MM-DD HH:MM` of an instant in a time zone (the viewer's by default) - the same on every machine and in both languages.
 * @param {string} iso
 * @param {string} [tz] an IANA zone ("UTC"); default: the viewer's
 * @returns {string} "" for something that is no instant
 */
export function stamp(iso, tz) {
  // the server's stamp is UTC; one written without its zone ("2026-10-11T13:50:00": Python's `utcnow().isoformat()`) would be read as the viewer's own time by `Date`
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso) ? `${iso}Z` : iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  /** @param {string} type */
  const part = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

/**
 * When a model was fitted, for the chip: the time alone when it was today, else the date and the time.
 * @param {string} iso
 * @param {{now?: Date, tz?: string}} [opts]
 * @returns {string}
 */
export function fittedWhen(iso, { now = new Date(), tz } = {}) {
  const at = stamp(iso, tz);
  if (!at) return "";
  const today = stamp(now.toISOString(), tz).slice(0, 10);
  return at.slice(0, 10) === today ? at.slice(11) : at;
}

/**
 * Seconds for a sentence: a whole number from ten on, one decimal below, the decimal separator of the language.
 * @param {number} seconds
 * @param {string} [lang]
 * @returns {string}
 */
export function secondsText(seconds, lang = "en") {
  if (!Number.isFinite(seconds)) return "—";
  const tenth = Math.round(seconds * 10) / 10;
  if (tenth >= 10) return String(Math.round(seconds)); // 9.96 is "10", not "10.0"
  const text = tenth.toFixed(1);
  return lang === "tr" ? text.replace(".", ",") : text;
}

/**
 * @typedef {Object} ModelMeta `trace.meta.model`
 * @property {UsedSource} source
 * @property {boolean} [held_out]
 * @property {string | null} [fitted_at]
 * @property {number} [n_epochs]
 * @property {number | null} [seconds]
 * @property {number | null} [estimated_seconds]
 */

/**
 * The summary chip of a trace's model: "model: pretrained · 13:50", "model: refit (held-out)", "model: fit", and the hover text that says what that means.
 * @param {ModelMeta | null | undefined} model `trace.meta.model` (absent on a trace from a server without the stored-model layer: no chip)
 * @param {{t: (key: string, params?: Record<string, unknown>) => string, lang: string, now?: Date, tz?: string}} opts
 * @returns {{text: string, title: string, source: UsedSource} | null}
 */
export function modelChip(model, { t, lang, now, tz }) {
  if (!model || !model.source) return null;
  if (model.source === "pretrained") {
    const when = model.fitted_at ? fittedWhen(model.fitted_at, { now, tz }) : "";
    return {
      source: "pretrained",
      text: when ? t("trace.model_pretrained", { when }) : t("trace.model_pretrained_plain"),
      title: t("trace.model_pretrained_tip", {
        when: model.fitted_at ? stamp(model.fitted_at, tz) : "—",
        epochs: model.n_epochs ?? "—",
        seconds: model.seconds === null || model.seconds === undefined ? "—" : secondsText(model.seconds, lang),
      }),
    };
  }
  if (model.source === "refit") return { source: "refit", text: t("trace.model_refit"), title: t("trace.model_refit_tip") };
  return { source: "fit", text: t("trace.model_fit"), title: t("trace.model_fit_tip") };
}

// -- the Model row of the parameter form ------------------------------------------------------------------------------------------------------------------------------

/**
 * @typedef {Object} RowView what the "Model" row shows
 * @property {Source | null} pressed the choice the person made (pressed); null: automatic, or a held-out refit
 * @property {Source | null} auto the source automatic resolves to (not pressed: the row says "auto" beside the control); null when a choice is pressed or the row is a refit
 * @property {Source | null} resolved WP-155: the source IN USE - the pressed choice, else the one automatic comes to; null for a held-out refit (the control is faded, nothing in it is in use).
 *   The control fills this segment with a check mark, whether it was pressed or came out of automatic
 * @property {boolean} refit the target is a rating of the user's: the model is trained again without it, whatever was asked (the whole control is faded)
 * @property {boolean} pretrainedDisabled the pretrained choice cannot be used (the method is not stored, or the list is known and has no model for these settings)
 * @property {"ease" | "missing" | null} pretrainedWhy
 * @property {{head: string, key: string, params: Record<string, unknown>}} state the line beside the control: `head` (an i18n key, drawn bold - WP-155: "Pretrained model in use",
 *   "Trained on this page", "Held-out refit") and the detail (`key` + `params`) after it
 */

/**
 * What the row shows.
 * @param {{
 *   choice: Source | null, match: ModelInfo | null, listKnown: boolean, last: ModelMeta | null, task: "predict" | "topk", rated: boolean | null, algorithm: string | undefined,
 *   lang: string, tz?: string,
 * }} opts `choice` the route's `model`; `match` the stored model of the page's settings; `listKnown` the list of stored models has arrived; `last` the trace on screen's
 *   `meta.model`; `rated` whether that trace's target is a rating of the user's (null: no trace yet); `algorithm` the method (EASE is never stored)
 * @returns {RowView}
 */
export function rowView({ choice, match, listKnown, last, task, rated, algorithm, lang, tz }) {
  const ease = algorithm === "ease";
  const missing = listKnown && match === null;
  const pretrainedDisabled = ease || missing;
  const pretrainedWhy = ease ? "ease" : missing ? "missing" : null;
  const heldOut = task !== "topk" && (last ? last.held_out === true || last.source === "refit" : rated === true);
  if (heldOut) {
    return {
      pressed: null,
      auto: null,
      resolved: null,
      refit: true,
      pretrainedDisabled,
      pretrainedWhy,
      state: { head: "params.model_source_head_refit", key: "params.model_source_state_refit", params: {} },
    };
  }
  const picked = ease && choice === "pretrained" ? null : choice; // EASE is never stored: a pretrained choice cannot stand (the form does not send it)
  /** @type {Source} */
  const effective = picked ?? (ease ? "fit" : last ? (last.source === "pretrained" ? "pretrained" : "fit") : match !== null ? "pretrained" : "fit");
  // the facts of the stored model: the trace's own word when it used one, else the list's entry
  const info = last && last.source === "pretrained" ? last : match;
  /** @type {RowView["state"]} */
  let state;
  if (effective === "pretrained") {
    state =
      info && info.fitted_at
        ? {
            head: "params.model_source_head_pretrained",
            key: "params.model_source_state_pretrained",
            params: {
              when: stamp(info.fitted_at, tz),
              epochs: info.n_epochs ?? "—",
              seconds: info.seconds === null || info.seconds === undefined ? "—" : secondsText(info.seconds, lang),
            },
          }
        : { head: "params.model_source_head_missing", key: "params.model_source_state_missing", params: {} };
  } else {
    state = { head: "params.model_source_head_fit", key: ease ? "params.model_source_state_ease" : "params.model_source_state_fit", params: {} };
  }
  return { pressed: picked, auto: picked ? null : effective, resolved: effective, refit: false, pretrainedDisabled, pretrainedWhy, state };
}

// -- the "too large" warning ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * A value as JSON with the keys of every object in sorted order, so two equal settings written in another order are the same text.
 * @param {any} value
 * @returns {any}
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

/**
 * What one "train anyway" covers (user decision 2026-10-11: a tiring design is no design): this data set, this engine and these RESOLVED settings, for the rest of the page's
 * session - not the pair, not the task (a prediction or a top-K list), not the model's source. A new user or film on the same data and settings does not ask again; a changed
 * data set, engine or setting (an explicit default is no change: the settings are compared as the engine would resolve them) does.
 * @param {{engine: string, dataset: string, defaults?: Record<string, any> | null, config?: Record<string, any> | null}} opts `config` the request's engine config, `defaults` the engine's block of `/api/config/algorithms`
 * @returns {string}
 */
export function confirmScope({ engine, dataset, defaults, config }) {
  return JSON.stringify(canonical([engine, dataset, resolvedConfig(defaults, config)]));
}

/**
 * Whether a person's earlier "train anyway" covers a request.
 * @param {{scope: string} | null | undefined} confirmed
 * @param {string} scope the request's `confirmScope`
 * @returns {boolean}
 */
export function confirmCovers(confirmed, scope) {
  return confirmed !== null && confirmed !== undefined && confirmed.scope === scope;
}

/**
 * Whether an error of the trace request is the server's "this would train on more ratings than the page allows" (413 `trace_too_large`): a question to answer, not a failure.
 * @param {unknown} err an `ApiError` (`status`, `code`, `params`)
 * @returns {boolean}
 */
export function isTooLarge(err) {
  return typeof err === "object" && err !== null && /** @type {any} */ (err).status === 413 && /** @type {any} */ (err).code === "trace_too_large";
}

/**
 * The server refuses a trace that would train a model on more ratings than the page allows unless the person confirms (413 `trace_too_large`; the plan's D3): what the warning says
 * and offers. A server of the stored-model layer sends the estimate, whether a stored model could answer, and the command that fits one; an older one sends neither.
 * WP-146 (lead, 2026-10-11): a film the user has RATED is the held-out cell - the model is always trained again without that rating, so no stored model can answer it (the server says
 * so: `held_out: true`, and `pretrained_available` false). The notice then says why the stored model is not offered and what to do (pick a film the user has not rated), and does not
 * tell the person to fit a model beforehand - that cannot help this film. `note` is the one extra sentence: "held_out", "fit_first" (above the hard ceiling, where a model fitted
 * beforehand is the way on) or none.
 * WP-153: `few` - the estimate is the server's SMALLEST bucket (it rounds to 5 s and never goes below 5, engines/mf/persist.py `estimate_seconds`): every size up to that point reads
 * the same "5", so the notice says "a few seconds" instead of an "about 5 s" that sounds measured; both wordings call it an estimate from the size of the data set, not a measurement.
 * @param {Record<string, any>} params the error's `params`
 * @param {{classSet: string | null, storable?: boolean}} opts the data set the "class set" button leads to (null: there is none to offer); `storable` whether the method has a stored model
 *   at all (EASE has none: nothing to pick an unrated film FOR)
 * @returns {{reason: "ratings" | "items" | "hard_limit", estimate: number | null, few: boolean, canTrain: boolean, canPretrained: boolean, canClass: boolean, command: string | null, note: "held_out" | "fit_first" | null}}
 */
export function largeOffer(params, { classSet, storable = true }) {
  const reason = params.reason === "items" || params.reason === "hard_limit" ? params.reason : "ratings";
  const estimate = typeof params.estimated_seconds === "number" && Number.isFinite(params.estimated_seconds) && params.estimated_seconds > 0 ? params.estimated_seconds : null;
  const fit = typeof params.fit_command === "string" && params.fit_command.trim() ? params.fit_command.trim() : null;
  const heldOut = params.held_out === true && storable && reason !== "items";
  const note = heldOut ? "held_out" : reason === "hard_limit" && fit !== null ? "fit_first" : null;
  return {
    reason,
    estimate,
    few: estimate !== null && estimate <= SMALLEST_ESTIMATE_S,
    canTrain: reason === "ratings", // only the soft limit can be confirmed: the hard ceiling and EASE's memory limit (`items`) are refused whatever is sent (checked in the server's guard)
    canPretrained: params.pretrained_available === true,
    canClass: classSet !== null,
    command: heldOut ? null : fit, // a model fitted beforehand cannot answer a held-out cell
    note,
  };
}

/**
 * The data set of the class (its users' own ratings, small enough to train in the page): the newest live one - not a frozen snapshot - that is within the training limit.
 * @param {{name: string, kind: string, n_ratings: number, frozen?: boolean, release?: string | null}[] | undefined} datasets `/api/meta` `datasets`
 * @param {number | undefined} limit `trace_limits.max_train_ratings` (undefined: no limit)
 * @returns {string | null}
 */
export function classSetFor(datasets, limit) {
  const fits = (datasets || []).filter((d) => d.kind === "class" && !d.frozen && (limit === undefined || d.n_ratings <= limit));
  fits.sort((a, b) => (a.release === "final" ? 0 : 1) - (b.release === "final" ? 0 : 1) || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  return fits.length ? fits[0].name : null;
}
