// @ts-check
// WP-50 (D-112, brief 07; page s13 `feature-augmentation` of the I2RS w06 deck): the mode `pseudo` of table-highlight, a support module like table-matrix.js. Feature augmentation, told as a picture: a content-based
// model fills the empty cells of a sparse rating matrix with PSEUDO-RATINGS, and the collaborative model then reads the filled matrix (Melville, Mooney and Nagarajan 2002: the pseudo user vectors, p. 188, and the
// weighting of a pair by how many REAL ratings both users have, p. 189). Everything here is SYNTHETIC; the speaker note and the evidence record say so, the picture carries no label (D-129).
//
// The matrix: users x films, a number in every cell. A real rating is a dark filled cell with a light number; a pseudo-rating a light cell with a dashed purple frame and an italic purple number (purple = term, D-009:
// the page's term is "pseudo-ratings"); the frame and the italics are the non-colour cue (D-068). An empty cell is a dashed frame with a grey notch.
//
// States (four presses; 0 is the empty frame of the matrix):
//   1 sparse   the real ratings pop in (row by row); every empty cell shows its notch
//   2 fill     the notches go and the pseudo-ratings pop in, row by row: every empty cell is filled
//   3 read     two users (`read`) are banded; their filled vectors stand side by side on the right with an arc between them (no number: "similar taste") and the collaborative model's card reads them
//   4 weights  the strips make room for three user PAIRS: how many real ratings each user has (synthetic), and a bar that is the pair's weight multiplier, hm = 2 m_i m_j / (m_i + m_j) with m = min(1, n / full)
//              (Melville et al. p. 189): the bar grows with the numbers of real ratings and is full from `full` (50) real ratings on. The bars carry no number (the lead's rule); the counts under the pairs do.
//
// duration(k) = planDuration(plan(k)); u = unit 380 ms, s = the stagger of a cell:
//   1  120 + (real cells - 1) * 22 + u  (the real cells, row-major)       2  80 + (pseudo cells - 1) * 30 + u, the notches fade at once
//   3  max(bands u, strips 260 + 120 + u, arc 420 + 560, the label 700 + u, the card 560 + u)       4  rows 150 apart, bars start 260 after their row: 2 * 150 + 260 + 560; press 3's picture leaves in u
// Default numbers: 918 / 880 / 1080 / 1120 ms for the lecture's matrix (35 cells, 20 real, 15 pseudo): 120 + 19 * 22 + 380; 80 + 14 * 30 + 380; 700 + 380 (the arc's label is the last to come); 2 * 150 + 260 + 560
// (measured: the browser reports the same, and tests/js/widgets-story.html holds the numbers).
//
// Motion: opacity, transform (scale pops, scaleX for the bars) and strokeDashoffset (the arc). No colour keyframes; a band or a strip is an element whose opacity moves.
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon, poster } from './pictos.js';

const W = 1680, H = 600;
const CELL = 60, GAP = 8, PITCH = CELL + GAP, GX = 64, GY = 118;
/** The right panel: the two strips of press 3 and the weights of press 4. */
const STRIP = { x: 740, y: [190, 330] };
const WT = { icons: 700, counts: 840, track: 1090, trackW: 500, y: [196, 306, 416] };

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const LABELS = {
  real: frag('real rating', 'gerçek puan'), pseudo: frag('pseudo-rating (content-based model)', 'sahte puan (içerik tabanlı model)'),
  similar: frag('similar taste', 'benzer zevk'), reads: frag('Collaborative model', 'İşbirlikçi model'),
  ratings: frag('real ratings', 'gerçek puan sayısı'), weight: frag('weight', 'ağırlık'), full: frag('{n}+ real ratings each: full weight', 'her biri {n}+ gerçek puan: tam ağırlık'),
};
const REAL = ['5.4.55.', '.34.4.5', '4.55.4.', '55.4.2.', '.4.55.4'];
/** The pseudo-ratings of the content-based model for the empty cells of REAL, by hand (only the form matters): "." where the user rated for real. */
const FILL = ['.4.3..5', '4..2.4.', '.3..4.4', '..4.3.3', '3.4..4.'];

