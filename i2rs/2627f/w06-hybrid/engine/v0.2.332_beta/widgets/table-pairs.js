// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1, P3; the page `diversity` of the I2RS w07 deck, storyboard §3): the mode `pairs` of table-highlight. Intra-list diversity, told as a picture: a recommendation list of three films, the similarity of each of its three pairs,
// and diversity as the mean dissimilarity of the pairs (Ziegler et al. 2005; Vargas and Castells 2011; Kaminskas and Bridge 2016). A list of three films of the same genre against a list of three different genres; and diversity can be told apart from accuracy
// (Ziegler's finding is verified at the level of the abstract: a topic diversification can cost a little accuracy and raise satisfaction; the note says so). The similarities are a toy: the picture is plainly an example and carries no label (D-129).
//
// A list is three generic posters (one emblem shape stands for one genre). The three pairs are (first, second), (second, third) and (first, third); a pair carries a bracket under the posters and its similarity (0 to 1) in a pill. By hand, the defaults:
// list A, one genre: similarities 0.8, 0.9, 0.7: dissimilarities 0.2, 0.1, 0.3: intra-list diversity = (0.2 + 0.1 + 0.3) / 3 = 0.20; list B, three genres: 0.2, 0.3, 0.1: dissimilarities 0.8, 0.7, 0.9: (0.8 + 0.7 + 0.9) / 3 = 0.80.
//
// State 0 is empty. Three presses:
//   1 pairs      the list of three films of one genre and the similarity of each of its three pairs
//   2 diversity  the list of three genres beside it with its three pairs; each list gets its intra-list diversity as one formula line (D-174: ILD = frac(Σ (1 − similarity)|number of pairs) = frac(0.2 + 0.1 + 0.3|3) = 0.20) and a gauge
//   3 not accuracy  two pills (accuracy: a little lower; satisfaction: higher) and the gold sentence: diversity can be told apart from accuracy, measure both
//
// WP-93 (the user's w07 review of 2026-11-01, page 7, with a screenshot; alternative A of the review board): the pills tell what happens when the list of ONE genre turns into the list of THREE (Ziegler 2005), so they stand under
// the list they describe, panel B, exactly as wide as it (x 900 to 1620: 360 + 20 + 340), with an arrow in the gap between the panels, level with the two gauges, that reads A -> B (0.20 to 0.80); the gold sentence moves under
// panel A (x 60 to 780; with the new D-171 text it takes two balanced lines at 26 px on a 1.12 line, 58 px in the 60 px box). They had no place in the picture's logic and ran 60 px past panel A (x 840 against 780); and a dashed red and a solid green frame read as the
// keys of a legend, so the user looked for those lines inside the shapes. Now a chip has NO frame: a tint of the role colour (18 % over the ground), a triangle (down: lower, up: higher) in the role colour and the words in ink,
// so the cue is a shape and words as well as a colour (D-068). The arrow is a child of panel B (it comes with the panel in press 2) and the triangles are drawn shapes (no font glyph).
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): 980 / 1430 / 880 ms.
//   1  max(the panel 100 + u, the three pairs 300 + i * 150 + u)   2  max(the panel 100 + u, the three pairs 300 + i * 150 + u, the two readouts 900 + u and 1050 + u)   3  max(the pills 100 + u and 250 + u, the sentence 500 + u)
//
// Motion: opacity and transform (a rise). Nothing else.
import { h, s } from './frames.js';
import { emblem } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { U, finish, frag, labelsSchema, num, pressDuration, rise, scene } from './w07-common.js';

const PANEL = { y: 50, w: 720, h: 476, a: 60, b: 900 };
const POSTER = { w: 110, h: 140, x: [80, 305, 530], y: 76 };
/** WP-93: the bottom row. The pills fill panel B (360 + 20 + 340 = 720: the Turkish "çevrimdışı skor: biraz düşük" is the widest text and gets the wider pill), the gold sentence fills panel A. */
const ROW = { pillY: 544, pillH: 44, downW: 360, upW: 340, goldY: 536, goldH: 60 };
/**
 * WP-93 (D-174): the readout under the pairs: the term (30 px line), the formula in one fixed-height line (the fraction line is about 54 px high at 24 px: 2 * 22.08 * 1.12 + .23 * 22.08) and the gauge's track (10 px under it, 24 px high). The heights are fixed so the
 * track stands where the sums say whatever the browser makes of the fractions: panel y 336 + 30 + 58 + 10 = 434 to 458, 12 px above the panel's inner foot (470). It stood at 424 before, with the one-line sum.
 */
