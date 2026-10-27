// @ts-check
// WP-50 (D-112, brief 07; page s7 `families` of the I2RS w06 deck): the mode `families` of compare, a support module like table-matrix.js of table-highlight. The three families of ensembles, one schematic picture each, and
// what they become for rating matrices. Every picture is a drawing with INVENTED values (three predictions and their mean, the shades of a strip of predictions, the weights of the dots, the cells of a matrix); they are plainly an
// example, so the pictures carry no label (D-129; D-127 had a tag "synthetic data", the speaker note and the evidence record say so now).
//   0 the stage: the data, eight film markers A .. H in a row
//   1 bagging   three resamples of the data, WITH replacement (R1 A A C D D F G H, R2 B C C E F G G H, R3 A B D E E F H H: a marker may come twice, another not at all), each flows into a model of its own;
//               the three predictions (synthetic: 3.6, 4.0, 4.4) are averaged into one (4.0)               (Breiman 1996, p. 123)
//   2 boosting  a chain of three models, the order matters: the examples the first model got wrong are ringed and GROW in the next stage (the size of a dot is its weight), the second model's mistakes grow in the third;
//               the weight ACCUMULATES: example 1 is wrong in both models, so it is two steps bigger (56 px against 28) by the third stage; a key under the picture says "ring: wrong, bigger dot: higher weight";
//               a weighted vote ends the chain                                                                   (Freund and Schapire 1997, p. 131)
//   3 stacking  three base models, their predictions as three columns of cells, a second-level learner that reads them, one prediction                                  (Sill et al. 2009, p. 1)
//   4 matrix    the same ideas for rating matrices, three small boxes side by side: single ratings resampled from the matrix (a repeated cell is double-framed; this one is bagging), k of 2k neighbours picked at random
//               for a user and two different random starts of a matrix factorization (these two are randomness injection, a group of their own)           (Bar et al. 2013, preprint pp. 5-9)
// Every number is written in the form of the language on screen (`oneDecimal`: EN "3.6", TR "3,6").
// A picture comes in and the one before it goes out (the data row stays through press 1, the source of the resamples).
//
// duration(k) = planDuration(plan(k)): every element has its own start and length written where it is made (`when`), the press ends with the last of them:
//   1 bagging 1520 ms (the last of three rows 120 + 2 * 160, then 700 for the converging arrow and the average, + 380)   2 boosting 1460 ms (120 + 2 * 320 + 320 for the vote, + 380)
//   3 stacking 1680 ms (120 + 2 * 160 + 860 for the output, + 380)   4 matrix 1020 ms (120 + 2 * 220 for the last card, + 460)   (measured: the browser reports the same; tests/js/widgets-story.html holds them)
// Motion: opacity and transform only (a thing pops or rises; the weight of a boosted example is a scale that is already there, so it never animates a size).
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon } from './pictos.js';

