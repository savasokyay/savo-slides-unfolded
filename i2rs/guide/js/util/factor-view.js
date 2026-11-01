// @ts-check
// WP-122: the logic of the MF page's factor panel - WHAT it shows, in plain values, so it can be checked under node against hand-derived cases
// (tests/app/js/factor_view_check.mjs); components/factor-panel.js builds the DOM from it.
//
// The engine's `views.factors` (trace/models.py `FactorView`; FunkSVD and ALS only): the watched users x films of the sub-matrix (the same rows and columns in the
// same order, the active user and the target film first), the factor matrices P (users x k) and Q (films x k), the biases and the whole predicted matrix
// R^ = mu + b_u + b_i + P Q^T for TWO frames - the initial weights and the epoch the trainer kept (it restores the best epoch, so there is no "final" frame that
// could contradict the prediction). Which cell is which is told by roles: `observed` (every rating the watched cells hold, the TARGET not among them),
// `trained` (those the model was fitted on) and `valid` (held out for validation: not trained on).
// Rules the panel keeps:
//  * the residual r - r^ exists ONLY for a trained cell; an unrated cell has none (it is empty, never 0), a validation cell was not trained on (it is faded);
//  * the target cell's r^ is the answer: it stays hidden ("?") until the prediction phase, whatever frame is on screen;
//  * the initial frame shows until the trainer has finished (the early-stopping step restores the kept epoch), the kept epoch from there on;
//  * the sign of a factor is a colour (WP-157: purple above zero, orange-brown below - the centred sub-matrix's diverging scale, not the user / film hues), a rating's value a tint of one hue (navy) - the heat grid has no value scale of its own.

import { phaseReached } from "./column-phase.js"; // WP-141

/** how many of the k latent components the panel writes out (the rest is counted in a note) */
export const MAX_FACTORS_SHOWN = 6;

/**
 * Whether a view can be drawn: at least one frame, every frame's P / Q / R^ / biases shaped like the labels (a mismatch would put one user's numbers on another's row).
 * @param {any} view
 * @returns {boolean}
 */
export function isFactorView(view) {
  if (!view || !Array.isArray(view.frames) || view.frames.length === 0) return false;
  const m = Array.isArray(view.user_labels) ? view.user_labels.length : 0;
  const n = Array.isArray(view.item_labels) ? view.item_labels.length : 0;
  const k = view.k;
  if (!(m > 0 && n > 0 && Number.isInteger(k) && k > 0)) return false;
  /** @param {any} rows @param {number} height @param {number} width */
  const shaped = (rows, height, width) => Array.isArray(rows) && rows.length === height && rows.every((/** @type {any} */ row) => Array.isArray(row) && row.length === width);
  /** @param {any} list @param {number} size */
  const optional = (list, size) => list === null || list === undefined || (Array.isArray(list) && list.length === size);
  return view.frames.every(
    (/** @type {any} */ f) => shaped(f.P, m, k) && shaped(f.Q, n, k) && shaped(f.rhat, m, n) && optional(f.b_users, m) && optional(f.b_items, n) && Number.isFinite(f.mu)
  );
}

/**
 * The index of the frame the kept epoch is ("factor.frame.best"); the last frame when none is labelled so.
 * @param {{label_key?: string}[]} frames
 * @returns {number}
 */
export function bestIndex(frames) {
  const at = frames.findIndex((f) => String(f.label_key).endsWith(".best"));
  return at >= 0 ? at : frames.length - 1;
}

/**
 * The frame a step shows: the initial weights until the trainer has finished, the kept epoch from the early-stopping step on (that step is the one that
 * restores it) - and in the prediction phase, whatever the steps in between were.
 * @param {{step?: {node_id?: string}, visitedNodes?: Set<string>, phase?: {id?: string} | null}} frame the player's frame
 * @param {{label_key?: string}[]} frames
 * @returns {number}
 */
export function frameIndexFor(frame, frames) {
  if (frames.length < 2) return 0;
  const trained = frame.step?.node_id === "early_stop" || Boolean(frame.visitedNodes?.has("early_stop")) || frame.phase?.id === "prediction";
  return trained ? bestIndex(frames) : 0;
}

/**
 * WP-146: the i18n key of a frame's chip in the panel head. The frame that is the INITIAL weights says so; every other frame is named by its epoch. It used to be the first frame
 * of the list that said "initialisation" - true of a trace that walks the training, false of a model fitted beforehand (the pretrained one has ONE frame: the kept epoch), whose
 * chip then called trained weights "initialisation".
 * @param {{label_key?: string}} frame
 * @returns {"mf.frame_init" | "mf.frame_epoch"}
 */
