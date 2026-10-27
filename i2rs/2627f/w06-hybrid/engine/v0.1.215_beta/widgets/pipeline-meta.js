// @ts-check
// WP-51 (D-124, brief of slide-lead 2026-10-25; page `meta-level` of the I2RS w06 deck, data contract in docs/research/i2rs-ch06-wp50-widget-data.md): the mode `meta` of pipeline, a support module like pipeline-designs.js.
// A meta-level hybrid hands the second technique the WHOLE MODEL the first one learned, not just its output (Burke 2002, p. 343). The first system (content-based) learns a PROFILE for each user; the second
// (collaborative) compares users by these profiles, not by their ratings (Pazzani's approach as Melville et al. 2002, p. 191, tell it). The last press sets it against feature augmentation, where an OUTPUT (a rating)
// is what is handed on. A profile is a small card, a user icon and three bars over the genres (comedy, drama, sci-fi). The lengths of the bars (and the four stars of the output in press 3) are invented, plainly an example; the speaker note
// and the evidence record say so and the picture carries no label (D-129: "synthetic data" only on a chart that could pass for a measurement).
// States (three presses; state 0 is empty):
//   1 profile     the content-based model, one arrow, ONE profile card (a user and three bars that grow: what the model learned about this user), headed "learned profiles"
//   2 compare     two more profile cards (three users); two of them are alike (their bars, and a pill "similar profiles" between them); the collaborative model reads the three profiles (three arrows)
//   3 difference  the scene gives way to two rows, each model 1 -> what is handed on -> model 2: feature augmentation (above: an output, a rating) and meta-level (below: the model itself, a profile); the boxes
//                 that are handed on stand in the same column and are the emphasis blue AND a box of their own (D-068)
// The two similar profiles are the second and the third card (the first press shows the second, so its arrow runs straight); the pure check refuses a deck whose bars make another pair closer.
//
// duration(k) = planDuration(plan(k)); box pop 300, arrow draw 300, a bar grows in 380:
//   1  model 0, arrow 200, heading and card 440, bars 640 / 720 / 800                                                                        -> 1180 ms
//   2  arrows 0 / 100, cards 240 / 340, bars 480.. / 580.. (60 apart), the pill 900, three arrows 1000 / 1060 / 1120, the collaborative model 1300   -> 1600 ms
//   3  the scene fades 0..400, bands and titles 200..560, the upper row 360 / 560 / 760 / 960 / 1160, the lower row 120 later                     -> 1580 ms
// Motion: opacity and transform (a box pops, a bar grows by scaleX, a scene fades), strokeDashoffset (an arrow is drawn: ONE subpath, shaft then head retraced, as in pipeline-designs.js).
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon, starRow } from './pictos.js';

const W = 1680, H = 600;
/** The scene of presses 1 and 2: the content-based model, the profile cards (a column), the collaborative model. */
const CB = { x: 100, y: 234, w: 300, h: 120 };
const CARD = { x: 600, w: 420, h: 120, y: [70, 234, 410] };
const CF = { x: 1260, y: 234, w: 330, h: 120 };
const SIM = { w: 300, h: 36, y: 364 };                       // the pill in the gap between the second and the third card
/** The two rows of press 3: the bands (y, height), the titles' y, the boxes (x, width) and the y of the top of a model box and of the box that is handed on (rows: feature augmentation, meta-level). */
const BAND = [[0, 286], [314, 286]];
const TITLE_Y = [8, 322];
const ROW = { m1: { x: 100, w: 330 }, pass: { x: 640, w: 400 }, m2: { x: 1250, w: 330 }, mh: 110, ph: 130, my: [113, 427], py: [103, 417] };
const GENRES = /** @type {const} */ (['comedy', 'drama', 'scifi']);

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const LABELS = {
  contentBased: frag('Content-based model', 'İçerik tabanlı model'), collaborative: frag('Collaborative model', 'İşbirlikçi model'),
  profiles: frag('Learned profiles', 'Öğrenilmiş profiller'), comedy: frag('Comedy', 'Komedi'), drama: frag('Drama', 'Dram'), scifi: frag('Sci-fi', 'Bilim kurgu'),
  similar: frag('similar profiles', 'benzer profiller'),
  augmentation: frag('feature augmentation', 'özellik artırma'), metaLevel: frag('meta-level', 'meta-düzey'),
  output: frag('Output (ratings)', 'Çıktı (puanlar)'), itself: frag('The model itself (profile)', 'Modelin kendisi (profil)'),
};
/** The bars of the three profile cards (comedy, drama, sci-fi; 0..1, an example): the second and the third user are alike, the first is not. */
const PROFILES = [[0.25, 0.9, 0.4], [0.9, 0.3, 0.6], [0.85, 0.35, 0.55]];

