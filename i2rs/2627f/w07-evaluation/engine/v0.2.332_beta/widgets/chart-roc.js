// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1; the optional page `roc` of the I2RS w07 deck, storyboard §3): the mode `roc` of chart-draw. ROC and AUC for a ranked list, told as a picture (Herlocker et al. 2004, p. 28; Rendle 2019, p. 4); the textbook's
// Table 7.1 is retold in our own toy example (D-048). A ranked list of ten items, five of them relevant: walk down the list; a relevant item steps UP (a true positive, 1/5 of the height), an irrelevant one steps RIGHT (a false positive, 1/5 of the width).
// The picture is plainly a toy (no measured result): it carries no label (D-129).
//
// WP-93 (brief 10 item 1, D-162; the user: "before saying A and B and the other lines, one line must be drawn and told: the open formulas of TPR and FPR, drawn by sliding, with the parameters changing, with cuts over the recommendation
// list"; the user chose the alternative A, the live counter, and four ranks for the first press, 2026-11-01): the page opens with the WALK of one curve. One ranked list appears, unnamed; a cut stands above it (the top k is recommended: a band;
// the rest is not) and slides down the list one rank at a time. At every k the four counts TP, FP, FN, TN and the open formulas TPR = TP / (TP + FN) and FPR = FP / (FP + TN) show that k's numbers, the numbers TICK in place (an odometer: a
// column of numbers behind a window, its transform jumps at the moment the cut arrives); a point drops onto the chart at (FPR, TPR) (a cursor with two guides to the axes, and a bead that stays), and the stair curve builds behind it.
//
// The two toy lists: A "RRR-----RR" (relevant at ranks 1, 2, 3, 9, 10: a good start, a bad end) and B "-R-RRRR---" (relevant at ranks 2, 4, 5, 6, 7: nothing at the top, nothing at the end). Their curves cross.
// By hand: the AUC is the number of (relevant, irrelevant) pairs in the right order over all 5 x 5 = 25 pairs: A: ranks 1, 2, 3 each have 5 irrelevant items below them, ranks 9 and 10 none: 15 / 25 = 0.60; B: the relevant item at rank 2 has 4 irrelevant below, ranks 4, 5, 6, 7
// have 3 each: 4 + 12 = 16 / 25 = 0.64. The oracle (all relevant first) has 25 / 25 = 1, the random diagonal 0.5. The area under the stair curve IS the share of correctly ordered pairs: the filled cells of the 5 x 5 grid.
// The walk by hand (list A): k = 0: TP 0 FP 0 FN 5 TN 5, the point (0, 0); k = 3: TP 3 FN 2: (0, 0.6); k = 4: the item is irrelevant, FP 1 TN 4: TPR = 3 / (3 + 2) = 0.60, FPR = 1 / (1 + 4) = 0.20: (0.2, 0.6); k = 8: FP 5 TN 0: (1, 0.6); k = 10: (1, 1).
//
// State 0 is the frame: the axes of the unit square with its 5 x 5 grid. Five presses (the old press 1, the list and its curve, is now the walk):
//   1 the first cuts the list "one ranked list", the cut, the board (a 2 x 2 of the counts in the look of the confusion page) and the two formulas; the cut slides down the first `first` ranks (default 4); the cursor, the beads and the stair steps follow
//   2 the rest       the cut runs on to the end of the list (faster): the curve is complete at (1, 1)
//   3 the extremes   the walk machinery leaves; the oracle (every relevant item first: up, then right) is the best, the random list is the diagonal
//   4 two lists      the first list is NAMED (algorithm A) and a second list (B) is walked: A is ahead at the start, B later; the curves cross (two chips say where); WP-93 (the user's notes on page 15): the legends of the oracle and of the random list leave, so that A and B stand out
//   5 AUC            the area under B's curve is shaded: AUC = the chance that a random relevant item is ahead of a random irrelevant one, A 15 / 25 = 0.60, B 16 / 25 = 0.64; AUC is blind to position: from rank 101 to 100 is worth as much as from 2 to 1
//
// duration(k) = pressDuration (every start is in the plan below): 4240 / 4540 / 1260 / 1610 / 1260 ms (presses 1 and 2 were 2800 and 2540: WP-93, the user's notes on page 15, "the iterations go by too fast for reading": the wait between
// two cut positions, and so the time every number of every odometer stays, is DOUBLED, 480 to 960 ms and 400 to 800 ms).
//   1  the list 100 + 360, the cut machinery 300 + 360, the board 300 + 360, the formulas 440 + 360; the cut moves from 900, one rank every 960 ms, each move 300 ms (the last arrives at 4080); a bead drops 80 ms before its cursor arrives (240 ms): the last ends at 4240
//   2  the cut moves from 100, one rank every 800 ms, each move 280 ms (the last arrives at 4380); the last bead ends at 4540
//   3  the walk leaves within 300; the diagonal 0 + 500, the oracle 300 + 700, the two labels 500 and 900 (+ 360)
//   4  the name and the letter of A, the list B 100 + 360, the ten steps 300 + i * 80 (+ 300), the end point 1100 + 300, the two chips 1100 and 1250 (+ 360)
//   5  the area 0 + 500, the two AUC lines 300 and 450 (+ 360), the two sentences 650 and 900 (+ 360)
//
// Motion: opacity, transform, strokeDashoffset (a line draws, a cell pops, a label rises). The cut and the cursor move with `via` keyframes (a move uses the engine's easing, a hold is linear); an odometer jumps (steps easing). No colour keyframes.
//
// WP-93 (D-174, the user's rule of 2026-11-01: a formula is shown as a computation): TPR and FPR are the symbolic fraction = the same fraction with the numbers = the value, every division a fraction with a horizontal bar (formula.js
// `frac(NUM|DEN)`), never "a / b" in a line of text: `TPR = frac(TP|TP + FN) = frac([3]|[3] + [2]) = [0.60]`, the bracketed numbers are the odometers, which tick INSIDE the fraction (the fraction is built by hand with the classes
// of formula.js, `fm-frac`, `fm-num`, `fm-den`, because the numbers are live windows). The two formulas stand one above the other (a fraction is two lines high: 63.6 px at 28 px; with "(recall)" and "(1 − specificity)" in their names they no longer fit side by side, so the board moved up 18 px: WP-93, the user's notes on page 15). The AUC lines of press 5 are
// `AUC of A = frac(pairs in the right order|all pairs) = frac(15|25) = 0.60` (`aucFormulas`), each two lines high, so the two chips of press 4 leave in press 5 to make the room. The geometry is UNMEASURED at the time of writing: the
// Chrome run of the deck tour decides.
import { h, s } from './frames.js';
import { emblem } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { finish, frag, labelsSchema, num, on, pop, pressDuration, rise, scene } from './w07-common.js';

