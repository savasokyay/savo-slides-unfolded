// @ts-check
// WP-50 (D-112, brief 07; page s7 `families` of the I2RS w06 deck): the mode `families` of compare, a support module like table-matrix.js of table-highlight. The three families of ensembles, one schematic picture each, and
// what they become for rating matrices. Every picture is a drawing with INVENTED values (three predictions and their mean, the shades of a strip of predictions, the weights of the dots, the cells of a matrix); they are plainly an
// example, so the pictures carry no label (D-129; D-127 had a tag "synthetic data", the speaker note and the evidence record say so now).
// WP-89 (D-158; the user's own design, tried in prototypes/families-bagging): a deliberately dark, closed BLACK BOX stands for "the method" (an icon and a short text; class `bb`, its own token pair --black-box and
// --black-box-ink), so the pictures say what the method is: the SAME one in bagging and boosting, a DIFFERENT one in every row of stacking. The data stays where it was; only the boxes and the arrows around them changed.
//   0 the stage: the data, eight film markers A .. H in a row
//   1 bagging   three resamples of the data, WITH replacement (R1 A A C D D F G H, R2 B C C E F G G H, R3 A B D E E F H H: a marker may come twice, another not at all) enter ONE shared black box "same method"; a line under
//               it says "each sample is trained on its own" (the box is not a pool), and a model of its own leaves it at the height the sample entered (sample 1 -> M1, 2 -> M2, 3 -> M3); the three predictions
//               (synthetic: 3.6, 4.0, 4.4) are averaged into one (4.0)                                                                  (Breiman 1996, p. 123)
//   2 boosting  a chain of three stages, each the SAME black box "same method" and the model it makes (M1, M2, M3), the order matters: the examples the first model got wrong are ringed and GROW in the next stage (the
//               size of a dot is its weight), the second model's mistakes grow in the third; the weight ACCUMULATES: example 1 is wrong in both models, so it is two steps bigger (56 px against 28) by the third stage;
//               a key under the picture says "ring: wrong, bigger dot: higher weight"; a weighted vote ends the chain                    (Freund and Schapire 1997, p. 131)
//   3 stacking  the SAME data in three rows, each into a DIFFERENT black box (kNN, MF, tree: another name and another icon), their predictions as three strips of cells, a second-level learner that reads them, one prediction
//                                                                                                                                      (Sill et al. 2009, p. 1)
//   4 matrix    the same ideas for rating matrices, three small boxes side by side: single ratings resampled from the matrix (a repeated cell is double-framed; this one is bagging), k of 2k neighbours picked at random
//               for a user and two different random starts of a matrix factorization (these two are randomness injection, a group of their own)           (Bar et al. 2013, preprint pp. 5-9)
// Every number is written in the form of the language on screen (`oneDecimal`: EN "3.6", TR "3,6").
// A picture comes in and the one before it goes out (the data row stays through press 1, the source of the resamples).
//
// duration(k) = planDuration(plan(k)): every element has its own start and length written where it is made (`when`), the press ends with the last of them. WP-89 moved elements but kept the last one of every press where it was:
//   1 bagging 1520 ms (the last of three rows 120 + 2 * 160, then 700 for the converging arrow and the average, + 380)   2 boosting 1460 ms (120 + 2 * 320 + 320 for the vote, + 380)
//   3 stacking 1680 ms (120 + 2 * 160 + 860 for the output, + 380)   4 matrix 1020 ms (120 + 2 * 220 for the last card, + 460)   (measured: the browser reports the same; tests/js/widgets-story.html holds them)
// Motion: opacity and transform only (a thing pops or rises; the weight of a boosted example is a scale that is already there, so it never animates a size).
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon } from './pictos.js';

const W = 1680, H = 600;
// WP-89: the chips of a row stand 60 px apart (they were 72) and start at x 100 (they were 130): the black box and the columns after it fit into the 1680 px of the picture
const CHIP = 52, PITCH = 60, DX = 100, DY = 40;

