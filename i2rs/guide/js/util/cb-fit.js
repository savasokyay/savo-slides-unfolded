// @ts-check
// WP-195c: the Fit tab of the per-user content model (docs/plans/2610171557-per-user-content-model-design.md): what the model that was just trained is. A per-user model is trained for the
// request, from ONE user's own films, so the page says what it is - the kind, the ridge penalty alpha, how it was solved, how many films and terms it learned from, how far it is from its
// own films' ratings (the training RMSE, never a test error) and how long it took. The numbers are `result.model` of the trace (+ `meta.timing_ms`); this module only writes them out - which
// row shows, how each number is written - as plain data the component draws. Pure functions, hand-derived in tests/app/js/cb_fit_check.mjs under node.

import { fmtElapsed } from "./trace-loading.js";

/**
 * @typedef {Object} FitModel `result.model` of a content-based trace made with `method: "model"`
 * @property {string} [kind] "ridge" (the lecture's model) | "mlp" (the small network, stage 2)
 * @property {number} [alpha] the ridge penalty
 * @property {string | null} [solver] "dual" (closed form over the films) | "lsqr" (iterative, for many films); null for a model with no solver
 * @property {number | null} [iterations] lsqr's iteration count
 * @property {boolean | null} [converged]
 * @property {number} [n_films] the user's films the model was trained on
 * @property {number} [n_terms_used] the terms that got a weight
 * @property {number} [train_rmse] the error on those same films
 * @property {boolean} [flat] every rating equals the user's mean: nothing to learn
 * @property {number | null} [fit_ms] the time of the fit alone, when the engine reports it
 * WP-195c stage 2 - the small network (`kind: "mlp"`):
 * @property {number} [hidden] the hidden layer's units
 * @property {number} [epochs] the training epochs (full-batch Adam)
 * @property {number} [lr] Adam's learning rate
 * @property {number} [seed] the seed the start is drawn from
 * @property {number} [n_input_terms] the terms the network sees (the most frequent `max_terms` of the user's films)
 * @property {number} [n_dropped] the terms left out because there were more than `max_terms`
 * @property {number} [start_rmse] the error on the user's films before the first epoch
 * WP-224 - the validation split and early stopping (present when the user had films to hold out):
 * @property {number} [n_val] films held out
 * @property {boolean} [early_stopping] the switch (on = the usual practice, off = the labelled foil)
 * @property {number | null} [patience] epochs without improvement that end training
 * @property {string} [stop_reason] "patience" | "max_epochs" | "no_validation"
 * @property {number} [epochs_run] epochs that ran
 * @property {number | null} [kept_epoch] the epoch whose weights predict
 * @property {number | null} [best_epoch] the epoch with the lowest held-out error
 * @property {number | null} [val_rmse] the held-out error of the weights that predict
 * @property {number | null} [val_rmse_at_best] the lowest held-out error
 * @property {boolean} [still_improving] the run ended on its budget while the held-out error still fell
 */

/**
 * The ridge penalty as a short number: up to four significant digits, no trailing zeros (1 -> "1", 0.25 -> "0.25", 10 -> "10", 0.0001234 -> "0.0001234").
 * @param {number} alpha
 * @returns {string}
 */
export function alphaText(alpha) {
  return String(Number(alpha.toPrecision(4)));
}

/**
 * A duration, rounded down like the page's clock: under 10 ms with one decimal ("0.7 ms" - a per-user fit is that fast, which is the point), under a second in whole milliseconds
 * ("13 ms"), else seconds with one decimal in the page's own unit ("1.4 s" / "1,4 sn"). The decimal separator is the language's.
 * @param {number} ms
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {string} lang
 * @returns {string}
 */
export function durationText(ms, t, lang) {
  if (ms < 10) {
    const tenths = (Math.floor(Math.max(0, ms) * 10) / 10).toFixed(1);
    return t("cbmodel.ms", { n: lang === "tr" ? tenths.replace(".", ",") : tenths });
  }
  return ms < 1000 ? t("cbmodel.ms", { n: Math.floor(ms) }) : t("trace.loading_seconds", { n: fmtElapsed(ms, lang) });
}

/**
 * The fit's own time in milliseconds: `values.fit_seconds` of the step of the `fit` phase (the engine measures the training alone). Null when the trace has none (an older trace, no fit step).
 * @param {{phase?: string, values?: {fit_seconds?: unknown}}[] | null | undefined} steps `trace.steps`
 * @returns {number | null}
 */