export function frameChipKey(frame) {
  return frame.label_key === "factor.frame.init" ? "mf.frame_init" : "mf.frame_epoch";
}

/**
 * The target cell's R^ is the answer the whole walk leads to: it is written only from the prediction phase on.
 * @param {{phase?: {id?: string} | null}} frame
 * @returns {boolean}
 */
export function targetOpen(frame) {
  return frame.phase?.id === "prediction";
}

/**
 * @typedef {{values: Map<string, number>, trained: Set<string>, valid: Set<string>, target: string | null}} Roles
 */

/** @param {number} r @param {number} c */
const key = (r, c) => `${r}:${c}`;

/**
 * @param {any} view
 * @returns {Roles}
 */
export function buildRoles(view) {
  /** @type {Roles} */
  const roles = { values: new Map(), trained: new Set(), valid: new Set(), target: null };
  for (const [r, c, v] of view.observed || []) roles.values.set(key(r, c), v);
  for (const [r, c] of view.trained || []) roles.trained.add(key(r, c));
  for (const [r, c] of view.valid || []) roles.valid.add(key(r, c));
  if (Array.isArray(view.target) && view.target.length === 2) roles.target = key(view.target[0], view.target[1]);
  return roles;
}

/**
 * What a cell is: the "target" (never a rating the model sees), a "trained" rating, a "valid"ation rating (held out of the fit) or "none" (no rating: R^ is the
 * model's value alone).
 * @param {Roles} roles @param {number} r @param {number} c
 * @returns {"target" | "trained" | "valid" | "none"}
 */
export function cellRole(roles, r, c) {
  const k = key(r, c);
  if (k === roles.target) return "target";
  if (roles.trained.has(k)) return "trained";
  if (roles.valid.has(k)) return "valid";
  return "none";
}

/**
 * The residual r - r^ of a cell: only a TRAINED rating has one (an unrated cell would be -r^, a validation rating was never fitted, the target is the answer).
 * @param {Roles} roles @param {number} r @param {number} c @param {number} rhat
 * @returns {number | null}
 */
export function residualOf(roles, r, c, rhat) {
  if (cellRole(roles, r, c) !== "trained") return null;
  const v = roles.values.get(key(r, c));
  return v === undefined ? null : v - rhat;
}

/** @param {number} value @returns {string} a factor, bias or mean: three decimals (the values are of the order of 0.1); a value that rounds to zero has no sign */
export function fmtFactor(value) {
  const text = value.toFixed(3);
  return Number(text) === 0 ? "0.000" : text;
}

/** @param {number} value @returns {string} a predicted rating in a cell: two decimals */
export function fmtRhat(value) {
  return value.toFixed(2);
}

/** @param {number} value @returns {string} a residual with its sign: "+0.31", "-0.31", "0.00" */
export function fmtResidual(value) {
  const text = value.toFixed(2);
  if (Number(text) === 0) return "0.00";
  return value > 0 ? `+${text}` : text;
}

/**
 * How much of a hue a rated value gets: 0 at the scale's bottom, 1 at its top.
 * @param {number} value
 * @param {{min?: number, max?: number} | null | undefined} scale the dataset's rating scale (the default 0.5 - 5 when unknown)
 * @returns {number}
 */