export const PLOT = Object.freeze({ x: 1010, y: 480, size: 380 });
export const LIST = Object.freeze({ x: 60, pitch: 76, cell: 64, y: 130, yb: 300 });
/** WP-93 (D-174): the tops of the two AUC lines of press 5 (each is a fraction line, 59.1 px high at 26 px), under list B (it ends at 364) and above the sentences (522). */
export const AUC_Y = Object.freeze([392, 454]);
const SEG = 300, POP = 300, LABEL = 360, FADE = 500;
const OUT = 3;                                                        // the press in which the walk machinery leaves
const NAMED = 4;                                                      // the press in which the first list is named
/** The height of one line of an odometer: the formulas' results, the board's counts, the k of "(top k)", px. */
const LH = 40, BIG_LH = 60, K_LH = 34;
/** WP-93 (D-174): the line of an odometer INSIDE a fraction: the fraction's font is .92 of the formula's 28 px, 25.76 px, on a line of 1.12: 28.85 px, taken as 29. */
const FM_LH = 29;
/** WP-93 (D-174; the user's notes on page 15): the two formulas of the walk one above the other: a row is 66 px high (a fraction line at 28 px is 63.6 px), the second starts 74 px under the first. They were side by side, 440 px apart; with
 * "TPR (recall)" and "FPR (1 − specificity)" in front the second row is 541 px wide and does not fit beside the first. */
const FM_ROW = Object.freeze({ h: 66, y2: 74 });
/** WP-93 (the same): the board (it was at y 250, 210 high) and the formulas under it: board 232 to 432, formulas 446 to 586. */
const BOARD = Object.freeze({ x: 60, y: 232, w: 700, h: 200 });
const FORMULAS = Object.freeze({ x: 60, y: 446, w: 700, h: FM_ROW.y2 + FM_ROW.h });

const A = 'RRR-----RR', B = '-R-RRRR---';
const same = (/** @type {string} */ t) => frag(t, t);
const LABELS = {
  listA: frag('algorithm A', 'algoritma A'), listB: frag('algorithm B', 'algoritma B'),
  // WP-93 (the user's notes on page 15, 2026-11-01): the axes carry ONLY the abbreviations; the words "true / false positive rate" are the caption's (D-170, D-178)
  tpr: frag('TPR', 'TPR'), fpr: frag('FPR', 'FPR'),
  oracle: frag('oracle: the best list', 'kâhin: en iyi liste'), random: frag('random, on average: the diagonal', 'rastgele, ortalamada: köşegen'),   // a single random ranking wanders around the diagonal: on average it follows it (the lead, 2026-11-01); 319 px at 22 px, the box is 360 px wide
  chipA: frag('A is ahead at the start', 'başta A önde'), chipB: frag('B is ahead later', 'sonra B önde'),
  // WP-93 (D-174): the AUC lines are computations: the symbolic fraction (the pairs in the right order over all pairs) = the same fraction with the numbers = the value; {n}, {m} and {v} are filled by `aucFormulas`
  aucA: frag('AUC of A = frac(pairs in the right order|all pairs) = frac({n}|{m}) = {v}', 'A\'nın AUC\'si = frac(doğru sıradaki çiftler|tüm çiftler) = frac({n}|{m}) = {v}'),
  aucB: frag('AUC of B = frac(pairs in the right order|all pairs) = frac({n}|{m}) = {v}', 'B\'nin AUC\'si = frac(doğru sıradaki çiftler|tüm çiftler) = frac({n}|{m}) = {v}'),
  prob: frag('AUC: the chance that a random relevant item is ahead of a random irrelevant one', 'AUC: rastgele bir ilgili öğenin rastgele bir ilgisizin önünde olma olasılığı'),
  blind: frag('AUC is blind to position: rank 101 to 100 is worth as much as rank 2 to 1', 'AUC konuma kördür: 101\'den 100\'e çıkmak 2\'den 1\'e çıkmak kadar değerlidir'),
  // WP-93 (D-162): the walk of one curve, before the lists are named
  listWalk: frag('one ranked list', 'sıralı bir liste'),
  topPre: frag('recommended (top ', 'önerildi (ilk '), topPost: same(')'), notRec: frag('not recommended', 'önerilmedi'),
  relevant: frag('relevant', 'ilgili'), irrelevant: frag('irrelevant', 'ilgisiz'),
  // WP-93 (D-174): the symbolic fraction of the two open formulas (the build writes " = ", the fraction with the odometers, " = " and the value after it)
  // WP-93 (the user's notes on page 15, via the lead: "hiç anılmaması kötü", it is bad that the page never says it): TPR is recall (TP / (TP + FN)), FPR is 1 minus specificity (FP / (FP + TN) = 1 - TN / (FP + TN))
  fTpr: same('TPR (recall) = frac(TP|TP + FN)'), fFpr: same('FPR (1 − specificity) = frac(FP|FP + TN)'),
};
/** WP-93 (D-174): the labels that hold formula mark-up (frac(NUM|DEN), formula.js): refused with their place when one does not parse. */
const FORMULA_LABELS = ['fTpr', 'fFpr', 'aucA', 'aucB'];

