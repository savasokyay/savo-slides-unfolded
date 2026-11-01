// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2; page `coverage` of the I2RS w07 deck, storyboard §3): the mode `catalog` of table-highlight. Two kinds of coverage, told as a picture. Catalogue coverage: of a toy catalogue of 20 films, what a popularity
// recommender (A) ever recommends and what a more varied one (B) ever recommends, as a share of the catalogue. Prediction coverage (Herlocker et al. 2004, p. 40: the share of user-item pairs for which the system can produce a prediction; the old deck's
// formula, C1 was reversed in the second literature round): a user x film grid where a new user and a new film leave gaps (the cold start). Coverage is read with the error and ranking measures (D-171, once "accuracy"): a bad guess for every pair would give 100 %.
// The numbers are a toy and the picture is plainly an example: it carries no label (D-129).
//
// The catalogue: 20 films (5 x 4 generic emblems, never a real title). A film that the algorithm ever recommends is lit: a blue ring and a tick badge; a film it never recommends stays dim and plain (D-068: ring and mark, not colour alone).
// By hand, the lecture's defaults: A recommends 4 distinct films, B 11: catalogue coverage 4 / 20 = 20 % and 11 / 20 = 55 %. The prediction grid has 6 users x 8 films, 33 pairs that can be predicted: prediction coverage 33 / 48 = 68.75 %, shown as 69 %.
//
// States (four presses; 0 shows nothing):
//   1 popularity   the first catalogue appears and the same few films light up: the popular ones, recommended again and again
//   2 varied       the second catalogue appears and many more films light up
//   3 catalogue    catalogue coverage = the films that ever get recommended / the films in the catalogue: a gauge and the fraction under each catalogue
//   4 prediction   the user x film grid: the pairs the system can predict (a tick), the gaps of a new user (a whole row) and a new film (a whole column), the fraction, and the note that coverage is read with accuracy
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): 820 / 1080 / 1150 / 1130 ms with the defaults.
//   1  max(the catalogue 100 + u, the lit films 200 + (a - 1) * 80 + u)     2  max(the catalogue 100 + u, the lit films 200 + (b - 1) * 50 + u)
//   3  max(the fractions 200 + u and 350 + u, the gauges 400 + 600 and 550 + 600)
//   4  max(the panel 100 + u, the predictable pairs 200 + (p - 1) * 10 + u, the two captions 500 + u, the fraction 600 + u, the note 750 + u)
//
// Motion: opacity and transform (a rise, scale pops, scaleX for a gauge). Nothing else.
import { h } from './frames.js';
import { emblem } from './pictos.js';
import { U, finish, frag, grow, labelsSchema, pct, pop, pressDuration, rise, scene } from './w07-common.js';

/** The grid of the toy catalogue and the three panels (design box 1680 x 600, px). */
const GRID = { cols: 5, rows: 4, cell: 68, gap: 8 };
const PITCH = GRID.cell + GRID.gap, GW = GRID.cols * PITCH - GRID.gap, GH = GRID.rows * PITCH - GRID.gap;
const PANEL = { y: 50, w: GW + 60, h: 476, a: 50, b: 526, pred: { x: 1012, w: 618 } };
const TRACK_Y = 58 + GH + 18, READ_Y = TRACK_Y + 20;
const PC = { cell: 40, pitch: 46, x: 30, y: 70 };

const LABELS = {
  a: frag('popularity', 'popülerlik'), b: frag('varied', 'çeşitli'), cover: frag('catalogue coverage', 'katalog kapsamı'),
  predTitle: frag('prediction coverage', 'tahmin kapsamı'), canPredict: frag('can predict', 'tahmin edebilir'), cannot: frag('cannot predict', 'tahmin edemez'),
  newFilm: frag('last column: a new film', 'son sütun: yeni bir film'), newUser: frag('this row: a new user', 'bu satır: yeni bir kullanıcı'),
  predCover: frag('pairs it can predict', 'tahmin edebildiği çiftler'),
  note: frag('read it with the error and ranking measures: a bad guess for every pair would give 100 %', 'hata ve sıralama ölçüleriyle birlikte oku: her çifte kötü bir tahmin yüzde 100 verir'),      // D-171: "accuracy" is not one measure here
};
const A = [0, 1, 2, 3];
const B = [2, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18];
const PREDICTABLE = ['xxxxxxx.', 'xxxxxxx.', 'xxx.xxx.', 'xxxxxxx.', '........', 'xxxxx.x.'];

