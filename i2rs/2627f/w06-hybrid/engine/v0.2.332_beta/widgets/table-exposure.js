// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2 item 8; the page `mnar` of the I2RS w07 deck, storyboard §3): the mode `exposure` of table-highlight. Why the missing ratings are not random (MNAR), told on a toy rating matrix of 6 users x 8 films (Marlin and Zemel
// 2007; Steck 2010; Schnabel et al. 2016): users rate what they like, and they cannot rate what they were never shown. The w06 page `limits` keeps the mode `mnar` (the held-out ratings, the screen outside the matrix); this mode is the w07 page's own four presses.
// The matrix is a toy: the cells carry a small gauge, no number. The error bars of press 3 could be read as a measurement, so they carry a "synthetic data" tag (D-129; the tag is a label, empty hides it).
//
// A cell is rated (a frame and a gauge), shown but not rated (a dashed empty cell), or never shown (a hatched veil with a crossed eye): every rated cell was shown, so the rated cells are a subset of the shown ones.
// State 0 is the empty grid (every cell dashed), the films and the users. Four presses:
//   1 selection      the rated cells appear, and a histogram next to them: the ratings pile up high (users rate what they like), against the ratings if every film were rated
//   2 exposure       the never-shown cells get their veil and a legend: you cannot rate what you were never shown; shown-not-rated and never-shown are different things
//   3 popular / tail the films split into popular and long tail (brackets), a bar under each film counts its ratings, and two bars compare the error on the two groups: the error is not the same on both
//   4 remedies       the matrix steps back; three cards: a random test sample (users rate randomly chosen items), unbiased estimators such as IPS (named only; the maths is further reading), sensitivity analysis
//
// By hand, the default matrix (6 users x 8 films): 19 rated cells, 5 shown but not rated, 24 never shown (19 + 5 + 24 = 48). The ratings: nine 5s, eight 4s, two 3s: shares 0.474, 0.421, 0.105 (4 and 5 together 0.895; if every film were rated: 0.40).
// Ratings per film: 5 5 4 1 1 0 1 2: the three popular films hold 14 of the 19 ratings, the five long-tail films 5. The error bars: 0.7 on the popular films, 1.1 on the long tail.
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): 744 / 742 / 980 / 1080 ms with the defaults.
//   1  max(the last rated cell 40 + (n - 1) * 18 + u, the histogram 200 + u)   2  max(the last veil 40 + (v - 1) * 14 + u, the legend 200 + u, the histogram leaves in 260)
//   3  max(the brackets 100 + 150 + u, the count bars 200 + 7 * 40 + 500, the panel 200 + u)   4  max(the matrix dims in 400, the last card 300 + 2 * 200 + u)
//
// Motion: opacity and transform (scale pops, scaleX / scaleY for a bar). Nothing else.
import { h } from './frames.js';
import { emblem, icon } from './pictos.js';
import { item } from './w07-items.js';
import { U, finish, frag, grow, labelsSchema, on, pop, pressDuration, rise, scene } from './w07-common.js';

const CELL = 56, PITCH = 64, GX = 90, GY = 104;
const PANEL = { x: 660, y: 100, w: 960, h: 390 };

