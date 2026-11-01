// @ts-check
// WP-74 (D-149, D-150; brief 09; page 13 `rating-error` of the I2RS w07 deck, storyboard §3): the mode `errors` of table-highlight. Rating error told as a picture: six films with the stars a user really gave and the stars a recommender
// predicted; the absolute errors and their mean (MAE), the squared errors and the root of their mean (RMSE), one bad prediction that moves RMSE far more than MAE, the plain answer to "which one?" (no universal one: two sources defend
// opposite choices, so it depends on the use) and the long tail (popular items set the average, sparse items have larger errors). The numbers are a toy: the speaker note and the evidence record say so, the picture carries no label (D-129).
//
// By hand, the lecture's numbers: six pairs, every error 0.5 stars: MAE = 6 * 0.5 / 6 = 0.50, RMSE = sqrt(6 * 0.25 / 6) = 0.50. The seventh pair (5 stars really, 2 predicted) has an error of 3: MAE = (3 + 3) / 7 = 0.857 -> 0.86 (+71 %),
// RMSE = sqrt((1.5 + 9) / 7) = sqrt(1.5) = 1.2247 -> 1.22 (+145 %): RMSE grows twice as much as MAE, because it squares the error before it averages.
//
// The bars (WP-93, the user's w07 review of 2026-11-01, page 9): the two error kinds stand side by side and stay side by side: an absolute error is a bar of 50 px per star in the first column (a bar for 3 stars is 150 px), a
// squared error a bar of 21 px per star squared in the second (9 stars squared are 189 px); before, the squared column took the place of the absolute one and the picture jumped to the RMSE view in one press ("the absolute error
// should stop before the squared error column and go on with it"). The two columns, their numbers and the cards need 490 to 1000 px of the 1010 px the cards leave; the stars of a pair moved left to make the room.
//
// The formulas (WP-93, D-177, the user's choice of 2026-11-01): INSIDE its card, in the empty space at the card's inner bottom, in the press the card comes in, the SYMBOLIC fraction alone, with no "MAE =" or "RMSE =" in front (the card
// already names it): `frac(Σ \|r − p\||n)` (r the real stars, p the predicted ones, n the number of pairs) and `sqrt(frac(Σ (r − p)²|n))`; the mark-up is formula.js. The numbers are not computed here: the card's big value already shows them.
// Press 3 changes only the card's value (and the +71 % / +145 % chip); the formula stays as it is. In press 4, when the cards say what their error counts, the formulas go.
// This page is the one exception (with the coverage page) to D-174's "symbolic fraction = the fraction with the numbers = the value": see the guard comment at `FORMULA_IN` below.
//
// States (five presses; 0 is the table of six pairs):
//   1 absolute   a bar and the number for every pair; the MAE card with its value and its formula
//   2 squared    the squared bars come beside the absolute ones, which stay; the RMSE card with its value and its formula
//   3 one bad    a seventh pair (marked "one bad prediction": text, the negative role and its cue) and its two bars, the absolute one and the long squared one; both values change, and how much each grew (the formulas stay: D-177)
//   4 which?     the table steps back; each card says what its error counts (every error the same / a large error much more)
//   5 long tail  the table goes; the popularity of eight items (a long tail) and their error, which grows to the right: popular items set the average, sparse items have larger errors
//
// duration(k) = pressDuration (the latest end of any thing that changes; u = 380 ms):
//   1  max(bars 120 + 5 * 90 + 420, their numbers 120 + 5 * 90 + 200 + u, MAE card 300 + u, its value 500 + u, its formula and the legend 700 + u)
//   2  max(squared bars 80 + 5 * 90 + 420, their numbers 80 + 5 * 90 + 200 + u, RMSE card 300 + u, its value 500 + u, its formula 700 + u; the MAE formula stays)
//   3  max(row 100 + u, tag 160 + u, the two bars 360 + 420 and 360 + 560, their numbers 700 + u, MAE value 1000 + u, RMSE value 1120 + u, +71 % 1240 + u, +145 % 1360 + u; the formulas do not change)
//   4  max(table 400, the two sentences 300 + u and 450 + u, the formulas leave 260)
//   5  max(table 400, chart bars 300 + 7 * 70 + 420, error bars 900 + 7 * 70 + 420, the first sentence 700 + u, the second 1500 + u)
// Default numbers: 1150 / 1110 / 1740 / 830 / 1880 ms (tests/js/table-errors.test.mjs works them out by hand; the browser reports the same).
//
// Motion: opacity and transform (scaleX / scaleY for a bar). Nothing else.
import { h } from './frames.js';
import { poster, starRow } from './pictos.js';
import { U, fillFrag, finish, frag, grow, labelsSchema, num, on, pressDuration, rise, scene, fmt } from './w07-common.js';
import { formulaProblem, renderFormula } from './formula.js';

