// @ts-check
// WP-224: the sentence under a training curve - how training ended and which epoch's weights predict - and the "still improving at the last epoch" badge. Both network pages carry the
// same facts in their trace result: the neural page at the top of `result` (`stop_reason`, `best_epoch`, `kept_epoch`, `epochs`, `still_improving`, `n_valid`, `trainer.patience` in the
// request config), the per-user content model under `result.model` (`stop_reason`, `best_epoch`, `kept_epoch`, `epochs_run`, `early_stopping`, `patience`, `still_improving`, `n_val`).
// This module only reads them and picks the sentence; components/curve-panel.js draws it. Pure functions, checked under node (tests/app/js/dnn_page_check.mjs).

/**
 * @typedef {Object} CurveFacts
 * @property {string | null} stopReason "patience" | "max_epochs" | "no_validation" | null (unknown)
 * @property {number | null} bestEpoch the epoch with the lowest validation error (null without validation)
 * @property {number | null} keptEpoch the epoch whose weights predict
 * @property {number | null} epochsRun epochs that actually ran
 * @property {number | null} budget the epoch budget (max epochs)
 * @property {number | null} patience the patience in epochs (null: early stopping off / unknown)
 * @property {boolean} earlyStopping whether the early-stopping switch was on
 * @property {boolean} stillImproving the run ended on the budget while the last epoch still improved validation
 * @property {boolean} validation whether a validation set existed
 */

/** @param {unknown} v @returns {number | null} */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The facts of a trace's training, whichever page it comes from; null when the trace has no epochs (a closed form, no trace).
 * @param {any} trace the trace (`result`, `meta.request.config`)
 * @returns {CurveFacts | null}
 */
export function curveFacts(trace) {
  const r = trace?.result;
  if (!r || typeof r !== "object") return null;
  const m = r.model && typeof r.model === "object" && typeof r.model.kind === "string" ? r.model : null; // the per-user content model
  if (m) {
    if (m.kind !== "mlp" || !num(m.epochs_run) && !Array.isArray(m.loss_curve)) return null;
    const run = num(m.epochs_run) ?? (Array.isArray(m.loss_curve) ? m.loss_curve.length : null);
    const validation = (num(m.n_val) ?? 0) > 0;
    return {
      stopReason: typeof m.stop_reason === "string" ? m.stop_reason : validation ? "max_epochs" : "no_validation",
      bestEpoch: num(m.best_epoch),
      keptEpoch: num(m.kept_epoch) ?? run,
      epochsRun: run,
      budget: num(m.epochs),
      patience: m.early_stopping === false ? null : num(m.patience),
      earlyStopping: m.early_stopping === true,
      stillImproving: m.still_improving === true,
      validation,
    };
  }
  const run = num(r.epochs);
  if (run === null) return null;
  const trainer = trace?.meta?.request?.config?.trainer;
  const patience = trainer && typeof trainer === "object" ? num(trainer.patience) : null;
  const validation = (num(r.n_valid) ?? 0) > 0;
  return {
    stopReason: typeof r.stop_reason === "string" ? r.stop_reason : null,
    bestEpoch: num(r.best_epoch),
    keptEpoch: num(r.kept_epoch) ?? num(r.best_epoch) ?? run,
    epochsRun: run,
    budget: trainer && typeof trainer === "object" ? num(trainer.max_epochs) : null,
    patience: patience !== null && patience > 0 ? patience : null,
    earlyStopping: patience !== null && patience > 0,
    stillImproving: r.still_improving === true,
    validation,
  };
}

/**
 * The caption's sentence key and params, plus whether the badge shows. The sentence says why training ended and which epoch's weights predict; with early stopping OFF and a validation set
 * the sentence names it as the teaching foil and where the usual practice would have stopped (never the foil alone, docs/teaching-invariants.md §8).
 * @param {CurveFacts | null} facts
 * @returns {{key: string, params: Record<string, number | string>, badge: boolean} | null}
 */
export function curveCaption(facts) {
  if (!facts || facts.epochsRun === null) return null;
  const kept = facts.keptEpoch ?? facts.epochsRun;
  const params = { n: facts.epochsRun, kept, best: facts.bestEpoch ?? kept, budget: facts.budget ?? facts.epochsRun, patience: facts.patience ?? 0 };
  if (!facts.validation || facts.stopReason === "no_validation") return { key: "curve.stop_no_validation", params, badge: false };
  if (facts.stopReason === "patience") return { key: "curve.stop_patience", params, badge: false };
  if (!facts.earlyStopping) {
    // WP-225: the foil sentence only when the last epoch's weights really predict; a budget run whose best weights were restored (a model fitted with patience off but the
    // restore on, reachable through the CLI, not the form) gets the plain budget sentence
    if (kept !== facts.epochsRun) return { key: "curve.stop_budget", params, badge: false };
    return { key: "curve.stop_foil_off", params, badge: facts.stillImproving };
  }
  return { key: facts.stillImproving ? "curve.stop_budget_improving" : "curve.stop_budget", params, badge: facts.stillImproving };
}