/** The params of the mode `meta`, merged into pipeline's schema (the registry carries the whole). */
export const metaSchema = {
  type: 'object', additionalProperties: false, title: 'the meta-level mode (mode meta)',
  description: 'The labels of the picture and the bars of the three profile cards. The second and the third card are the two similar profiles (the pill between them says so), so their bars must be closer to each other than to the first card\'s. The bars are an example (no label on the picture, D-129).',
  default: { labels: LABELS, profiles: PROFILES },
  properties: {
    labels: { type: 'object', additionalProperties: false, default: LABELS, properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, { ...FRAGMENT, default: v }])) },
    profiles: {
      type: 'array', minItems: 3, maxItems: 3, default: PROFILES, title: 'the bars of the three profile cards',
      description: 'Each card: three numbers 0..1 (comedy, drama, sci-fi), the length of the bars. An example, no number is written.',
      items: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 1 } },
    },
  },
};
/** The example of the mode: the lecture's page. */
export const metaExamples = [{ mode: 'meta' }];

/** The distance of two profiles: the sum of the differences of their bars. @param {number[]} a @param {number[]} b */
export const profileDistance = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0);

/**
 * What the picture needs of the params and the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function metaProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const M = P.meta;
  for (const [name, text] of Object.entries(M.labels)) if (!String(/** @type {any} */ (text).en ?? '').trim()) bad(`$.meta.labels.${name}`, 'has no English text: a box, a bar or a title must say what it is');
  const [a, b, c] = M.profiles;
  if (a && b && c && !(profileDistance(b, c) < Math.min(profileDistance(a, b), profileDistance(a, c)))) bad('$.meta.profiles', 'the second and the third profile are the similar pair (the pill says so): their bars must be closer to each other than to the first');
  return out;
}

/**
 * The picture of the mode `meta`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of pipeline
 * @returns {import('./kit.js').WidgetBuild}
 */