const ROW0 = 108, PITCH = 62, ROW_H = 50;
// WP-93: the two error columns side by side (the stars of a pair moved left: actual 116, predicted 306, each cell about 182 px wide); a bar's number stands 12 px after it and needs about 54 px
const COL = { poster: 64, actual: 116, predicted: 306 };
const BARS = { abs: { x: 500, max: 150, px: 50 }, sq: { x: 740, max: 189, px: 21 } };
const CARD = { y: 108, w: 300, h: 340, x0: 1010, gap: 20 };
/** WP-93: the legend of r, p and n above the cards (x 1010 to 1630, the width of the two cards and the gap). */
const LEGEND = { x: CARD.x0, w: 2 * CARD.w + CARD.gap, y: 64 };
// WP-93 (D-177, the user's choice of 2026-11-01): on this page the formula is SYMBOLIC ONLY and stands INSIDE its card: the card's big value already shows the number, so the computation (the fraction with the numbers, the value) is left out. This is a
// page-level exception to D-174 ("symbolic fraction = the fraction with the numbers = the value"), like the coverage page's "n / m = p%" (D-175): do NOT "fix" it in a later formula sweep.
/** The formula inside a card, card-relative like the value (x 18) and the change chip: 12 px under the chip (which ends at 216 + 30 = 246 + 10) and 12 px above the card's inner foot (332); a card is 264 px wide inside its padding. */
const FORMULA_IN = { x: 18, y: 256, w: 264, h: 64 };
const CH = { x: 120, pitch: 118, barW: 64, popBase: 300, popMax: 170, errBase: 520, errMax: 150, rowTitleX: 64 };

const LABELS = {
  actual: frag('real', 'gerçek'), predicted: frag('predicted', 'tahmin'), abs: frag('absolute error', 'mutlak hata'), sq: frag('squared error', 'kare hata'),
  mae: frag('MAE', 'MAE'), maeHow: frag('mean of the absolute errors', 'mutlak hataların ortalaması'), rmse: frag('RMSE', 'RMSE'), rmseHow: frag('root of the mean of the squared errors', 'kare hataların ortalamasının karekökü'),
  bad: frag('one bad prediction', 'tek bir kötü tahmin'), maeWhy: frag('every error counts the same', 'her hata aynı sayılır'), rmseWhy: frag('a large error counts much more', 'büyük hata çok daha ağır sayılır'),
  popular: frag('popular items set the average', 'popüler öğeler ortalamayı belirler'), rare: frag('rare items: the error is larger', 'seyrek öğelerde hata büyür'),
  perItem: frag('ratings per item', 'öğe başına puan'), errorOf: frag('error', 'hata'), item: frag('item {i}', '{i}. öğe'),
  // WP-93 (D-177): the symbolic formulas of the two cards, alone (formula.js mark-up: the | bars of the absolute value are escaped as \| inside the fraction); the card names the measure, so there is no "MAE =" in front
  maeFormula: frag('frac(Σ \\|r − p\\||n)', 'frac(Σ \\|r − p\\||n)'), rmseFormula: frag('sqrt(frac(Σ (r − p)²|n))', 'sqrt(frac(Σ (r − p)²|n))'),
  legend: frag('r = real rating, p = predicted rating, n = number of pairs', 'r = gerçek puan, p = tahmin, n = çift sayısı'),
};
const PAIRS = [[4, 3.5], [3, 3.5], [5, 4.5], [2, 2.5], [4, 4.5], [3, 2.5]];
const POP = [120, 90, 60, 35, 20, 10, 6, 3];
const ERR = [0.4, 0.45, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5];

