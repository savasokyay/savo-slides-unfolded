// @ts-check
// WP-51 (D-124, brief of slide-lead 2026-10-25; page `homo-hetero` of the I2RS w06 deck, data contract in docs/research/i2rs-ch06-wp50-widget-data.md): the mode `kinds` of pipeline, a support module like pipeline-designs.js.
// What an ensemble reads: ONE kind of data or SEVERAL kinds (the deck's definition; copies of one model are the page `bias-variance`, not this one). Two panels, one above the other, the same columns in both
// (data, models, the weighted blend, the prediction), so the only thing that differs is what stands in the first two columns:
//   HOMOGENEOUS    one box of data (ratings) -> three DIFFERENT models (a factor model, a neighbourhood model, a Boltzmann machine: the families of Jahrer et al. 2010) -> weighted blend -> prediction
//   HETEROGENEOUS  two boxes of data of two kinds (ratings, film attributes: two different icons) -> a collaborative model (reads the ratings) and a content-based model (reads the attributes) -> the same blend -> prediction (P-Tango)
// The picture is a box-and-arrow scheme and carries no note about it (D-127: a scheme that shows no data value says nothing of being schematic; the model names are generic, the size and place of a box are no measure);
// no weight is written, only that there are weights (w1, w2), so nothing in it is synthetic either.
// States (three presses; state 0 is the two panel titles, nothing else):
//   1 homogeneous   the data box, three arrows, the three models, three arrows, the blend, its arrow, the prediction (each arrow is drawn before the box it leads to)
//   2 heterogeneous the same for the lower panel; the upper panel goes quiet (0.4), the attention is below
//   3 idea          the two arrows into the blend of the lower panel are drawn again, thicker and in the emphasis blue, and the weights w1 and w2 stand on them
// Meaning never rests on colour alone (D-068): the blend is the emphasis blue AND a box of its own in both panels; the two kinds of data differ by shape (two icons, two names); the weighted arrows are thicker
// (7 against 4 px) and carry a label, and the upper panel is dimmed (opacity), not recoloured. Panel titles are the page's terms (data-role="term").
//
// duration(k) = planDuration(plan(k)); box pop 300, arrow draw 300:
//   1  data 0, arrows 200, models 440 / 500 / 560, arrows 760, blend 960, arrow 1160, prediction 1360                                                       -> 1660 ms
//   2  data 0 / 80, arrows 200, models 440 / 500, arrows 700, blend 900, arrow 1100, prediction 1300 (the upper panel dims 0..400)                           -> 1600 ms
//   3  the two thick arrows 0 / 100 (320), the labels 280 / 380 (300)                                                                                        -> 680 ms
// Motion: opacity and transform (a box pops, a label fades, a panel dims), strokeDashoffset (an arrow is drawn: ONE subpath, shaft then head retraced, as in pipeline-designs.js).
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon } from './pictos.js';

const W = 1680, H = 600;
const BOX_H = 64, BLEND_H = 76;
const X = { data: 30, model: 560, blend: 1070, out: 1440 };
const WID = { data: 350, model: 310, blend: 270, out: 210 };
/** The two panels: the band (y, height), the title's y, and the rows of the models (y of the top of a box). */
const HOM = { band: [0, 286], title: 8, rows: [52, 130, 208] };
const HET = { band: [314, 286], title: 322, rows: [410, 498] };

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const LABELS = {
  homogeneous: frag('homogeneous', 'homojen'), heterogeneous: frag('heterogeneous', 'heterojen'),
  ratings: frag('Ratings', 'Puanlar'), attributes: frag('Film attributes', 'Film öznitelikleri'),
  factor: frag('Factor model', 'Faktör modeli'), neighbourhood: frag('Neighbourhood model', 'Komşuluk modeli'), boltzmann: frag('Boltzmann machine', 'Boltzmann makinesi'),
  collaborative: frag('Collaborative model', 'İşbirlikçi model'), contentBased: frag('Content-based model', 'İçerik tabanlı model'),
  blend: frag('Weighted blend', 'Ağırlıklı karışım'), prediction: frag('Prediction', 'Tahmin'),
};

/** The params of the mode `kinds`, merged into pipeline's schema (the registry carries the whole). */
export const kindsSchema = {
  type: 'object', additionalProperties: false, title: 'the data-kinds mode (mode kinds)',
  description: 'The labels of the picture: the two panel titles, the two kinds of data, the five models, the blend and the prediction (the picture shows no data value, so it has no note about being schematic or synthetic). The three models of the homogeneous panel must be different models.',
  default: { labels: LABELS },
  properties: {
    labels: { type: 'object', additionalProperties: false, default: LABELS, properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, { ...FRAGMENT, default: v }])) },
  },
};
/** The example of the mode: the lecture's page. */
export const kindsExamples = [{ mode: 'kinds' }];