/** The params of the mode `roc`, merged into chart-draw's schema (the registry carries the whole). */
export const rocSchema = {
  type: 'object', additionalProperties: false, title: 'ROC and AUC for a ranked list (mode roc)',
  description: '`a` and `b` are two rankings of the same items, best first, one character per rank: "R" a relevant item, "-" an irrelevant one (4 to 12 characters, the two have the same number of each; the curves must cross). `first` is how many ranks the cut walks in the first press (1 to the length less one; the second press walks the rest). The picture is a toy and carries no label.',
  default: { a: A, b: B, first: 4, labels: LABELS },
  properties: {
    a: { type: 'string', minLength: 4, maxLength: 12, default: A },
    b: { type: 'string', minLength: 4, maxLength: 12, default: B },
    first: { type: 'integer', minimum: 1, maximum: 11, default: 4 },
    labels: labelsSchema(LABELS, '`aucA` and `aucB` hold {n}, {m} and {v}.'),
  },
};
export const rocExamples = [{ mode: 'roc' }];
export const rocPresses = 5;

/**
 * The curve of a ranking: from (0, 0) a relevant item steps up, an irrelevant one to the right; the corners in unit coordinates, the pair counts of the AUC. Pure.
 * @param {string} list "R" and "-" best first
 */
export function rocCurve(list) {
  const nR = [...list].filter((c) => c === 'R').length, nN = list.length - nR;
  /** @type {Array<[number, number]>} */ const pts = [[0, 0]];
  let tp = 0, fp = 0, pairs = 0;
  for (const c of list) {
    if (c === 'R') { tp++; pairs += nN - fp; } else fp++;
    pts.push([fp / nN, tp / nR]);
  }
  return { nR, nN, pts, pairs, total: nR * nN, auc: pairs / (nR * nN) };
}

/**
 * The true positive rate when exactly k irrelevant items have been passed (the highest point of the curve at that width), for k = 0..nN. Pure.
 * @param {string} list @returns {number[]}
 */
export function tprAtWidths(list) {
  const nR = [...list].filter((c) => c === 'R').length, nN = list.length - nR;
  /** @type {number[]} */ const out = [];
  for (let k = 0; k <= nN; k++) {
    let seen = 0, tp = 0;
    for (const c of list) { if (c === '-') { if (seen === k) break; seen++; } else tp++; }
    out.push(tp / nR);
  }
  return out;
}

/**
 * WP-93: the four counts and the two rates when the cut stands below the first k items of `list` ("R" relevant, "-" irrelevant): TP and FP are what the cut recommends (relevant, irrelevant), FN and TN what it leaves (relevant, irrelevant). Pure.
 * @param {string} list @param {number} k @returns {{k: number, tp: number, fp: number, fn: number, tn: number, tpr: number, fpr: number, nR: number, nN: number}}
 */
export function cutStats(list, k) {
  const items = [...list];
  const nR = items.filter((c) => c === 'R').length, nN = items.length - nR;
  const tp = items.slice(0, k).filter((c) => c === 'R').length, fp = k - tp;
  return { k, tp, fp, fn: nR - tp, tn: nN - fp, tpr: tp / nR, fpr: fp / nN, nR, nN };
}

/** @typedef {{k: number, m: number, b: number}} Step  the cut moves from k - 1 to k between m and b (ms in the press) */
/** @typedef {Record<string, string>} Style */

/** The timing of the walk, ms: the first press explains slowly, the second runs. */
export const SCHED = Object.freeze({
  p1: { t0: 900, every: 960, move: 300 },       // press 1: the first cut starts to move at 900, one move every 960 ms (480 before the page-15 notes: the user could not read the numbers), each move takes 300
  p2: { t0: 100, every: 800, move: 280 },       // press 2: the rest of the list, a little faster than the first (400 before: doubled too)
  introAt: 300, introDur: 360,                  // the walk machinery (cut, band, cursor, guides) fades in
  pop: { lead: 80, dur: 240 },                  // a bead drops 80 ms before the cursor arrives
  pad: 40,                                      // an odometer's animation runs 40 ms past its last jump, so the last jump is not at offset 1
});

/**
 * The steps of both walk presses: press 1 takes the cut from 0 to `first`, press 2 from `first` to `n`. Pure.
 * @param {number} first @param {number} n @returns {{1: Step[], 2: Step[]}}
 */
export function walkSteps(first, n) {
  /** @param {number} from @param {number} to @param {{t0: number, every: number, move: number}} p @returns {Step[]} */
  const run = (from, to, p) => Array.from({ length: to - from }, (_, j) => { const m = p.t0 + j * p.every; return { k: from + j + 1, m, b: m + p.move }; });
  return { 1: run(0, first, SCHED.p1), 2: run(first, n, SCHED.p2) };
}

/**
 * The keyframes of a track that HOLDS a style and MOVES to the next at every step (the cut, the band, the cursor, the guides): `via` entries for `stepsFromFrames`, whose own first and last keyframes are the state before and the state
 * after the press. A move uses the engine's easing, a hold is linear. `intro` (press 1): the track first fades in over `intro.dur` ms from `start`. Offsets are fractions of the returned `duration`; the final arrival is the end. Pure.
 * @param {{start: number, steps: Step[], styleAt: (k: number) => Style, k0: number, intro?: {dur: number}|null}} o
 * @returns {{start: number, duration: number, firstEasing: string|undefined, via: Array<Style & {offset: number, easing?: string}>}}
 */
export function stepTrack({ start, steps, styleAt, k0, intro = null }) {
  const end = steps[steps.length - 1].b;
  const duration = end - start;
  /** @type {Array<{t: number, style: Style, easing: string|undefined}>} */ const seq = [];
  /** @type {string|undefined} */ let firstEasing;
  let t = start, pos = k0;
  if (intro) { t = start + intro.dur; seq.push({ t, style: styleAt(k0), easing: 'linear' }); }
  else firstEasing = steps[0].m > start ? 'linear' : undefined;
  for (const st of steps) {
    if (st.m > t + 0.5) {
      if (seq.length) seq[seq.length - 1].easing = 'linear'; else firstEasing = 'linear';
      seq.push({ t: st.m, style: styleAt(pos), easing: undefined });
    } else if (seq.length) seq[seq.length - 1].easing = undefined; else firstEasing = undefined;
    seq.push({ t: st.b, style: styleAt(st.k), easing: 'linear' });
    t = st.b; pos = st.k;
  }
  seq.pop();                                                                         // the last arrival is the `to` keyframe of the entry (offset 1)
  return { start, duration, firstEasing, via: seq.map((e) => ({ ...e.style, offset: +(Math.min(1, Math.max(0, (e.t - start) / duration))).toFixed(5), ...(e.easing ? { easing: e.easing } : {}) })) };
}

