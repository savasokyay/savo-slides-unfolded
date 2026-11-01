// @ts-check
// WP-212: where a step of the content page's top-K trace is inside the loop it belongs to - the counter under "Step i / N" ("3 / 5" while the films are scored, "Place 3 / 10" while the
// list is re-ranked), the top-K counterpart of the candidate counter of the prediction walk (util/candidate-progress.js) and of the training pages' epoch counter.
//
// The engine says it with data the steps already carry, no new field. A scoring step (`score`) of one film focuses ITS row of the `ranked` table and reveals the table up to it
// (`tables[].focus_rows` = [r], `reveal_upto` = r + 1): that is the candidate number. An MMR pick (`mmr`) names its place in the list in `values.position`. The steps that belong to a
// loop but name no film or place of their own - the folded rest of a long list (`topk_score_rest`, `topk_mmr_rest`), the closing summary of the re-ranking, the empty-candidate sentence -
// take the one of the loop step before them (else the one after), so inside a loop the counter is never empty (the step counter above no longer moves there, util/macro-steps.js);
// the folded rest therefore reads "C / C" - the last film or place walked - and the hover title says how many exist ("20 of 30 shown"). A step outside the two loops (the pick, the sort,
// the result) has no counter (the strip keeps its place).
// `walked` is the number of films the walk goes through (the engine detail-steps a few: `limits.max_detail_items`), `total` the number that exist (the `pick` step's `n_candidates`);
// `places` / `placesTotal` the same for the list (`limits.max_rank_steps` picks are walked, the `k` the closing step names is the list's length).
// Pure, so tests/app/js/topk_progress_check.mjs can pin the rule under node.

import { CB_TOPK_LOOPS, loopOf } from "./macro-steps.js";

/** @typedef {{ c: number, kind?: "place" }} TopkPosition `kind` absent: a candidate film */

/** @param {unknown} value @returns {number | null} a positive integer, else null */
function count(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * @param {{ steps?: any[] }} trace
 * @returns {{ perStep: (TopkPosition | null)[], walked: number, total: number | null, places: number, placesTotal: number | null }}
 */
export function topkProgress(trace) {
  const steps = trace.steps || [];
  /** @type {(TopkPosition | null)[]} */
  const perStep = steps.map(() => null);
  let walked = 0;
  let places = 0;
  let total = null;
  let placesTotal = null;
  steps.forEach((s, i) => {
    if (s.node_id === "pick") total = count(s.values?.n_candidates ?? s.text_params?.n_candidates) ?? total;
    if (s.node_id === "score") {
      // the film's own step: it focuses one row of the ranked table and reveals the table up to that row
      const ref = (s.tables || []).find(
        (/** @type {any} */ t) => Array.isArray(t.focus_rows) && t.focus_rows.length === 1 && count(t.reveal_upto) === t.focus_rows[0] + 1
      );
      if (!ref) return;
      perStep[i] = { c: ref.reveal_upto };
      walked = Math.max(walked, ref.reveal_upto);
    } else if (s.node_id === "mmr") {
      const c = count(s.values?.position);
      placesTotal = count(s.text_params?.k) ?? placesTotal; // the closing step names the list's length
      if (c === null) return;
      perStep[i] = { kind: "place", c };
      places = Math.max(places, c);
    }
  });
  // no empty counter inside a loop: a loop step that names nothing takes its neighbour's within the SAME loop (the one before it first)
  steps.forEach((s, i) => {
    const loop = loopOf(s, CB_TOPK_LOOPS);
    if (loop < 0 || perStep[i] !== null) return;
    for (let j = i - 1; j >= 0 && loopOf(steps[j], CB_TOPK_LOOPS) === loop; j--) {
      if (perStep[j] !== null) {
        perStep[i] = perStep[j];
        return;
      }
    }
    for (let j = i + 1; j < steps.length && loopOf(steps[j], CB_TOPK_LOOPS) === loop; j++) {
      if (perStep[j] !== null) {
        perStep[i] = perStep[j];
        return;
      }
    }
  });
  return { perStep, walked, total, places, placesTotal };
}