const LABELS = {
  popular: frag('popular films', 'popüler filmler'), tail: frag('long-tail films', 'uzun kuyruk filmleri'),
  liked: frag('users rate what they like', 'kullanıcılar beğendiğini puanlar'), observed: frag('observed ratings', 'gözlenen puanlar'), everyone: frag('if every film were rated', 'her film puanlansaydı'),
  rated: frag('rated', 'puanlandı'), shownNot: frag('shown, not rated', 'gösterildi, puanlanmadı'), never: frag('never shown: it cannot be rated', 'hiç gösterilmedi: puanlanamaz'),
  cannot: frag('you cannot rate what you were never shown', 'görmediğini puanlayamazsın'),
  differs: frag('the error is not the same on both', 'hata ikisinde aynı değil'), error: frag('average error', 'ortalama hata'), tag: frag('synthetic data', 'sentetik veri'),
  r1: frag('a random test sample', 'rastgele örneklenmiş test'), r1d: frag('ask users to rate randomly chosen items', 'kullanıcılardan rastgele seçilen öğeleri puanlamasını iste'),
  r2: frag('unbiased estimators, such as IPS', 'yansız tahminciler, örneğin IPS'), r2d: frag('weigh each rating by how likely it was to be shown', 'her puanı gösterilme olasılığına göre ağırlıklandır'),
  r3: frag('sensitivity analysis', 'duyarlılık analizi'), r3d: frag('ask how much the conclusion changes if the missing ratings were different', 'eksik puanlar farklı olsaydı sonucun ne kadar değiştiğine bak'),
};
const RATINGS = ['545.4...', '4.5....5', '55.4....', '435...3.', '.45.....', '54.....4'];
const SHOWN = ['xxxxx...', 'xxx....x', 'xxxx....', 'xxx...x.', 'xxx.....', 'xxx....x'];
const EVERYONE = [0.12, 0.18, 0.3, 0.22, 0.18];
const ERRORS = [0.7, 1.1];

/** The params of the mode `exposure`, merged into table-highlight's schema (the registry carries the whole). */
export const exposureSchema = {
  type: 'object', additionalProperties: false, title: 'the missing-not-at-random mode (mode exposure)',
  description: '`ratings` has one string per user, one character per film: "." is an empty cell, "1".."5" a rating. `shown` has the same shape: "x" is a film the user was shown, "." a film never shown (every rated cell must be shown). `popular` is the number of popular films '
    + '(the first columns). `everyone` are the shares of the ratings 1..5 if every film were rated (they add up to 1). `errors` are the average error on the popular films and on the long tail (a toy; the picture tags it). The matrix carries no number.',
  default: { ratings: RATINGS, shown: SHOWN, popular: 3, everyone: EVERYONE, errors: ERRORS, labels: LABELS },
  properties: {
    ratings: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string', minLength: 3, maxLength: 8 }, default: RATINGS },
    shown: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string', minLength: 3, maxLength: 8 }, default: SHOWN },
    popular: { type: 'integer', minimum: 1, maximum: 6, default: 3 },
    everyone: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'number', minimum: 0, maximum: 1 }, default: EVERYONE },
    errors: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0 }, default: ERRORS },
    labels: labelsSchema(LABELS),
  },
};
export const exposureExamples = [{ mode: 'exposure' }, { mode: 'exposure', exposure: { ratings: ['54..', '45.5', '.45.'], shown: ['xxx.', 'xxxx', 'xxx.'], popular: 2 } }];
export const exposurePresses = 4;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function exposureProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.exposure;
  /** @type {string[]} */ const rt = Q.ratings, sh = Q.shown;
  const cols = rt[0]?.length ?? 0;
  if (rt.length !== sh.length) bad('$.exposure.shown', `has ${sh.length} users, ratings has ${rt.length}: one string per user in both`);
  rt.forEach((row, r) => {
    if (row.length !== cols) bad(`$.exposure.ratings[${r}]`, `has ${row.length} films, the first row has ${cols}: every row must have the same length`);
    if (!/^[.1-5]+$/.test(row)) bad(`$.exposure.ratings[${r}]`, `holds "." or 1..5, found "${row}"`);
  });
  sh.forEach((row, r) => {
    if (row.length !== cols) bad(`$.exposure.shown[${r}]`, `has ${row.length} films, ratings has ${cols}: every row must have the same length`);
    if (!/^[x.]+$/.test(row)) bad(`$.exposure.shown[${r}]`, `holds "x" or ".", found "${row}"`);
  });
  if (out.length) return out;
  rt.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' && sh[r][c] !== 'x') bad(`$.exposure.shown[${r}]`, `film ${c} of user ${r} is rated but not shown: a rated cell was shown`); }));
  const m = exposureStats(Q);
  if (m.observed === 0) bad('$.exposure.ratings', 'has no rating');
  if (m.never === 0) bad('$.exposure.shown', 'shows every film to every user: there is nothing to veil');
  if (m.shownNot === 0) bad('$.exposure.shown', 'has no film that is shown and not rated: the page tells them apart from the never-shown ones');
  if (Q.popular >= cols) bad('$.exposure.popular', `is ${Q.popular}: it must leave at least one long-tail film (${cols} films)`);
  else {
    const pop = m.perFilm.slice(0, Q.popular).reduce((a, x) => a + x, 0) / Q.popular, tail = m.perFilm.slice(Q.popular).reduce((a, x) => a + x, 0) / (cols - Q.popular);
    if (!(pop > tail)) bad('$.exposure.ratings', `has ${pop.toFixed(2)} ratings per popular film and ${tail.toFixed(2)} per long-tail film: the popular films must be rated more`);
  }
  const sum = Q.everyone.reduce((/** @type {number} */ a, /** @type {number} */ x) => a + x, 0);
  if (Math.abs(sum - 1) > 0.01) bad('$.exposure.everyone', `add up to ${sum.toFixed(2)}, not 1`);
  const high = (/** @type {number[]} */ v) => v[3] + v[4];
  if (!(high(m.shares) > high(Q.everyone))) bad('$.exposure.everyone', `has ${(high(Q.everyone) * 100).toFixed(0)} % of 4s and 5s, the observed ratings ${(high(m.shares) * 100).toFixed(0)} %: the page says the observed ratings pile up higher`);
  if (!(Q.errors[0] < Q.errors[1])) bad('$.exposure.errors', `are ${Q.errors[0]} and ${Q.errors[1]}: the error on the popular films must be the smaller one`);
  return out;
}