/**
 * WP-89 (D-158): the grid of the bagging and stacking pictures in design px, measured in prototypes/families-bagging (layout.mjs, with the text widths of measure-text.py): the sample rows are at `ys`, a black box is
 * 232 wide (its icon 30 + 10 + the widest name, 156.1 for "same method", + 2 x (border 4 + padding 12) = 228.1, rounded up to a multiple of 4) and 76 high, a model 100 x 76, a prediction pill 90 x 56, the average and the
 * learner 190 x 160, the output pill 196 x 64 ("one prediction" is 167.4 + 2 x (3 + 10)); arrows are 40 px with 6 px of air at both ends, the fan-in arrow 60 px.
 */
export const GRID = Object.freeze({ ys: Object.freeze([190, 300, 410]), bbW: 232, bbH: 76, mW: 100, pillW: 90, pillH: 56, sW: 190, sH: 160, outW: 196, outH: 64, arrow: 40, gap: 6, fan: 60 });
/** The x of the columns of the bagging picture, left to right (chips, arrow, black box, arrow, model, arrow, prediction, fan-in arrow, average or learner); a number by hand: DX + 7 x PITCH + CHIP = 572. */
export const X = Object.freeze((() => {
  const chipsR = DX + 7 * PITCH + CHIP;
  const a1 = chipsR + GRID.gap, a1e = a1 + GRID.arrow, bb = a1e + GRID.gap, bbR = bb + GRID.bbW;
  const a2 = bbR + GRID.gap, a2e = a2 + GRID.arrow, m = a2e + GRID.gap, mR = m + GRID.mW;
  const a3 = mR + GRID.gap, a3e = a3 + GRID.arrow, p = a3e + GRID.gap, pR = p + GRID.pillW;
  const a4 = pR + GRID.gap, a4e = a4 + GRID.fan, avg = a4e + GRID.gap, avgR = avg + GRID.sW;
  return { chipsR, a1, a1e, bb, bbR, a2, a2e, m, mR, a3, a3e, p, pR, a4, a4e, avg, avgR };
})());
/** The left edges of the three stages of the boosting picture: a stage is box 232 + 6 + arrow 40 + 6 + model 100 = 384 wide, then 6 + 40 + 6 to the next box. */
export const BOOST_X = Object.freeze([40, 476, 912]);
/** The stacking strips (WP-89 kept the 6-cell strips of the predictions): they start where the models of bagging stand, a cell is 32 px on a 40 px pitch. */
export const STRIP = Object.freeze({ x: X.m, cell: 32, pitch: 40, cols: 6 });

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const LABELS = {
  data: frag('the data', 'veri'), resample: frag('sampled with replacement', 'yerine koyarak örneklenir'), average: frag('average', 'ortalama'),
  bagging: frag('Bagging', 'Bagging'), boosting: frag('Boosting', 'Boosting'), stacking: frag('Stacking', 'Yığınlama'), matrix: frag('Rating matrices', 'Puan matrisleri'),
  vote: frag('weighted vote', 'ağırlıklı oy'), learner: frag('second-level learner', 'ikinci düzey öğrenen'), output: frag('one prediction', 'tek tahmin'),
  resampleRatings: frag('resample the ratings', 'puanları yeniden örnekle'), neighbours: frag('k of the 2k nearest, at random', 'en yakın 2k komşudan rastgele k'), starts: frag('two random starts', 'iki rastgele başlangıç'),
  // WP-50: the key of the boosting picture, the heading of the stacking strips and of the two groups of the matrix picture (content-agent's review of package D)
  legend: frag('ring: wrong · bigger dot: higher weight', 'halka: yanlış · büyük nokta: yüksek ağırlık'),
  predictions: frag('predictions', 'tahminler'),
  injection: frag('randomness injection', 'rastgelelik enjeksiyonu'),
  // WP-89 (D-158): the black box ("same method" in bagging and boosting; a method's name in stacking), the line under the shared box of bagging and the note under the data row of stacking
  method: frag('same method', 'aynı yöntem'), each: frag('each sample is trained on its own', 'her örnek ayrı eğitilir'), sameData: frag('the same data, three different methods', 'aynı veri, üç farklı yöntem'),
  knn: frag('kNN', 'kNN'), mf: frag('MF', 'MF'), tree: frag('tree', 'ağaç'),
};
const DATA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const RESAMPLES = ['AACDDFGH', 'BCCEFGGH', 'ABDEEFHH'];
const PREDICTIONS = [3.6, 4.0, 4.4];
// WP-50: example 1 is wrong in BOTH models, so it is the heaviest (the weight of an example grows each time it stays wrong: Freund and Schapire 1997, p. 14 of the author copy)
const WRONG = [[1, 6, 10], [1, 3, 8]];
/** The ratings resampled in the first box of the matrix picture, "row:film" in a 5 x 6 matrix; 3:3 is drawn twice, so it is double-framed. */
const CELLS = ['0:1', '0:4', '1:0', '1:3', '2:2', '2:5', '3:1', '3:3', '3:3', '4:0', '4:4', '4:5'];
const START_A = '241032410324103', START_B = '012340123401234';           // two different shadings of a 4 x 4 factor (rows of 4: 0 light .. 4 dark), the same length

