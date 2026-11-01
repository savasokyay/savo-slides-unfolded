// @ts-check
// WP-235: where a step of a hybrid trace is inside the loop it belongs to - the counter under "Step i / N" ("Iteration 15 / 30" in the gradient descent, "Recommender 2 / 4" while the bases are
// fitted, or scored on the switching walk), the hybrid's counterpart of the MF / DNN pages' "Epoch 3 / 8" (util/training-progress.js) and the uCF / iCF candidate counter. The macro counter above
// counts the whole loop as ONE step (util/hybrid-tabs.js `HYBRID_LOOPS`), so without this line thirty iterations all read "Step 6 / 10".
//
// The engine says it with data the steps already carry, no new field: a gradient step (`gd`, text_key `step.hybrid.gd_*`) names its iteration and the descent's length in `text_params`
// (`k`, `K`); the step that folds the iterations a long descent does not show one by one (`step.hybrid.gd_collapsed`) names the last of them (`last`), the walk has reached it; a base being
// fitted (`fit_bases`) or scored (`score`) names its place in the list (`i`, `q`). Every other step (pick, split, predict, the equal start, the closed form, the blend) belongs to no loop:
// no counter, the strip keeps its place. `widest` is what the counter has to make room for - the largest "c / n" of each kind - so the strip never moves while stepping.
// Pure, so tests/app/js/hybrid_progress_check.mjs can pin the rule under node.

/**
 * @typedef {{ kind: "iteration" | "recommender", c: number, n: number }} LoopPosition
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
export function hybridProgress(trace) {
  const steps = trace.steps || [];
  /** @type {(LoopPosition | null)[]} */
  const perStep = steps.map(() => null);
  let iterations = 0; // the length of the descent: the largest `K` any gradient step names
  let recommenders = 0;
  steps.forEach((step, i) => {
    const p = step.text_params || {};
    if (step.node_id === "gd" && p.k !== undefined) {
      const c = count(p.k);
      const n = count(p.K);
      if (c === null || n === null || c > n) return;
      perStep[i] = { kind: "iteration", c, n };
      iterations = Math.max(iterations, n);
    } else if (step.node_id === "fit_bases" || step.node_id === "score") {
      const c = count(p.i);
      const n = count(p.q);
      if (c === null || n === null || c > n) return;
      perStep[i] = { kind: "recommender", c, n };
      recommenders = Math.max(recommenders, n);
    }
  });
  // the step that folds the iterations a long descent does not show: the walk is at the last of them
  steps.forEach((step, i) => {
    if (step.node_id !== "gd" || step.text_key !== "step.hybrid.gd_collapsed") return;
    const c = count((step.text_params || {}).last);
    if (c === null) return;
    const n = Math.max(iterations, c);
    perStep[i] = { kind: "iteration", c, n };
    iterations = n;
  });
  /** @type {LoopPosition[]} */
  const widest = [];
  if (iterations > 0) widest.push({ kind: "iteration", c: iterations, n: iterations });
  if (recommenders > 0) widest.push({ kind: "recommender", c: recommenders, n: recommenders });
  return { perStep, widest };
}
