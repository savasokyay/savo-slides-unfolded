// @ts-check
// WP-235: the numbers behind what the Weights tab says about the gradient descent, as pure functions (pinned under node by tests/app/js/hybrid_curve_model_check.mjs): which way the error
// moved at a step (the glyph and tone the chart's current point and the table's row wear), which weight moved the most, the first step at which every weight is within the tolerance of the closed
// form ("reached the closed form at step k"), how much the error has fallen since the equal start, the y range fitted to the descent, and the labels of the reference lines spread so none
// sits on another. The engine's numbers are the input: the trajectory table (`a_<base>` weights, `rmse` per step 0..K), the closed-form weights (the bases table's `alpha_ridge`) and the
// tolerance of `config/algorithms.yaml: hybrid_notes.gd_tol`.

/** the error moved by less than this between two steps: "=", neither better nor worse (the lead's rule for WP-235) */
export const TREND_EPS = 1e-4;

/** the glyph of each trend: the error fell (an improvement), rose, or stood still */
export const TREND_GLYPH = /** @type {const} */ ({ down: "▼", up: "▲", flat: "=" });

/**
 * Which way the held-out error moved from one step to the next. `down` is the good way: the error fell.
 * @param {number | null | undefined} prev the error one step earlier
 * @param {number | null | undefined} cur the error now
 * @param {number} [eps] a move smaller than this is no move
 * @returns {"down" | "up" | "flat" | null} null where one of the two is missing (the start has no step before it)
 */
export function trendOf(prev, cur, eps = TREND_EPS) {
  if (prev === null || prev === undefined || cur === null || cur === undefined || !Number.isFinite(prev) || !Number.isFinite(cur)) return null;
  const delta = cur - prev;
  return Math.abs(delta) < eps ? "flat" : delta < 0 ? "down" : "up";
}

/**
 * The weight that moved the most between two rows of the trajectory table (the first of equals; null when nothing moved or there is no row before).
 * @param {Record<string, any> | null | undefined} prev
 * @param {Record<string, any> | null | undefined} row
 * @param {string[]} keys the weight columns (`a_<base>`)
 * @returns {string | null}
 */
export function largestChange(prev, row, keys) {
  if (!prev || !row) return null;
  let best = null;
  let most = 0;
  for (const key of keys) {
    const move = Math.abs(Number(row[key]) - Number(prev[key]));
    if (Number.isFinite(move) && move > most) {
      most = move;
      best = key;
    }
  }
  return best;
}

/**
 * The widest gap between a step's weights and the closed form's.
 * @param {Record<string, any>} row a row of the trajectory table
 * @param {string[]} keys `a_<base>` of each weight, in the order of `star`
 * @param {number[]} star the closed-form weights
 * @returns {number}
 */
export function widestGap(row, keys, star) {
  return Math.max(...keys.map((key, j) => Math.abs(Number(row[key]) - star[j])));
}

/**
 * The first step at which no weight is further from the closed form than `tol` (`hybrid_notes.gd_tol`'s meaning: "the descent has reached the closed form when no weight is further away than this").
 * @param {Record<string, any>[]} rows the trajectory table, step 0..K in order
 * @param {string[]} keys
 * @param {number[]} star
 * @param {number} tol
 * @returns {number | null} the step (the row's `step`), null when the descent never gets there
 */
export function reachedStep(rows, keys, star, tol) {
  if (!keys.length || keys.length !== star.length) return null;
  const hit = rows.find((row) => widestGap(row, keys, star) <= tol);
  return hit ? Number(hit.step) : null;
}

/**
 * How much the error has changed since the equal start: the difference (negative = fell) and the share of the start (percent).
 * @param {number} from the error at step 0
 * @param {number} to the error now
 * @returns {{delta: number, pct: number | null}} `pct` is null for a start of zero
 */
export function gainOf(from, to) {
  const delta = to - from;
  return { delta, pct: from !== 0 ? (delta / Math.abs(from)) * 100 : null };
}

/**
 * WP-235a: the smallest "nice" tick step (1, 2 or 5 times a power of ten) that is at least `raw` - the step an axis would take to show about `raw`-sized intervals.
 * @param {number} raw a positive number
 * @returns {number}
 */
export function niceStep(raw) {
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * power >= raw * (1 - 1e-9)) return m * power;
  return 10 * power;
}

/**
 * WP-235a: the y range of the curve: the top a share of the span above the highest value (as it was), the BOTTOM one tick below the lowest - a tick's worth of room under the flat tail, so the tail stands
 * clear of the x axis and "it has converged" can be seen - with the tick step the axis then uses (about `ticks` intervals over the range).
 * @param {number[]} values the descent and where it is heading
 * @param {number} [topMargin] a share of the span of the values
 * @param {number} [ticks] about how many intervals the axis shows
 * @returns {{lo: number, hi: number, dtick: number}}
 */
export function tickedRange(values, topMargin = 0.1, ticks = 4) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.abs(high) * 0.01 || 1; // a descent that did not move still gets a window
  const hi = high + topMargin * span;
  const dtick = niceStep((hi - low) / ticks);
  return { lo: low - dtick, hi, dtick };
}

/**
 * WP-235a: the first step at which the error moves by less than `eps` (the "=" of the walk): from there on the descent has diminishing returns.
 * @param {number[]} errors the error at step 0..K
 * @param {number} [eps]
 * @returns {number | null} the step (index), null when every step still moves the error
 */
export function firstFlatStep(errors, eps = TREND_EPS) { // WP-235a
  for (let k = 1; k < errors.length; k++) if (trendOf(errors[k - 1], errors[k], eps) === "flat") return k;
  return null;
}

/**
 * Positions for labels that stand at given levels, pushed apart so that no two are closer than `gap` (the labels sit beside the plot, a line each; two levels that are close would print one on the other).
 * The order of the levels is kept; the pushes are shared (a cluster is centred on where its labels wanted to be). The gaps end within a hair of `gap` (a pair is pushed until it is no more than 1e-12 short).
 * @param {{key: string, y: number}[]} levels
 * @param {number} gap the least distance between two labels, in the units of `y`
 * @param {[number, number]} [bounds] the lowest and highest position a label may take (the plot's own extent: a label beyond it is drawn in the margin and may be cut): after every push the labels are
 *   brought back inside, so a cluster at the edge is pushed the other way
 * @returns {Record<string, number>} the position of each label by key
 */
export function spreadLevels(levels, gap, bounds) {
  const sorted = [...levels].sort((a, b) => a.y - b.y);
  const at = sorted.map((l) => l.y);
  // push every too-close pair apart, half each way (the sum of the positions never changes, so a cluster stays centred on where its labels wanted to be): the passes settle a handful of labels
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 1; i < at.length; i++) {
      const short = gap - (at[i] - at[i - 1]);
      if (short > 1e-12) {
        at[i - 1] -= short / 2;
        at[i] += short / 2;
        moved = true;
      }
    }
    if (bounds) {
      for (let i = 0; i < at.length; i++) {
        const inside = Math.min(bounds[1], Math.max(bounds[0], at[i]));
        if (inside !== at[i]) {
          at[i] = inside;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return Object.fromEntries(sorted.map((l, i) => [l.key, at[i]]));
}