/** The params of the mode `pseudo`, merged into table-highlight's schema (the registry carries the whole). */
export const pseudoSchema = {
  type: 'object', additionalProperties: false, title: 'the pseudo-rating mode (mode pseudo)',
  description: '`real` and `fill` are one string per user, one character per film: "." empty, "1".."5" a rating. `fill` has a pseudo-rating exactly where `real` is empty. `read` are the two users compared in press 3 (row numbers from 0). `pairs` are the numbers of REAL ratings of the two users of a pair (press 4); `full` is the number from which a user\'s weight is full.',
  default: { real: REAL, fill: FILL, read: [0, 1], pairs: [[5, 5], [10, 40], [60, 80]], full: 50, labels: LABELS },
  properties: {
    real: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string', minLength: 3, maxLength: 7 }, default: REAL },
    fill: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string', minLength: 3, maxLength: 7 }, default: FILL },
    read: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 0 }, default: [0, 1] },
    pairs: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 1 } }, default: [[5, 5], [10, 40], [60, 80]] },
    full: { type: 'integer', minimum: 1, default: 50 },
    labels: {
      type: 'object', additionalProperties: false, default: LABELS, title: 'the short labels of the picture',
      description: '`full` may hold {n}: the number from which a weight is full.',
      properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, { ...FRAGMENT, default: v }])),
    },
  },
};

/** The example of the mode: the lecture's matrix. */
export const pseudoExamples = [{ mode: 'pseudo' }];

/** The harmonic mean of two numbers (0 when either is 0). @param {number} a @param {number} b @returns {number} */
export const harmonicMean = (a, b) => (a > 0 && b > 0 ? (2 * a * b) / (a + b) : 0);
/**
 * The weight multiplier of a pair of users (Melville, Mooney and Nagarajan 2002, p. 189): each user counts min(1, n / full), the pair their harmonic mean, so it leans to the smaller of the two and is
 * full only when BOTH have `full` real ratings or more. @param {number} ni @param {number} nj @param {number} full @returns {number} 0 .. 1
 */
export const pairWeight = (ni, nj, full) => harmonicMean(Math.min(1, ni / full), Math.min(1, nj / full));

/** The Pearson correlation of two vectors of ratings (0 when one of them is constant). @param {number[]} xs @param {number[]} ys @returns {number} */
export function pearson(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx * syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}
/** The smallest Pearson r of the two users read in press 3: the arc says "similar taste", so the numbers must say it (the lecture's pair is at 0.86). */
export const SIMILAR_AT = 0.7;

/**
 * What the picture needs of the params and the schema subset cannot say, as problems with their paths (empty: fine). Pure; table-highlight's `check` returns it for the mode `pseudo`.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function pseudoProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.pseudo;
  /** @type {string[]} */ const real = Q.real, fill = Q.fill;
  const cols = real[0]?.length ?? 0;
  real.forEach((row, r) => { if (row.length !== cols) bad(`$.pseudo.real[${r}]`, `has ${row.length} films, the first row has ${cols}: every row must have the same length`); if (!/^[.1-5]+$/.test(row)) bad(`$.pseudo.real[${r}]`, `holds "." or 1..5, found "${row}"`); });
  if (fill.length !== real.length) bad('$.pseudo.fill', `has ${fill.length} rows, real has ${real.length}: one row of pseudo-ratings for every user`);
  else {
    fill.forEach((row, r) => {
      if (row.length !== real[r].length) { bad(`$.pseudo.fill[${r}]`, `has ${row.length} films, real[${r}] has ${real[r].length}`); return; }
      if (!/^[.1-5]+$/.test(row)) { bad(`$.pseudo.fill[${r}]`, `holds "." or 1..5, found "${row}"`); return; }
      for (let c = 0; c < row.length; c++) {
        if (real[r][c] !== '.' && row[c] !== '.') bad(`$.pseudo.fill[${r}]`, `film ${c} has a real rating: a pseudo-rating never replaces it`);
        else if (real[r][c] === '.' && row[c] === '.') bad(`$.pseudo.fill[${r}]`, `film ${c} is empty in real and not filled: the content-based model fills every empty cell`);
      }
    });
  }
  const [a, b] = Q.read;
  if (a === b) bad('$.pseudo.read', 'names the same user twice');
  Q.read.forEach((r, i) => { if (r >= real.length) bad(`$.pseudo.read[${i}]`, `row ${r} does not exist (the matrix has ${real.length} users)`); });
  if (out.length === 0 && a !== b) {                                                                // the arc between the two filled vectors says "similar taste": the numbers must say it too
    const merged = (/** @type {number} */ r) => [...real[r]].map((ch, c) => Number(ch !== '.' ? ch : fill[r][c]));
    const r = pearson(merged(a), merged(b));
    if (r < SIMILAR_AT) bad('$.pseudo.read', `users ${a} and ${b} are not similar: the Pearson correlation of their filled vectors is ${r.toFixed(2)}, below ${SIMILAR_AT} (the arc says "similar taste")`);
  }
  return out;
}

