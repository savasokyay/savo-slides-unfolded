// @ts-check
// WP-74 (D-149, D-150; brief 09; page 17 `ndcg` of the I2RS w07 deck, storyboard §3): the mode `dcg` of table-highlight. A ranked list is scored by the gain of each item, discounted by its position: DCG, the same score of the ideal order,
// and their ratio NDCG; then the same item early or late, and why a metric that weighs the top more is the right one for a top-K list. The gains are a toy: the speaker note and the evidence record say so, the picture carries no label (D-129).
//
// By hand, the lecture's list (five items, gains 3 2 3 0 1): the discount of position i is 1 / log2(1 + i) = 1.000, 0.631, 0.500, 0.431, 0.387; the gains discounted: 3.00, 1.26, 1.50, 0.00, 0.39, so DCG = 6.15
// (3 + 2 / 1.585 + 3 / 2 + 0 + 1 / 2.585 = 6.1487). The ideal order 3 3 2 1 0 gives IDCG = 3 + 3 / 1.585 + 2 / 2 + 1 / 2.322 + 0 = 6.3235, so NDCG = 6.1487 / 6.3235 = 0.972.
// One perfect item (gain 3) in a list of 15: first, DCG = 3 / 1 = 3.00 and NDCG = 1.00; 15th, DCG = 3 / log2(16) = 0.75 and NDCG = 0.25 (the ideal order is the same one item first).
//
// States (five presses; 0 is the list: the positions and the gains):
//   1 discount   FIRST an arrow comes in and points at the gain circles with a label saying what the numbers in them are (WP-93, the user's notes on page 13: "what do the numbers in the circles mean"); then, under every position,
//                a bar 1 / log2(1 + position) and its value: the lower in the list, the less it counts
//   2 DCG        the gain times the discount under every position, and the sum (DCG, spelled out beside its name where it first appears, D-178)
//   3 ideal      the discount rows step back; the same items in the ideal order; IDCG ("ideal DCG (IDCG)") and NDCG = DCG / IDCG, spelled out under its row, with a gauge
//   4 early/late the same perfect item first and 15th in a list of 15: their DCG and NDCG (1.00 and 0.25), NDCG tells them apart
//   5 which one  every position weighs the same in ROC and Kendall's tau, the top weighs more in NDCG (20 positions, the two weights as bars) and the cut points @10 and @20 are marked: K matters, both are reported
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): 1820 / 1280 / 1440 / 1230 / 1680 ms (press 1 was 1220: the arrow and its label come first, the rest starts at 700).
//   1  max(the arrow 500, its label 150 + u, bars 700 + 4 * 110 + 500, their values 700 + 4 * 110 + 300 + u)      2  max(products 100 + 4 * 110 + u, the card 700 + u, DCG 900 + u)
//   3  max(the rows dim 400, the ideal row 150 + u, IDCG 500 + u, NDCG 700 + u, the gauge 800 + 640)      4  max(the old picture out 400, rows 300 + u and 450 + u, their values 700 + u and 850 + u)
//   5  max(the early/late picture out 260, the panel 250 + u, flat bars 400 + 600, NDCG bars 700 + 700, labels 500 + u and 900 + u, the cut lines 1100 + u and 1300 + u)
//
// Motion: opacity and transform (scaleY for a bar). Nothing else.
//
// WP-93 (D-174, the user's rule of 2026-11-01: a formula is shown as a computation): the discount and NDCG are computations, the symbolic fraction = the same fraction with the numbers = the value, every division a fraction with a
// horizontal bar (formula.js `frac(NUM|DEN)`), never "a / b" in a line of text; the base of the logarithm is a subscript (`log_2`: the contract of 2026-11-01, `_` and a run of letters or digits is a subscript). Press 1 writes under every bar
// the fraction with the position's number and, under it, "= value"; the left label column holds the name and the symbolic fraction 1 / log_2(1 + i) (the row of the positions is "position i"). Press 3's card writes NDCG = DCG / IDCG = 6.15 / 6.32
// as one line that ends in the big value. `dcgFormulas` composes the lines per language from the model's numbers and the labels (the symbolic part is a label, so a deck can reword it); the picture draws them with `renderFormula`.
// The values keep their two decimals (1.00, not 1: the products read 3 x 1.00, the notes say NDCG 1.00). The bars are 96 px tall (were 112) on a baseline 38 px higher, to make room for the two-line computation under them. The geometry of
// the taller lines is UNMEASURED at the time of writing: the Chrome run of the deck tour decides.
import { h, s } from './frames.js';
import { svg } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { U, finish, fillFrag, frag, grow, labelsSchema, num, on, pressDuration, rise, scene } from './w07-common.js';