/**
 * The keyframes of an odometer: a column of numbers whose window shows one value at a time, JUMPING to the next at every arrival of the cut (steps easing, no slide: a counter ticks). The animation starts at the first move and runs
 * `SCHED.pad` ms past the last jump. Pure.
 * @param {{steps: Step[], valueAt: (k: number) => Style}} o
 * @returns {{start: number, duration: number, firstEasing: string, via: Array<Style & {offset: number, easing: string}>}}
 */
export function jumpTrack({ steps, valueAt }) {
  const start = steps[0].m, duration = steps[steps.length - 1].b - start + SCHED.pad;
  return { start, duration, firstEasing: 'steps(1, end)', via: steps.map((st) => ({ ...valueAt(st.k), offset: +((st.b - start) / duration).toFixed(5), easing: 'steps(1, end)' })) };
}

/** @typedef {'k'|'tp'|'fn'|'tpr'|'fp'|'tn'|'fpr'} OdoKind */

/**
 * Which odometer index (the position in its column) each quantity has at a cut: the counts of the relevant side follow TP, those of the irrelevant side FP; the column of FN runs from nR down to 0, so its index is TP too. Pure.
 * @param {OdoKind} kind @param {ReturnType<typeof cutStats>} st @returns {number}
 */
export const odoIndex = (kind, st) => (kind === 'k' ? st.k : kind === 'tp' || kind === 'fn' || kind === 'tpr' ? st.tp : st.fp);

/**
 * The values of an odometer column from the top: the counts 0..max (FN and TN count DOWN from their total), the rates i / total. Pure.
 * @param {OdoKind} kind @param {{n: number, nR: number, nN: number}} c @returns {number[]}
 */
export function odoValues(kind, c) {
  const up = (/** @type {number} */ m) => Array.from({ length: m + 1 }, (_, i) => i);
  switch (kind) {
    case 'k': return up(c.n);
    case 'tp': return up(c.nR);
    case 'fp': return up(c.nN);
    case 'fn': return up(c.nR).reverse();
    case 'tn': return up(c.nN).reverse();
    case 'tpr': return up(c.nR).map((i) => i / c.nR);
    default: return up(c.nN).map((i) => i / c.nN);
  }
}

/**
 * What the picture needs of the params that the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function rocProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.roc;
  for (const key of FORMULA_LABELS) {                                                  // WP-93 (D-174): the formula mark-up of formula.js, refused with its place when it does not parse
    for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.[key] ?? {}))) {
      const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
      if (problem) bad(`$.roc.labels.${key}.${lang}`, problem);
    }
  }
  /** @type {Array<[string, string]>} */
  const lists = [['a', Q.a], ['b', Q.b]];
  for (const [key, l] of lists) if (!/^[R-]+$/.test(l)) bad(`$.roc.${key}`, `holds "R" or "-", found "${l}"`);
  if (out.length) return out;
  if (Q.a.length !== Q.b.length) bad('$.roc.b', `has ${Q.b.length} ranks, a has ${Q.a.length}: both rank the same items`);
  const ca = rocCurve(Q.a), cb = rocCurve(Q.b);
  for (const [key, c] of /** @type {Array<[string, ReturnType<typeof rocCurve>]>} */ ([['a', ca], ['b', cb]])) if (c.nR === 0 || c.nN === 0) bad(`$.roc.${key}`, 'needs at least one relevant and one irrelevant item');
  if (out.length) return out;
  if (ca.nR !== cb.nR) bad('$.roc.b', `has ${cb.nR} relevant items, a has ${ca.nR}: both rank the same items`);
  else {
    const ta = tprAtWidths(Q.a), tb = tprAtWidths(Q.b);
    if (!(ta.some((v, i) => v > tb[i]) && tb.some((v, i) => v > ta[i]))) bad('$.roc.b', 'does not cross the curve of a: the page shows two lists that win on different parts of the curve');
  }
  const n = Q.a.length, first = Q.first ?? 4;                                          // WP-93: the first press walks `first` ranks, the second the rest
  if (first < 1 || first > n - 1) bad('$.roc.first', `walks ${first} ranks in the first press, the list has ${n}: 1 to ${n - 1}`);
  return out;
}

/**
 * WP-93 (D-174): the two AUC lines of press 5, per language: the symbolic fraction (pairs in the right order over all pairs) = the same fraction with the numbers = the value, `AUC of A = frac(pairs in the right order|all pairs) =
 * frac(15|25) = 0.60`, every division a `frac(NUM|DEN)` of formula.js. The label (a deck can reword it) holds {n} (the pairs in the right order), {m} (all pairs) and {v} (the AUC, two decimals, the decimal comma in Turkish). Pure.
 * By hand: A 15 / 25 = 0.60 (ranks 1, 2, 3 each have 5 irrelevant items below them, ranks 9 and 10 none), B 4 + 12 = 16 / 25 = 0.64.
 * @param {any} P the resolved params of chart-draw @returns {{a: Record<string, string>, b: Record<string, string>}}
 */
export function aucFormulas(P) {
  const Q = P.roc, L = Q.labels;
  const fill = (/** @type {string} */ key, /** @type {ReturnType<typeof rocCurve>} */ c) => Object.fromEntries(['en', 'tr'].map((lg) => [lg, String(L[key][lg] ?? L[key].en).replace('{n}', String(c.pairs)).replace('{m}', String(c.total)).replace('{v}', lg === 'tr' ? c.auc.toFixed(2).replace('.', ',') : c.auc.toFixed(2))]));
  return { a: fill('aucA', rocCurve(Q.a)), b: fill('aucB', rocCurve(Q.b)) };
}

/**
 * The picture's pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of chart-draw
 */