/**
 * The picture of the mode `pseudo`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function pseudoBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const lang = ctx.lang;
  const Q = P.pseudo, L = Q.labels;
  /** @type {string[]} */ const real = Q.real, fill = Q.fill;
  const rows = real.length, cols = real[0].length;
  const gridW = cols * PITCH - GAP, gridH = rows * PITCH - GAP;
  const cx = (/** @type {number} */ c) => GX + c * PITCH;
  const cy = (/** @type {number} */ r) => GY + r * PITCH;
  const isReal = (/** @type {number} */ r, /** @type {number} */ c) => real[r][c] !== '.';
  const levelAt = (/** @type {number} */ r, /** @type {number} */ c) => (isReal(r, c) ? real[r][c] : fill[r][c]);
  const n = 4;

  const root = h(doc, 'div', 'w-root mx-root ps-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {Element} el @param {string} css @param {Element} [parent] */
  const put = (key, el, css, parent) => { /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); (parent ?? root).append(el); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  /** A cell showing a rating: a real one (dark, filled) or a pseudo one (light, dashed purple frame, italic). @param {string} level @param {boolean} real */
  const rating = (level, real) => {
    const c = h(doc, 'div', real ? 'ps-real' : 'ps-pseudo', { 'aria-hidden': 'true' });
    const num = h(doc, 'span', '', real ? {} : { 'data-role': 'term' });
    num.textContent = level;
    c.append(num);
    return c;
  };

  // the two users' bands of press 3 lie under everything else of the matrix, so they are made first
  Q.read.forEach((/** @type {number} */ r, /** @type {number} */ i) => put(`rd:${i}`, h(doc, 'div', 'ps-band', { 'aria-hidden': 'true' }), box(GX - 10, cy(r) - 6, gridW + 20, CELL + 12)));

  // the empty frames of the matrix (state 0), then the real cells, the notches and the pseudo cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frame0 = h(doc, 'div', 'mx-cell', { 'aria-hidden': 'true', 'data-gfx': 'border' });
      frame0.style.cssText = box(cx(c), cy(r), CELL, CELL);
      root.append(frame0);
    }
  }
  const order = [];                                                                    // row-major, for the stagger
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${isReal(r, c) ? 'rl' : 'pf'}:${r}:${c}`;
      order.push(key);
      put(key, rating(levelAt(r, c), isReal(r, c)), box(cx(c), cy(r), CELL, CELL));
      if (!isReal(r, c)) put(`nt:${r}:${c}`, h(doc, 'div', 'ps-notch', { 'aria-hidden': 'true' }), box(cx(c) + 16, cy(r) + CELL / 2 - 3, CELL - 32, 6));
    }
  }
  const realKeys = order.filter((k) => k.startsWith('rl:')), pseudoKeys = order.filter((k) => k.startsWith('pf:'));
  // films across the top and users down the left (the same cast as the matrix mode)
  for (let c = 0; c < cols; c++) {
    const p = poster(doc, [4, 8, 1, 5, 9, 3, 6, 0][c % 8], CELL, 58, 30);
    p.style.cssText += `;position:absolute;left:${cx(c)}px;top:${GY - 72}px`;
    root.append(p);
  }
  for (let r = 0; r < rows; r++) {
    const u = icon(doc, 'user', 46);
    u.classList.add('mx-user');
    u.style.cssText = `left:${GX - 62}px;top:${cy(r) + (CELL - 46) / 2}px`;
    root.append(u);
  }
  // the legend (what a dark and what a dashed cell is)
  const lgY = GY + gridH + 22;
  const legend = (/** @type {string} */ key, /** @type {boolean} */ realCell, /** @type {number} */ x, /** @type {Record<string, string>} */ text) => {
    const g = h(doc, 'div', 'ps-legend', { 'aria-hidden': 'true' });
    g.append(h(doc, 'i', realCell ? 'ps-sw ps-sw-real' : 'ps-sw ps-sw-pseudo'), say(h(doc, 'span', ''), text));
    put(key, g, `left:${x}px;top:${lgY}px`);
  };
  legend('lg:real', true, GX, L.real);
  legend('lg:pseudo', false, GX + 220, L.pseudo);

  // press 3: the two users' bands in the matrix, their filled vectors side by side, the arc of similar taste and the collaborative model's card
  Q.read.forEach((/** @type {number} */ r, /** @type {number} */ i) => {
    const strip = h(doc, 'div', 'ps-strip', { 'aria-hidden': 'true' });
    const u = icon(doc, 'user', 46);
    u.classList.add('mx-user');
    u.style.cssText = `left:-70px;top:${(CELL - 46) / 2}px`;
    strip.append(u);
    for (let c = 0; c < cols; c++) { const cell = rating(levelAt(r, c), isReal(r, c)); cell.style.cssText += `;${box(c * PITCH, 0, CELL, CELL)}`; strip.append(cell); }
    put(`rs:${i}`, strip, `left:${STRIP.x}px;top:${STRIP.y[i]}px`);
  });
  const stripEnd = STRIP.x + gridW + 22;
  const yA = STRIP.y[0] + CELL / 2, yB = STRIP.y[1] + CELL / 2;
  const arcSvg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  arcSvg.append(s(doc, 'path', { class: 'ps-arc', d: `M${stripEnd} ${yA}C${stripEnd + 110} ${yA} ${stripEnd + 110} ${yB} ${stripEnd} ${yB}`, pathLength: '1', 'data-gfx': 'stroke', 'data-key': 'ar' }));
  root.append(arcSvg);
  els.set('ar', /** @type {Element} */ (arcSvg.lastElementChild));
  put('sm', say(h(doc, 'div', 'ps-sim', { 'data-role': 'emph' }), L.similar), `left:${stripEnd - 262}px;top:${(yA + yB) / 2 - 18}px;width:240px;text-align:right`);
  const cf = h(doc, 'div', 'ps-cf', { 'aria-hidden': 'true' });
  cf.append(icon(doc, 'users', 56), say(h(doc, 'span', ''), L.reads));
  put('cf', cf, box(1400, (yA + yB) / 2 - 70, 250, 140));

  // press 4: the weights of three user pairs
  put('wh:ratings', say(h(doc, 'div', 'ps-wh'), L.ratings), `left:${WT.counts}px;top:${WT.y[0] - 54}px;width:240px`);
  put('wh:weight', say(h(doc, 'div', 'ps-wh'), L.weight), `left:${WT.track}px;top:${WT.y[0] - 54}px;width:140px`);
  put('wh:full', h(doc, 'div', 'ps-wh ps-whfull'), `left:${WT.track + WT.trackW - 460}px;top:${WT.y[0] - 54}px;width:460px;text-align:right`).textContent = ctx.text(L.full).replace('{n}', String(Q.full));
  /** @type {number[]} */ const weights = Q.pairs.map((/** @type {number[]} */ [a, b]) => pairWeight(a, b, Q.full));
  Q.pairs.forEach((/** @type {number[]} */ [a, b], /** @type {number} */ i) => {
    const row = h(doc, 'div', 'ps-pair', { 'aria-hidden': 'true' });
    for (let k = 0; k < 2; k++) { const u = icon(doc, 'user', 46); u.classList.add('mx-user'); u.style.cssText = `left:${WT.icons + k * 56}px;top:${WT.y[i] + 8}px`; row.append(u); }
    const counts = h(doc, 'div', 'ps-counts');
    counts.style.cssText = `left:${WT.counts}px;top:${WT.y[i]}px`;
    counts.textContent = `${a} · ${b}`;
    row.append(counts);
    const track = h(doc, 'div', 'ps-track');
    track.style.cssText = box(WT.track, WT.y[i] + 10, WT.trackW, 34);
    row.append(track);
    put(`wt:${i}`, row, '');
    put(`wb:${i}`, h(doc, 'div', 'ps-bar', { 'data-gfx': 'fill' }), `${box(WT.track + 4, WT.y[i] + 14, Math.max(2, Math.round((WT.trackW - 8) * weights[i])), 26)};transform-origin:0 50%`);
  });

  // ---------- frames and timing ----------
  const RISE = 'translateY(14px)', NONE = 'translateY(0px)';
  const POP_OFF = { opacity: '0', transform: 'scale(0.55)' }, POP_ON = { opacity: '1', transform: 'scale(1)' };
  const on = (/** @type {boolean} */ b) => ({ opacity: b ? '1' : '0' });
  const rise = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const key of realKeys) f.set(key, k >= 1 ? POP_ON : POP_OFF);
    for (const key of pseudoKeys) { f.set(key, k >= 2 ? POP_ON : POP_OFF); f.set(`nt:${key.slice(3)}`, on(k === 1)); }
    f.set('lg:real', rise(k >= 1)); f.set('lg:pseudo', rise(k >= 2));
    Q.read.forEach((/** @type {number} */ _r, /** @type {number} */ i) => { f.set(`rd:${i}`, on(k === 3)); f.set(`rs:${i}`, rise(k === 3)); });
    f.set('ar', { strokeDashoffset: k === 3 ? '0' : '1.02' }); f.set('sm', rise(k === 3)); f.set('cf', rise(k === 3));
    for (const key of ['wh:ratings', 'wh:weight', 'wh:full']) f.set(key, rise(k >= 4));
    Q.pairs.forEach((/** @type {number[]} */ _p, /** @type {number} */ i) => { f.set(`wt:${i}`, rise(k >= 4)); f.set(`wb:${i}`, k >= 4 ? { opacity: '1', transform: 'scaleX(1)' } : { opacity: '0', transform: 'scaleX(0)' }); });
    return f;
  };
  /** @param {string} key @param {number} k */
  const timing = (key, k) => {
    const [kind, a] = key.split(':');
    const U = 380;
    if (kind === 'rl') return { start: 120 + realKeys.indexOf(key) * 22, duration: U };
    if (kind === 'pf') return { start: 80 + pseudoKeys.indexOf(key) * 30, duration: U };
    if (kind === 'nt') return { start: 0, duration: 260 };
    if (kind === 'lg') return { start: a === 'real' ? 200 : 120, duration: U };
    if (k >= 4 && ['rd', 'rs', 'ar', 'sm', 'cf'].includes(kind)) return { start: 0, duration: U };       // press 3's picture makes room for the weights
    if (kind === 'rd') return { start: 0, duration: U };
    if (kind === 'rs') return { start: 260 + Number(a) * 120, duration: U };
    if (kind === 'ar') return { start: 420, duration: 560 };
    if (kind === 'sm') return { start: 700, duration: U };
    if (kind === 'cf') return { start: 560, duration: U };
    if (kind === 'wh') return { start: 120, duration: U };
    if (kind === 'wt') return { start: Number(a) * 150, duration: U };
    if (kind === 'wb') return { start: Number(a) * 150 + 260, duration: 560 };
    return { start: 0, duration: U };
  };
  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