const COL0 = 220, PITCH = 170, CHIP = 84;   // WP-93 (D-174): COL0 was 190; the label column (right edge COL0 - 20) holds the symbolic fraction 1 / log_2(1 + position), 163 px wide at 22 px
const LAB = { x: 20, w: COL0 - 40 };         // the row labels: x 20 to COL0 - 20 (200), right-aligned
const Y = { pos: 56, chip: 96, barBase: 292, barH: 96, prod: 396, ideal: 478 };
const DV = { y: 298, w: 150, numH: 56, resH: 30 };   // WP-93 (D-174): under a bar, the fraction with the position's number (a fraction line at 24 px is 54.5 px high) and "= value" (30 px), centred on the chip
const PANEL = { x: 1090, y: 90, w: 550, h: 352 };   // WP-93 (D-178): 330 high before; the words of NDCG stand under its row (y 274 to 300) and the gauge moved down 18 px (track at 308)
const ARROW = { x: 992, y: 118, w: 96, h: 40, label: 108, rest: 700 };   // WP-93 (page 13): the arrow (tip at x 992, 8 px right of the last circle, which ends at 984) and its label, on the circles' centre line (138); the rest of press 1 starts at 700 ms
const STRIP = { x: 250, pitch: 54, cell: 46, y: [150, 300], val: 1110 };
const WIDE = { x: 150, pitch: 62, bar: 38, n: 20, flatBase: 250, ndcgBase: 470, h: 130 };

const LABELS = {
  // WP-93 (D-174): `discount` is the row's name and `discountFormula` its symbolic fraction (formula.js mark-up; `log_2` is a subscript), `ndcg` the symbolic part of the card's computation
  position: frag('position', 'konum'), list: frag('the list', 'liste'), discount: frag('discount', 'indirim'), discountFormula: frag('frac(1|log_2(1 + position))', 'frac(1|log_2(1 + konum))'), product: frag('gain x discount', 'kazanç x indirim'),
  dcg: frag('DCG', 'DCG'), idcg: frag('ideal DCG (IDCG)', 'ideal DCG (IDCG)'), ndcg: frag('NDCG = frac(DCG|IDCG)', 'NDCG = frac(DCG|IDCG)'), ideal: frag('ideal order', 'ideal sıra'),
  // WP-93 (the user's notes on page 13, 2026-11-01): the label of the arrow that points at the numbers in the circles (the gains) in press 1; and (D-178, the abbreviation rule: spelled out on the slide where it first appears) the words
  // of DCG (beside its name, press 2) and of NDCG (under its row, press 3); IDCG is "ideal DCG (IDCG)". Technical terms stay English in Turkish slides.
  gainArrow: frag('gain: how relevant the item is, 0 to 3', 'kazanç: öğenin ilgi derecesi, 0 ile 3 arası'),
  dcgName: frag('Discounted Cumulative Gain', 'Discounted Cumulative Gain'), ndcgName: frag('Normalized Discounted Cumulative Gain', 'Normalized Discounted Cumulative Gain'),
  first: frag('perfect item first', 'mükemmel öğe başta'), late: frag('perfect item {n}th', 'mükemmel öğe {n}. sırada'), dcgOf: frag('DCG', 'DCG'),
  // WP-93 (D-178): "ROC" is explained on page 15, so page 13 does not draw it (`same` said "ROC, Kendall: ...")
  same: frag('Kendall: every position counts the same', 'Kendall: her konum aynı sayılır'), top: frag('NDCG: the top counts more', 'NDCG: tepe daha ağır sayılır'), atK: frag('@{k}', '@{k}'),
};
/** WP-93 (D-174): the labels that hold formula mark-up (frac(NUM|DEN), log_2, formula.js): refused with their place when one does not parse. */
const FORMULA_LABELS = ['discountFormula', 'ndcg'];
const GAINS = [3, 2, 3, 0, 1];