export function metaBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const L = P.meta.labels;
  /** @type {number[][]} */ const profiles = P.meta.profiles;
  const n = 3;
  const root = h(doc, 'div', 'w-root dg-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @type {Map<string, {start: number, duration: number}>} */
  const when = new Map();
  /** @type {Map<string, {press: number, kind: 'box'|'arrow'|'fade'|'grow'}>} the press each keyed element belongs to, and how it comes */
  const about = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {number} k @param {'box'|'arrow'|'fade'|'grow'} kind @param {[number, number]} t [start, duration] @param {Element} el @param {string} css @param {Element} parent */
  const put = (key, k, kind, t, el, css, parent) => { if (css) /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); when.set(key, { start: t[0], duration: t[1] }); about.set(key, { press: k, kind }); parent.append(el); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  /** The path of an arrow: the line, then the open head as ONE subpath (a dash pattern restarts at every subpath, so a head of its own would show up at once). */
  const arrowD = (/** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ x2, /** @type {number} */ y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), p = (/** @type {number} */ d) => `${+(x2 - 15 * Math.cos(a + d)).toFixed(1)} ${+(y2 - 15 * Math.sin(a + d)).toFixed(1)}`;
    return `M${x1} ${y1}L${x2} ${y2}L${p(0.5)}L${x2} ${y2}L${p(-0.5)}`;
  };

  /** A layer of its own with an svg for the arrows: the scene of presses 1 and 2, the two rows of press 3. */
  const layer = () => {
    const el = h(doc, 'div', 'dg-panel');
    const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    el.append(svg);
    root.append(el);
    return { el, svg };
  };
  const scene = layer();
  scene.el.setAttribute('data-key', 'scene'); els.set('scene', scene.el);
  const link = (/** @type {{svg: SVGElement}} */ ly, /** @type {string} */ key, /** @type {number} */ k, /** @type {number} */ start, /** @type {string} */ d) => put(key, k, 'arrow', [start, 300], s(doc, 'path', { class: 'dg-arrow', d, pathLength: '1', 'data-gfx': 'stroke' }), '', ly.svg);
  /** A box with an optional icon above its label. */
  const node = (/** @type {{el: HTMLElement}} */ ly, /** @type {string} */ key, /** @type {number} */ k, /** @type {number} */ start, /** @type {{x: number, y: number, w: number, h: number}} */ r, /** @type {Record<string, string>} */ text, /** @type {string} */ cls, /** @type {string} */ icn = '') => {
    const b = h(doc, 'div', `dg-box ${cls}`.trim(), { 'aria-hidden': 'true', 'data-gfx': 'border' });
    if (icn) b.append(icon(doc, /** @type {any} */ (icn), 48));
    b.append(say(h(doc, 'span', ''), text));
    return put(key, k, 'box', [start, 300], b, box(r.x, r.y, r.w, r.h), ly.el);
  };
  /** The bars of a profile, as tracks with a fill; the fills are returned to be animated. @param {number[]} values @param {string} cls @param {Array<Record<string, string>>} [names] */
  const bars = (values, cls, names) => {
    /** @type {HTMLElement[]} */ const fills = [];
    const rows = values.map((v, i) => {
      const row = h(doc, 'div', cls);
      if (names) row.append(say(h(doc, 'span', ''), names[i]));
      const track = h(doc, 'div', 'pf-track', { 'data-gfx': 'border' });
      const fill = h(doc, 'div', 'pf-fill', { 'data-gfx': 'fill' });
      fill.style.width = `${Math.round(v * 100)}%`;
      track.append(fill);
      row.append(track);
      fills.push(fill);
      return row;
    });
    return { rows, fills };
  };

  // ---------- press 1: the content-based model learns a profile: one card, its bars grow ----------
  const cy = (/** @type {number} */ i) => CARD.y[i] + CARD.h / 2;
  const mid = CB.y + CB.h / 2;
  node(scene, 'cb', 1, 0, CB, L.contentBased, 'dg-stack', 'attributes');
  // the heading of the column stands over the one card of press 1 and rides up to the head of the column when the other two arrive (a transform)
  const HEAD_Y = 22, HEAD_Y1 = CARD.y[1] - 44;
  const head = say(h(doc, 'div', 'pf-head'), L.profiles);
  head.style.cssText += `;left:${CARD.x}px;top:${HEAD_Y1}px`;
  head.setAttribute('data-key', 'ph'); els.set('ph', head); scene.el.append(head);
  /** A profile card: a user and three labelled bars; its fills are keyed by the card and the bar. @param {number} i the card @param {number} k the press @param {number} start @param {number} barStart @param {number} barGap */
  const card = (i, k, start, barStart, barGap) => {
    const el = h(doc, 'div', 'pf-card', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    el.append(icon(doc, 'user', 52));
    const { rows, fills } = bars(profiles[i], 'pf-row', GENRES.map((g) => L[g]));
    rows.forEach((row, j) => { row.style.top = `${10 + j * 34}px`; el.append(row); });
    put(`pc:${i}`, k, 'box', [start, 300], el, box(CARD.x, CARD.y[i], CARD.w, CARD.h), scene.el);
    fills.forEach((f, j) => put(`bf:${i}:${j}`, k, 'grow', [barStart + j * barGap, 380], f, '', row0(f)));
  };
  /** The fill stays where it is built (inside its track): `put` appends to a parent, so hand it the fill's own parent. @param {HTMLElement} f */
  const row0 = (f) => /** @type {Element} */ (f.parentElement);
  link(scene, 'ma:1', 1, 200, arrowD(CB.x + CB.w + 4, mid, CARD.x - 8, cy(1)));
  card(1, 1, 440, 640, 80);

  // ---------- press 2: two more users; two of the three profiles are alike; the collaborative model reads the profiles ----------
  link(scene, 'ma:0', 2, 0, arrowD(CB.x + CB.w + 4, mid - 12, CARD.x - 8, cy(0)));
  link(scene, 'ma:2', 2, 100, arrowD(CB.x + CB.w + 4, mid + 12, CARD.x - 8, cy(2)));
  card(0, 2, 240, 480, 60);
  card(2, 2, 340, 580, 60);
  const sim = h(doc, 'div', 'pf-sim', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  const wave = s(doc, 'svg', { width: '32', height: '22', viewBox: '0 0 32 22', 'aria-hidden': 'true' });
  wave.append(s(doc, 'path', { d: 'M2 8q7-7 14 0t14 0M2 17q7-7 14 0t14 0', 'data-gfx': 'stroke' }));
  sim.append(wave, say(h(doc, 'span', ''), L.similar));
  put('sim', 2, 'fade', [900, 320], sim, box(CARD.x + (CARD.w - SIM.w) / 2, SIM.y, SIM.w, SIM.h), scene.el);
  [0, 1, 2].forEach((i) => link(scene, `ca:${i}`, 2, 1000 + i * 60, arrowD(CARD.x + CARD.w + 4, cy(i), CF.x - 8, mid + (i - 1) * 20)));
  node(scene, 'cf', 2, 1300, CF, L.collaborative, 'dg-stack', 'users');

  // ---------- press 3: two rows: what is handed on (an output, or the model itself) ----------
  const rows = layer();
  const rowTitles = [L.augmentation, L.metaLevel];
  [0, 1].forEach((r) => {
    const band = h(doc, 'div', 'dg-band', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    put(`b3:${r}`, 3, 'fade', [200, 360], band, box(0, BAND[r][0], W, BAND[r][1]), rows.el);
    const title = h(doc, 'div', 'dg-title', { 'data-role': 'term' });
    put(`t3:${r}`, 3, 'fade', [200, 360], say(title, rowTitles[r]), `left:28px;top:${TITLE_Y[r]}px`, rows.el);
  });
  rows.el.append(rows.svg);                                                              // the arrows above the bands (a band has a ground of its own), under the boxes that follow
  [0, 1].forEach((r) => {
    const t0 = 360 + r * 120;
    const my = ROW.my[r], py = ROW.py[r], cyr = my + ROW.mh / 2;
    node(rows, `r${r}m1`, 3, t0, { x: ROW.m1.x, y: my, w: ROW.m1.w, h: ROW.mh }, L.contentBased, '');
    link(rows, `r${r}a1`, 3, t0 + 200, arrowD(ROW.m1.x + ROW.m1.w + 4, cyr, ROW.pass.x - 8, cyr));
    const passed = node(rows, `r${r}p`, 3, t0 + 400, { x: ROW.pass.x, y: py, w: ROW.pass.w, h: ROW.ph }, r === 0 ? L.output : L.itself, 'dg-comb dg-pass');
    if (r === 0) passed.append(starRow(doc, 4, 24, 5));                                              // an output: a rating, shown as stars
    else {                                                                                            // the model itself: a profile card in small
      const mini = h(doc, 'div', 'pf-mini');
      mini.append(icon(doc, 'user', 40));
      const col = h(doc, 'div', 'pf-minibars');
      for (const row of bars(profiles[1], 'pf-mrow').rows) col.append(row);
      mini.append(col);
      passed.append(mini);
    }
    link(rows, `r${r}a2`, 3, t0 + 600, arrowD(ROW.pass.x + ROW.pass.w + 4, cyr, ROW.m2.x - 8, cyr));
    node(rows, `r${r}m2`, 3, t0 + 800, { x: ROW.m2.x, y: my, w: ROW.m2.w, h: ROW.mh }, L.collaborative, '');
  });

  // ---------- frames and timing ----------
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('scene', { opacity: k >= 3 ? '0' : '1' });
    f.set('ph', { opacity: k >= 1 ? '1' : '0', transform: `translateY(${k >= 2 ? HEAD_Y - HEAD_Y1 : 0}px)` });
    for (const [key, a] of about) {
      const on = k >= a.press;
      f.set(key, a.kind === 'arrow' ? { opacity: '1', strokeDashoffset: on ? '0' : '1.02' }
        : a.kind === 'fade' ? { opacity: on ? '1' : '0' }
          : a.kind === 'grow' ? { transform: on ? 'scaleX(1)' : 'scaleX(0)' }
            : on ? { opacity: '1', transform: 'scale(1)' } : { opacity: '0', transform: 'scale(0.7)' });
    }
    return f;
  };
  const timing = (/** @type {string} */ key, /** @type {number} */ k) => key === 'scene' ? { start: 0, duration: 400 }
    : key === 'ph' ? (k === 1 ? { start: 440, duration: 300 } : { start: 100, duration: 500 })
      : /** @type {{start: number, duration: number}} */ (when.get(key));
  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
