// @ts-check
// WP-74 (D-149, D-150; brief 09; page 9 `split` of the I2RS w07 deck, storyboard §3): the mode `split` of table-highlight, a support module like table-pseudo.js. A rating matrix is split into training, validation and test
// ratings; the picture tells why, how the three are used and what a cross-validation does. Everything is a toy matrix: the speaker note and the evidence record say so, the picture carries no label (D-129).
//
// The matrix: users x films, a rating in every observed cell (a dark filled cell with a light number), a dashed frame where nothing was rated. `roles` has one character per cell: "." nothing, T training, V validation, X test.
// A role is shown by its colour AND its shape (D-068): training is a blue ring and a round mark, validation a purple dashed ring and a diamond mark, test a gold double ring and a square mark.
//
// States (five presses; 0 is the matrix with its ratings):
//   1 hold-out    the ratings that will not be learned from (validation and test) are veiled; a bar splits all ratings into "learn" and "kept aside"
//   2 three roles the veils go, every rating takes its role; the bar has three parts, sized by the counts (12 : 6 : 6 is 2 : 1 : 1), the legend appears; WP-93 (D-179, the user's review of 2026-11-01) the technique is NAMED under the bar,
//                 "per-user split (stratified by user)" (each user's ratings are split in the same proportion: 2 : 1 : 1 in every row), with a warning in the negative role: a random split over all ratings can leave a user with no
//                 training ratings, and that user is never learned
//   3 the uses    three cards: training (the model learns), validation (tune the settings, stop early) and test (opened once, at the end: a lock on its cells)
//   4 the exam    the same three cards as a sitting: textbook, practice exams, the final exam
//   5 k folds     the matrix steps back; k rows, each with k parts, one part of each row is held out and is VALIDATION (a purple dashed ring and a diamond, D-179: "validation, as the name says", not the test role), the rest train; a bar per fold and
//                 the bar of their average. The test cells stay aside for the final report (our method rule): the folds never show them. ("k parts", "k-fold": the user prefers k to q.)
//
// duration(k) = pressDuration (the latest end of any thing that changes; u = 380 ms):
//   1  max(veils 100 + (v - 1) * 30 + u, the bar 120 + u)        v = validation + test cells (12)
//   2  max(veils out 260, roles 60 + (n - 1) * 24 + u, legend 120 + 2 * 100 + u, the two-part bar out 300, the three-part bar 200 + u)        n = rated cells (24)
//   3  max(locks 100 + (x - 1) * 60 + u, cards 120 + 2 * 140 + u, their contents 120 + 2 * 140 + 80 + u)        x = test cells (6)
//   4  max(contents out 260, the analogies 160 + 300)
//   5  max(the matrix 400, the locks, the cards and the bar out 300, folds 300 + (k - 1) * 110 + (200 + 500), the average 300 + k * 110 + 300 + 560)        k = the number of folds (the param `folds`, the model's `q`)
//   (WP-93, D-179: the name of the technique and its warning come in press 2 at 480 and 600 and end at 860 and 980, inside the 992 ms of that press; in press 3 they leave in 200 ms)
// Default numbers (24 rated cells: 12 training, 6 validation, 6 test; k = 4): 810 / 992 / 860 / 460 / 1600 ms (tests/js/table-split.test.mjs works them out by hand; the browser reports the same).
//
// Motion: opacity, transform. A veil and a lock are elements whose opacity moves; the dim of the matrix is its opacity.
import { h } from './frames.js';
import { icon, poster } from './pictos.js';
import { H, U, W, fillFrag, finish, frag, gcd, glyph, labelsSchema, num, on, pop, pressDuration, rise, scene } from './w07-common.js';

const CELL = 60, GAP = 8, PITCH = CELL + GAP, GX = 64, GY = 118;
const PX = 700;                                         // the right panel
const CARD = { y: 214, w: 290, h: 280, gap: 20 };
const FOLD = { y: 168, pitch: 62, seg: 64, x: 830, bar: 1210, barW: 320 };