export function rocModel(P) {
  const Q = P.roc;
  const nA = Q.a.length, nB = Q.b.length, first = Q.first ?? 4;
  const stat = (/** @type {number} */ k) => cutStats(Q.a, k);
  const { nR, nN } = stat(0);
  const steps = walkSteps(first, nA);
  const cutAt = [0, first, nA, nA, nA, nA];                                             // where the cut stands in each state
  const S = PLOT.size;
  const nz = (/** @type {number} */ x) => String(+x.toFixed(3));
  /** @type {Record<string, (k: number) => string>} the transform of each cut-bound element when the cut stands at k */
  const TF = {
    ct: (k) => `translateX(${nz(k * LIST.pitch)}px)`,
    bn: (k) => `scaleX(${nz(k / nA)})`,
    cu: (k) => { const t = stat(k); return `translate(${nz(t.fpr * S)}px, ${nz(-t.tpr * S)}px)`; },
    gh: (k) => { const t = stat(k); return `translate(0px, ${nz(-t.tpr * S)}px) scale(${nz(t.fpr)}, 1)`; },
    gv: (k) => { const t = stat(k); return `translate(${nz(t.fpr * S)}px, 0px) scale(1, ${nz(t.tpr)})`; },
  };
  const TRACKS = ['ct', 'bn', 'cu', 'gh', 'gv'];
  /** @type {Array<[string, OdoKind, number]>} the odometers: key, what it shows, the height of a line */
  const ODO = [
    ['o:k', 'k', K_LH], ['o:bTP', 'tp', BIG_LH], ['o:bFP', 'fp', BIG_LH], ['o:bFN', 'fn', BIG_LH], ['o:bTN', 'tn', BIG_LH],
    // WP-93 (D-174): the numbers inside the fractions are FM_LH lines high, the results (t4, f4) stand outside them
    ['o:t1', 'tp', FM_LH], ['o:t2', 'tp', FM_LH], ['o:t3', 'fn', FM_LH], ['o:t4', 'tpr', LH], ['o:f1', 'fp', FM_LH], ['o:f2', 'fp', FM_LH], ['o:f3', 'tn', FM_LH], ['o:f4', 'fpr', LH],
  ];
  /** @type {Array<{key: string, kind: 'rise'|'pop'|'draw'|'on', kIn: number, kOut?: number}>} */ const entries = [];
  /** @type {Map<string, Map<number, any>>} */ const T = new Map();
  const ent = (/** @type {string} */ key, /** @type {'rise'|'pop'|'draw'|'on'} */ kind, /** @type {number} */ kIn, /** @type {number} [kOut] */ kOut) => { entries.push({ key, kind, kIn, ...(kOut === undefined ? {} : { kOut }) }); };
  const setT = (/** @type {string} */ key, /** @type {number} */ k, /** @type {any} */ t) => { if (!T.has(key)) T.set(key, new Map()); /** @type {Map<number, any>} */ (T.get(key)).set(k, t); };
  const pressOf = (/** @type {number} */ j) => (j <= first ? 1 : 2);
  const stepOf = (/** @type {number} */ j) => (j <= first ? steps[1][j - 1] : steps[2][j - first - 1]);

  // presses 1 and 2: the walk. The list, its name, the board and the formulas, the beads, the stair steps, the cut machinery and the odometers
  ent('la', 'rise', 1); setT('la', 1, { start: 100, duration: LABEL });
  ent('nw', 'on', 1, NAMED); setT('nw', 1, { start: 100, duration: LABEL }); setT('nw', NAMED, { start: 0, duration: 300 });
  ['bd', 'fm'].forEach((g, i) => { ent(g, 'rise', 1, OUT); setT(g, 1, { start: 300 + i * 140, duration: LABEL }); setT(g, OUT, { start: 0, duration: 300 }); });
  for (let j = 0; j <= nA; j++) {
    const kin = j === 0 ? 1 : pressOf(j);
    ent(`pb:${j}`, 'pop', kin, OUT);
    setT(`pb:${j}`, kin, { start: j === 0 ? 560 : stepOf(j).b - SCHED.pop.lead, duration: SCHED.pop.dur });
    setT(`pb:${j}`, OUT, { start: 0, duration: 260 });
  }
  for (let i = 0; i < nA; i++) {
    const st = stepOf(i + 1), kin = pressOf(i + 1);
    ent(`sa:${i}`, 'draw', kin); setT(`sa:${i}`, kin, { start: st.m, duration: st.b - st.m });
  }
  for (const key of TRACKS) {
    const styleAt = (/** @type {number} */ k) => ({ opacity: '1', transform: TF[key](k) });
    setT(key, 1, stepTrack({ start: SCHED.introAt, steps: steps[1], styleAt, k0: 0, intro: { dur: SCHED.introDur } }));
    setT(key, 2, stepTrack({ start: steps[2][0].m, steps: steps[2], styleAt, k0: first }));
    setT(key, OUT, { start: 0, duration: 300 });
  }
  for (const [key, kind, lh] of ODO) {
    const valueAt = (/** @type {number} */ k) => ({ transform: `translateY(${nz(-odoIndex(kind, stat(k)) * lh)}px)` });
    setT(key, 1, jumpTrack({ steps: steps[1], valueAt })); setT(key, 2, jumpTrack({ steps: steps[2], valueAt }));
  }

  // press 3 (the extremes), 4 (two lists, the first one named), 5 (AUC)
  ent('rnd', 'draw', 3); setT('rnd', 3, { start: 0, duration: FADE }); ent('orc', 'draw', 3); setT('orc', 3, { start: 300, duration: 700 });
  // WP-93 (the user's notes on page 15): the legends "random" and "the best list" leave in press 4, so that A and B stand out (the diagonal and the oracle's line stay, unlabelled)
  ent('lr', 'rise', 3, NAMED); setT('lr', 3, { start: 500, duration: LABEL }); setT('lr', NAMED, { start: 0, duration: 260 });
  ent('lo', 'rise', 3, NAMED); setT('lo', 3, { start: 900, duration: LABEL }); setT('lo', NAMED, { start: 0, duration: 260 });
  ent('na', 'on', NAMED); setT('na', NAMED, { start: 100, duration: LABEL }); ent('da', 'pop', NAMED); setT('da', NAMED, { start: 460, duration: POP });
  ent('lb', 'rise', 4); setT('lb', 4, { start: 100, duration: LABEL });
  for (let i = 0; i < nB; i++) { ent(`sb:${i}`, 'draw', 4); setT(`sb:${i}`, 4, { start: 300 + i * 80, duration: SEG }); }
  ent('db', 'pop', 4); setT('db', 4, { start: 300 + nB * 80, duration: POP });
  // WP-93 (D-174): the two chips leave in press 5: the AUC lines are two lines high (fractions) and take their place
  ent('ca', 'rise', 4, 5); setT('ca', 4, { start: 1100, duration: LABEL }); setT('ca', 5, { start: 0, duration: 260 }); ent('cb', 'rise', 4, 5); setT('cb', 4, { start: 1250, duration: LABEL }); setT('cb', 5, { start: 0, duration: 260 });
  ent('au', 'on', 5); setT('au', 5, { start: 0, duration: FADE });
  ent('xa', 'rise', 5); setT('xa', 5, { start: 300, duration: LABEL }); ent('xb', 'rise', 5); setT('xb', 5, { start: 450, duration: LABEL });
  ent('pr', 'rise', 5); setT('pr', 5, { start: 650, duration: LABEL }); ent('bl', 'rise', 5); setT('bl', 5, { start: 900, duration: LABEL });

  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */ const f = new Map();
    for (const e of entries) {
      const vis = k >= e.kIn && (e.kOut === undefined || k < e.kOut);
      f.set(e.key, e.kind === 'rise' ? rise(vis) : e.kind === 'pop' ? pop(vis) : e.kind === 'draw' ? { strokeDashoffset: vis ? '0' : '1.02' } : on(vis));
    }
    const live = k >= 1 && k < OUT;
    for (const key of TRACKS) f.set(key, { opacity: live ? '1' : '0', transform: TF[key](cutAt[k]) });
    for (const [key, kind, lh] of ODO) f.set(key, { transform: `translateY(${nz(-odoIndex(kind, stat(cutAt[k])) * lh)}px)` });
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const t = T.get(key)?.get(k);
    if (!t) throw new Error(`chart-draw roc: no timing for "${key}" in press ${k}`);
    return t;
  };
  return {
    frame, timing, steps, cutAt, first, nR, nN, nA, nB, TRACKS, ODO, TF, stat,
    curves: { a: rocCurve(Q.a), b: rocCurve(Q.b) }, n: rocPresses,
    duration: (/** @type {number} */ k) => pressDuration(k, frame, timing),
  };
}