/**
 * What the picture needs of the params and the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function kindsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const L = P.kinds.labels;
  const name = (/** @type {string} */ key) => String(L[key]?.en ?? '').trim();
  for (const key of Object.keys(L)) if (!name(key)) bad(`$.kinds.labels.${key}`, 'has no English text: a box or a panel title must say what it is');
  /** @param {string[]} keys @param {string} why */
  const distinct = (keys, why) => {
    /** @type {Map<string, string>} */ const seen = new Map();
    for (const key of keys) {
      const n = name(key).toLowerCase();
      if (!n) continue;
      const was = seen.get(n);
      if (was) bad(`$.kinds.labels.${key}`, `names "${name(key)}" again (first at $.kinds.labels.${was}): ${why}`);
      else seen.set(n, key);
    }
  };
  distinct(['factor', 'neighbourhood', 'boltzmann'], 'homogeneous means different models on one kind of data, not copies of one model');
  distinct(['ratings', 'attributes'], 'heterogeneous means two different kinds of data');
  distinct(['collaborative', 'contentBased'], 'the two models of the heterogeneous panel are different models');
  return out;
}

/**
 * The picture of the mode `kinds`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of pipeline
 * @returns {import('./kit.js').WidgetBuild}
 */
export function kindsBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const L = P.kinds.labels;
  const n = 3;
  const root = h(doc, 'div', 'w-root dg-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @type {Map<string, {start: number, duration: number}>} */
  const when = new Map();
  /** @type {Map<string, {press: number, kind: 'box'|'arrow'|'fade'}>} the press each keyed element belongs to, and how it comes */
  const about = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {number} k @param {'box'|'arrow'|'fade'} kind @param {[number, number]} t [start, duration] @param {Element} el @param {string} css @param {Element} parent */
  const put = (key, k, kind, t, el, css, parent) => { if (css) /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); when.set(key, { start: t[0], duration: t[1] }); about.set(key, { press: k, kind }); parent.append(el); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  /** The path of an arrow from (x1, y1) to (x2, y2): the line, then the open head as ONE subpath (a dash pattern restarts at every subpath, so a head of its own would show up at once). */
  const arrowD = (/** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ x2, /** @type {number} */ y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), p = (/** @type {number} */ d) => `${+(x2 - 15 * Math.cos(a + d)).toFixed(1)} ${+(y2 - 15 * Math.sin(a + d)).toFixed(1)}`;
    return `M${x1} ${y1}L${x2} ${y2}L${p(0.5)}L${x2} ${y2}L${p(-0.5)}`;
  };

  /** A panel: a layer of its own (the upper one dims as a whole), the quiet band, the title, an svg for the arrows. */
  const panel = (/** @type {{band: number[], title: number}} */ spec, /** @type {Record<string, string>} */ title) => {
    const layer = h(doc, 'div', 'dg-panel');
    const band = h(doc, 'div', 'dg-band', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    band.style.cssText = box(0, spec.band[0], W, spec.band[1]);
    const t = h(doc, 'div', 'dg-title', { 'data-role': 'term' });
    t.style.cssText = `left:28px;top:${spec.title}px`;
    const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    layer.append(band, say(t, title), svg);
    root.append(layer);
    return { layer, svg };
  };
  const hom = panel(HOM, L.homogeneous);
  const het = panel(HET, L.heterogeneous);
  hom.layer.setAttribute('data-key', 'hom'); els.set('hom', hom.layer);                  // the upper panel dims as a whole in press 2

  /** @param {{layer: HTMLElement, svg: SVGElement}} pn @param {string} key @param {number} k @param {number} start @param {number} y @param {number} hh @param {Record<string, string>} text @param {{x: number, w: number}} col @param {string} [cls] @param {string} [icn] */
  const node = (pn, key, k, start, y, hh, text, col, cls = '', icn = '') => {
    const b = h(doc, 'div', `dg-box ${cls}`.trim(), { 'aria-hidden': 'true', 'data-gfx': 'border' });
    if (icn) b.append(icon(doc, /** @type {any} */ (icn), 40));
    b.append(say(h(doc, 'span', ''), text));
    return put(key, k, 'box', [start, 300], b, box(col.x, y, col.w, hh), pn.layer);
  };
  /** An arrow of a panel, drawn by dash offset (pathLength 1, the pattern "1 2": offset 1.02 hides it). */
  const link = (/** @type {{layer: HTMLElement, svg: SVGElement}} */ pn, /** @type {string} */ key, /** @type {number} */ k, /** @type {number} */ start, /** @type {string} */ d, /** @type {string} */ cls = 'dg-arrow', /** @type {number} */ dur = 300) =>
    put(key, k, 'arrow', [start, dur], s(doc, 'path', { class: cls, d, pathLength: '1', 'data-gfx': 'stroke' }), '', pn.svg);
  const COL = { data: { x: X.data, w: WID.data }, model: { x: X.model, w: WID.model }, blend: { x: X.blend, w: WID.blend }, out: { x: X.out, w: WID.out } };
  const rightOf = (/** @type {{x: number, w: number}} */ c) => c.x + c.w + 4;
  const leftOf = (/** @type {{x: number, w: number}} */ c) => c.x - 8;
  const centre = (/** @type {number} */ y, /** @type {number} */ hh = BOX_H) => y + hh / 2;

  // ---------- press 1: the homogeneous panel: one kind of data, three different models ----------
  const rowsH = HOM.rows, mid1 = (centre(rowsH[0]) + centre(rowsH[2])) / 2;
  node(hom, 'hd', 1, 0, mid1 - BOX_H / 2, BOX_H, L.ratings, COL.data, 'dg-data', 'ratings');
  const modelsH = [L.factor, L.neighbourhood, L.boltzmann];
  modelsH.forEach((text, i) => {
    link(hom, `ha:${i}`, 1, 200, arrowD(rightOf(COL.data), mid1 + (i - 1) * 18, leftOf(COL.model), centre(rowsH[i])));
    node(hom, `hm:${i}`, 1, 440 + i * 60, rowsH[i], BOX_H, text, COL.model);
    link(hom, `hb:${i}`, 1, 760, arrowD(rightOf(COL.model), centre(rowsH[i]), leftOf(COL.blend), mid1 + (i - 1) * 20));
  });
  node(hom, 'hc', 1, 960, mid1 - BLEND_H / 2, BLEND_H, L.blend, COL.blend, 'dg-comb');
  link(hom, 'ho', 1, 1160, arrowD(rightOf(COL.blend), mid1, leftOf(COL.out), mid1));
  node(hom, 'hp', 1, 1360, mid1 - BOX_H / 2, BOX_H, L.prediction, COL.out);

  // ---------- press 2: the heterogeneous panel: two kinds of data, each read by its own model ----------
  const rowsE = HET.rows, mid2 = (centre(rowsE[0]) + centre(rowsE[1])) / 2;
  const dataE = [{ text: L.ratings, icn: 'ratings' }, { text: L.attributes, icn: 'attributes' }];
  const modelsE = [L.collaborative, L.contentBased];
  const meet = [mid2 - 16, mid2 + 16];                                                    // where the two arrows meet the blend
  dataE.forEach((d, i) => {
    node(het, `ed:${i}`, 2, i * 80, rowsE[i], BOX_H, d.text, COL.data, 'dg-data', d.icn);
    link(het, `ea:${i}`, 2, 200, arrowD(rightOf(COL.data), centre(rowsE[i]), leftOf(COL.model), centre(rowsE[i])));
    node(het, `em:${i}`, 2, 440 + i * 60, rowsE[i], BOX_H, modelsE[i], COL.model);
    link(het, `eb:${i}`, 2, 700, arrowD(rightOf(COL.model), centre(rowsE[i]), leftOf(COL.blend), meet[i]));
  });
  node(het, 'ec', 2, 900, mid2 - BLEND_H / 2, BLEND_H, L.blend, COL.blend, 'dg-comb');
  link(het, 'eo', 2, 1100, arrowD(rightOf(COL.blend), mid2, leftOf(COL.out), mid2));
  node(het, 'ep', 2, 1300, mid2 - BOX_H / 2, BOX_H, L.prediction, COL.out);

  // ---------- press 3: the weights of the heterogeneous panel come forward: the two arrows again, thicker and in the emphasis blue, and a label on each ----------
  rowsE.forEach((_, i) => {
    const x1 = rightOf(COL.model), y1 = centre(rowsE[i]), x2 = leftOf(COL.blend), y2 = meet[i];
    link(het, `lit:${i}`, 3, i * 100, arrowD(x1, y1, x2, y2), 'dg-arrow dg-lit', 320);
    const w = h(doc, 'div', 'dg-w', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    const sym = h(doc, 'span');                                                          // one inline child: the grid would stack a bare "w" and its subscript
    sym.append(doc.createTextNode('w'), h(doc, 'sub'));
    /** @type {HTMLElement} */ (sym.lastChild).textContent = String(i + 1);
    w.append(sym);
    put(`w:${i}`, 3, 'fade', [280 + i * 100, 300], w, box(Math.round((x1 + x2) / 2 - 29), Math.round((y1 + y2) / 2 - 19), 58, 38), het.layer);
  });

  // ---------- frames and timing ----------
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('hom', { opacity: k >= 2 ? '0.4' : '1' });
    for (const [key, a] of about) {
      const on = k >= a.press;
      f.set(key, a.kind === 'arrow' ? { opacity: '1', strokeDashoffset: on ? '0' : '1.02' }
        : a.kind === 'fade' ? { opacity: on ? '1' : '0' }
          : on ? { opacity: '1', transform: 'scale(1)' } : { opacity: '0', transform: 'scale(0.7)' });
    }
    return f;
  };
  const timing = (/** @type {string} */ key) => key === 'hom' ? { start: 0, duration: 400 } : /** @type {{start: number, duration: number}} */ (when.get(key));
  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