/** The params of the mode `errors`, merged into table-highlight's schema (the registry carries the whole). */
export const errorsSchema = {
  type: 'object', additionalProperties: false, title: 'the rating-error mode (mode errors)',
  description: '`pairs` are [real stars, predicted stars] (0..5, steps of the picture: up to six); `bad` is the pair that is added in press 3 (its error must be larger than every other). `popularity` (ratings per item, falling) and `error` (the mean error of the item, '
    + 'larger for the last item than for the first) draw the long tail of press 5, one pair of numbers per item (four to eight). All numbers are a toy; the picture carries no label.',
  default: { pairs: PAIRS, bad: [5, 2], popularity: POP, error: ERR, labels: LABELS },
  properties: {
    pairs: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 5 } }, default: PAIRS },
    bad: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 5 }, default: [5, 2] },
    popularity: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'number', minimum: 1 }, default: POP },
    error: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'number', minimum: 0 }, default: ERR },
    labels: labelsSchema(LABELS, '`item` holds {i} (the item\'s rank by popularity).'),
  },
};
export const errorsExamples = [{ mode: 'errors' }, { mode: 'errors', errors: { pairs: [[4, 3], [2, 3]], bad: [5, 1], popularity: [50, 20, 8, 3], error: [0.3, 0.6, 0.9, 1.4] } }];
export const errorsPresses = 5;