/** The params of the mode `dcg`, merged into table-highlight's schema (the registry carries the whole). */
export const dcgSchema = {
  type: 'object', additionalProperties: false, title: 'the DCG mode (mode dcg)',
  description: '`gains` are the gains of the five items in the order of the list (0..3). `late` is the list of press 4: its length (2..20) and the gain of its one perfect item (1..3). `cuts` are the two cut points of press 5 (each at most 20, the first smaller). '
    + 'The gains are a toy; the picture carries no label.',
  default: { gains: GAINS, late: { length: 15, gain: 3 }, cuts: [10, 20], labels: LABELS },
  properties: {
    gains: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'integer', minimum: 0, maximum: 3 }, default: GAINS },
    late: { type: 'object', additionalProperties: false, default: { length: 15, gain: 3 }, properties: { length: { type: 'integer', minimum: 2, maximum: 20, default: 15 }, gain: { type: 'integer', minimum: 1, maximum: 3, default: 3 } } },
    cuts: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 1, maximum: 20 }, default: [10, 20] },
    labels: labelsSchema(LABELS, '`late` holds {n} (the position of the perfect item), `atK` {k}.'),
  },
};
export const dcgExamples = [{ mode: 'dcg' }, { mode: 'dcg', dcg: { gains: [2, 1, 0, 3, 3], late: { length: 8, gain: 2 }, cuts: [3, 8] } }];
export const dcgPresses = 5;

// WP-74 (headless deck tour 2026-10-31; lead's decision B): a gain chip's ground is the key colour mixed into the page ground, 22 % per gain (gain 3 = 66 %). In the DARK theme the body ink on a
// tint above 45 % drops under the project's 4.5:1 for text (CLAUDE.md, both themes), so those chips (gain 3 only: the schema's gains are 0..3) write their digit in the page ground colour instead.
// By hand, tokens of config/themes/dark.yaml: key #F5C542, ground #0E1940, ink #E2E7F8; relative luminance L = 0.2126 R + 0.7152 G + 0.0722 B of the linear channels, ratio (L1 + 0.05) / (L2 + 0.05):
//   gain 3, 66 %: ground = 0.66 key + 0.34 ground = (166.46, 138.52, 65.32) = #A68B41, L = 0.269; ink L = 0.801 -> 0.851 / 0.319 = 2.67 (the tour measured 2.66, on the screen's rounded colours);
//   the page ground #0E1940 has L = 0.0116 -> 0.319 / 0.0616 = 5.18 by this three-digit chain, 5.175 unrounded (about 5.2).
//   gain 2, 44 %: ground #746541, ink 4.65 passes. The largest whole share where the ink still passes is 45 % (4.52; 46 % gives 4.41), hence DARK_INK_MAX_TINT = 45.
// The LIGHT theme needs nothing: key #8B5F00, ground #F0F3FA, ink #1B2350 give 13.48 / 10.00 / 7.18 / 4.98 for gains 0 to 3 (its own limit is 71 %). The rule is in engine/css/widgets-w07.css, dark theme only.
export const TINT_PER_GAIN = 22;
export const DARK_INK_MAX_TINT = 45;
/** The share (percent) of the key colour in the ground of a chip of gain `g`. @param {number} g @returns {number} */
export const tintOf = (g) => g * TINT_PER_GAIN;
/** True when the chip's tint is too strong for the body ink in the dark theme (its digit takes the ground colour there). @param {number} g @returns {boolean} */
export const chipHigh = (g) => tintOf(g) > DARK_INK_MAX_TINT;
/** The attributes of a gain chip: the graphics class and, for a strong tint, the `data-hi` mark the dark-theme rule reads. @param {number} g @returns {Record<string, string>} */
export const chipAttrs = (g) => (chipHigh(g) ? { 'data-gfx': 'border', 'data-hi': '' } : { 'data-gfx': 'border' });