/**
 * The picture of the mode `roc`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of chart-draw
 * @returns {import('./kit.js').WidgetBuild}
 */
export function rocBuild(ctx, P) {
  const problems = rocProblems(P);
  if (problems.length) throw new Error(`chart-draw roc: ${problems.map((p) => `${p.path} ${p.detail}`).join('; ')}`);
  const Q = P.roc, L = Q.labels;
  const M = rocModel(P);
  const sc = scene(ctx, 'cv-root rc-root');
  const { doc, root, box, put, say } = sc;
  const fsay = (/** @type {HTMLElement} */ el, /** @type {Record<string, string>} */ text) => { say(el, text); renderFormula(doc, el); return el; };   // WP-93 (D-174): a text with formula mark-up: say, then draw the fractions
  const px = (/** @type {number} */ f) => PLOT.x + f * PLOT.size, py = (/** @type {number} */ t) => PLOT.y - t * PLOT.size;
  const S = PLOT.size;
  const svg = s(doc, 'svg', { class: 'cv-svg', width: '1680', height: '600', viewBox: '0 0 1680 600' });
  root.append(svg);
  /** A text label. @param {string|null} key @param {string} cls @param {Record<string, string>} text @param {string} css */
  const label = (key, cls, text, css) => {
    const e = h(doc, 'div', `rc-lbl ${cls}`);
    say(e, text);
    if (key) put(key, e, css); else { e.style.cssText += `;${css}`; root.append(e); }
    return e;
  };
  // the frame (state 0): the unit square, its 5 x 5 grid, the axes and their names
  const { nA, nR, nN } = M;
  const cA = M.curves.a, cB = M.curves.b;
  for (let i = 0; i <= nN; i++) svg.append(s(doc, 'path', { class: 'cv-grid', d: `M${px(i / nN)} ${py(0)}V${py(1)}` }));
  for (let i = 0; i <= nR; i++) svg.append(s(doc, 'path', { class: 'cv-grid', d: `M${px(0)} ${py(i / nR)}H${px(1)}` }));
  svg.append(s(doc, 'path', { class: 'cv-axis', d: `M${px(0)} ${py(1) - 14}V${py(0)}H${px(1) + 14}` }));
  label(null, 'rc-axis', L.fpr, `left:${PLOT.x}px;top:${PLOT.y + 14}px;width:${S}px;text-align:center`);
  // WP-93 (the user's notes on page 15): the names of the axes are the abbreviations only; the one of the Y axis stands ROTATED beside the axis (a box of 120 x 30 centred on (PLOT.x - 60, the middle of the axis), turned a quarter)
  label(null, 'rc-axis rc-axis-y', L.tpr, `left:${PLOT.x - 60 - 60}px;top:${py(0.5) - 15}px;width:120px;height:30px;text-align:center;transform:rotate(-90deg)`);
  label(null, 'rc-tick', { en: '0', tr: '0' }, `left:${PLOT.x - 34}px;top:${PLOT.y - 14}px;width:24px;text-align:right`);
  label(null, 'rc-tick', { en: '1', tr: '1' }, `left:${PLOT.x - 34}px;top:${py(1) - 14}px;width:24px;text-align:right`);
  // under the curves: the area under the curve of B (press 5), the random diagonal and the oracle (press 3)
  put('au', s(doc, 'path', { class: 'rc-area', d: `M${px(0)} ${py(0)}${cB.pts.map(([f, t]) => `L${px(f)} ${py(t)}`).join('')}L${px(1)} ${py(0)}Z`, 'data-gfx': 'fill' }), '', svg);
  put('rnd', s(doc, 'path', { class: 'rc-rand', d: `M${px(0)} ${py(0)}L${px(1)} ${py(1)}`, pathLength: '1', 'data-gfx': 'stroke' }), '', svg);
  put('orc', s(doc, 'path', { class: 'rc-orc', d: `M${px(0)} ${py(0)}L${px(0)} ${py(1)}L${px(1)} ${py(1)}`, pathLength: '1', 'data-gfx': 'stroke' }), '', svg);

  // the list as a strip of cells with the relevant items starred; the band of the recommended top k lies UNDER the cells
  put('bn', h(doc, 'div', 'rw-band', { 'aria-hidden': 'true' }), `left:${LIST.x - 6}px;top:${LIST.y - 8}px;width:${nA * LIST.pitch}px;height:${LIST.cell + 16}px`);   // 8 px of band above and below the cells; the name stands above it (y 90..121)
  /** @param {string} key @param {string} list @param {number} y @param {Record<string, string>|null} name */
  const strip = (key, list, y, name) => {
    const g = h(doc, 'div', 'rc-list', { 'aria-hidden': 'true' });
    [...list].forEach((ch, i) => {
      const cell = h(doc, 'div', `rc-cell${ch === 'R' ? ' rc-rel' : ''}`, { 'data-gfx': 'border' });
      cell.style.cssText = `left:${LIST.x + i * LIST.pitch}px;top:${y}px;width:${LIST.cell}px;height:${LIST.cell}px`;
      const nr = h(doc, 'span', 'rc-rank'); nr.textContent = String(i + 1);
      cell.append(nr);
      if (ch === 'R') { const st = emblem(doc, 4, 30); st.classList.add('rc-star'); cell.append(st); }
      g.append(cell);
    });
    if (name) { g.append(say(h(doc, 'div', 'rc-name'), name)); /** @type {HTMLElement} */ (g.lastElementChild).style.cssText = `left:${LIST.x}px;top:${y - 40}px`; }
    put(key, g, box(0, 0, 1680, 600));
  };
  strip('la', Q.a, LIST.y, null);
  label('nw', 'rc-name', L.listWalk, `left:${LIST.x}px;top:${LIST.y - 40}px`);
  label('na', 'rc-name', L.listA, `left:${LIST.x}px;top:${LIST.y - 40}px`);
  strip('lb', Q.b, LIST.yb, L.listB);
  // the cut: a bar between the cells (translateX by one pitch per rank)
  put('ct', h(doc, 'div', 'rw-cut', { 'aria-hidden': 'true' }), `left:${LIST.x - 9}px;top:${LIST.y - 8}px;height:${LIST.cell + 24}px`);   // 8 px above the cells (it must not cross the name above) and 16 px below them

  // the stair steps of the curve, one per rank: a relevant item up, an irrelevant one to the right; the guides, the beads of the cuts and the cursor
  /** @param {string} prefix @param {ReturnType<typeof rocCurve>} c @param {string} cls */
  const steps = (prefix, c, cls) => {
    for (let i = 1; i < c.pts.length; i++) {
      const [f0, t0] = c.pts[i - 1], [f1, t1] = c.pts[i];
      put(`${prefix}:${i - 1}`, s(doc, 'path', { class: `rc-step ${cls}`, d: `M${px(f0)} ${py(t0)}L${px(f1)} ${py(t1)}`, pathLength: '1', 'data-gfx': 'stroke' }), '', svg);
    }
  };
  steps('sa', cA, 'rc-a'); steps('sb', cB, 'rc-b');
  put('gh', h(doc, 'div', 'rw-gh', { 'aria-hidden': 'true' }), `left:${px(0)}px;top:${py(0) - 1.5}px;width:${S}px`);
  put('gv', h(doc, 'div', 'rw-gv', { 'aria-hidden': 'true' }), `left:${px(0) - 1.5}px;top:${py(1)}px;height:${S}px`);
  for (let j = 0; j <= nA; j++) { const t = M.stat(j); put(`pb:${j}`, h(doc, 'div', 'rw-bead', { 'aria-hidden': 'true' }), `left:${px(t.fpr) - 7}px;top:${py(t.tpr) - 7}px`); }
  put('cu', h(doc, 'div', 'rw-cursor', { 'aria-hidden': 'true' }), `left:${px(0) - 12}px;top:${py(0) - 12}px`);

  /** An odometer: a window one line high over a column of values; the column's translateY picks the value. @param {string} key @param {OdoKind} kind @param {number} lh @param {number} w @param {string} cls */
  const odo = (key, kind, lh, w, cls) => {
    const win = h(doc, 'span', `rw-odo ${cls}`);
    win.style.cssText = `height:${lh}px;width:${w}px`;
    const col = h(doc, 'span', 'rw-col');
    for (const v of odoValues(kind, { n: nA, nR, nN })) {
      const c = h(doc, 'span', 'rw-val');
      c.style.cssText = `height:${lh}px;line-height:${lh}px`;
      say(c, kind === 'tpr' || kind === 'fpr' ? num(v, 2) : kind === 'k' ? { en: `${v}${L.topPost.en}`, tr: `${v}${L.topPost.tr}` } : frag(String(v), String(v)));   // the closing bracket of "(top 4)" rides in the column, so no gap opens before it
      col.append(c);
    }
    put(key, col, '', win);
    return win;
  };
  // the board: what the recommender did (rows) against what the user would like (columns), in the look of the confusion page (a right outcome a solid green frame, a wrong one a dashed red one, D-068); the four counts tick
  const bd = h(doc, 'div', 'rw-board');
  put('bd', bd, box(BOARD.x, BOARD.y, BOARD.w, BOARD.h));
  const ch = (/** @type {number} */ x, /** @type {Record<string, string>} */ text) => { const e = say(h(doc, 'div', 'rw-ch'), text); e.style.cssText = `left:${x}px;top:0;width:210px`; bd.append(e); };
  ch(260, L.relevant); ch(480, L.irrelevant);
  const rh1 = h(doc, 'div', 'rw-rh'); rh1.style.cssText = 'left:0;top:38px;width:250px;height:76px';
  rh1.append(say(h(doc, 'span', 'rw-ts'), L.topPre), odo('o:k', 'k', K_LH, 13 * String(nA).length + 10, 'rw-k'));
  const rh2 = say(h(doc, 'div', 'rw-rh'), L.notRec); rh2.style.cssText = 'left:0;top:124px;width:250px;height:76px';
  bd.append(rh1, rh2);
  /** @param {number} x @param {number} y @param {boolean} good @param {string} abbr @param {'tp'|'fp'|'fn'|'tn'} kind @param {string} key */
  const cell = (x, y, good, abbr, kind, key) => {
    const c = h(doc, 'div', `rw-cell ${good ? 'rw-good' : 'rw-bad'}`);
    c.style.cssText = `left:${x}px;top:${y}px;width:210px;height:76px`;
    const a = h(doc, 'span', 'rw-abbr'); a.textContent = abbr;
    c.append(a, odo(key, kind, BIG_LH, 56, 'rw-n'));
    bd.append(c);
  };
  cell(260, 38, true, 'TP', 'tp', 'o:bTP'); cell(480, 38, false, 'FP', 'fp', 'o:bFP');
  cell(260, 124, false, 'FN', 'fn', 'o:bFN'); cell(480, 124, true, 'TN', 'tn', 'o:bTN');
  // WP-93 (D-174): the open formulas with this k's numbers, one above the other: `TPR = frac(TP|TP + FN) = frac([TP]|[TP] + [FN]) = [rate]`. The symbolic fraction is a label drawn by formula.js; the fraction with the numbers is built by hand
  // with the same classes (fm-frac, fm-num, fm-den) because its numbers are odometers (live windows, FM_LH lines high), and the value is an odometer too
  const fm = h(doc, 'div', 'rw-fm');
  put('fm', fm, box(FORMULAS.x, FORMULAS.y, FORMULAS.w, FORMULAS.h));
  /** @param {number} y @param {Record<string, string>} sym @param {Array<['tp'|'fn'|'fp'|'tn', string]>} parts the three numbers of the fraction: numerator, then the two terms of the denominator @param {['tpr'|'fpr', string]} res */
  const formula = (y, sym, parts, res) => {
    const row = h(doc, 'div', 'rw-fline');
    row.style.cssText = `left:0;top:${y}px`;
    const eqs = () => say(h(doc, 'span', 'rw-ft'), same(' = '));
    const w = 15 * String(Math.max(nR, nN)).length;
    const fr = h(doc, 'span', 'fm-frac rw-nf'), nu = h(doc, 'span', 'fm-num'), de = h(doc, 'span', 'fm-den');
    nu.append(odo(parts[0][1], parts[0][0], FM_LH, w, 'rw-f'));
    de.append(odo(parts[1][1], parts[1][0], FM_LH, w, 'rw-f'), say(h(doc, 'span', 'rw-ft'), same(' + ')), odo(parts[2][1], parts[2][0], FM_LH, w, 'rw-f'));
    fr.append(nu, de);
    row.append(fsay(h(doc, 'span', 'rw-ft'), sym), eqs(), fr, eqs(), odo(res[1], res[0], LH, 64, 'rw-res'));
    fm.append(row);
  };
  formula(0, L.fTpr, [['tp', 'o:t1'], ['tp', 'o:t2'], ['fn', 'o:t3']], ['tpr', 'o:t4']);
  formula(FM_ROW.y2, L.fFpr, [['fp', 'o:f1'], ['fp', 'o:f2'], ['tn', 'o:f3']], ['fpr', 'o:f4']);

  // the letter of each algorithm on its curve (a letter and a shape, not colour alone): A named in press 4, B with its curve
  /** @param {string} key @param {string} cls @param {string} letter @param {ReturnType<typeof rocCurve>} c @param {number} frac @param {number} dx @param {number} dy */
  const endMark = (key, cls, letter, c, frac, dx, dy) => {
    const [f, t] = c.pts[Math.round((c.pts.length - 1) * frac)];
    const m = h(doc, 'div', `rc-end ${cls}`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
    m.textContent = letter;
    put(key, m, `left:${px(f) + dx - 16}px;top:${py(t) + dy - 16}px`);
  };
  endMark('da', 'rc-end-a', 'A', cA, 0.3, 30, -24);
  endMark('db', 'rc-end-b', 'B', cB, 0.7, -30, 26);
  label('lr', 'rc-note', L.random, `left:${px(0.52)}px;top:${py(0.52) + 26}px;width:360px`);
  label('lo', 'rc-note', L.oracle, `left:${px(0.62)}px;top:${py(1) - 38}px;width:300px`);
  // press 4: where each list wins
  label('ca', 'rc-chip', L.chipA, `left:${LIST.x}px;top:${LIST.yb + 96}px;width:420px`);
  label('cb', 'rc-chip rc-chip-b', L.chipB, `left:${LIST.x + 450}px;top:${LIST.yb + 96}px;width:380px`);
  // press 5: the two AUC lines (pairs in the right order over all pairs), the definition and the blindness to position
  // WP-93 (D-174): each AUC line is a computation of two lines' height (59.1 px at 26 px) on the place of the chips of press 4 (they leave in press 5): 392 to 451 and 454 to 513, the sentences from 522
  const AUC = aucFormulas(P);
  renderFormula(doc, label('xa', 'rc-auc', AUC.a, `left:${LIST.x}px;top:${AUC_Y[0]}px;width:880px`));
  renderFormula(doc, label('xb', 'rc-auc', AUC.b, `left:${LIST.x}px;top:${AUC_Y[1]}px;width:880px`));
  label('pr', 'rc-note', L.prob, `left:${LIST.x}px;top:${LIST.yb + 222}px;width:880px`);
  label('bl', 'rc-note', L.blind, `left:${LIST.x}px;top:${LIST.yb + 256}px;width:880px`);
  return finish(ctx, sc, M.n, M.frame, M.timing);
}