/** The params of the mode `catalog`, merged into table-highlight's schema (the registry carries the whole). */
export const catalogSchema = {
  type: 'object', additionalProperties: false, title: 'the coverage mode (mode catalog)',
  description: 'The catalogue has 20 films (0..19, row by row). `a` and `b` are the films the first and the second recommender ever recommend (B recommends more of them than A). `predictable` has one string per user and one character per film: "x" is a pair '
    + 'the system can predict, "." one it cannot; it needs a whole empty row (a new user) and a whole empty column (a new film). All numbers are a toy; the picture carries no label.',
  default: { a: A, b: B, predictable: PREDICTABLE, labels: LABELS },
  properties: {
    a: { type: 'array', minItems: 1, maxItems: 19, items: { type: 'integer', minimum: 0, maximum: 19 }, default: A },
    b: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'integer', minimum: 0, maximum: 19 }, default: B },
    predictable: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string', minLength: 3, maxLength: 8 }, default: PREDICTABLE },
    labels: labelsSchema(LABELS),
  },
};
export const catalogExamples = [{ mode: 'catalog' }, { mode: 'catalog', catalog: { a: [0, 1], b: [0, 3, 7, 12], predictable: ['xxx.', '....', 'xx..'] } }];
export const catalogPresses = 4;

/**
 * The cells of the prediction grid: how many pairs can be predicted, the empty rows (new users) and the empty columns (new films). Pure.
 * @param {string[]} grid one string per user, "x" can predict @returns {{can: number, total: number, rows: number, cols: number, coldRows: number[], coldCols: number[]}}
 */
export function predictionStats(grid) {
  const cols = grid[0].length;
  const coldRows = grid.map((row, r) => (/^\.+$/.test(row) ? r : -1)).filter((r) => r >= 0);
  const coldCols = Array.from({ length: cols }, (_, c) => c).filter((c) => grid.every((row) => row[c] === '.'));
  return { can: grid.reduce((a, row) => a + [...row].filter((ch) => ch === 'x').length, 0), total: grid.length * cols, rows: grid.length, cols, coldRows, coldCols };
}

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function catalogProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.catalog;
  for (const key of ['a', 'b']) if (new Set(Q[key]).size !== Q[key].length) bad(`$.catalog.${key}`, 'names a film twice: each film counts once, however often it is recommended');
  const na = new Set(Q.a).size, nb = new Set(Q.b).size;
  if (na >= nb) bad('$.catalog.b', `recommends ${nb} distinct films, not more than a (${na}): the page says the second recommender covers more of the catalogue`);
  /** @type {string[]} */ const grid = Q.predictable;
  const cols = grid[0].length;
  let shape = true;
  grid.forEach((row, r) => {
    if (row.length !== cols) { bad(`$.catalog.predictable[${r}]`, `has ${row.length} films, the first row has ${cols}: every row must have the same length`); shape = false; }
    if (!/^[x.]+$/.test(row)) { bad(`$.catalog.predictable[${r}]`, `holds "x" or ".", found "${row}"`); shape = false; }
  });
  if (shape) {
    const S = predictionStats(grid);
    if (S.can === 0) bad('$.catalog.predictable', 'has no pair the system can predict');
    if (S.coldRows.length === 0) bad('$.catalog.predictable', 'has no empty row: the page shows a new user the system cannot predict anything for');
    if (S.coldCols.length === 0) bad('$.catalog.predictable', 'has no empty column: the page shows a new film the system cannot predict');
  }
  return out;
}