export function ratingTint(value, scale) {
  const lo = Number.isFinite(scale?.min) ? /** @type {number} */ (scale?.min) : 0.5;
  const hi = Number.isFinite(scale?.max) ? /** @type {number} */ (scale?.max) : 5;
  if (!(hi > lo)) return 0;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/**
 * The colour of a factor value: its sign (1 the positive arm of the diverging scale, -1 the negative arm, 0 none; the colours are CSS's, mf.css `.factor-cell.is-pos` / `.is-neg`) and how
 * strong (its share of the largest absolute value of the matrix).
 * @param {number} value @param {number} largest the largest absolute value among the numbers shown with it
 * @returns {{sign: -1 | 0 | 1, strength: number}}
 */
export function signedTint(value, largest) {
  if (!(largest > 0) || value === 0 || !Number.isFinite(value)) return { sign: 0, strength: 0 };
  return { sign: value > 0 ? 1 : -1, strength: Math.min(1, Math.abs(value) / largest) };
}

/**
 * @param {number[][]} rows a matrix (users x k, films x k)
 * @returns {number} the largest absolute value in it (0 for an empty one)
 */
export function largestAbs(rows) {
  let best = 0;
  for (const row of rows) for (const v of row) if (Number.isFinite(v)) best = Math.max(best, Math.abs(v));
  return best;
}

/**
 * @param {number} k the number of latent components
 * @returns {{shown: number, hidden: number}} the components written out and the ones left to the note
 */
export function shownFactors(k) {
  return { shown: Math.min(k, MAX_FACTORS_SHOWN), hidden: Math.max(0, k - MAX_FACTORS_SHOWN) };
}

/**
 * What the step marks in the factor view: whole rows (the active user), whole columns, and single cells with their style ("result": the prediction's cell).
 * WP-141: a column marked in the `dim` style (candidates "all": the rated films stay in the list, display only) or in the `dropped` style (candidates "unseen": the rated films drop
 * out) is not outlined - it fades; it comes back as `dim`.
 * @param {{view?: string, rows?: number[], cols?: number[], cells?: number[][], style?: string}[]} highlights the player's frame (persisted ones included)
 * @returns {{rows: Set<number>, cols: Set<number>, cells: Map<string, string>, dim: Set<number>}}
 */
export function highlightSets(highlights) {
  const rows = new Set();
  const cols = new Set();
  /** @type {Map<string, string>} */
  const cells = new Map();
  /** @type {Set<number>} */
  const dim = new Set();
  for (const h of highlights || []) {
    if (h.view !== "factors") continue;
    for (const r of h.rows || []) rows.add(r);
    for (const c of h.cols || []) (h.style === "dim" || h.style === "dropped" ? dim : cols).add(c);
    for (const [r, c] of h.cells || []) cells.set(key(r, c), h.style || "active");
  }
  return { rows, cols, cells, dim };
}

// WP-141: the factor view of the TOP-K task. The same fitted model, asked about every film at once: the user's row of P (and bias) against each shown film's column of
// Q^T gives one score per film - a single row, R^ - and the K films the cut keeps are the answer. There is no target film: `target` is null, `scores_row` is that row of
// the kept epoch's frame (one score per shown film column) and `top_cols` the columns the cut keeps, best score first (docs/plans/2610101900-topk-task-switch.md
// section 7). The panel shows ONE frame (the kept epoch: a list is the trained model's), writes the scores from the scoring phase on ("?" before it) and outlines the
// kept columns from the cut phase on.

/**
 * Whether a view is the top-K task's: no target film, a score per shown film.
 * @param {any} view
 * @returns {boolean}
 */
export function isTopkView(view) {
  return Boolean(view) && !Array.isArray(view.target) && Array.isArray(view.scores_row);
}

/**
 * The rank (1 = best) of each column the cut keeps (`top_cols` is in score order).
 * @param {{top_cols?: number[] | null}} view
 * @returns {Map<number, number>} column -> rank
 */
export function topRanks(view) {
  /** @type {Map<number, number>} */
  const ranks = new Map();
  (view.top_cols || []).forEach((c, i) => {
    if (!ranks.has(c)) ranks.set(c, i + 1);
  });
  return ranks;
}

/**
 * How far the walk has come in the top-K task: the scores exist from the `score` phase on, the cut from the `cut` phase on (a trace without such a phase has nothing to
 * wait for: its values show from the start).
 * @param {{phase?: {id?: string} | null, trace?: {phases?: {id: string}[]}}} frame the player's frame
 * @returns {{scores: boolean, cut: boolean}}
 */
export function topkStage(frame) {
  const ids = (frame.trace?.phases || []).map((p) => p.id);
  const now = frame.phase?.id ?? null;
  return { scores: phaseReached(ids, now, "score"), cut: phaseReached(ids, now, "cut") };
}

/**
 * Which formula line goes with the numbers: with the biases of the model, or - ALS and a model without biases - the global mean and the factors alone.
 * @param {{b_users?: unknown[] | null}} frame
 * @returns {"with_bias" | "no_bias"}
 */
export function formulaKey(frame) {
  return Array.isArray(frame.b_users) ? "with_bias" : "no_bias";
}

/**
 * Whether the engine says the latent-space panel shows the first two principal components rather than the factors themselves (k > 2): the numbers here are the raw P and Q.
 * @param {{basis?: string, k?: number}} view
 * @returns {boolean}
 */
export function basisDiffers(view) {
  return view.basis === "svd" && Number(view.k) > 2;
}