/** The params of the mode `families`, merged into compare's schema (the registry carries the whole). */
export const familiesSchema = {
  type: 'object', additionalProperties: false, title: 'the families mode (mode families)',
  description: '`data` are the markers of the data; `resamples` one string of markers per resample (letters of `data`, a letter may come twice or not at all: sampling with replacement); `predictions` one synthetic number per resample (their mean is shown); `wrong` the examples (0..examples-1) the first and the second boosted model get wrong; `cells` the ratings resampled in the matrix picture ("row:film" in a 5 x 6 matrix, one may come twice).',
  default: { data: DATA, resamples: RESAMPLES, predictions: PREDICTIONS, examples: 12, wrong: WRONG, cells: CELLS, labels: LABELS },
  properties: {
    data: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 1 }, default: DATA },
    resamples: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string', minLength: 3, maxLength: 8 }, default: RESAMPLES },
    predictions: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 5 }, default: PREDICTIONS },
    examples: { type: 'integer', minimum: 6, maximum: 12, default: 12 },
    wrong: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'integer', minimum: 0, maximum: 11 } }, default: WRONG },
    cells: { type: 'array', minItems: 4, maxItems: 14, items: { type: 'string' }, default: CELLS },
    labels: {
      type: 'object', additionalProperties: false, default: LABELS, title: 'the short labels of the pictures',
      properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, { ...FRAGMENT, default: v }])),
    },
  },
};

/** The example of the mode: the lecture's page. */
export const familiesExamples = [{ mode: 'families' }];

/** The mean of the predictions (the number the average box shows). @param {number[]} xs @returns {number} */
export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** The markers of `data` a resample does not hold (the out-of-bag ones). @param {string} sample @param {string[]} data @returns {string[]} */
export const leftOut = (sample, data) => data.filter((d) => !sample.includes(d));
/** A number with one decimal in the form of each language (EN "3.6", TR "3,6"); the same rule as every number on a slide. @param {number} x @returns {{en: string, tr: string}} */
export const oneDecimal = (x) => ({ en: x.toFixed(1), tr: x.toFixed(1).replace('.', ',') });

/**
 * What the picture needs of the params and the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function familiesProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const F = P.families;
  if (new Set(F.data).size !== F.data.length) bad('$.families.data', 'has a marker twice: the markers of the data are told apart');
  F.resamples.forEach((/** @type {string} */ r, /** @type {number} */ i) => { const stray = [...r].filter((ch) => !F.data.includes(ch)); if (stray.length) bad(`$.families.resamples[${i}]`, `holds ${stray.map((x) => `"${x}"`).join(', ')}, not a marker of the data (${F.data.join('')})`); });
  if (F.predictions.length !== F.resamples.length) bad('$.families.predictions', `has ${F.predictions.length} numbers, there are ${F.resamples.length} resamples: one prediction for each model`);
  F.wrong.forEach((/** @type {number[]} */ w, /** @type {number} */ i) => { if (w.some((x) => x >= F.examples)) bad(`$.families.wrong[${i}]`, `names an example the stage does not have (examples: ${F.examples})`); if (new Set(w).size !== w.length) bad(`$.families.wrong[${i}]`, 'names an example twice'); });
  F.cells.forEach((/** @type {string} */ c, /** @type {number} */ i) => { const m = /^([0-4]):([0-5])$/.exec(c); if (!m) bad(`$.families.cells[${i}]`, `"${c}" is not "row:film" in a 5 x 6 matrix (row 0..4, film 0..5)`); });
  return out;
}