const W = 1680, H = 600;
const CHIP = 52, PITCH = 72;

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

  // ---------- the stage: the data (states 0 and 1) ----------
  const dt = h(doc, 'div', 'fm-pic', { 'aria-hidden': 'true' });
  const DX = 130, DY = 40;
  data.forEach((letter, i) => { const c = chip(letter); c.style.cssText += `;${box(DX + i * PITCH, DY, CHIP, CHIP)}`; dt.append(c); });
  dt.append(label(L.data, `left:${DX + data.length * PITCH + 14}px;top:${DY + 8}px;width:300px`, 'fm-lbl fm-soft'));
  put('dt', dt, '', [0, 300]);

  // ---------- 1 bagging ----------
  {
    const { g, svg } = picture(1);
    root.append(g);
    g.append(label(L.bagging, 'left:0;top:-4px;width:260px', 'fm-title', 'term'));
    const YS = [190, 300, 410];
    resamples.forEach((sample, i) => {
      const t0 = 120 + i * 160, yc = YS[i] + CHIP / 2;
      const row = h(doc, 'div', 'fm-row');
      [...sample].forEach((letter, j) => { const c = chip(letter); c.style.cssText += `;${box(DX + j * PITCH, 0, CHIP, CHIP)}`; row.append(c); });
      put(`rs:${i}`, row, `left:0;top:${YS[i]}px;width:${W}px;height:${CHIP}px`, [t0, 380], g);
      const xb = 100 - i * 16;
      arrow(svg, `ab:${i}`, `M${DX - 6} ${DY + CHIP / 2}H${xb}V${yc}H${DX - 10}M${DX - 24} ${yc - 12}L${DX - 8} ${yc}L${DX - 24} ${yc + 12}`, [t0, 380]);
      const mx = DX + 8 * PITCH + 40;
      arrow(svg, `am:${i}`, arrowD(DX + sample.length * PITCH + 4, yc, mx - 6, yc), [t0 + 240, 380]);
      const md = h(doc, 'div', 'fm-model');
      md.append(icon(doc, 'items', 40), Object.assign(h(doc, 'span', ''), { textContent: `M${i + 1}` }));
      put(`md:${i}`, md, box(mx, yc - 38, 130, 76), [t0 + 240, 380], g);
      arrow(svg, `ap:${i}`, arrowD(mx + 136, yc, mx + 196, yc), [t0 + 480, 380]);
      const pr = h(doc, 'div', 'fm-pill');
      say(pr, oneDecimal(predictions[i]));
      put(`pr:${i}`, pr, box(mx + 202, yc - 28, 110, 56), [t0 + 480, 380], g);
      arrow(svg, `aa:${i}`, arrowD(mx + 318, yc, mx + 410, 300 + (yc - 300) * 0.25), [t0 + 700, 380]);
    });
    const avg = h(doc, 'div', 'fm-avg');
    avg.append(say(h(doc, 'div', 'fm-avgnum'), oneDecimal(mean(predictions))), say(h(doc, 'div', 'fm-avgsub'), L.average));
    put('av', avg, box(DX + 8 * PITCH + 40 + 420, 236, 200, 128), [120 + 2 * 160 + 700, 380], g);
    g.append(label(L.resample, `left:${DX}px;top:${DY + CHIP + 22}px;width:420px`, 'fm-lbl fm-soft'));
  }

  // ---------- 2 boosting ----------
  {
    const { g, svg } = picture(2);
    root.append(g);
    g.append(label(L.boosting, 'left:0;top:-4px;width:260px', 'fm-title', 'term'));
    const COLS = [200, 620, 1040], MY = 120, FY = 250, DOT = 28, DP = 62, COLS_PER_ROW = 4;
    const examples = F.examples;
    /** The size of an example's dot in stage k (1 .. 3): it grows by a step each time a model before it got it wrong. */
    const timesWrong = (/** @type {number} */ e, /** @type {number} */ stage) => F.wrong.slice(0, stage - 1).filter((/** @type {number[]} */ w) => w.includes(e)).length;
    COLS.forEach((cx, i) => {
      const t0 = 120 + i * 320;
      const md = h(doc, 'div', 'fm-model');
      md.append(icon(doc, 'items', 40), Object.assign(h(doc, 'span', ''), { textContent: `M${i + 1}` }));
      put(`bm:${i}`, md, box(cx - 65, MY, 130, 76), [t0, 380], g);
      if (i < COLS.length - 1) arrow(svg, `ac:${i}`, arrowD(cx + 72, MY + 38, COLS[i + 1] - 72, MY + 38), [t0 + 260, 380]);
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
    arrow(svg, 'av:0', arrowD(COLS[2] + 72, MY + 38, 1330, MY + 38), [120 + 2 * 320 + 260, 380]);
    const vote = h(doc, 'div', 'fm-vote');
    vote.append(icon(doc, 'sliders', 56), say(h(doc, 'span', ''), L.vote));
    put('bv', vote, box(1340, 90, 260, 140), [120 + 2 * 320 + 320, 380], g);
    // the key: a ring means "got it wrong", a bigger dot "a higher weight" (the picture says it before the caption does; part of the picture, no timing of its own)
    g.append(label(L.legend, 'left:0;top:500px;width:560px', 'fm-lbl fm-soft'));
  }

  // ---------- 3 stacking ----------
  {
    const { g, svg } = picture(3);
    root.append(g);
    g.append(label(L.stacking, 'left:0;top:-4px;width:260px', 'fm-title', 'term'));
    const YS = [130, 260, 390], BX = 150, CX = 360, COLS = 6;
    const lx = 860, lw = 250, ly = 180, lh = 240;
    g.append(label(L.predictions, `left:${CX}px;top:86px;width:${COLS * 50}px`, 'fm-lbl fm-soft'));
    for (let i = 0; i < 3; i++) {
      const t0 = 120 + i * 160, yc = YS[i] + 38;
      const md = h(doc, 'div', 'fm-model');
      md.append(icon(doc, 'items', 40), Object.assign(h(doc, 'span', ''), { textContent: `M${i + 1}` }));
      put(`sm:${i}`, md, box(BX, YS[i], 130, 76), [t0, 380], g);
      arrow(svg, `as:${i}`, arrowD(BX + 136, yc, CX - 8, yc), [t0 + 200, 380]);
      const strip = h(doc, 'div', 'fm-strip');
      for (let c = 0; c < COLS; c++) {
        const cell = h(doc, 'i', 'fm-cell');
        cell.style.cssText = `${box(c * 50, 0, 42, 42)};background:color-mix(in srgb,var(--emph) ${[20, 55, 85, 35, 70, 45][(c + i * 2) % 6]}%,var(--ground))`;
        strip.append(cell);
      }
      put(`sp:${i}`, strip, `left:${CX}px;top:${yc - 21}px;width:${COLS * 50}px;height:42px`, [t0 + 320, 380], g);
      arrow(svg, `al:${i}`, arrowD(CX + COLS * 50 + 4, yc, lx - 8, ly + lh / 2 + (yc - (ly + lh / 2)) * 0.35), [t0 + 640, 380]);
    }
    const lr = h(doc, 'div', 'fm-learner');
    lr.append(icon(doc, 'sliders', 64), say(h(doc, 'span', ''), L.learner));
    put('sl', lr, box(lx, ly, lw, lh), [120 + 2 * 160 + 640, 380], g);
    arrow(svg, 'ao', arrowD(lx + lw + 6, ly + lh / 2, lx + lw + 110, ly + lh / 2), [120 + 2 * 160 + 760, 380]);
    const out = h(doc, 'div', 'fm-pill fm-out');
    out.append(say(h(doc, 'span', ''), L.output));
    put('so', out, box(lx + lw + 116, ly + lh / 2 - 32, 250, 64), [120 + 2 * 160 + 860, 380], g);
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
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const key of els.keys()) {
      const [kind, a] = key.split(':');
      if (key === 'dt') f.set(key, { opacity: k <= 1 ? '1' : '0' });
      else if (kind === 'pic') f.set(key, { opacity: k === Number(a) ? '1' : '0' });
      else {
        const press = { rs: 1, ab: 1, am: 1, md: 1, ap: 1, pr: 1, aa: 1, av: 1, bm: 2, ac: 2, bf: 2, bv: 2, sm: 3, as: 3, sp: 3, al: 3, sl: 3, ao: 3, so: 3, cd: 4 }[/** @type {'rs'} */ (kind)] ?? (key === 'av:0' ? 2 : 1);
        const on = k >= press;
        f.set(key, kind === 'md' || kind === 'bm' || kind === 'sm' || kind === 'bv' || kind === 'sl' || kind === 'so' || kind === 'pr' || key === 'av' ? POP(on) : rise(on));
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