// WP-93 (D-175): the user keeps "n / m = p%" on this page, the one exception to D-174 (formulas as a fraction with a bar): do not "fix" it in a later formula sweep
/** "4 / 20 = 20%" (Turkish: "4 / 20 = %20"). @param {number} n @param {number} m */
const ratio = (n, m) => { const p = pct(n / m); return { en: `${n} / ${m} = ${p.en}`, tr: `${n} / ${m} = ${p.tr}` }; };

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function catalogModel(P) {
  const Q = P.catalog;
  /** @type {number[]} */ const a = [...new Set(Q.a)], b = [...new Set(Q.b)];
  /** @type {string[]} */ const grid = Q.predictable;
  const stats = predictionStats(grid);
  /** @type {Array<[number, number]>} */ const cells = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'x') cells.push([r, c]); }));
  const cover = { a: a.length / 20, b: b.length / 20 }, predCover = stats.can / stats.total;
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('pa', rise(k >= 1)); f.set('pb', rise(k >= 2));
    for (const i of a) f.set(`ga:${i}`, pop(k >= 1));
    for (const i of b) f.set(`gb:${i}`, pop(k >= 2));
    f.set('ca', rise(k >= 3)); f.set('cb', rise(k >= 3)); f.set('qa', grow(k >= 3)); f.set('qb', grow(k >= 3));
    f.set('pg', rise(k >= 4)); f.set('pf', rise(k >= 4)); f.set('pn', rise(k >= 4)); f.set('pcu', rise(k >= 4)); f.set('pci', rise(k >= 4));
    for (const [r, c] of cells) f.set(`pc:${r}:${c}`, pop(k >= 4));
    return f;
  };
  /** @param {string} key @returns {import('./frames.js').Timing} */
  const timing = (key) => {
    const [kind, x, y] = key.split(':');
    const i = Number(x);
    switch (kind) {
      case 'pa': case 'pb': case 'pg': return { start: 100, duration: U };
      case 'ga': return { start: 200 + a.indexOf(i) * 80, duration: U };
      case 'gb': return { start: 200 + b.indexOf(i) * 50, duration: U };
      case 'ca': return { start: 200, duration: U };
      case 'cb': return { start: 350, duration: U };
      case 'qa': return { start: 400, duration: 600 };
      case 'qb': return { start: 550, duration: 600 };
      case 'pc': return { start: 200 + cells.findIndex(([r, c]) => r === i && c === Number(y)) * 10, duration: U };
      case 'pcu': case 'pci': return { start: 500, duration: U };
      case 'pf': return { start: 600, duration: U };
      case 'pn': return { start: 750, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { a, b, cells, stats, cover, predCover, frame, timing, n: catalogPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `catalog`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function catalogBuild(ctx, P) {
  const L = P.catalog.labels;
  const M = catalogModel(P);
  const sc = scene(ctx, 'mx-root ca-root');
  const { doc, box, put, add, say } = sc;
  /** @type {Array<{p: string, g: string, c: string, q: string, set: number[], title: Record<string, string>, share: number, x: number, cls: string}>} */
  const panels = [
    { p: 'pa', g: 'ga', c: 'ca', q: 'qa', set: M.a, title: L.a, share: M.cover.a, x: PANEL.a, cls: 'ca-a' },
    { p: 'pb', g: 'gb', c: 'cb', q: 'qb', set: M.b, title: L.b, share: M.cover.b, x: PANEL.b, cls: 'ca-b' },
  ];
  for (const pn of panels) {
    const panel = put(pn.p, h(doc, 'div', `ca-panel ${pn.cls}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(pn.x, PANEL.y, PANEL.w, PANEL.h));
    add(say(h(doc, 'div', 'ca-title'), pn.title), box(0, 6, PANEL.w, 44), panel);
    for (let i = 0; i < GRID.cols * GRID.rows; i++) {
      const left = 30 + (i % GRID.cols) * PITCH, top = 58 + Math.floor(i / GRID.cols) * PITCH;
      const film = h(doc, 'div', 'ca-film', { 'aria-hidden': 'true', 'data-gfx': 'border' });
      film.append(emblem(doc, (i * 3 + 1) % 10, 34));
      add(film, box(left, top, GRID.cell, GRID.cell), panel);
      if (pn.set.includes(i)) put(`${pn.g}:${i}`, litMark(doc), box(left - 4, top - 4, GRID.cell + 8, GRID.cell + 8), panel);
    }
    add(h(doc, 'div', 'ca-track', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(30, TRACK_Y, GW, 12), panel);
    put(pn.q, h(doc, 'div', 'ca-gauge', { 'aria-hidden': 'true', 'data-gfx': 'fill' }), `${box(30, TRACK_Y, Math.max(4, Math.round(GW * pn.share)), 12)};transform-origin:0 50%`, panel);
    put(pn.c, readout(doc, say, L.cover, ratio(pn.set.length, 20)), box(30, READ_Y, GW, 84), panel);
  }
  // press 4: prediction coverage, a user x film grid: the pairs the system can predict (a tick), the gaps of a new user and a new film
  const pg = put('pg', h(doc, 'div', 'ca-panel ca-pred', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(PANEL.pred.x, PANEL.y, PANEL.pred.w, PANEL.h));
  add(say(h(doc, 'div', 'ca-title'), L.predTitle), box(0, 6, PANEL.pred.w, 44), pg);
  const px = (/** @type {number} */ c) => PC.x + c * PC.pitch, py = (/** @type {number} */ r) => PC.y + r * PC.pitch;
  for (let r = 0; r < M.stats.rows; r++) for (let c = 0; c < M.stats.cols; c++) add(h(doc, 'div', 'ca-nc', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(px(c), py(r), PC.cell, PC.cell), pg);
  for (const [r, c] of M.cells) put(`pc:${r}:${c}`, tickCell(doc), box(px(c), py(r), PC.cell, PC.cell), pg);
  const gridRight = px(M.stats.cols - 1) + PC.cell;
  const capW = PANEL.pred.w - gridRight - 40;
  put('pci', say(h(doc, 'div', 'ca-cap'), L.newFilm), box(gridRight + 24, py(0), capW, 60), pg);
  put('pcu', say(h(doc, 'div', 'ca-cap'), L.newUser), box(gridRight + 24, py(M.stats.coldRows[0]) - 4, capW, 60), pg);
  const legend = add(h(doc, 'div', 'ca-legend', { 'aria-hidden': 'true' }), box(30, py(M.stats.rows - 1) + PC.cell + 16, PANEL.pred.w - 60, 34), pg);
  legend.append(h(doc, 'i', 'ca-sw-yes'), say(h(doc, 'span'), L.canPredict), h(doc, 'i', 'ca-sw-no'), say(h(doc, 'span'), L.cannot));
  put('pf', readout(doc, say, L.predCover, ratio(M.stats.can, M.stats.total)), box(30, READ_Y, PANEL.pred.w - 60, 84), pg);
  put('pn', say(h(doc, 'div', 'ca-note'), L.note), box(PANEL.pred.x, PANEL.y + PANEL.h + 8, PANEL.pred.w, 56));      // D-171: the new note is 829 px (EN) and 761 px (TR) long, two lines of the 618 px box: 2 x 26.4 = 53 px, so 56 (bottom at y 590 of 600)
  return finish(ctx, sc, M.n, M.frame, M.timing);
}

/** A two-line readout: the name of the measure, then the fraction and its percentage. @param {Document} doc @param {(el: HTMLElement, text: Record<string, string>) => HTMLElement} say @param {Record<string, string>} title @param {Record<string, string>} value */
function readout(doc, say, title, value) {
  const el = h(doc, 'div', 'ca-read', { 'aria-hidden': 'true' });
  el.append(say(h(doc, 'div', 'ca-read-title'), title), say(h(doc, 'div', 'ca-read-value'), value));
  return el;
}

/** The ring and the tick badge over a lit film (the film itself is drawn underneath). @param {Document} doc */
function litMark(doc) {
  const ring = h(doc, 'div', 'ca-lit', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  const badge = h(doc, 'span', 'ca-badge');
  badge.append(tick(doc, 26));
  ring.append(badge);
  return ring;
}

/** A pair the system can predict: a filled cell with a tick. @param {Document} doc */
function tickCell(doc) {
  const cell = h(doc, 'div', 'ca-pc', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  cell.append(tick(doc, 26));
  return cell;
}

/** A tick in currentColor. @param {Document} doc @param {number} size */
function tick(doc, size) {
  const ns = 'http://www.w3.org/2000/svg';
  const sv = doc.createElementNS(ns, 'svg');
  sv.setAttribute('width', String(size)); sv.setAttribute('height', String(size)); sv.setAttribute('viewBox', '0 0 34 34'); sv.setAttribute('aria-hidden', 'true');
  const p = doc.createElementNS(ns, 'path'); p.setAttribute('d', 'M7 18l7 7 14-15');
  sv.append(p);
  return /** @type {SVGElement} */ (sv);
}