/**
 * The picture of the mode `families`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of compare
 * @returns {import('./kit.js').WidgetBuild}
 */
export function familiesBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const F = P.families, L = F.labels;
  /** @type {string[]} */ const data = F.data, resamples = F.resamples;
  /** @type {number[]} */ const predictions = F.predictions;
  const n = 4;

  const root = h(doc, 'div', 'w-root fm-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @type {Map<string, {start: number, duration: number}>} */
  const when = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {Element} el @param {string} css @param {[number, number]} t [start, duration] @param {Element} [parent] */
  const put = (key, el, css, t, parent) => { /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); when.set(key, { start: t[0], duration: t[1] }); (parent ?? root).append(el); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  /** A text label. @param {Record<string, string>} text @param {string} css @param {string} [cls] @param {string} [role] */
  const label = (text, css, cls = 'fm-lbl', role = '') => { const e = h(doc, 'div', cls, role ? { 'data-role': role } : {}); e.style.cssText = css; return say(e, text); };
  const chip = (/** @type {string} */ letter) => { const c = h(doc, 'div', 'fm-chip', { 'aria-hidden': 'true' }); c.textContent = letter; return c; };
  /** An arrow as a path (a line and a head) in an SVG layer. @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  const arrowD = (x1, y1, x2, y2) => { const a = Math.atan2(y2 - y1, x2 - x1), p = (/** @type {number} */ d) => `${+(x2 - 15 * Math.cos(a + d)).toFixed(1)} ${+(y2 - 15 * Math.sin(a + d)).toFixed(1)}`; return `M${x1} ${y1}L${x2} ${y2}M${p(0.5)}L${x2} ${y2}L${p(-0.5)}`; };
  /** One picture: a group that comes in and goes out, with an SVG layer for its arrows. @param {number} i @returns {{g: HTMLElement, svg: Element}} */
  const picture = (i) => {
    const g = h(doc, 'div', 'fm-pic', { 'aria-hidden': 'true' });
    const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}` });
    g.append(svg);
    put(`pic:${i}`, g, '', [0, 300]);
    return { g, svg };
  };
  /** An arrow of a picture, popping at `t`. @param {Element} svg @param {string} key @param {string} d @param {[number, number]} t */
  const arrow = (svg, key, d, t) => put(key, s(doc, 'path', { class: 'fm-arrow', d }), '', t, svg);
  /**
   * WP-89 (D-158): the BLACK BOX, the method: a deliberately dark, closed box with an icon and a short text (class `bb`; a tall one when one box serves several rows). The same icon and text in every box of bagging and
   * boosting ("same method"), another icon and name in each row of stacking.
   * @param {'items'|'users'|'matrix'|'tree'} name the icon @param {Record<string, string>} text @param {boolean} [tall]
   */
  const blackBox = (name, text, tall = false) => {
    const b = h(doc, 'div', `bb${tall ? ' bb-tall' : ''}`);
    b.append(icon(doc, name, tall ? 40 : 30), say(h(doc, 'span', 'bb-name'), text));
    return b;
  };
  /** A model box: M1, M2, M3 (WP-89: the text only; the black box before it says what made it). @param {number} i */
  const model = (i) => { const md = h(doc, 'div', 'fm-model'); md.textContent = `M${i + 1}`; return md; };
  const yc = GRID.ys.map((y) => y + CHIP / 2);                        // the centres of the three sample rows

  // ---------- the stage: the data (states 0 and 1) ----------
  const dt = h(doc, 'div', 'fm-pic', { 'aria-hidden': 'true' });
  data.forEach((letter, i) => { const c = chip(letter); c.style.cssText += `;${box(DX + i * PITCH, DY, CHIP, CHIP)}`; dt.append(c); });
  dt.append(label(L.data, `left:${DX + data.length * PITCH + 14}px;top:${DY + 8}px;width:300px`, 'fm-lbl fm-soft'));
  put('dt', dt, '', [0, 300]);

  // ---------- 1 bagging ----------
  {
    const { g, svg } = picture(1);
    root.append(g);
    g.append(label(L.bagging, 'left:0;top:-4px;width:260px', 'fm-title', 'term'));
    // the ONE black box all samples enter (it spans the rows: sample i enters at the height where model i leaves) with its line under it, which comes in with the first sample's arrow
    const bbTop = yc[0] - GRID.bbH / 2, bbHeight = yc[resamples.length - 1] + GRID.bbH / 2 - bbTop;
    put('bbx', blackBox('items', L.method, true), box(X.bb, bbTop, GRID.bbW, bbHeight), [240, 380], g);
    put('bn', label(L.each, `left:${X.bb + GRID.bbW / 2 - 200}px;top:${bbTop + bbHeight + 8}px;width:400px`, 'fm-lbl bb-each'), '', [240, 380], g);
    resamples.forEach((sample, i) => {
      const t0 = 120 + i * 160, y = yc[i];
      const row = h(doc, 'div', 'fm-row');
      [...sample].forEach((letter, j) => { const c = chip(letter); c.style.cssText += `;${box(DX + j * PITCH, 0, CHIP, CHIP)}`; row.append(c); });
      put(`rs:${i}`, row, `left:0;top:${GRID.ys[i]}px;width:${W}px;height:${CHIP}px`, [t0, 380], g);
      const xb = DX - 30 - i * 16;
      arrow(svg, `ab:${i}`, `M${DX - 6} ${DY + CHIP / 2}H${xb}V${y}H${DX - 10}M${DX - 24} ${y - 12}L${DX - 8} ${y}L${DX - 24} ${y + 12}`, [t0, 380]);
      arrow(svg, `am:${i}`, arrowD(DX + (sample.length - 1) * PITCH + CHIP + GRID.gap, y, X.a1e, y), [t0 + 120, 380]);
      arrow(svg, `bo:${i}`, arrowD(X.a2, y, X.a2e, y), [t0 + 300, 380]);
      put(`md:${i}`, model(i), box(X.m, y - GRID.bbH / 2, GRID.mW, GRID.bbH), [t0 + 300, 380], g);
      arrow(svg, `ap:${i}`, arrowD(X.a3, y, X.a3e, y), [t0 + 500, 380]);
      const pr = h(doc, 'div', 'fm-pill');
      say(pr, oneDecimal(predictions[i]));
      put(`pr:${i}`, pr, box(X.p, y - GRID.pillH / 2, GRID.pillW, GRID.pillH), [t0 + 500, 380], g);
      arrow(svg, `aa:${i}`, arrowD(X.a4, y, X.a4e, 300 + (y - 300) * 0.25), [t0 + 700, 380]);
    });
    const avg = h(doc, 'div', 'fm-avg');
    avg.append(say(h(doc, 'div', 'fm-avgnum'), oneDecimal(mean(predictions))), say(h(doc, 'div', 'fm-avgsub'), L.average));
    put('av', avg, box(X.avg, 300 - GRID.sH / 2, GRID.sW, GRID.sH), [120 + 2 * 160 + 700, 380], g);
    g.append(label(L.resample, `left:${DX}px;top:${DY + CHIP + 22}px;width:420px`, 'fm-lbl fm-soft'));
  }

  // ---------- 2 boosting ----------
  {
    const { g, svg } = picture(2);
    root.append(g);
    g.append(label(L.boosting, 'left:0;top:-4px;width:260px', 'fm-title', 'term'));
    const MY = 120, FY = 250, DOT = 28, DP = 62, COLS_PER_ROW = 4;
    const mid = MY + GRID.bbH / 2;
    const examples = F.examples;
    /** The size of an example's dot in stage k (1 .. 3): it grows by a step each time a model before it got it wrong. */
    const timesWrong = (/** @type {number} */ e, /** @type {number} */ stage) => F.wrong.slice(0, stage - 1).filter((/** @type {number[]} */ w) => w.includes(e)).length;
    const modelX = BOOST_X.map((x) => x + GRID.bbW + GRID.gap + GRID.arrow + GRID.gap);        // 324, 760, 1196
    BOOST_X.forEach((sx, i) => {
      const t0 = 120 + i * 320;
      // the SAME black box in every stage, the model it makes after it, and the arrow that carries on to the next stage's box (the order matters)
      put(`bm:${i}`, blackBox('items', L.method), box(sx, MY, GRID.bbW, GRID.bbH), [t0, 380], g);
      arrow(svg, `bq:${i}`, arrowD(sx + GRID.bbW + GRID.gap, mid, modelX[i] - GRID.gap, mid), [t0 + 160, 380]);
      put(`bmd:${i}`, model(i), box(modelX[i], MY, GRID.mW, GRID.bbH), [t0 + 160, 380], g);
      if (i < BOOST_X.length - 1) arrow(svg, `ac:${i}`, arrowD(modelX[i] + GRID.mW + GRID.gap, mid, BOOST_X[i + 1] - GRID.gap, mid), [t0 + 260, 380]);
      const cx = sx + GRID.bbW / 2;                                                            // the examples stand under their own box
      const field = h(doc, 'div', 'fm-field');
      for (let e = 0; e < examples; e++) {
        const r = Math.floor(e / COLS_PER_ROW), c = e % COLS_PER_ROW;
        const grown = timesWrong(e, i + 1);
        const d = DOT + grown * 14;
        const dot = h(doc, 'i', 'fm-dot');
        dot.style.cssText = `left:${cx - (COLS_PER_ROW * DP) / 2 + c * DP + (DP - d) / 2}px;top:${FY + r * DP + (DP - d) / 2}px;width:${d}px;height:${d}px`;
        field.append(dot);
        if (i < 2 && F.wrong[i].includes(e)) {
          const ring = h(doc, 'i', 'fm-ring');
          ring.style.cssText = `left:${cx - (COLS_PER_ROW * DP) / 2 + c * DP + (DP - d) / 2 - 8}px;top:${FY + r * DP + (DP - d) / 2 - 8}px;width:${d + 16}px;height:${d + 16}px`;
          field.append(ring);
        }
      }
      put(`bf:${i}`, field, `left:0;top:0;width:${W}px;height:${H}px`, [t0 + 120, 460], g);
    });
    // the vote ends the chain (WP-89: the arrow has a key of its own, `bav`; before it shared "av" with the bagging average and was on from press 1)
    const voteX = modelX[2] + GRID.mW + GRID.gap + GRID.arrow + GRID.gap;
    arrow(svg, 'bav', arrowD(modelX[2] + GRID.mW + GRID.gap, mid, voteX - GRID.gap, mid), [120 + 2 * 320 + 260, 380]);
    const vote = h(doc, 'div', 'fm-vote');
    vote.append(icon(doc, 'sliders', 56), say(h(doc, 'span', ''), L.vote));
    put('bv', vote, box(voteX, 90, 260, 140), [120 + 2 * 320 + 320, 380], g);
    // the key: a ring means "got it wrong", a bigger dot "a higher weight" (the picture says it before the caption does; part of the picture, no timing of its own)
    g.append(label(L.legend, 'left:0;top:500px;width:560px', 'fm-lbl fm-soft'));
  }

  // ---------- 3 stacking ----------
  {
    const { g, svg } = picture(3);
    root.append(g);
    g.append(label(L.stacking, 'left:0;top:-4px;width:260px', 'fm-title', 'term'));
    // WP-89: the SAME data in every row (the stage's own row has gone in press 3, so the picture carries a copy), each row into a DIFFERENT black box
    const sdt = h(doc, 'div', 'fm-pic', { 'aria-hidden': 'true' });
    data.forEach((letter, i) => { const c = chip(letter); c.style.cssText += `;${box(DX + i * PITCH, DY, CHIP, CHIP)}`; sdt.append(c); });
    sdt.append(label(L.data, `left:${DX + data.length * PITCH + 14}px;top:${DY + 8}px;width:300px`, 'fm-lbl fm-soft'));
    put('sdt', sdt, '', [120, 380], g);
    g.append(label(L.sameData, `left:${DX}px;top:${DY + CHIP + 22}px;width:460px`, 'fm-lbl fm-soft'));
    const cellsR = STRIP.x + (STRIP.cols - 1) * STRIP.pitch + STRIP.cell;                       // the right edge of a strip: 908 + 5 x 40 + 32 = 1140
    const lx = cellsR + GRID.gap + GRID.fan + GRID.gap, ly = 300 - GRID.sH / 2;                // the learner: 1212, 220
    g.append(label(L.predictions, `left:${STRIP.x}px;top:${yc[0] - STRIP.cell / 2 - 40}px;width:${STRIP.cols * STRIP.pitch}px`, 'fm-lbl fm-soft'));
    /** @type {Array<['users'|'matrix'|'tree', Record<string, string>]>} */
    const methods = [['users', L.knn], ['matrix', L.mf], ['tree', L.tree]];
    methods.forEach(([iconName, name], i) => {
      const t0 = 120 + i * 160, y = yc[i];
      const row = h(doc, 'div', 'fm-row');
      data.forEach((letter, j) => { const c = chip(letter); c.style.cssText += `;${box(DX + j * PITCH, 0, CHIP, CHIP)}`; row.append(c); });
      put(`sr:${i}`, row, `left:0;top:${GRID.ys[i]}px;width:${W}px;height:${CHIP}px`, [t0, 380], g);
      const xb = DX - 30 - i * 16;
      arrow(svg, `sab:${i}`, `M${DX - 6} ${DY + CHIP / 2}H${xb}V${y}H${DX - 10}M${DX - 24} ${y - 12}L${DX - 8} ${y}L${DX - 24} ${y + 12}`, [t0, 380]);
      arrow(svg, `sa:${i}`, arrowD(DX + (data.length - 1) * PITCH + CHIP + GRID.gap, y, X.a1e, y), [t0 + 120, 380]);
      put(`sb:${i}`, blackBox(iconName, name), box(X.bb, y - GRID.bbH / 2, GRID.bbW, GRID.bbH), [t0 + 120, 380], g);
      arrow(svg, `as:${i}`, arrowD(X.a2, y, STRIP.x - GRID.gap, y), [t0 + 300, 380]);
      const strip = h(doc, 'div', 'fm-strip');
      for (let c = 0; c < STRIP.cols; c++) {
        const cell = h(doc, 'i', 'fm-cell');
        cell.style.cssText = `${box(c * STRIP.pitch, 0, STRIP.cell, STRIP.cell)};background:color-mix(in srgb,var(--emph) ${[20, 55, 85, 35, 70, 45][(c + i * 2) % 6]}%,var(--ground))`;
        strip.append(cell);
      }
      put(`sp:${i}`, strip, `left:${STRIP.x}px;top:${y - STRIP.cell / 2}px;width:${STRIP.cols * STRIP.pitch}px;height:${STRIP.cell}px`, [t0 + 400, 380], g);
      arrow(svg, `al:${i}`, arrowD(cellsR + GRID.gap, y, lx - GRID.gap, 300 + (y - 300) * 0.25), [t0 + 700, 380]);
    });
    const lr = h(doc, 'div', 'fm-learner');
    lr.append(icon(doc, 'sliders', 40), say(h(doc, 'span', ''), L.learner));
    put('sl', lr, box(lx, ly, GRID.sW, GRID.sH), [120 + 2 * 160 + 700, 380], g);
    arrow(svg, 'ao', arrowD(lx + GRID.sW + GRID.gap, 300, lx + GRID.sW + GRID.gap + GRID.arrow, 300), [120 + 2 * 160 + 760, 380]);
    const out = h(doc, 'div', 'fm-pill fm-out');
    out.append(say(h(doc, 'span', ''), L.output));
    put('so', out, box(lx + GRID.sW + GRID.gap + GRID.arrow + GRID.gap, 300 - GRID.outH / 2, GRID.outW, GRID.outH), [120 + 2 * 160 + 860, 380], g);
  }

  // ---------- 4 the same ideas for rating matrices ----------
  {
    const { g } = picture(4);
    root.append(g);
    g.append(label(L.matrix, 'left:0;top:-4px;width:360px', 'fm-title', 'term'));
    const CARD_W = 500, CARD_Y = 80, CARD_H = 440, XS = [40, 590, 1140];
    const titles = [L.resampleRatings, L.neighbours, L.starts];
    // the first card is bagging (resampling), the other two are randomness injection (Bar et al. 2013): two group headings above the cards (part of the picture)
    g.append(label(L.bagging, `left:${XS[0]}px;top:34px;width:${CARD_W}px`, 'fm-lbl fm-group'), label(L.injection, `left:${XS[1]}px;top:34px;width:${XS[2] + CARD_W - XS[1]}px`, 'fm-lbl fm-group'));
    XS.forEach((x, i) => {
      const card = h(doc, 'div', 'fm-card');
      card.append(say(h(doc, 'div', 'fm-cardtitle'), titles[i]));
      const body = h(doc, 'div', 'fm-cardbody');
      if (i === 0) {
        /** @type {Map<string, number>} */ const count = new Map();
        for (const c of F.cells) count.set(c, (count.get(c) ?? 0) + 1);
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 6; c++) {
            const k = count.get(`${r}:${c}`) ?? 0;
            const cell = h(doc, 'i', `fm-mcell${k ? ' on' : ''}${k > 1 ? ' twice' : ''}`);
            cell.style.cssText = box(94 + c * 54, 40 + r * 54, 44, 44);
            body.append(cell);
          }
        }
      } else if (i === 1) {
        const user = icon(doc, 'user', 64);
        user.style.cssText = 'position:absolute;left:218px;top:10px';
        body.append(user);
        for (let k = 0; k < 8; k++) {
          const nb = h(doc, 'i', `fm-nb${[0, 2, 5, 7].includes(k) ? ' on' : ''}`);
          nb.style.cssText = box(70 + (k % 4) * 90, 130 + Math.floor(k / 4) * 90, 56, 56);
          body.append(nb);
        }
      } else {
        [START_A, START_B].forEach((pattern, j) => {
          const heat = h(doc, 'div', 'fm-heat');
          heat.style.cssText = box(34 + j * 220, 70, 200, 200);
          [...pattern.padEnd(16, '0')].slice(0, 16).forEach((v, c) => {
            const cell = h(doc, 'i', 'fm-hcell');
            cell.style.cssText = `${box((c % 4) * 50, Math.floor(c / 4) * 50, 44, 44)};background:color-mix(in srgb,var(--term) ${10 + Number(v) * 20}%,var(--ground))`;
            heat.append(cell);
          });
          body.append(heat);
        });
      }
      card.append(body);
      put(`cd:${i}`, card, box(x, CARD_Y, CARD_W, CARD_H), [120 + i * 220, 460], g);
    });
  }

  // ---------- frames and timing ----------
  const RISE = 'translateY(14px)', NONE = 'translateY(0px)';
  const POP = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: 'scale(1)' } : { opacity: '0', transform: 'scale(0.6)' });
  const rise = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
  // the press each kind of element belongs to (WP-89 added the black boxes and their arrows, the boosting vote arrow `bav` and the copy of the data row of stacking `sdt`); the boxes, models and the vote pop, the rest rises
  /** @type {Record<string, number>} */
  const PRESS = { rs: 1, ab: 1, am: 1, bbx: 1, bn: 1, bo: 1, md: 1, ap: 1, pr: 1, aa: 1, av: 1,
    bm: 2, bq: 2, bmd: 2, ac: 2, bf: 2, bav: 2, bv: 2,
    sdt: 3, sr: 3, sab: 3, sa: 3, sb: 3, as: 3, sp: 3, al: 3, sl: 3, ao: 3, so: 3,
    cd: 4 };
  const POPS = new Set(['md', 'bm', 'bmd', 'bbx', 'sb', 'bv', 'sl', 'so', 'pr']);
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const key of els.keys()) {
      const [kind, a] = key.split(':');
      if (key === 'dt') f.set(key, { opacity: k <= 1 ? '1' : '0' });
      else if (kind === 'pic') f.set(key, { opacity: k === Number(a) ? '1' : '0' });
      else {
        if (!(kind in PRESS)) throw new Error(`families: the element "${key}" belongs to no press`);
        const on = k >= PRESS[kind];
        f.set(key, POPS.has(kind) || key === 'av' ? POP(on) : rise(on));
      }
    }
    return f;
  };
  /** @param {string} key */
  const timing = (key) => /** @type {{start: number, duration: number}} */ (when.get(key));

  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