/**
 * The counts of a matrix: rated, shown but not rated, never shown cells, ratings per film and the shares of the ratings 1..5. Pure.
 * @param {{ratings: string[], shown: string[]}} Q
 */
export function exposureStats(Q) {
  const cols = Q.ratings[0].length;
  let observed = 0, shownNot = 0, never = 0;
  const perFilm = Array.from({ length: cols }, () => 0), hist = [0, 0, 0, 0, 0];
  Q.ratings.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') { observed++; perFilm[c]++; hist[Number(ch) - 1]++; } else if (Q.shown[r][c] === 'x') shownNot++; else never++;
  }));
  return { observed, shownNot, never, perFilm, hist, shares: hist.map((n) => (observed ? n / observed : 0)) };
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function exposureModel(P) {
  const Q = P.exposure;
  /** @type {string[]} */ const rt = Q.ratings, sh = Q.shown;
  const cols = rt[0].length;
  const stats = exposureStats(Q);
  /** @type {Array<[number, number]>} */ const rated = [], veiled = [];
  rt.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') rated.push([r, c]); else if (sh[r][c] !== 'x') veiled.push([r, c]); }));
  const gone = { start: 0, duration: 260 };
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('mat', { opacity: k === 4 ? '0.25' : '1' });
    for (const [r, c] of rated) f.set(`ob:${r}:${c}`, pop(k >= 1));
    for (const [r, c] of veiled) f.set(`nv:${r}:${c}`, pop(k >= 2));
    f.set('h1', on(k === 1)); f.set('h2', on(k === 2)); f.set('h3', on(k === 3));
    f.set('bk:0', rise(k >= 3)); f.set('bk:1', rise(k >= 3));
    for (let c = 0; c < cols; c++) f.set(`cn:${c}`, grow(k >= 3, 'y'));
    for (let i = 0; i < 3; i++) f.set(`rc:${i}`, rise(k >= 4));
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a, b] = key.split(':');
    const i = Number(a);
    switch (kind) {
      case 'mat': return { start: 0, duration: 400 };
      case 'ob': return { start: 40 + rated.findIndex(([r, c]) => r === i && c === Number(b)) * 18, duration: U };
      case 'nv': return { start: 40 + veiled.findIndex(([r, c]) => r === i && c === Number(b)) * 14, duration: U };
      case 'h1': case 'h2': case 'h3': return k === Number(kind.slice(1)) ? { start: 200, duration: U } : gone;
      case 'bk': return { start: 100 + i * 150, duration: U };
      case 'cn': return { start: 200 + i * 40, duration: 500 };
      case 'rc': return { start: 300 + i * 200, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { cols, rows: rt.length, rated, veiled, stats, frame, timing, n: exposurePresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `exposure`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function exposureBuild(ctx, P) {
  const Q = P.exposure, L = Q.labels;
  const M = exposureModel(P);
  const sc = scene(ctx, 'mx-root ex-root');
  const { doc, box, put, add, say } = sc;
  const cx = (/** @type {number} */ c) => GX + c * PITCH, cy = (/** @type {number} */ r) => GY + r * PITCH;
  const gridW = M.cols * PITCH - (PITCH - CELL);
  // the matrix, its films (generic emblems) and its users, in a group that steps back for the remedies
  const mat = put('mat', h(doc, 'div', 'ex-mat'), box(0, 0, 1680, 600));
  for (let c = 0; c < M.cols; c++) add(emblem(doc, (c * 3 + 1) % 10, 30), `position:absolute;left:${cx(c) + (CELL - 30) / 2}px;top:${GY - 44}px`, mat);
  for (let r = 0; r < M.rows; r++) { const u = icon(doc, 'user', 34); u.classList.add('ex-user'); add(u, `left:${GX - 52}px;top:${cy(r) + 11}px`, mat); }
  for (let r = 0; r < M.rows; r++) for (let c = 0; c < M.cols; c++) add(h(doc, 'div', 'ex-empty', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(cx(c), cy(r), CELL, CELL), mat);
  for (const [r, c] of M.rated) {
    const cell = h(doc, 'div', 'ex-ob', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    const lv = Number(Q.ratings[r][c]);
    cell.append(h(doc, 'i', 'ex-bar', { 'data-gfx': 'fill' }));
    /** @type {HTMLElement} */ (cell.lastElementChild).style.cssText = `height:${Math.round((CELL - 14) * lv / 5)}px`;
    put(`ob:${r}:${c}`, cell, box(cx(c), cy(r), CELL, CELL), mat);
  }
  for (const [r, c] of M.veiled) {
    const veil = h(doc, 'div', 'ex-nv', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    veil.append(icon(doc, 'eyeoff', 26));
    put(`nv:${r}:${c}`, veil, box(cx(c), cy(r), CELL, CELL), mat);
  }
  // press 3: the brackets over the films, a count bar under each film
  const nPop = Q.popular;
  /** @type {Array<[string, number, number, Record<string, string>]>} */
  const groups = [['bk:0', 0, nPop, L.popular], ['bk:1', nPop, M.cols, L.tail]];
  for (const [key, from, to, name] of groups) {
    const br = h(doc, 'div', 'ex-bk', { 'aria-hidden': 'true' });
    br.append(say(h(doc, 'span'), name));
    put(key, br, box(cx(from), 4, cx(to - 1) + CELL - cx(from), 34), mat);
  }
  const maxPer = Math.max(1, ...M.stats.perFilm);
  for (let c = 0; c < M.cols; c++) {
    const n = M.stats.perFilm[c];
    put(`cn:${c}`, h(doc, 'i', 'ex-cn', { 'data-gfx': 'fill' }), `${box(cx(c) + 14, cy(M.rows - 1) + CELL + 12, CELL - 28, Math.max(3, Math.round(60 * n / maxPer)))};transform-origin:50% 0`, mat);
  }
  // the panels of the right side: one per press, the next one replaces the last
  const panel = (/** @type {string} */ key, /** @type {Record<string, string>} */ title) => {
    const el = h(doc, 'div', 'ex-panel', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    el.append(say(h(doc, 'div', 'ex-title'), title));
    put(key, el, box(PANEL.x, PANEL.y, PANEL.w, PANEL.h));
    return el;
  };
  // press 1: the histogram of the observed ratings next to the ratings if every film were rated
  const h1 = panel('h1', L.liked);
  const hx = 60, hw = 150, bw = 46, base = 320, hmax = 200;
  for (let lv = 0; lv < 5; lv++) {
    /** @type {Array<[number, string]>} */
    const bars = [[M.stats.shares[lv], 'ex-hist-ob'], [Q.everyone[lv], 'ex-hist-all']];
    bars.forEach(([share, cls], j) => add(h(doc, 'i', `ex-hist ${cls}`, { 'data-gfx': 'fill' }), box(hx + lv * hw + j * (bw + 6), base - Math.max(3, Math.round(hmax * share / 0.5)), bw, Math.max(3, Math.round(hmax * share / 0.5))), h1));
    add(say(h(doc, 'div', 'ex-hx'), { en: String(lv + 1), tr: String(lv + 1) }), box(hx + lv * hw, base + 8, 2 * bw + 6, 30), h1);
  }
  const lg1 = h(doc, 'div', 'ex-legend'); lg1.append(h(doc, 'i', 'ex-sw ex-hist-ob'), say(h(doc, 'span'), L.observed), h(doc, 'i', 'ex-sw ex-hist-all'), say(h(doc, 'span'), L.everyone));
  add(lg1, box(60, 60, 840, 40), h1);
  // press 2: the legend of the three kinds of cell
  const h2 = panel('h2', L.cannot);
  /** @type {Array<[string, Record<string, string>]>} */
  const kinds = [['ex-ob', L.rated], ['ex-empty', L.shownNot], ['ex-nv', L.never]];
  kinds.forEach(([cls, name], i) => {
    const sample = h(doc, 'div', `${cls} ex-sample`, { 'aria-hidden': 'true' });
    if (cls === 'ex-ob') { const bar = h(doc, 'i', 'ex-bar', { 'data-gfx': 'fill' }); bar.style.cssText = `height:${Math.round((CELL - 14) * 0.8)}px`; sample.append(bar); }
    if (cls === 'ex-nv') sample.append(icon(doc, 'eyeoff', 26));
    add(sample, box(60, 100 + i * 90, CELL, CELL), h2);
    add(say(h(doc, 'div', 'ex-kind'), name), box(140, 100 + i * 90, 760, CELL), h2);
  });
  // press 3: the error on the two groups of films
  const h3 = panel('h3', L.differs);
  [[L.popular, Q.errors[0], 'ex-err-pop'], [L.tail, Q.errors[1], 'ex-err-tail']].forEach(([name, err, cls], i) => {
    add(say(h(doc, 'div', 'ex-kind'), /** @type {Record<string, string>} */ (name)), box(60, 120 + i * 110, 840, 36), h3);
    add(h(doc, 'i', `ex-err ${cls}`, { 'data-gfx': 'fill' }), box(60, 164 + i * 110, Math.round(/** @type {number} */ (err) / Math.max(...Q.errors) * 700), 40), h3);
  });
  add(say(h(doc, 'div', 'ex-cap'), L.error), box(60, 340, 400, 30), h3);
  const tg = add(say(h(doc, 'div', 'ex-tag'), L.tag), box(PANEL.w - 280, 18, 250, 40), h3);
  if (!L.tag.en) /** @type {HTMLElement} */ (tg).hidden = true;
  // press 4: three remedies
  /** @type {Array<[string, Record<string, string>, Record<string, string>, () => Element]>} */
  const cards = [['rc:0', L.r1, L.r1d, () => item(doc, 'dice', 56)], ['rc:1', L.r2, L.r2d, () => icon(doc, 'sliders', 56)], ['rc:2', L.r3, L.r3d, () => icon(doc, 'magnifier', 56)]];
  cards.forEach(([key, title, how, glyph], i) => {
    const el = h(doc, 'div', 'ex-card', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    const g = glyph(); g.classList.add('ex-glyph');
    const txt = h(doc, 'div', 'ex-card-text');
    txt.append(say(h(doc, 'div', 'ex-card-title'), title), say(h(doc, 'div', 'ex-card-how'), how));
    el.append(g, txt);
    put(key, el, box(PANEL.x, PANEL.y + i * 130, PANEL.w, 112));
  });
  return finish(ctx, sc, M.n, M.frame, M.timing);
}