/** The discount of a position (1-based). @param {number} i @returns {number} */
export const discount = (i) => 1 / Math.log2(1 + i);
/** DCG of gains in list order. @param {number[]} gains @returns {number} */
export const dcgOf = (gains) => gains.reduce((a, g, i) => a + g * discount(i + 1), 0);
/** IDCG: the DCG of the same gains in the ideal (falling) order. @param {number[]} gains @returns {number} */
export const idcgOf = (gains) => dcgOf([...gains].sort((a, b) => b - a));
/** NDCG = DCG / IDCG (0 when every gain is 0). @param {number[]} gains @returns {number} */
export const ndcgOf = (gains) => { const i = idcgOf(gains); return i === 0 ? 0 : dcgOf(gains) / i; };

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function dcgProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.dcg;
  for (const key of FORMULA_LABELS) {                                                  // WP-93 (D-174): the formula mark-up of formula.js, refused with its place when it does not parse
    for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.[key] ?? {}))) {
      const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
      if (problem) bad(`$.dcg.labels.${key}.${lang}`, problem);
    }
  }
  /** @type {number[]} */ const g = Q.gains;
  if (Math.max(...g) === 0) bad('$.dcg.gains', 'are all 0: nothing is relevant, NDCG is undefined');
  else if (JSON.stringify(g) === JSON.stringify([...g].sort((a, b) => b - a))) bad('$.dcg.gains', 'are already in the ideal order: the list and the ideal order would be the same picture (NDCG 1.00); put a better item lower');
  const [a, b] = Q.cuts;
  if (!(a < b)) bad('$.dcg.cuts', `are ${a} and ${b}: the first cut point must be smaller than the second`);
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function dcgModel(P) {
  const Q = P.dcg;
  /** @type {number[]} */ const gains = Q.gains;
  const n = gains.length, L = Q.late.length;
  const disc = gains.map((_, i) => discount(i + 1)), prods = gains.map((g, i) => g * disc[i]);
  const ideal = [...gains].sort((a, b) => b - a);
  const dcg = dcgOf(gains), idcg = idcgOf(gains), ndcg = ndcgOf(gains);
  const early = { dcg: Q.late.gain * discount(1), ndcg: 1 }, lateOne = { dcg: Q.late.gain * discount(L), ndcg: discount(L) };
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('g0', on(k <= 3)); f.set('gd', { opacity: k <= 2 ? '1' : k === 3 ? '0.3' : '0' });
    f.set('ga', k === 1 ? { opacity: '1', transform: 'translateX(0px)' } : { opacity: '0', transform: 'translateX(48px)' });   // WP-93 (page 13): the arrow slides in from the right in press 1, and goes when the card comes
    for (let i = 0; i < n; i++) { f.set(`db:${i}`, grow(k >= 1, 'y')); f.set(`dv:${i}`, rise(k >= 1)); f.set(`pv:${i}`, rise(k >= 2)); }
    f.set('rp', rise(k === 2 || k === 3)); f.set('dcgv', rise(k === 2 || k === 3)); f.set('idcgv', rise(k === 3)); f.set('ndcgv', rise(k === 3)); f.set('ng', grow(k === 3));
    f.set('ir', rise(k === 3));
    f.set('cA', rise(k === 4)); f.set('cB', rise(k === 4)); f.set('nA', rise(k === 4)); f.set('nB', rise(k === 4));
    f.set('wp', on(k === 5)); f.set('wf', grow(k === 5, 'y')); f.set('wn', grow(k === 5, 'y')); f.set('wl1', rise(k === 5)); f.set('wl2', rise(k === 5)); f.set('c1', rise(k === 5)); f.set('c2', rise(k === 5));
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    const gone = { start: 0, duration: 260 };
    switch (kind) {
      case 'g0': return gone;
      case 'gd': return { start: 0, duration: 400 };
      case 'ga': return k === 1 ? { start: 0, duration: 500 } : gone;                          // WP-93 (page 13): the FIRST animation of press 1; the rest starts at ARROW.rest (700 ms), when the arrow and its label (150 + u) are there
      case 'db': return { start: ARROW.rest + i * 110, duration: 500 };
      case 'dv': return { start: ARROW.rest + i * 110 + 300, duration: U };
      case 'pv': return { start: 100 + i * 110, duration: U };
      case 'rp': return k === 2 ? { start: 700, duration: U } : gone;
      case 'dcgv': return k === 2 ? { start: 900, duration: U } : gone;
      case 'idcgv': return k === 3 ? { start: 500, duration: U } : gone;
      case 'ndcgv': return k === 3 ? { start: 700, duration: U } : gone;
      case 'ng': return k === 3 ? { start: 800, duration: 640 } : gone;
      case 'ir': return k === 3 ? { start: 150, duration: U } : gone;
      case 'cA': return k === 4 ? { start: 300, duration: U } : gone;
      case 'cB': return k === 4 ? { start: 450, duration: U } : gone;
      case 'nA': return k === 4 ? { start: 700, duration: U } : gone;
      case 'nB': return k === 4 ? { start: 850, duration: U } : gone;
      case 'wp': return { start: 250, duration: U };
      case 'wf': return { start: 400, duration: 600 };
      case 'wn': return { start: 700, duration: 700 };
      case 'wl1': return { start: 500, duration: U };
      case 'wl2': return { start: 900, duration: U };
      case 'c1': return { start: 1100, duration: U };
      case 'c2': return { start: 1300, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { n, L, gains, ideal, disc, prods, dcg, idcg, ndcg, early, lateOne, frame, timing, count: dcgPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/** @typedef {{sym: Record<'en'|'tr', string>, num: Record<'en'|'tr', string>, val: Record<'en'|'tr', string>}} Equation  `sym` the symbolic part (a label: it may hold formula mark-up), `num` the fraction with the numbers, `val` the value */

/**
 * WP-93 (D-174): the computations of the page, per language: the symbolic part (`sym`, a label, so that a deck can reword it) = the same fraction with the numbers (`num`) = the value (`val`), every division a `frac(NUM|DEN)` of
 * formula.js and never "a / b" in a line of text; the base of the logarithm is a subscript (`log_2`). The page writes `num` and "= val" under each bar and `sym = num =` and then the big `val` on the card. The numbers are the
 * model's own, written with two decimals (the decimal comma in Turkish). Pure. By hand (log_2 2 = 1, log_2 3 = 1.585, log_2 4 = 2, log_2 5 = 2.322, log_2 6 = 2.585; the gains 3 2 3 0 1):
 *   the discount 1 / log_2(1 + p) of the positions p = 1 to 5 is 1 / 1 = 1.00, 1 / 1.585 = 0.63, 1 / 2 = 0.50, 1 / 2.322 = 0.43, 1 / 2.585 = 0.39
 *   NDCG = DCG / IDCG = 6.15 / 6.32 = 0.97 (DCG = 6.1487, IDCG = 6.3235, the quotient 0.9724)
 * @param {any} P the resolved params of table-highlight @returns {{disc: Equation[], ndcg: Equation}} `disc`: one per position of the list
 */
export function dcgFormulas(P) {
  const Q = P.dcg, L = Q.labels, M = dcgModel(P);
  const langs = /** @type {Array<'en'|'tr'>} */ (['en', 'tr']);
  /** a label in both languages (a deck may give English only) */
  const label = (/** @type {string} */ key) => /** @type {Record<'en'|'tr', string>} */ ({ en: L[key].en, tr: L[key].tr ?? L[key].en });
  const both = (/** @type {(lang: 'en'|'tr') => string} */ f) => /** @type {Record<'en'|'tr', string>} */ (Object.fromEntries(langs.map((lang) => [lang, f(lang)])));
  const disc = M.disc.map((/** @type {number} */ d, /** @type {number} */ i) => ({ sym: label('discountFormula'), num: both(() => `frac(1|log_2(1 + ${i + 1}))`), val: both((lang) => num(d, 2)[lang]) }));
  const ndcg = { sym: label('ndcg'), num: both((lang) => `frac(${num(M.dcg, 2)[lang]}|${num(M.idcg, 2)[lang]})`), val: both((lang) => num(M.ndcg, 2)[lang]) };
  return { disc, ndcg };
}

/**
 * The picture of the mode `dcg`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function dcgBuild(ctx, P) {
  const Q = P.dcg, Lb = Q.labels;
  const M = dcgModel(P);
  const sc = scene(ctx, 'mx-root dc-root');
  const { doc, box, put, add, say } = sc;
  const fsay = (/** @type {HTMLElement} */ el, /** @type {Record<string, string>} */ text) => { say(el, text); renderFormula(doc, el); return el; };   // WP-93 (D-174): a text with formula mark-up: say, then draw the fractions
  const F = dcgFormulas(P);
  const colX = (/** @type {number} */ i) => COL0 + i * PITCH;
  const tint = (/** @type {number} */ g) => `background:color-mix(in srgb,var(--key) ${tintOf(g)}%,var(--ground))`;
  // WP-74: chipAttrs marks the strong tints, whose digit takes the ground colour in the dark theme (see TINT_PER_GAIN)
  const chip = (/** @type {number} */ g, /** @type {number} */ size) => { const c = h(doc, 'div', 'dc-chip', chipAttrs(g)); c.style.cssText += `;width:${size}px;height:${size}px;line-height:${size - 8}px;${tint(g)}`; c.textContent = String(g); return c; };

  // the list: positions and gains (press 0), with the row labels
  const g0 = h(doc, 'div', 'dc-g');
  put('g0', g0, box(0, 0, 1680, 600));
  add(say(h(doc, 'div', 'dc-rowlab'), Lb.position), `left:${LAB.x}px;top:${Y.pos}px;width:${LAB.w}px;text-align:right`, g0);
  add(say(h(doc, 'div', 'dc-rowlab'), Lb.list), `left:${LAB.x}px;top:${Y.chip + 22}px;width:${LAB.w}px;text-align:right`, g0);
  M.gains.forEach((g, i) => {
    add(say(h(doc, 'div', 'dc-pos'), { en: `#${i + 1}`, tr: `${i + 1}.` }), `left:${colX(i)}px;top:${Y.pos}px;width:${CHIP}px`, g0);
    add(chip(g, CHIP), `left:${colX(i)}px;top:${Y.chip}px`, g0);
  });
  // WP-93 (the user's notes on page 13: "what do the numbers in the circles mean"): the FIRST animation of press 1: an arrow comes in from the right and points at the circles (the last one ends at x 984), with a label that says what the
  // numbers are, the gains. It stands right of the row, clear of the bars (below) and of the card (press 2: x 1090 on), which it leaves before.
  const ga = h(doc, 'div', 'dc-ga');
  const ar = svg(doc, ARROW.w, ARROW.h, 'dc-arrow');
  ar.append(s(doc, 'path', { d: `M${ARROW.w - 6} ${ARROW.h / 2}H8M22 ${ARROW.h / 2 - 12}L8 ${ARROW.h / 2}L22 ${ARROW.h / 2 + 12}` }));
  ga.append(ar, say(h(doc, 'div', 'dc-galab', { 'data-role': 'emph' }), Lb.gainArrow));
  put('ga', ga, box(ARROW.x, ARROW.y, 1640 - ARROW.x, ARROW.h));
  // the discount bars and the products, one group that dims in press 3 and goes in press 4
  const gd = h(doc, 'div', 'dc-g');
  put('gd', gd, box(0, 0, 1680, 600));
  // WP-93 (D-174): the row's name (26 px) and, 4 px under it, the symbolic fraction (a fraction line at 22 px is 50 px high): both end above the baseline of the bars (292)
  add(say(h(doc, 'div', 'dc-rowlab'), Lb.discount), `left:${LAB.x}px;top:${Y.barBase - Y.barH}px;width:${LAB.w}px;text-align:right`, gd);
  add(fsay(h(doc, 'div', 'dc-rowlab dc-dform'), F.disc[0].sym), `left:${LAB.x}px;top:${Y.barBase - Y.barH + 30}px;width:${LAB.w}px;text-align:right`, gd);
  add(say(h(doc, 'div', 'dc-rowlab'), Lb.product), `left:${LAB.x}px;top:${Y.prod + 8}px;width:${LAB.w}px;text-align:right`, gd);
  M.gains.forEach((g, i) => {
    const bh = Math.round(M.disc[i] * Y.barH);
    put(`db:${i}`, h(doc, 'div', 'dc-bar', { 'data-gfx': 'fill' }), `${box(colX(i) + 12, Y.barBase - bh, CHIP - 24, bh)};transform-origin:50% 100%`, gd);
    // WP-93 (D-174): under the bar the fraction with the position's number and, under it, "= value" (two lines, one keyed element)
    const f = F.disc[i], dv = h(doc, 'div', 'dc-val');
    dv.append(fsay(h(doc, 'div', 'dc-dnum'), f.num), say(h(doc, 'div', 'dc-dres'), { en: `= ${f.val.en}`, tr: `= ${f.val.tr}` }));
    put(`dv:${i}`, dv, `left:${colX(i) + (CHIP - DV.w) / 2}px;top:${DV.y}px;width:${DV.w}px;height:${DV.numH + DV.resH}px`, gd);
    const pv = h(doc, 'div', 'dc-prod');
    pv.append(say(h(doc, 'span', 'dc-prod-calc'), { en: `${g} x ${num(M.disc[i], 2).en}`, tr: `${g} x ${num(M.disc[i], 2).tr}` }), say(h(doc, 'b'), num(M.prods[i], 2)));
    put(`pv:${i}`, pv, `left:${colX(i) - 28}px;top:${Y.prod}px;width:${CHIP + 56}px`, gd);
  });
  // the result card: DCG (press 2), then IDCG and NDCG with a gauge (press 3)
  const rp = h(doc, 'div', 'dc-card', { 'aria-hidden': 'true' });
  put('rp', rp, box(PANEL.x, PANEL.y, PANEL.w, PANEL.h));
  // WP-93 (D-178, the abbreviation rule of 2026-11-01): `words` stands beside the name (DCG: "Discounted Cumulative Gain", 22 px after the 32 px abbreviation) and `below` under the row (NDCG: "Normalized Discounted Cumulative Gain")
  const row = (/** @type {string} */ key, /** @type {number} */ y, /** @type {Record<string, string>} */ label, /** @type {number} */ v, /** @type {string} */ cls, /** @type {Equation | undefined} */ eq, /** @type {Record<string, string> | undefined} */ words, /** @type {Record<string, string> | undefined} */ below) => {
    const el = h(doc, 'div', `dc-line ${cls}`);
    // WP-93 (D-174): NDCG's row is one computation, `symbolic = numbers =` and then the value, big, at the right end of the row
    const left = eq ? fsay(h(doc, 'span'), { en: `${eq.sym.en} = ${eq.num.en} =`, tr: `${eq.sym.tr} = ${eq.num.tr} =` }) : say(h(doc, 'span'), label);
    if (words) left.append(say(h(doc, 'small', 'dc-expand'), words));
    el.append(left, say(h(doc, 'b'), num(v, 2)));
    if (below) el.append(say(h(doc, 'small', 'dc-below'), below));
    put(key, el, `left:22px;top:${y}px;width:${PANEL.w - 44}px`, rp);
  };
  row('dcgv', 24, Lb.dcg, M.dcg, '', undefined, Lb.dcgName);
  row('idcgv', 104, Lb.idcg, M.idcg, '');
  row('ndcgv', 196, Lb.ndcg, M.ndcg, 'dc-big', F.ndcg, undefined, Lb.ndcgName);
  rp.append(h(doc, 'div', 'dc-track', { 'aria-hidden': 'true' }));
  put('ng', h(doc, 'div', 'dc-gauge', { 'data-gfx': 'fill' }), `${box(30, 308, Math.max(4, Math.round((PANEL.w - 60) * M.ndcg)), 22)};transform-origin:0 50%`, rp);
  // the ideal order (press 3)
  const ir = h(doc, 'div', 'dc-g');
  put('ir', ir, box(0, 0, 1680, 600));
  add(say(h(doc, 'div', 'dc-rowlab'), Lb.ideal), `left:${LAB.x}px;top:${Y.ideal + 22}px;width:${LAB.w}px;text-align:right`, ir);
  M.ideal.forEach((g, i) => add(chip(g, 74), `left:${colX(i) + 5}px;top:${Y.ideal}px`, ir));

  // press 4: the same perfect item first and late, in lists of L positions
  const strip = (/** @type {string} */ key, /** @type {string} */ vkey, /** @type {number} */ y, /** @type {number} */ at, /** @type {Record<string, string>} */ label, /** @type {{dcg: number, ndcg: number}} */ res) => {
    const el = h(doc, 'div', 'dc-g');
    put(key, el, box(0, 0, 1680, 600));
    add(say(h(doc, 'div', 'dc-strip-lab'), label), `left:${STRIP.x}px;top:${y - 40}px;width:700px`, el);
    for (let i = 0; i < M.L; i++) add(h(doc, 'div', i === at ? 'dc-cell dc-cell-on' : 'dc-cell', { 'data-gfx': 'border' }), box(STRIP.x + i * STRIP.pitch, y, STRIP.cell, STRIP.cell), el);
    const v = h(doc, 'div', 'dc-res');
    v.append(say(h(doc, 'span'), Lb.dcgOf), say(h(doc, 'b'), num(res.dcg, 2)), say(h(doc, 'span', 'dc-res-nd'), { en: 'NDCG', tr: 'NDCG' }), say(h(doc, 'b', 'dc-res-n'), num(res.ndcg, 2)));
    put(vkey, v, `left:${STRIP.val}px;top:${y - 6}px;width:520px`);
  };
  strip('cA', 'nA', STRIP.y[0], 0, Lb.first, M.early);
  strip('cB', 'nB', STRIP.y[1], M.L - 1, fillFrag(Lb.late, { n: M.L }), M.lateOne);

  // press 5: the weight of every position in ROC and Kendall (flat) and in NDCG (falling), and the cut points
  const wp = h(doc, 'div', 'dc-g');
  put('wp', wp, box(0, 0, 1680, 600));
  const flat = h(doc, 'div', 'dc-w'); const fall = h(doc, 'div', 'dc-w');
  put('wf', flat, `${box(WIDE.x, WIDE.flatBase - WIDE.h, WIDE.pitch * WIDE.n, WIDE.h)};transform-origin:50% 100%`, wp);
  put('wn', fall, `${box(WIDE.x, WIDE.ndcgBase - WIDE.h, WIDE.pitch * WIDE.n, WIDE.h)};transform-origin:50% 100%`, wp);
  for (let i = 0; i < WIDE.n; i++) {
    const a = h(doc, 'i', 'dc-wbar dc-wbar-flat', { 'data-gfx': 'fill' }); a.style.cssText += `;left:${i * WIDE.pitch + 12}px;width:${WIDE.bar}px;height:${WIDE.h}px;bottom:0`; flat.append(a);
    const bh = Math.round(discount(i + 1) * WIDE.h);
    const b = h(doc, 'i', 'dc-wbar dc-wbar-ndcg', { 'data-gfx': 'fill' }); b.style.cssText += `;left:${i * WIDE.pitch + 12}px;width:${WIDE.bar}px;height:${bh}px;bottom:0`; fall.append(b);
  }
  put('wl1', say(h(doc, 'div', 'dc-wlab'), Lb.same), `left:${WIDE.x}px;top:${WIDE.flatBase - WIDE.h - 44}px;width:1100px`, wp);
  put('wl2', say(h(doc, 'div', 'dc-wlab'), Lb.top), `left:${WIDE.x}px;top:${WIDE.ndcgBase - WIDE.h - 44}px;width:1100px`, wp);
  Q.cuts.forEach((/** @type {number} */ k, /** @type {number} */ j) => {
    const x = WIDE.x + k * WIDE.pitch - 6;
    const cut = h(doc, 'div', 'dc-cut', { 'aria-hidden': 'true' });
    cut.append(say(h(doc, 'b'), fillFrag(Lb.atK, { k })));
    put(`c${j + 1}`, cut, `left:${x}px;top:${WIDE.flatBase - WIDE.h - 8}px;height:${WIDE.ndcgBase - WIDE.flatBase + WIDE.h + 24}px`, wp);
  });
  return finish(ctx, sc, M.count, M.frame, M.timing);
}