/** The mean absolute error of the errors (real - predicted). @param {number[]} errs @returns {number} */
export const mae = (errs) => errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
/** The root mean squared error of the errors. @param {number[]} errs @returns {number} */
export const rmse = (errs) => Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
/** The relative growth of a value, 0.714 for +71 %. @param {number} before @param {number} after @returns {number} */
export const growth = (before, after) => after / before - 1;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function errorsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.errors;
  /** @type {number[][]} */ const pairs = Q.pairs;
  const errs = pairs.map(([a, p]) => a - p);
  const worst = Math.max(...errs.map(Math.abs));
  const e7 = Q.bad[0] - Q.bad[1];
  if (Math.abs(e7) <= worst) bad('$.errors.bad', `has an error of ${Math.abs(e7)} stars, not larger than the largest of the pairs (${worst}): the bad prediction must be the worst`);
  else {
    const before = [mae(errs), rmse(errs)], all = [...errs, e7], after = [mae(all), rmse(all)];
    if (!(growth(before[1], after[1]) > growth(before[0], after[0]))) bad('$.errors.bad', 'does not move RMSE more than MAE: the page says it does');
  }
  if (Q.popularity.length !== Q.error.length) bad('$.errors.error', `has ${Q.error.length} numbers, popularity has ${Q.popularity.length}: one error per item`);
  else {
    /** @type {number[]} */ const pop = Q.popularity;
    for (let i = 1; i < pop.length; i++) if (pop[i] > pop[i - 1]) { bad('$.errors.popularity', `rises at item ${i + 1}: the items are ordered by popularity, falling (a long tail)`); break; }
    if (!(Q.error[Q.error.length - 1] > Q.error[0])) bad('$.errors.error', 'is not larger for the last item than for the first: the page says rare items have larger errors');
  }
  // WP-93: the symbolic formulas use the mark-up of formula.js; one that does not parse is refused with its place
  for (const key of ['maeFormula', 'rmseFormula']) {
    for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.[key] ?? {}))) {
      const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
      if (problem) bad(`$.errors.labels.${key}.${lang}`, problem);
    }
  }
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function errorsModel(P) {
  const Q = P.errors;
  /** @type {number[][]} */ const pairs = Q.pairs;
  const errs = pairs.map(([a, p]) => a - p), e7 = Q.bad[0] - Q.bad[1], all = [...errs, e7];
  const m = pairs.length, nTail = Q.popularity.length;
  const value = { mae0: mae(errs), rmse0: rmse(errs), mae1: mae(all), rmse1: rmse(all) };
  // WP-93: the two columns have their own room (150 px and 189 px of bar): 50 px per star and 21 px per star squared, scaled down only when the worst pair would not fit (an error of 4 is 16 stars squared)
  const worst = Math.max(...all.map(Math.abs));
  const scale = { abs: Math.min(BARS.abs.px, BARS.abs.max / worst), sq: Math.min(BARS.sq.px, BARS.sq.max / (worst * worst)) };
  const delta = { mae: growth(value.mae0, value.mae1), rmse: growth(value.rmse0, value.rmse1) };
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('tbl', { opacity: k <= 3 ? '1' : k === 4 ? '0.35' : '0' });
    f.set('he1', rise(k >= 1)); f.set('he2', rise(k >= 2));                  // WP-93: the absolute column stays when the squared one comes
    for (let i = 0; i < m; i++) { f.set(`ab:${i}`, grow(k >= 1)); f.set(`abl:${i}`, rise(k >= 1)); f.set(`sq:${i}`, grow(k >= 2)); f.set(`sql:${i}`, rise(k >= 2)); }
    f.set(`rw:${m}`, rise(k >= 3)); f.set('bt', rise(k >= 3)); f.set(`ab:${m}`, grow(k >= 3)); f.set(`abl:${m}`, rise(k >= 3)); f.set(`sq:${m}`, grow(k >= 3)); f.set(`sql:${m}`, rise(k >= 3));          // the bad pair is the row after the pairs (row m): both of its bars
    // WP-93 (D-177): the symbolic formulas inside the cards: the MAE one from press 1, the RMSE one from press 2; press 3 does not change them (only the values do); they go in press 4, when the words come; the legend goes with them
    f.set('mf', on(k >= 1 && k <= 3)); f.set('rf', on(k >= 2 && k <= 3)); f.set('lg', rise(k >= 1 && k <= 3));
    f.set('mc', rise(k >= 1 && k <= 4)); f.set('rc', rise(k >= 2 && k <= 4));
    f.set('mv0', on(k === 1 || k === 2)); f.set('mv1', on(k === 3 || k === 4)); f.set('rv0', on(k === 2)); f.set('rv1', on(k === 3 || k === 4));
    f.set('md', rise(k === 3 || k === 4)); f.set('rd', rise(k === 3 || k === 4)); f.set('mtx', on(k === 4)); f.set('rtx', on(k === 4));
    f.set('ch', on(k === 5)); f.set('ct1', rise(k === 5)); f.set('ct2', rise(k === 5)); f.set('t1', rise(k === 5)); f.set('t2', rise(k === 5));
    for (let i = 0; i < nTail; i++) { f.set(`pb:${i}`, grow(k === 5, 'y')); f.set(`eb:${i}`, grow(k === 5, 'y')); }
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    const gone = { start: 0, duration: 260 };
    switch (kind) {
      case 'tbl': return { start: 0, duration: 400 };
      case 'he1': return k === 1 ? { start: 100, duration: U } : gone;
      case 'he2': return { start: 100, duration: U };
      case 'ab': return i === m ? { start: 360, duration: 420 } : k === 1 ? { start: 120 + i * 90, duration: 420 } : gone;      // WP-93: the bad pair's absolute bar starts with its squared one (360)
      case 'abl': return i === m ? { start: 700, duration: U } : k === 1 ? { start: 120 + i * 90 + 200, duration: U } : gone;
      case 'mf': return k === 1 ? { start: 700, duration: U } : gone;                       // WP-93 (D-177): after its card (300 + 380) and its value (500 + 380) are in; it leaves in 260 ms in press 4
      case 'rf': return k === 2 ? { start: 700, duration: U } : gone;
      case 'lg': return k === 1 ? { start: 700, duration: U } : gone;
      case 'sq': return i === m ? { start: 360, duration: 560 } : k === 2 ? { start: 80 + i * 90, duration: 420 } : gone;
      case 'sql': return i === m ? { start: 700, duration: U } : k === 2 ? { start: 80 + i * 90 + 200, duration: U } : gone;
      case 'rw': return { start: 100, duration: U };
      case 'bt': return { start: 160, duration: U };
      case 'mc': return k === 1 ? { start: 300, duration: U } : { start: 0, duration: 300 };
      case 'rc': return k === 2 ? { start: 300, duration: U } : { start: 0, duration: 300 };
      case 'mv0': return k === 1 ? { start: 500, duration: U } : gone;
      case 'rv0': return k === 2 ? { start: 500, duration: U } : gone;
      case 'mv1': return k === 3 ? { start: 1000, duration: U } : gone;
      case 'rv1': return k === 3 ? { start: 1120, duration: U } : gone;
      case 'md': return k === 3 ? { start: 1240, duration: U } : gone;
      case 'rd': return k === 3 ? { start: 1360, duration: U } : gone;
      case 'mtx': return k === 4 ? { start: 300, duration: U } : gone;
      case 'rtx': return k === 4 ? { start: 450, duration: U } : gone;
      case 'ch': return { start: 200, duration: U };
      case 'ct1': return { start: 250, duration: U };
      case 'ct2': return { start: 850, duration: U };
      case 'pb': return { start: 300 + i * 70, duration: 420 };
      case 'eb': return { start: 900 + i * 70, duration: 420 };
      case 't1': return { start: 700, duration: U };
      case 't2': return { start: 1500, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { pairs, errs, e7, m, nTail, value, delta, scale, frame, timing, n: errorsPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `errors`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function errorsBuild(ctx, P) {
  const Q = P.errors, L = Q.labels;
  const M = errorsModel(P);
  const sc = scene(ctx, 'mx-root er-root');
  const { doc, box, put, add, say } = sc;
  const rowY = (/** @type {number} */ i) => ROW0 + i * PITCH;
  const D = 2;

  const tbl = h(doc, 'div', 'er-tbl');
  put('tbl', tbl, box(0, 0, 1680, 600));
  const head = (/** @type {string} */ key, /** @type {number} */ x, /** @type {number} */ w, /** @type {Record<string, string>} */ text, /** @type {boolean} */ keyed) => {
    const el = say(h(doc, 'div', 'er-head'), text);
    return keyed ? put(key, el, box(x, 62, w, 36), tbl) : add(el, box(x, 62, w, 36), tbl);
  };
  head('ha', COL.actual, 230, L.actual, false); head('hp', COL.predicted, 230, L.predicted, false);
  head('he1', BARS.abs.x, 230, L.abs, true); head('he2', BARS.sq.x, 230, L.sq, true);      // WP-93: side by side

  const rows = [...M.pairs, [Q.bad[0], Q.bad[1]]];
  rows.forEach(([a, p], i) => {
    const row = h(doc, 'div', 'er-row');
    const posterEl = poster(doc, [4, 8, 1, 5, 9, 3, 6][i % 7], 44, 44, 22);
    posterEl.style.cssText += ';position:absolute;left:0;top:4px';
    row.append(posterEl);
    for (const [x, v, cls] of /** @type {Array<[number, number, string]>} */ ([[COL.actual - COL.poster, a, 'er-a'], [COL.predicted - COL.poster, p, 'er-p']])) {
      const cell = h(doc, 'div', `er-stars ${cls}`);
      cell.style.cssText = `left:${x}px;top:${ROW_H / 2 - 12}px`;
      cell.append(starRow(doc, v, 24, 3, ''));
      const n = h(doc, 'span', 'er-num');
      ctx.setText(n, num(v, 1));
      cell.append(n);
      row.append(cell);
    }
    if (i === M.m) put(`rw:${i}`, row, box(COL.poster, rowY(i), 540, ROW_H), tbl); else add(row, box(COL.poster, rowY(i), 540, ROW_H), tbl);
    // the bars (WP-93: side by side): absolute (one bar per pair, 50 px per star) and squared (21 px per star squared), the number at the bar's end
    const e = Math.abs(a - p);
    const absW = Math.max(3, Math.round(e * M.scale.abs)), sqW = Math.max(3, Math.round(e * e * M.scale.sq));
    put(`ab:${i}`, h(doc, 'div', 'er-bar er-abs', { 'data-gfx': 'fill' }), `${box(BARS.abs.x, rowY(i) + 10, absW, 32)};transform-origin:0 50%`, tbl);          // WP-93: the bad pair has an absolute bar too
    put(`abl:${i}`, say(h(doc, 'div', 'er-val'), num(e, 2)), `left:${BARS.abs.x + absW + 12}px;top:${rowY(i)}px;height:${ROW_H}px`, tbl);
    put(`sq:${i}`, h(doc, 'div', 'er-bar er-sq', { 'data-gfx': 'fill' }), `${box(BARS.sq.x, rowY(i) + 10, sqW, 32)};transform-origin:0 50%`, tbl);
    put(`sql:${i}`, say(h(doc, 'div', 'er-val'), num(e * e, 2)), `left:${BARS.sq.x + sqW + 12}px;top:${rowY(i)}px;height:${ROW_H}px`, tbl);
  });
  put('bt', say(h(doc, 'div', 'er-bad', { 'data-role': 'neg' }), L.bad), `left:${BARS.abs.x}px;top:${rowY(M.m) + ROW_H + 4}px`, tbl);               // under the bad pair's bar: text, the negative role and its cue

  // the two cards
  // WP-93 (D-177): the symbolic formula of a card stands INSIDE the card (see FORMULA_IN: symbolic only, no numbers, a page-level exception to D-174); `fk` is its key and `fl` its label
  const card = (/** @type {string} */ key, /** @type {number} */ i, /** @type {Record<string, string>} */ name, /** @type {Record<string, string>} */ how, /** @type {string} */ k0, /** @type {string|null} */ k1, /** @type {Record<string, string>} */ v0, /** @type {Record<string, string>} */ v1, /** @type {number} */ dv, /** @type {string} */ dk, /** @type {Record<string, string>} */ why, /** @type {string} */ wk, /** @type {string} */ fk, /** @type {Record<string, string>} */ fl) => {
    const el = h(doc, 'div', `er-card er-card-${key}`, { 'aria-hidden': 'true' });
    el.append(say(h(doc, 'div', 'er-card-name'), name), say(h(doc, 'div', 'er-card-how'), how));
    put(key === 'm' ? 'mc' : 'rc', el, box(CARD.x0 + i * (CARD.w + CARD.gap), CARD.y, CARD.w, CARD.h));
    put(k0, say(h(doc, 'div', 'er-card-val'), v0), 'left:18px;top:132px', el);
    put(/** @type {string} */ (k1), say(h(doc, 'div', 'er-card-val'), v1), 'left:18px;top:132px', el);
    put(dk, say(h(doc, 'div', 'er-delta'), { en: `+${fmt(dv * 100, 0, 'en')}%`, tr: `+%${fmt(dv * 100, 0, 'tr')}` }), 'left:18px;top:216px', el);
    put(wk, say(h(doc, 'div', 'er-card-why'), why), 'left:18px;top:256px;width:264px', el);
    const fm = say(h(doc, 'div', 'er-formula', { 'aria-hidden': 'true' }), fl);
    renderFormula(doc, fm);
    put(fk, fm, box(FORMULA_IN.x, FORMULA_IN.y, FORMULA_IN.w, FORMULA_IN.h), el);
  };
  card('m', 0, L.mae, L.maeHow, 'mv0', 'mv1', num(M.value.mae0, D), num(M.value.mae1, D), M.delta.mae, 'md', L.maeWhy, 'mtx', 'mf', L.maeFormula);
  card('r', 1, L.rmse, L.rmseHow, 'rv0', 'rv1', num(M.value.rmse0, D), num(M.value.rmse1, D), M.delta.rmse, 'rd', L.rmseWhy, 'rtx', 'rf', L.rmseFormula);
  put('lg', say(h(doc, 'div', 'er-legend'), L.legend), box(LEGEND.x, LEGEND.y, LEGEND.w, 32));

  // press 5: the long tail and the error that grows with it
  const ch = h(doc, 'div', 'er-ch');
  put('ch', ch, box(0, 0, 1680, 600));
  put('ct1', say(h(doc, 'div', 'er-ct'), L.perItem), `left:${CH.rowTitleX}px;top:${CH.popBase - CH.popMax - 44}px`, ch);
  put('ct2', say(h(doc, 'div', 'er-ct'), L.errorOf), `left:${CH.rowTitleX}px;top:${CH.errBase - CH.errMax - 44}px`, ch);
  const maxPop = Math.max(...Q.popularity), maxErr = Math.max(...Q.error);
  for (let i = 0; i < M.nTail; i++) {
    const x = CH.x + i * CH.pitch;
    const ph = Math.max(4, Math.round(Q.popularity[i] / maxPop * CH.popMax)), eh = Math.max(4, Math.round(Q.error[i] / maxErr * CH.errMax));
    put(`pb:${i}`, h(doc, 'div', 'er-pop', { 'data-gfx': 'fill' }), `${box(x, CH.popBase - ph, CH.barW, ph)};transform-origin:50% 100%`, ch);
    put(`eb:${i}`, h(doc, 'div', 'er-err', { 'data-gfx': 'fill' }), `${box(x, CH.errBase - eh, CH.barW, eh)};transform-origin:50% 100%`, ch);
    add(say(h(doc, 'div', 'er-itm'), fillFrag(L.item, { i: i + 1 })), `left:${x - 12}px;top:${CH.errBase + 8}px;width:${CH.barW + 24}px`, ch);
  }
  put('t1', say(h(doc, 'div', 'er-note', { 'data-role': 'emph' }), L.popular), 'left:1070px;top:150px;width:560px', ch);
  put('t2', say(h(doc, 'div', 'er-note', { 'data-role': 'neg' }), L.rare), 'left:1070px;top:380px;width:560px', ch);

  return finish(ctx, sc, M.n, M.frame, M.timing);
}