const LABELS = {
  learn: frag('learn from', 'öğrenilen'), aside: frag('kept aside (hold-out)', 'saklanan (hold-out)'),
  train: frag('training', 'eğitim'), valid: frag('validation', 'doğrulama'), test: frag('test', 'test'),
  total: frag('{n} ratings', '{n} puan'), ratio: frag('{a} : {b} : {c}', '{a} : {b} : {c}'),
  trainUse: frag('the model learns from these', 'model bunlardan öğrenir'), validUse: frag('tune the settings, stop early', 'ayar ve erken durdurma'), testUse: frag('opened once, at the end', 'bir kez, en sonda açılır'),
  book: frag('textbook', 'ders kitabı'), mock: frag('practice exams', 'deneme sınavları'), exam: frag('the final exam', 'final sınavı'),
  folds: frag('{k}-fold cross-validation', '{k} parçalı çapraz doğrulama'), fold: frag('fold {i}', '{i}. parça'), mean: frag('average', 'ortalama'),     // WP-93 (D-179): {k}, not {q}: the user prefers k
  // WP-93 (D-179, the user's review of 2026-11-01, page 16 press 2): the name of the technique and its warning (the negative role: a dashed red frame and a cross)
  perUser: frag('per-user split (stratified by user)', 'kullanıcı bazlı bölme (kullanıcıya göre katmanlı)'),
  perUserWarn: frag('A random split over all ratings can leave a user with no training ratings, and that user is never learned', 'Rastgele puanlara göre bölmek, bazı kullanıcıların hiç öğrenilememesine sebep olabilir'),
};
const RATINGS = ['5.4..34.', '.4.52..3', '3..4.5.4', '.54.3.2.', '4.5..4.5', '.3.45.3.'];
const ROLES = ['T.T..VX.', '.T.XT..V', 'V..T.T.X', '.XT.V.T.', 'T.V..X.T', '.T.VT.X.'];

/** The params of the mode `split`, merged into table-highlight's schema (the registry carries the whole). */
export const splitSchema = {
  type: 'object', additionalProperties: false, title: 'the data-split mode (mode split)',
  description: '`ratings` and `roles` are one string per user, one character per film. `ratings`: "." not rated, "1".."5" a rating. `roles` has a role exactly where `ratings` has a rating: T training, V validation, X test. '
    + '`folds` is k of the k-fold cross-validation (2..5: k parts, each held out once as validation) and `scores` one toy score per fold (0..1; drawn as bars, no number).',
  default: { ratings: RATINGS, roles: ROLES, folds: 4, scores: [0.81, 0.78, 0.84, 0.77], labels: LABELS },
  properties: {
    ratings: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string', minLength: 3, maxLength: 8 }, default: RATINGS },
    roles: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string', minLength: 3, maxLength: 8 }, default: ROLES },
    folds: { type: 'integer', minimum: 2, maximum: 5, default: 4 },
    scores: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'number', minimum: 0, maximum: 1 }, default: [0.81, 0.78, 0.84, 0.77] },
    labels: labelsSchema(LABELS, '`total` holds {n}, `ratio` {a}, {b}, {c} (the counts divided by their greatest common divisor), `folds` {k}, `fold` {i}.'),
  },
};
export const splitExamples = [{ mode: 'split' }, { mode: 'split', split: { ratings: ['5.4', '.43', '35.'], roles: ['T.V', '.TX', 'TV.'], folds: 2, scores: [0.7, 0.9] } }];
/** Presses of the mode. */
export const splitPresses = 5;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function splitProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.split;
  /** @type {string[]} */ const rt = Q.ratings, ro = Q.roles;
  const cols = rt[0]?.length ?? 0;
  rt.forEach((row, r) => { if (row.length !== cols) bad(`$.split.ratings[${r}]`, `has ${row.length} films, the first row has ${cols}: every row must have the same length`); if (!/^[.1-5]+$/.test(row)) bad(`$.split.ratings[${r}]`, `holds "." or 1..5, found "${row}"`); });
  if (ro.length !== rt.length) bad('$.split.roles', `has ${ro.length} rows, ratings has ${rt.length}: one row of roles for every user`);
  else {
    ro.forEach((row, r) => {
      if (row.length !== rt[r].length) { bad(`$.split.roles[${r}]`, `has ${row.length} films, ratings[${r}] has ${rt[r].length}`); return; }
      if (!/^[.TVX]+$/.test(row)) { bad(`$.split.roles[${r}]`, `holds ".", T, V or X, found "${row}"`); return; }
      for (let c = 0; c < row.length; c++) {
        if (rt[r][c] === '.' && row[c] !== '.') bad(`$.split.roles[${r}]`, `film ${c} is not rated and has a role: only a rating is split`);
        if (rt[r][c] !== '.' && row[c] === '.') bad(`$.split.roles[${r}]`, `film ${c} is rated and has no role: every rating is training, validation or test`);
      }
    });
  }
  if (out.length === 0) for (const role of ['T', 'V', 'X']) if (!ro.join('').includes(role)) bad('$.split.roles', `has no ${role}: the picture needs ratings of all three roles`);
  // WP-93 (D-179): press 2 names the per-user split, which leaves EVERY user something to learn from: a user who has ratings and no training rating would make the name untrue
  if (out.length === 0) ro.forEach((row, r) => { if (!row.includes('T')) bad(`$.split.roles[${r}]`, 'has no training rating (T): the page names the per-user split, which leaves every user something to learn from'); });
  if (Q.scores.length !== Q.folds) bad('$.split.scores', `has ${Q.scores.length} scores, folds is ${Q.folds}: one score per fold`);
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM (tests work the numbers out by hand from them).
 * @param {any} P the resolved params of table-highlight @returns {ReturnType<typeof splitModelOf>}
 */