const READ = { y: 336, h: 122, title: 30, formula: 58, gap: 10, track: 24 };
/** WP-93: the middle of the two gauges (the tracks of the intra-list diversity bars: stage y 487 to 511 = panel y 50 + border 3 + 434 to 458): the arrow between the panels is level with them. The border of a panel is 3 px. */
const BORDER = 3, GAUGE_MID = PANEL.y + BORDER + READ.y + READ.title + READ.formula + READ.gap + READ.track / 2, ARROW = { w: 100, h: 40 };

/**
 * WP-93: a triangle for a pill, drawn as a shape (no font glyph, so no fallback font): down for "lower", up for "higher". @param {Document} doc @param {'down'|'up'} dir
 */
function triangle(doc, dir) {
  const v = s(doc, 'svg', { class: `pr-tri pr-tri-${dir}`, width: '18', height: '16', viewBox: '0 0 18 16', 'aria-hidden': 'true', focusable: 'false' });
  v.append(s(doc, 'path', { d: dir === 'down' ? 'M1 2h16L9 15z' : 'M1 14h16L9 1z' }));
  return v;
}

const LABELS = {
  a: frag('one genre', 'tek tür'), b: frag('three genres', 'üç tür'), ild: frag('intra-list diversity (ILD)', 'liste içi çeşitlilik (ILD)'),
  // WP-93 (D-174): the symbolic part of the readout's formula (formula.js mark-up); the fraction with the numbers and the value are worked out from the similarities
  ildFormula: frag('ILD = frac(Σ (1 − similarity)|number of pairs)', 'ILD = frac(Σ (1 − benzerlik)|çift sayısı)'),
  acc: frag('offline score: a little lower', 'çevrimdışı skor: biraz düşük'), sat: frag('satisfaction: higher', 'memnuniyet: daha yüksek'),      // D-171 (the user's term decision): "accuracy" is an offline score here
  gold: frag('diversity differs from offline performance, so both are measured', 'çeşitlilik çevrimdışı başarımdan ayrılır, bu yüzden ikisi de ölçülür'),      // D-171: the old text ended in the bare command "measure both"
};
/** The pairs of a list of three, by the index of their two films: (first, second), (second, third), (first, third). */
const PAIRS = Object.freeze(/** @type {Array<[number, number]>} */ ([[0, 1], [1, 2], [0, 2]]));
const SIM_A = [0.8, 0.9, 0.7], SIM_B = [0.2, 0.3, 0.1];

/** The params of the mode `pairs`, merged into table-highlight's schema (the registry carries the whole). */
export const pairsSchema = {
  type: 'object', additionalProperties: false, title: 'intra-list diversity (mode pairs)',
  description: '`simA` and `simB` are the similarities (0..1) of the three pairs of each list, in the order first-second, second-third, first-third; list A is the list of one genre (its pairs must be more similar than list B\'s). `genre` is the emblem (0..9) '
    + 'that stands for the genre of list A and `genres` the three emblems of list B (all different). The similarities are a toy; the picture carries no label.',
  default: { simA: SIM_A, simB: SIM_B, genre: 3, genres: [0, 4, 7], labels: LABELS },
  properties: {
    simA: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 1 }, default: SIM_A },
    simB: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 1 }, default: SIM_B },
    genre: { type: 'integer', minimum: 0, maximum: 9, default: 3 },
    genres: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'integer', minimum: 0, maximum: 9 }, default: [0, 4, 7] },
    labels: labelsSchema(LABELS),
  },
};
export const pairsExamples = [{ mode: 'pairs' }, { mode: 'pairs', pairs: { simA: [0.6, 0.7, 0.5], simB: [0.4, 0.5, 0.3], genre: 1, genres: [2, 5, 8] } }];
export const pairsPresses = 3;

