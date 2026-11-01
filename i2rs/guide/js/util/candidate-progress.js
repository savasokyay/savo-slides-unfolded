// @ts-check
// WP-107 (i): where a step of a uCF / iCF trace is among the candidates the walk goes through ("3 / 12" under the step counter).
//
// The engine says it with data the steps already carry, no new field: the per-candidate `similarity` step reveals one more row of the
// candidate table (`tables[].reveal_upto`, 1 for the first candidate), the `corated` step that opens the first few candidates belongs to
// the candidate whose similarity step follows it. Every other step is not part of the loop: no counter (the strip keeps the place) - also the
// significance-weighting step: it names ONE neighbour as the example of a rule applied to all of them, it is not a step of the loop, so it must
// not read "19 / 45" (the user's decision, 2026-10-05).
// `walked` is the number of candidates the walk goes through (the engine caps a long list: 50), `total` the number that exist (the setup step
// "candidates" says it in `text_params.n`); `total > walked` is the cap.
// WP-115 (3): inside the loop the counter is never empty (the step counter above no longer moves there - util/macro-steps.js - so this one is the only
// sign of progress): a loop step the rules above left without a candidate takes the candidate of the loop step before it (else the one after it). That is
// how the folded remainder of a capped list (`loop_neighbor` / `loop_item`) reads "C / C" - the last candidate walked, the cap's own title still says
// "50 of 62 shown" - and how a `corated` step without a similarity step of its own stays inside the loop.
// Pure, so tests/app/js/candidate_progress_check.mjs can pin the rule under node.

import { isLoopStep } from "./macro-steps.js"; // WP-115

/**
 * @param {{steps?: any[]}} trace
 * @returns {{ perStep: ({ c: number } | null)[], walked: number, total: number | null }} `perStep[i]`: the candidate step i is about
 */
export function candidateProgress(trace) {
  const steps = trace.steps || [];
  /** @type {({ c: number } | null)[]} */
  const perStep = steps.map(() => null);
  let walked = 0;
  steps.forEach((s, i) => {
    if (s.node_id !== "similarity") return;
    const ref = (s.tables || []).find((/** @type {any} */ t) => Number.isInteger(t.reveal_upto) && t.reveal_upto > 0);
    if (!ref) return;
    perStep[i] = { c: ref.reveal_upto };
    walked = Math.max(walked, ref.reveal_upto);
  });
  // a `corated` step belongs to the candidate whose `similarity` step comes next (the first candidates take two steps)
  // WP-176: so does the content page's `shared_terms` step (the candidate's terms in common with the target)
  const preSteps = ["corated", "shared_terms"];
  steps.forEach((s, i) => {
    if (!preSteps.includes(s.node_id)) return;
    for (let j = i + 1; j < steps.length; j++) {
      if (steps[j].node_id === "similarity") {
        perStep[i] = perStep[j];
        return;
      }
      if (!preSteps.includes(steps[j].node_id)) return;
    }
  });
  // WP-115 (3): no empty counter inside the loop
  steps.forEach((s, i) => {
    if (!isLoopStep(s) || perStep[i] !== null) return;
    for (let j = i - 1; j >= 0 && isLoopStep(steps[j]); j--) {
      if (perStep[j] !== null) {
        perStep[i] = perStep[j];
        return;
      }
    }
    for (let j = i + 1; j < steps.length && isLoopStep(steps[j]); j++) {
      if (perStep[j] !== null) {
        perStep[i] = perStep[j];
        return;
      }
    }
  });
  const setup = steps.find((s) => s.node_id === "candidates");
  const n = Number(setup?.text_params?.n ?? setup?.values?.n_candidates);
  return { perStep, walked, total: Number.isFinite(n) && n > 0 ? n : null };
}