export function fitMilliseconds(steps) {
  const step = Array.isArray(steps) ? steps.find((s) => s && s.phase === "fit") : null;
  const seconds = step?.values?.fit_seconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/**
 * What the Fit tab says about a trained model, as data: the heading (the kind of model), one row per number it has - a number the model does not carry has no row, never a blank - and a
 * note for the case with nothing to learn. `null` for no model (the user rated nothing besides the target film: the tab says so).
 * @param {FitModel | null | undefined} model `result.model`
 * @param {number | null | undefined} traceMs `meta.timing_ms`: the time of the whole trace, shown when the model has no time of its own
 * @param {(key: string, params?: Record<string, unknown>) => string} t the viewer's language
 * @param {string} [lang]
 * @returns {{heading: string, rows: {key: string, label: string, value: string}[], note: string | null} | null}
 */
export function fitSummary(model, traceMs, t, lang = "en") {
  if (!model || typeof model !== "object") return null;
  /** @type {{key: string, label: string, value: string}[]} */
  const rows = [];
  /** @param {string} key @param {string} value */
  const add = (key, value) => rows.push({ key, label: t(`cbmodel.${key}`), value });
  const finite = (/** @type {unknown} */ v) => typeof v === "number" && Number.isFinite(v);
  /** @param {unknown} v @returns {string} a whole number as text */
  const whole = (v) => String(Math.round(/** @type {number} */ (v)));
  if (model.kind === "mlp") {
    // WP-195c stage 2: the small network has no penalty and no solver - its rows are the architecture (the hidden units), the training (epochs, Adam's learning rate, the seed), the input
    // it saw (the terms: the most frequent ones when there are more than its limit, the rest left out) and how far it got: the error on its own films before the first epoch -> after the last
    if (finite(model.n_films)) add("films", whole(model.n_films));
    if (finite(model.hidden)) add("hidden", whole(model.hidden));
    if (finite(model.epochs)) add("epochs", whole(model.epochs));
    if (finite(model.lr)) add("lr", alphaText(/** @type {number} */ (model.lr)));
    if (finite(model.seed)) add("seed", whole(model.seed));
    if (finite(model.n_input_terms)) {
      const cut = finite(model.n_dropped) && /** @type {number} */ (model.n_dropped) > 0;
      rows.push({ key: "input_terms", label: t("cbmodel.input_terms"), value: cut ? t("cbmodel.input_terms_cut", { n: whole(model.n_input_terms), dropped: whole(model.n_dropped) }) : whole(model.n_input_terms) });
    }
    if (finite(model.train_rmse)) {
      const end = /** @type {number} */ (model.train_rmse).toFixed(4);
      rows.push({ key: "rmse_run", label: t("cbmodel.rmse_run"), value: finite(model.start_rmse) ? `${/** @type {number} */ (model.start_rmse).toFixed(4)} → ${end}` : end });
    }
    // WP-224: with a validation split the tab says whether early stopping was on (the usual practice) or off (the labelled foil), how many epochs ran and why they ended, which epoch's
    // weights predict, and the held-out error of those weights next to the lowest one; a model without a split (too few films) has none of these rows
    if (finite(model.n_val) && /** @type {number} */ (model.n_val) > 0 && typeof model.stop_reason === "string") {
      const on = model.early_stopping === true;
      add("early_stopping", on ? t("cbmodel.early_stopping_on", { patience: finite(model.patience) ? whole(model.patience) : "?" }) : t("cbmodel.early_stopping_off"));
      if (finite(model.epochs_run)) {
        const budget = finite(model.epochs) ? whole(model.epochs) : whole(model.epochs_run);
        add("epochs_run", t(model.stop_reason === "patience" ? "cbmodel.epochs_run_patience" : "cbmodel.epochs_run_budget", { n: whole(model.epochs_run), budget }));
      }
      if (finite(model.kept_epoch)) {
        const best = finite(model.best_epoch) ? whole(model.best_epoch) : whole(model.kept_epoch);
        add("kept_epoch", t(whole(model.kept_epoch) === best ? "cbmodel.kept_best" : "cbmodel.kept_last", { n: whole(model.kept_epoch), best }));
      }
      if (finite(model.val_rmse)) {
        const rmse = /** @type {number} */ (model.val_rmse).toFixed(4);
        add(
          "val_rmse",
          finite(model.val_rmse_at_best) && finite(model.best_epoch)
            ? t("cbmodel.val_rmse_at", { rmse, best_rmse: /** @type {number} */ (model.val_rmse_at_best).toFixed(4), best: whole(model.best_epoch) })
            : rmse
        );
      }
    }
  } else {
    if (finite(model.alpha)) add("alpha", alphaText(/** @type {number} */ (model.alpha)));
    if (model.solver === "dual") add("solver", t("cbmodel.solver_dual"));
    else if (model.solver === "lsqr") {
      add("solver", model.converged === false ? t("cbmodel.solver_lsqr_open") : t("cbmodel.solver_lsqr", { iterations: finite(model.iterations) ? model.iterations : "?" }));
    }
    if (finite(model.n_films)) add("films", whole(model.n_films));
    if (finite(model.n_terms_used)) add("terms", whole(model.n_terms_used));
    if (finite(model.train_rmse)) add("rmse", /** @type {number} */ (model.train_rmse).toFixed(4));
  }
  if (finite(model.fit_ms)) rows.push({ key: "time_fit", label: t("cbmodel.time_fit"), value: durationText(/** @type {number} */ (model.fit_ms), t, lang) });
  else if (finite(traceMs)) rows.push({ key: "time_trace", label: t("cbmodel.time_trace"), value: durationText(/** @type {number} */ (traceMs), t, lang) });
  const kind = model.kind === "mlp" ? "cbmodel.kind_mlp" : "cbmodel.kind_ridge";
  // WP-224: the note - nothing to learn (flat), else the badge sentence of a run that ended on its epoch budget while the held-out error was still falling
  const note = model.flat === true ? t("cbmodel.flat") : model.still_improving === true ? t("cbmodel.still_improving") : null;
  return { heading: t(kind), rows, note };
}
