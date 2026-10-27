// @ts-check
// WP-115 (3): the MACRO step counter of a uCF / iCF trace - "Step 4 / 8" - where the whole "for each candidate" loop is ONE step.
//
// The loop of a uCF / iCF walk is as long as the candidate list (45, 62, ... - the class pair and the lecture's 5x6 toy differ), so counting its
// steps one by one made the denominator depend on the data: "Step 12 / 15" on the toy, "Step 12 / 55" on a class pair. The user decided (2026-10-05): the
// counter above counts the algorithm's own steps - setup, THE LOOP, weighting, selection, prediction, result - and the loop is one of them, whatever the
// number of candidates; the counter under it ("c / C", util/candidate-progress.js) counts the candidates inside the loop. N is then the same for every pair.
//
// A step is a loop step when its node is one of the loop's own: the candidate's co-rated step, its similarity step, or the folded remainder of a capped
// list (`loop_neighbor` on a uCF page, `loop_item` on an iCF page). A run of consecutive loop steps is one macro step; any step outside the loop (the
// significance-weighting step included: it names one neighbour as an example of a rule applied to all of them) is a macro step of its own.
// WP-123: the MF and DNN pages count the same way. Their trace has TWO loops, each ONE step of the counter: the epoch walk (`evaluate`, one step per epoch
// shown, and `loop_epoch` for the epochs a long run folds into one) - as long as the run lasts, 4 to 40 epochs - and the forward pass's stages (`forward`, one per
// layer of the architecture: 5 or 10), which differ by the architecture. Two loops are never merged into one macro step, even when they touch: a run of loop
// steps is one macro step only while it stays in the SAME loop (`loops` is a list of node lists, one per loop).
// Pure, so tests/app/js/macro_steps_check.mjs can pin the rule under node.

/**
 * the nodes of the candidate loop (config/flowcharts/ucf.yaml, icf.yaml: `corated`, `similarity` and the loop node itself). WP-176: the content page's walk
 * (cb.yaml) has the same loop - its candidate's `shared_terms` step stands where the `corated` step does, then `similarity`, and `loop_item` for the folded remainder
 */
export const LOOP_NODES = ["corated", "shared_terms", "similarity", "loop_neighbor", "loop_item"];

/** WP-123: the loops of a uCF / iCF trace - one: the candidate walk (the default of every function below) */
export const CANDIDATE_LOOPS = [LOOP_NODES];

/**
 * WP-123: the loops of an MF / DNN trace (config/flowcharts/mf_sgd.yaml, mf_als.yaml, dnn.yaml): the epoch walk (`evaluate`, and `loop_epoch` for the folded
 * remainder of a long run) and the forward pass of the neural page (`forward`, one step per stage)
 */
export const TRAINED_LOOPS = [["evaluate", "loop_epoch"], ["forward"]];

/**
 * WP-212: the loops of the content page's top-K trace (config/flowcharts/topk_cb.yaml). Its walk has TWO loops, each ONE step of the counter: the scoring of the candidate films (`score` -
 * one step per detailed film, then one folded step for the rest) and the MMR re-ranking (`mmr` - one step per place of the list, the folded rest and the closing summary). `rank`
 * stands between them, so they never touch; they are still two lists, because a run of loop steps is one macro step only while it stays in the SAME loop. Measured on toy-5x6 and on an
 * 80 x 120 set: 6 and 20 raw steps, 5 macro steps for both (pick, scoring, sort, re-ranking, result)
 */
export const CB_TOPK_LOOPS = [["score"], ["mmr"]];

/**
 * @param {{ node_id?: string }} step
 * @param {string[][]} [loops]
 * @returns {number} the index of the loop the step belongs to, -1 when it belongs to none
 */
export function loopOf(step, loops = CANDIDATE_LOOPS) {
  return loops.findIndex((nodes) => nodes.includes(String(step.node_id)));
}

/**
 * @param {{ node_id?: string }} step
 * @param {string[][]} [loops]
 */
export function isLoopStep(step, loops = CANDIDATE_LOOPS) {
  return loopOf(step, loops) >= 0;
}

/**
 * @param {{ steps?: { node_id?: string }[] }} trace
 * @param {string[][]} [loops] the loops that count as one step each (default: the uCF / iCF candidate walk)
 * @returns {{ perStep: number[], total: number }} `perStep[i]`: the macro step (1-based) the trace's step i belongs to; `total`: the number of macro steps
 */
export function macroSteps(trace, loops = CANDIDATE_LOOPS) {
  const steps = trace.steps || [];
  /** @type {number[]} */
  const perStep = [];
  let total = 0;
  let previous = -1; // the loop the step before belonged to (-1: none)
  for (const step of steps) {
    const loop = loopOf(step, loops);
    if (!(loop >= 0 && loop === previous)) total += 1; // a loop step right after a step of the same loop is the same macro step
    perStep.push(total);
    previous = loop;
  }
  return { perStep, total };
}