export function splitModel(P) { return splitModelOf(P.split); }

/** @param {any} Q the params of the mode */
function splitModelOf(Q) {
  /** @type {string[]} */ const rt = Q.ratings, ro = Q.roles;
  const rows = rt.length, cols = rt[0].length, q = Q.folds;
  /** @type {Array<{r: number, c: number, rating: string, role: string, key: string}>} */ const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (rt[r][c] !== '.') cells.push({ r, c, rating: rt[r][c], role: ro[r][c], key: `${r}:${c}` });
  const veiled = cells.filter((x) => x.role !== 'T'), locked = cells.filter((x) => x.role === 'X');
  const count = { T: cells.filter((x) => x.role === 'T').length, V: cells.filter((x) => x.role === 'V').length, X: locked.length };
  const g = gcd([count.T, count.V, count.X]);
  const ratio = [count.T / g, count.V / g, count.X / g];
  const idx = (/** @type {{key: string}[]} */ list, /** @type {string} */ key) => list.findIndex((x) => x.key === key);
  const inCards = (/** @type {number} */ k) => k === 3 || k === 4;

  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const x of veiled) f.set(`vl:${x.key}`, on(k === 1));
    for (const x of cells) f.set(`ro:${x.key}`, pop(k >= 2));
    for (const x of locked) f.set(`lk:${x.key}`, pop(inCards(k)));
    f.set('mat', { opacity: k >= 5 ? '0.3' : '1' });
    for (let i = 0; i < 3; i++) f.set(`lg:${i}`, rise(k >= 2));
    f.set('ho', rise(k === 1)); f.set('b3', rise(k >= 2 && k <= 4)); f.set('hot', rise(k >= 1 && k <= 4));
    f.set('pu', rise(k === 2)); f.set('pw', rise(k === 2));                                           // WP-93 (D-179): the name of the technique and its warning stay for press 2 only
    for (let i = 0; i < 3; i++) { f.set(`cd:${i}`, rise(inCards(k))); f.set(`ds:${i}`, on(k === 3)); f.set(`ic:${i}`, on(k === 3)); f.set(`an:${i}`, on(k === 4)); f.set(`ia:${i}`, on(k === 4)); }
    f.set('cvh', rise(k === 5));
    for (let i = 0; i < q; i++) { f.set(`cr:${i}`, rise(k === 5)); f.set(`cs:${i}`, k === 5 ? { opacity: '1', transform: 'scaleX(1)' } : { opacity: '0', transform: 'scaleX(0)' }); }
    f.set('cav', rise(k === 5)); f.set('cb', k === 5 ? { opacity: '1', transform: 'scaleX(1)' } : { opacity: '0', transform: 'scaleX(0)' });
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a, b] = key.split(':');
    const i = Number(a);
    switch (kind) {
      case 'vl': return k === 1 ? { start: 100 + idx(veiled, `${a}:${b}`) * 30, duration: U } : { start: 0, duration: 260 };
      case 'ro': return { start: 60 + idx(cells, `${a}:${b}`) * 24, duration: U };
      case 'lk': return k === 3 ? { start: 100 + idx(locked, `${a}:${b}`) * 60, duration: U } : { start: 0, duration: 260 };
      case 'mat': return { start: 0, duration: 400 };
      case 'lg': return { start: 120 + i * 100, duration: U };
      case 'ho': case 'hot': return k === 1 ? { start: 120, duration: U } : { start: 0, duration: 300 };
      case 'b3': return k === 2 ? { start: 200, duration: U } : { start: 0, duration: 300 };
      case 'pu': return k === 2 ? { start: 480, duration: U } : { start: 0, duration: 200 };            // WP-93 (D-179): after the bar is nearly in (580), the name; then the warning; both end inside the 992 ms of the press
      case 'pw': return k === 2 ? { start: 600, duration: U } : { start: 0, duration: 200 };
      case 'cd': return k === 3 ? { start: 120 + i * 140, duration: U } : { start: 0, duration: 300 };
      case 'ds': case 'ic': return k === 3 ? { start: 120 + i * 140 + 80, duration: U } : { start: 0, duration: 260 };
      case 'an': case 'ia': return k === 4 ? { start: 160, duration: 300 } : { start: 0, duration: 300 };
      case 'cvh': return { start: 220, duration: U };
      case 'cr': return { start: 300 + i * 110, duration: U };
      case 'cs': return { start: 300 + i * 110 + 200, duration: 500 };
      case 'cav': return { start: 300 + q * 110 + 100, duration: U };
      case 'cb': return { start: 300 + q * 110 + 300, duration: 560 };
      default: return { start: 0, duration: U };
    }
  };
  return { rows, cols, q, cells, veiled, locked, count, ratio, frame, timing, n: splitPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/** The mean of the scores (the bar of the average). @param {number[]} xs @returns {number} */
export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * The picture of the mode `split`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function splitBuild(ctx, P) {
  const Q = P.split, L = Q.labels;
  const M = splitModelOf(Q);
  const sc = scene(ctx, 'mx-root sp-root');
  const { doc, box, put, add, say } = sc;
  const gridW = M.cols * PITCH - GAP, gridH = M.rows * PITCH - GAP;
  const cx = (/** @type {number} */ c) => GX + c * PITCH, cy = (/** @type {number} */ r) => GY + r * PITCH;

  // the matrix and everything that dims with it (press 5) live in one group
  const mat = h(doc, 'div', 'sp-mat');
  put('mat', mat, box(0, 0, W, H));
  for (let r = 0; r < M.rows; r++) for (let c = 0; c < M.cols; c++) { const f = h(doc, 'div', 'mx-cell', { 'aria-hidden': 'true', 'data-gfx': 'border' }); add(f, box(cx(c), cy(r), CELL, CELL), mat); }
  for (const x of M.cells) {
    const ob = h(doc, 'div', 'sp-ob', { 'aria-hidden': 'true' });
    const n = h(doc, 'span'); n.textContent = x.rating; ob.append(n);
    add(ob, box(cx(x.c), cy(x.r), CELL, CELL), mat);
    const ro = h(doc, 'div', `sp-ro sp-${x.role}`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
    ro.append(h(doc, 'i', 'sp-mk'));
    put(`ro:${x.key}`, ro, box(cx(x.c) - 3, cy(x.r) - 3, CELL + 6, CELL + 6), mat);
  }
  for (const x of M.veiled) {
    const v = h(doc, 'div', 'sp-veil', { 'aria-hidden': 'true' });
    const e = icon(doc, 'eyeoff', 30);
    e.style.cssText += ';position:absolute;left:15px;top:15px';
    v.append(e);
    put(`vl:${x.key}`, v, box(cx(x.c) - 3, cy(x.r) - 3, CELL + 6, CELL + 6), mat);
  }
  for (const x of M.locked) {
    const lk = h(doc, 'div', 'sp-lock', { 'aria-hidden': 'true' });
    lk.append(glyph(doc, 'lock', 34));
    put(`lk:${x.key}`, lk, box(cx(x.c) - 3, cy(x.r) - 3, CELL + 6, CELL + 6), mat);
  }
  // films across the top and users down the left: the cast of the matrix modes
  for (let c = 0; c < M.cols; c++) { const p = poster(doc, [4, 8, 1, 5, 9, 3, 6, 0][c % 8], CELL, 58, 30); add(p, `position:absolute;left:${cx(c)}px;top:${GY - 72}px`, mat); }
  for (let r = 0; r < M.rows; r++) { const u = icon(doc, 'user', 46); u.classList.add('mx-user'); add(u, `left:${GX - 62}px;top:${cy(r) + (CELL - 46) / 2}px`, mat); }
  // the legend under the matrix: the three roles, each with its mark
  const lgY = GY + gridH + 22;
  [[L.train, 'T', 0], [L.valid, 'V', 150], [L.test, 'X', 330]].forEach(([text, role, dx], i) => {
    const g = h(doc, 'div', 'sp-legend', { 'aria-hidden': 'true' });
    g.append(h(doc, 'i', `sp-sw sp-${role}`), say(h(doc, 'span'), /** @type {Record<string, string>} */ (text)));
    put(`lg:${i}`, g, `left:${GX + /** @type {number} */ (dx)}px;top:${lgY}px`, mat);
  });

  // the two bars of the right panel: all ratings split in two (press 1), in three (presses 2 to 4)
  const total = M.cells.length, BW = 920;
  const part = (/** @type {string} */ cls, /** @type {number} */ x, /** @type {number} */ w, /** @type {Record<string, string>|null} */ text, /** @type {Record<string, string>|null} */ sub) => {
    const el = h(doc, 'div', `sp-part ${cls}`, { 'data-gfx': 'fill' });
    el.style.cssText += `;left:${x}px;width:${w}px`;
    if (text) el.append(say(h(doc, 'b'), text));
    if (sub) el.append(say(h(doc, 'span'), sub));
    return el;
  };
  const ho = h(doc, 'div', 'sp-bar', { 'aria-hidden': 'true' });
  const wLearn = Math.round(BW * M.count.T / total);
  ho.append(part('sp-learn', 0, wLearn, num(M.count.T, 0), L.learn), part('sp-aside', wLearn, BW - wLearn, num(total - M.count.T, 0), L.aside));
  put('ho', ho, box(PX, 100, BW, 64));
  put('hot', say(h(doc, 'div', 'sp-bar-title'), fillFrag(L.total, { n: total })), box(PX, 56, BW, 36));
  const b3 = h(doc, 'div', 'sp-bar', { 'aria-hidden': 'true' });
  const w3 = [M.count.T, M.count.V, M.count.X].map((n) => Math.round(BW * n / total));
  w3[2] = BW - w3[0] - w3[1];
  b3.append(part('sp-T sp-p', 0, w3[0], num(M.count.T, 0), L.train), part('sp-V sp-p', w3[0], w3[1], num(M.count.V, 0), L.valid), part('sp-X sp-p', w3[0] + w3[1], w3[2], num(M.count.X, 0), L.test));
  put('b3', b3, box(PX, 100, BW, 64));
  const ratio = h(doc, 'div', 'sp-ratio');
  say(ratio, fillFrag(L.ratio, { a: M.ratio[0], b: M.ratio[1], c: M.ratio[2] }));
  b3.append(ratio);
  // WP-93 (D-179, the user's review of 2026-11-01): press 2 names the technique under the bar (a user icon and the name, 32 px) and warns in the negative role (a dashed red frame and a cross, the text in the ink: red text on the red wash is 4.2 : 1)
  const pu = h(doc, 'div', 'sp-peruser', { 'aria-hidden': 'true' });
  const pui = icon(doc, 'user', 44); pui.classList.add('sp-pu-icon');
  pu.append(pui, say(h(doc, 'span'), L.perUser));
  put('pu', pu, box(PX, 196, BW, 56));
  const pw = h(doc, 'div', 'sp-warn', { 'aria-hidden': 'true', 'data-gfx': 'border', 'data-role': 'neg' });
  const crossSv = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), crossPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  crossSv.setAttribute('class', 'sp-cross'); crossSv.setAttribute('width', '34'); crossSv.setAttribute('height', '34'); crossSv.setAttribute('viewBox', '0 0 34 34'); crossSv.setAttribute('aria-hidden', 'true');
  crossPath.setAttribute('d', 'M8 8l18 18M26 8L8 26'); crossSv.append(crossPath);
  pw.append(crossSv, say(h(doc, 'span'), L.perUserWarn));
  put('pw', pw, box(PX, 272, BW, 116));

  // press 3 and 4: the three cards
  /** @type {Array<{role: string, name: Record<string, string>, use: Record<string, string>, mock: Record<string, string>, pict: () => SVGElement, analogy: () => SVGElement}>} */
  const cards = [
    { role: 'T', name: L.train, use: L.trainUse, mock: L.book, pict: () => icon(doc, 'ratings', 56), analogy: () => glyph(doc, 'book', 56) },
    { role: 'V', name: L.valid, use: L.validUse, mock: L.mock, pict: () => icon(doc, 'sliders', 56), analogy: () => icon(doc, 'clipboard', 56) },
    { role: 'X', name: L.test, use: L.testUse, mock: L.exam, pict: () => glyph(doc, 'lock', 56), analogy: () => icon(doc, 'target', 56) },
  ];
  cards.forEach((cd, i) => {
    const el = h(doc, 'div', `sp-card sp-c${cd.role}`, { 'aria-hidden': 'true' });
    const head = h(doc, 'div', 'sp-card-head');
    head.append(h(doc, 'i', `sp-sw sp-${cd.role}`), say(h(doc, 'span'), cd.name));
    el.append(head);
    put(`cd:${i}`, el, box(PX + i * (CARD.w + CARD.gap), CARD.y, CARD.w, CARD.h));
    const a = cd.pict(), b = cd.analogy();
    put(`ic:${i}`, a, `position:absolute;left:${CARD.w / 2 - 28}px;top:84px`, el);
    put(`ia:${i}`, b, `position:absolute;left:${CARD.w / 2 - 28}px;top:84px`, el);
    put(`ds:${i}`, say(h(doc, 'div', 'sp-card-text'), cd.use), `left:18px;top:160px;width:${CARD.w - 36}px`, el);
    put(`an:${i}`, say(h(doc, 'div', 'sp-card-text sp-card-mock'), cd.mock), `left:18px;top:160px;width:${CARD.w - 36}px`, el);
  });

  // press 5: k folds, a bar per fold and the bar of their average. WP-93 (D-179): the part that is held out in a round is VALIDATION (the validation role: a purple dashed ring and a diamond), not the test role: the test set stays aside for the final report
  put('cvh', say(h(doc, 'div', 'sp-bar-title'), fillFrag(L.folds, { k: M.q })), box(PX, 70, BW, 40));
  for (let i = 0; i < M.q; i++) {
    const row = h(doc, 'div', 'sp-fold', { 'aria-hidden': 'true' });
    const y = FOLD.y + i * FOLD.pitch;
    const nm = say(h(doc, 'span', 'sp-fold-name'), fillFrag(L.fold, { i: i + 1 }));
    row.append(nm);
    for (let j = 0; j < M.q; j++) { const sg = h(doc, 'i', `sp-seg sp-${j === i ? 'V' : 'T'}`, { 'data-gfx': 'border' }); sg.style.cssText += `;left:${FOLD.x - PX + j * (FOLD.seg + 6)}px`; sg.append(h(doc, 'i', 'sp-mk')); row.append(sg); }
    put(`cr:${i}`, row, box(PX, y, 420, 52));
    put(`cs:${i}`, h(doc, 'div', 'sp-score', { 'data-gfx': 'fill' }), `${box(FOLD.bar, y + 10, Math.round(FOLD.barW * Q.scores[i]), 32)};transform-origin:0 50%`);
  }
  const avgY = FOLD.y + M.q * FOLD.pitch + 14;
  put('cav', say(h(doc, 'div', 'sp-fold-name sp-avg'), L.mean), box(PX, avgY, 420, 52));
  put('cb', h(doc, 'div', 'sp-score sp-score-avg', { 'data-gfx': 'fill' }), `${box(FOLD.bar, avgY + 10, Math.round(FOLD.barW * mean(Q.scores)), 32)};transform-origin:0 50%`);

  return finish(ctx, sc, M.n, M.frame, M.timing);
}