/** Intra-list diversity: the mean dissimilarity (1 - similarity) of the pairs of a list. @param {number[]} sims */
export const ild = (sims) => sims.reduce((a, x) => a + (1 - x), 0) / sims.length;

/**
 * WP-93 (D-174): the readout of a list as the page writes it, per language: the symbolic fraction (a label) = the fraction with the numbers = the value, e.g. `ILD = frac(Σ (1 − similarity)|number of pairs) = frac(0.2 + 0.1 + 0.3|3) = 0.20`. Pure.
 * @param {number[]} sims the similarities of the pairs @param {Record<string, Record<string, string>>} L the labels @returns {Record<'en'|'tr', string>}
 */
export function ildFormula(sims, L) {
  const dis = sims.map((x) => num(1 - x, 1)), value = num(ild(sims), 2);
  return /** @type {any} */ (Object.fromEntries(['en', 'tr'].map((lang) => [lang, `${L.ildFormula[lang] ?? L.ildFormula.en} = frac(${dis.map((d) => /** @type {any} */ (d)[lang]).join(' + ')}|${sims.length}) = ${/** @type {any} */ (value)[lang]}`])));
}

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function pairsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const Q = P.pairs;
  if (new Set(Q.genres).size !== 3) out.push({ path: '$.pairs.genres', detail: 'names an emblem twice: the three films of list B are of three different genres' });
  if (Q.genres.includes(Q.genre)) out.push({ path: '$.pairs.genre', detail: `is the emblem ${Q.genre}, which is also one of the genres of list B: the two lists must not share a genre` });
  for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.ildFormula ?? {}))) {         // WP-93: the formula mark-up of formula.js, refused with its place when it does not parse
    const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
    if (problem) out.push({ path: `$.pairs.labels.ildFormula.${lang}`, detail: problem });
  }
  if (!(ild(Q.simA) < ild(Q.simB))) out.push({ path: '$.pairs.simB', detail: `has an intra-list diversity of ${ild(Q.simB).toFixed(2)}, not above list A's ${ild(Q.simA).toFixed(2)}: the list of three genres is the more diverse one` });
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function pairsModel(P) {
  const Q = P.pairs;
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('pa', rise(k >= 1)); f.set('pb', rise(k >= 2));
    for (let i = 0; i < 3; i++) { f.set(`ba:${i}`, rise(k >= 1)); f.set(`bb:${i}`, rise(k >= 2)); }
    f.set('ia', rise(k >= 2)); f.set('ib', rise(k >= 2));
    f.set('c1', rise(k >= 3)); f.set('c2', rise(k >= 3)); f.set('gs', rise(k >= 3));
    return f;
  };
  /** @param {string} key @returns {import('./frames.js').Timing} */
  const timing = (key) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    switch (kind) {
      case 'pa': case 'pb': return { start: 100, duration: U };
      case 'ba': case 'bb': return { start: 300 + i * 150, duration: U };
      case 'ia': return { start: 900, duration: U };
      case 'ib': return { start: 1050, duration: U };
      case 'c1': return { start: 100, duration: U };
      case 'c2': return { start: 250, duration: U };
      case 'gs': return { start: 500, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { ildA: ild(Q.simA), ildB: ild(Q.simB), frame, timing, n: pairsPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `pairs`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function pairsBuild(ctx, P) {
  const Q = P.pairs, L = Q.labels;
  const M = pairsModel(P);
  const sc = scene(ctx, 'mx-root pr-root');
  const { doc, box, put, add, say } = sc;
  /** @type {Array<[string, string, string, Record<string, string>, number[], number[], number, number, string]>} */
  const lists = [
    ['pa', 'ba', 'ia', L.a, Q.simA, [Q.genre, Q.genre, Q.genre], M.ildA, PANEL.a, 'pr-a'],
    ['pb', 'bb', 'ib', L.b, Q.simB, Q.genres, M.ildB, PANEL.b, 'pr-b'],
  ];
  for (const [pk, bk, ik, title, sims, emblems, value, x0, cls] of lists) {
    const panel = put(pk, h(doc, 'div', `pr-panel ${cls}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(x0, PANEL.y, PANEL.w, PANEL.h));
    add(say(h(doc, 'div', 'pr-title'), title), box(0, 8, PANEL.w, 44), panel);
    emblems.forEach((e, i) => {
      const poster = h(doc, 'div', 'pr-poster', { 'data-gfx': 'border' });
      poster.append(emblem(doc, e, 56));
      add(poster, box(POSTER.x[i], POSTER.y, POSTER.w, POSTER.h), panel);
    });
    PAIRS.forEach(([i, j], n) => {
      const ci = POSTER.x[i] + POSTER.w / 2, cj = POSTER.x[j] + POSTER.w / 2, depth = j - i === 2 ? 84 : 34;
      const br = h(doc, 'div', 'pr-bracket', { 'aria-hidden': 'true' });
      const chip = h(doc, 'span', 'pr-sim'); say(chip, num(sims[n], 1));
      br.append(chip);
      put(`${bk}:${n}`, br, box(ci, POSTER.y + POSTER.h + 6, cj - ci, depth), panel);
    });
    const read = h(doc, 'div', 'pr-read', { 'aria-hidden': 'true' });
    const fm = say(h(doc, 'div', 'pr-read-formula'), ildFormula(sims, L));                // WP-93 (D-174): one line, symbolic fraction = the fraction with the numbers = the value
    renderFormula(doc, fm);
    read.append(say(h(doc, 'div', 'pr-read-title'), L.ild), fm);
    const track = h(doc, 'div', 'pr-track', { 'data-gfx': 'border' });
    const gauge = h(doc, 'i', 'pr-gauge', { 'data-gfx': 'fill' }); gauge.style.cssText = `width:${Math.max(4, Math.round(value * (PANEL.w - 96)))}px`;
    track.append(gauge);
    read.append(track);
    put(ik, read, box(24, READ.y, PANEL.w - 48, READ.h), panel);
    if (pk === 'pb') {                                                    // WP-93: the arrow A -> B in the gap between the panels, a child of panel B (it comes with it, in press 2)
      const gap = PANEL.b - (PANEL.a + PANEL.w);
      const arrow = s(doc, 'svg', { class: 'pr-arrow', width: String(ARROW.w), height: String(ARROW.h), viewBox: `0 0 ${ARROW.w} ${ARROW.h}`, 'aria-hidden': 'true', focusable: 'false' });
      arrow.append(s(doc, 'path', { d: `M4 ${ARROW.h / 2}H${ARROW.w - 6}M${ARROW.w - 20} ${ARROW.h / 2 - 12}L${ARROW.w - 5} ${ARROW.h / 2}L${ARROW.w - 20} ${ARROW.h / 2 + 12}`, 'stroke-width': '4' }));
      add(arrow, box(PANEL.a + PANEL.w + (gap - ARROW.w) / 2 - (PANEL.b + BORDER), GAUGE_MID - ARROW.h / 2 - (PANEL.y + BORDER), ARROW.w, ARROW.h), panel);   // in panel B's own coordinates
    }
  }
  const pill = (/** @type {string} */ key, /** @type {'down'|'up'} */ dir, /** @type {Record<string, string>} */ text, /** @type {number} */ x, /** @type {number} */ w) => {
    const el = say(h(doc, 'div', `pr-pill pr-pill-${dir}`), text);       // WP-93: the triangle comes after the text, which setText would otherwise replace
    el.prepend(triangle(doc, dir));
    put(key, el, box(x, ROW.pillY, w, ROW.pillH));
  };
  pill('c1', 'down', L.acc, PANEL.b, ROW.downW);
  pill('c2', 'up', L.sat, PANEL.b + PANEL.w - ROW.upW, ROW.upW);               // x 900 to 1260 and 1280 to 1620
  put('gs', say(h(doc, 'div', 'pr-gold', { 'data-role': 'key' }), L.gold), box(PANEL.a, ROW.goldY, PANEL.w, ROW.goldH));
  return finish(ctx, sc, M.n, M.frame, M.timing);
}
