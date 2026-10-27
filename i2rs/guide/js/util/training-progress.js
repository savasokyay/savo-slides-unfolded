// @ts-check
// WP-123: where a step of an MF / DNN trace is inside the loop it belongs to - the counter under "Step i / N" ("Epoch 3 / 8", "Stage 7 / 10"), the training
// pages' counterpart of the uCF / iCF candidate counter ("c / C", util/candidate-progress.js).
//
// The engine says it with data the steps already carry, no new field: an epoch step (`evaluate`) names its epoch and the run's length in `text_params`
// (`epoch`, `n_epochs`), a forward-pass step (`forward`) names its stage (`layer`, `n_layers`), and the step that folds the epochs a long run does not
// show one by one (`loop_epoch`) reveals the whole epoch table (`tables[].reveal_upto` = the run's length) - the walk has reached the last epoch. Every other
// step (the demo update of the first epoch, the early-stopping decision, the prediction) belongs to no loop: no counter (the strip keeps its place).
// The kind is `epoch` or `stage` (the app calls a layer of the traced forward pass a "stage", `step.dnn.layer_*`), so each gets its own text.
// `widest` is what the counter has to make room for - the largest "c / n" of each kind - so the strip never moves while stepping.
// Pure, so tests/app/js/training_progress_check.mjs can pin the rule under node.

/**
 * @typedef {{ kind: "epoch" | "stage", c: number, n: number }} LoopPosition
 */

/** @param {unknown} value @returns {number | null} a positive integer, else null */
function count(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * @param {{ steps?: any[] }} trace
 * @returns {{ perStep: (LoopPosition | null)[], widest: LoopPosition[] }}
 */
export function trainingProgress(trace) {
  const steps = trace.steps || [];
  /** @type {(LoopPosition | null)[]} */
  const perStep = steps.map(() => null);
  let epochs = 0; // the length of the run: the largest `n_epochs` any epoch step names
  let stages = 0;
  steps.forEach((step, i) => {
    const p = step.text_params || {};
    if (step.node_id === "evaluate") {
      const c = count(p.epoch);
      const n = count(p.n_epochs);
      if (c === null || n === null || c > n) return;
      perStep[i] = { kind: "epoch", c, n };
      epochs = Math.max(epochs, n);
    } else if (step.node_id === "forward") {
      const c = count(p.layer);
      const n = count(p.n_layers);
      if (c === null || n === null || c > n) return;
      perStep[i] = { kind: "stage", c, n };
      stages = Math.max(stages, n);
    }
  });
  // the step that folds the epochs a long run does not show: the walk is at its last epoch
  steps.forEach((step, i) => {
    if (step.node_id !== "loop_epoch") return;
    const ref = (step.tables || []).find((/** @type {any} */ t) => count(t.reveal_upto) !== null);
    const c = ref ? count(ref.reveal_upto) : null;
    if (c === null) return;
    const n = Math.max(epochs, c);
    perStep[i] = { kind: "epoch", c, n };
    epochs = n;
  });
  /** @type {LoopPosition[]} */
  const widest = [];
  if (epochs > 0) widest.push({ kind: "epoch", c: epochs, n: epochs });
  if (stages > 0) widest.push({ kind: "stage", c: stages, n: stages });
  return { perStep, widest };
}
