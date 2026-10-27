// @ts-check
// WP-50 (D-112, brief 07; page s5 `designs` of the I2RS w06 deck): the mode `designs` of pipeline, a support module like pipeline-switch.js. The two designs of an ensemble of recommenders, one above the other,
// as boxes and arrows (redrawn from Aggarwal 2016, Fig. 6.2; the idea is the book's, the picture is ours; with q = 2 recommenders). Both designs end in a COMBINE box, as the book's figure does:
//   PARALLEL    Input -> Recommender 1 and Recommender 2 (the same input, side by side) -> Combiner -> Prediction
//   SEQUENTIAL  Input -> Recommender 1 -> Recommender 2 -> Combiner -> Prediction; and, dashed, because it MAY be so: the original input also goes to the next recommender (Input -> Recommender 2) and the
//               earlier output to the combiner (Recommender 1 -> Combiner; the last recommender's output reaches it by the solid arrow); Burke 2002 tells the designs apart by whether the order matters (p. 344)
// The combiner stands in the same column in both panels (so do the input and the prediction); the two recommenders of the parallel panel stand between the columns of the sequential ones.
// States (three presses; state 0 is the two panel titles and nothing else):
//   1 parallel     the five boxes pop in, the two recommenders together; each solid arrow is drawn before the box it leads to
//   2 sequential   the five boxes and the solid arrows in order, the two dashed arrows last (they are the exception, not the rule); a dashed arrow is wiped in from left to right
//   3 leaves       two chips under each panel: the designs of the taxonomy that belong to it, in the order of the tree (weighted and switching are parallel; feature augmentation and cascade are sequential)
// As in the book the outputs carry names: P1 and P2 stand beside the arrows that carry them to the combiner (the dashed arrow carries P1, the solid one P2), and a key at the top right of the sequential panel says
// what the two kinds of arrow mean: solid, always; dashed, sometimes (it comes with the first dashed arrow). (The book's q recommenders are drawn as two.)
// No numbers anywhere; nothing is synthetic. Meaning never rests on colour alone (D-068): the combiner, the box where the outputs meet, is the emphasis blue AND a box of its own in both panels; a dashed arrow is
// dashed (a shape), not only lighter; the panel titles and the chips are the page's terms (data-role="term").
//
// duration(k) = planDuration(plan(k)); box pop 300, arrow draw 300 (a dashed wipe 420):
//   1 parallel    in 0, its two arrows 200, the two recommenders 440, their two arrows 640, combiner 840, its arrow 1040, prediction 1240            -> 1540 ms
//   2 sequential  in 0, arrow 120, r1 240, arrow 360, r2 480, arrow 600, combiner 720, arrow 840, prediction 960 (each 300, the last ends at 1260), then the dashed arrows at 1260 and 1400 (420 each)  -> 1820 ms
//   3 leaves      the four chips at 0, 120, 240, 360 (340 each)                                                                                       -> 700 ms
// Motion: opacity and transform (a box pops), strokeDashoffset (a solid arrow is drawn), clipPath (a dashed arrow wipes in: a dash pattern cannot be offset-revealed).
import { stepsFromFrames, h, s, fit } from './frames.js';

const W = 1680, H = 600;
const BOX_W = 240, BOX_H = 70;
/** The five columns of the sequential panel (x of the left edge of a box); the parallel panel keeps the input, the combiner and the prediction in columns 0, 3 and 4 and puts its two recommenders between columns 1 and 2. */
const COL = [60, 390, 720, 1050, 1380];
const COL_PAR = (COL[1] + COL[2]) / 2;
/** Vertical layout, in the 1680 x 600 design box: two bands (the panels), in the upper one the two recommenders and the boxes between them, in the lower one the row, and a row of chips under each. */
const PAR = { band: [0, 270], title: 10, r1: 36, r2: 124 };
const SEQ = { band: [290, 306], title: 300, row: 372 };
const CHIP = { par: 212, seq: 524, w: 320, h: 44, x: [510, 850] };

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const LABELS = {
  parallel: frag('parallel', 'paralel'), sequential: frag('sequential', 'ardışık'),
  input: frag('Input', 'Girdi'), r1: frag('Recommender 1', 'Öneri sistemi 1'), r2: frag('Recommender 2', 'Öneri sistemi 2'), combiner: frag('Combiner', 'Birleştirici'), prediction: frag('Prediction', 'Tahmin'),
  // WP-50: the key of the arrows (it comes with the first dashed arrow): a solid arrow is always there, a dashed one only sometimes
  keySolid: frag('always', 'her zaman'), keyDashed: frag('sometimes', 'bazen'),
};
const LEAVES_PARALLEL = [frag('Weighted', 'Ağırlıklı'), frag('Switching', 'Geçişli')];
const LEAVES_SEQUENTIAL = [frag('Feature augmentation', 'Özellik artırma'), frag('Cascade', 'Kademeli')];          // the order of the tree (Fig. 6.1): feature augmentation first

/** The params of the mode `designs`, merged into pipeline's schema (the registry carries the whole). */
export const designsSchema = {
  type: 'object', additionalProperties: false, title: 'the designs mode (mode designs)',
  description: 'The labels of the boxes and the two panels, and the two chips under each panel (the designs of the taxonomy that belong to it: one design belongs to one panel).',
  default: { labels: LABELS, leavesParallel: LEAVES_PARALLEL, leavesSequential: LEAVES_SEQUENTIAL },
  properties: {
    labels: { type: 'object', additionalProperties: false, default: LABELS, properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, { ...FRAGMENT, default: v }])) },
    leavesParallel: { type: 'array', minItems: 1, maxItems: 2, items: FRAGMENT, default: LEAVES_PARALLEL },
    leavesSequential: { type: 'array', minItems: 1, maxItems: 2, items: FRAGMENT, default: LEAVES_SEQUENTIAL },
  },
};
/** The example of the mode: the lecture's page. */
export const designsExamples = [{ mode: 'designs' }];

/**
 * What the picture needs of the params and the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function designsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const D = P.designs;
  for (const [name, text] of Object.entries(D.labels)) if (!String(/** @type {any} */ (text).en ?? '').trim()) bad(`$.designs.labels.${name}`, 'has no English text: a box or a panel title must say what it is');
  /** @type {Map<string, string>} */ const seen = new Map();
  for (const key of /** @type {const} */ (['leavesParallel', 'leavesSequential'])) {
    D[key].forEach((/** @type {{en?: string}} */ leaf, /** @type {number} */ i) => {
      const name = String(leaf.en ?? '').trim();
      const at = `$.designs.${key}[${i}]`;
      if (!name) { bad(at, 'has no English text: a chip must name a design'); return; }
      const was = seen.get(name.toLowerCase());
      if (was) bad(at, `names "${name}" again (first at ${was}): a design belongs to one panel, once`);
      else seen.set(name.toLowerCase(), at);
    });
  }
  return out;
}

/**
 * The picture of the mode `designs`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of pipeline
 * @returns {import('./kit.js').WidgetBuild}
 */
export function designsBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const D = P.designs, L = D.labels;
  const n = 3;
  const root = h(doc, 'div', 'w-root dg-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @type {Map<string, {start: number, duration: number}>} */
  const when = new Map();
  /** @type {Map<string, number>} the press each keyed element belongs to */
  const press = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {number} k the press it belongs to @param {[number, number]} t [start, duration] @param {Element} el @param {string} css @param {Element} [parent] */
  const put = (key, k, t, el, css, parent) => { /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); when.set(key, { start: t[0], duration: t[1] }); press.set(key, k); (parent ?? root).append(el); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  /** The path of an arrow from (x1, y1) to (x2, y2): the line, then the open head drawn as ONE subpath (back from the tip to a wing, to the tip again, to the other wing). A dash pattern restarts at every subpath, so
   *  a head of its own subpath would show up as soon as the drawing starts; as one subpath it appears when the line has reached the tip. */
  const arrowD = (/** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ x2, /** @type {number} */ y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), p = (/** @type {number} */ d) => `${+(x2 - 15 * Math.cos(a + d)).toFixed(1)} ${+(y2 - 15 * Math.sin(a + d)).toFixed(1)}`;
    return `M${x1} ${y1}L${x2} ${y2}L${p(0.5)}L${x2} ${y2}L${p(-0.5)}`;
  };

  // the two panels are quiet bands behind everything (state 0: two empty panels with their titles)
  for (const [y, hh] of [PAR.band, SEQ.band]) { const band = h(doc, 'div', 'dg-band', { 'aria-hidden': 'true', 'data-gfx': 'border' }); band.style.cssText = box(0, y, W, hh); root.append(band); }
  const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  root.append(svg);
  /** A box of a panel. @param {string} key @param {number} k @param {number} start @param {number} x @param {number} y @param {Record<string, string>} text @param {string} [cls] */
  const node = (key, k, start, x, y, text, cls = '') => put(key, k, [start, 300], say(h(doc, 'div', `dg-box ${cls}`.trim(), { 'aria-hidden': 'true', 'data-gfx': 'border' }), text), box(x, y, BOX_W, BOX_H));
  /** A solid arrow, drawn from its tail to its head (pathLength 1 and the dash pattern "1 2": offset 1.02 hides it). @param {string} key @param {number} k @param {number} start @param {string} d */
  const link = (key, k, start, d) => put(key, k, [start, 300], s(doc, 'path', { class: 'dg-arrow', d, pathLength: '1', 'data-gfx': 'stroke' }), '', svg);
  /** A dashed route over (dir -1) or under (dir 1) the row, from the centre of one box to the centre of another, wiped in from the left (the head is a solid path of its own). */
  const route = (/** @type {string} */ key, /** @type {number} */ start, /** @type {number} */ x1, /** @type {number} */ x2, /** @type {-1|1} */ dir) => {
    const edge = dir < 0 ? SEQ.row : SEQ.row + BOX_H;
    const y1 = edge + dir * 6, tip = edge + dir * 8, wing = tip + dir * 22, bend = edge + dir * 70;
    const wrap = h(doc, 'div', 'dg-wipe', { 'aria-hidden': 'true' });
    const sv = s(doc, 'svg', { width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}` });
    sv.append(s(doc, 'path', { class: 'dg-arrow dg-dash', d: `M${x1} ${y1}C${x1} ${bend} ${x2} ${bend} ${x2} ${tip}`, 'data-gfx': 'stroke' }));
    sv.append(s(doc, 'path', { class: 'dg-arrow dg-head', d: `M${x2 - 16} ${wing}L${x2} ${tip}L${x2 + 16} ${wing}`, 'data-gfx': 'stroke' }));
    wrap.append(sv);
    put(key, 2, [start, 420], wrap, '');
  };

  /** The name of an output, P1 or P2, beside the arrow that carries it (a plain label, no translation). @param {string} key @param {number} k @param {number} start @param {string} name @param {number} x @param {number} y */
  const pn = (key, k, start, name, x, y) => { const e = h(doc, 'div', 'dg-pn', { 'aria-hidden': 'true' }); e.textContent = name; return put(key, k, [start, 300], e, `left:${x}px;top:${y}px`); };
  // the two panel titles are part of the first picture (state 0)
  const title = (/** @type {Record<string, string>} */ text, /** @type {number} */ y) => { const t = h(doc, 'div', 'dg-title', { 'data-role': 'term' }); t.style.cssText = `left:28px;top:${y}px`; root.append(say(t, text)); };
  title(L.parallel, PAR.title);
  title(L.sequential, SEQ.title);

  // ---------- press 1: the parallel design ----------
  const mid = (PAR.r1 + PAR.r2 + BOX_H) / 2, top = mid - BOX_H / 2;               // the input, the combiner and the prediction stand between the two recommenders
  const r1c = PAR.r1 + BOX_H / 2, r2c = PAR.r2 + BOX_H / 2;
  node('p:in', 1, 0, COL[0], top, L.input);
  link('pa:in-r1', 1, 200, arrowD(COL[0] + BOX_W + 4, mid - 12, COL_PAR - 8, r1c));
  link('pa:in-r2', 1, 200, arrowD(COL[0] + BOX_W + 4, mid + 12, COL_PAR - 8, r2c));
  node('p:r1', 1, 440, COL_PAR, PAR.r1, L.r1);
  node('p:r2', 1, 440, COL_PAR, PAR.r2, L.r2);
  link('pa:r1-c', 1, 640, arrowD(COL_PAR + BOX_W + 4, r1c, COL[3] - 8, mid - 12));
  link('pa:r2-c', 1, 640, arrowD(COL_PAR + BOX_W + 4, r2c, COL[3] - 8, mid + 12));
  node('p:c', 1, 840, COL[3], top, L.combiner, 'dg-comb');
  link('pa:c-out', 1, 1040, arrowD(COL[3] + BOX_W + 4, mid, COL[4] - 8, mid));
  node('p:out', 1, 1240, COL[4], top, L.prediction);
  pn('pl:1', 1, 840, 'P1', 884, 40);
  pn('pl:2', 1, 840, 'P2', 884, 154);

  // ---------- press 2: the sequential design: the solid arrows in order, the dashed ones last ----------
  const yc = SEQ.row + BOX_H / 2;
  node('s:in', 2, 0, COL[0], SEQ.row, L.input);
  link('sa:in-r1', 2, 120, arrowD(COL[0] + BOX_W + 4, yc, COL[1] - 8, yc));
  node('s:r1', 2, 240, COL[1], SEQ.row, L.r1);
  link('sa:r1-r2', 2, 360, arrowD(COL[1] + BOX_W + 4, yc, COL[2] - 8, yc));
  node('s:r2', 2, 480, COL[2], SEQ.row, L.r2);
  link('sa:r2-c', 2, 600, arrowD(COL[2] + BOX_W + 4, yc, COL[3] - 8, yc));
  node('s:c', 2, 720, COL[3], SEQ.row, L.combiner, 'dg-comb');
  link('sa:c-out', 2, 840, arrowD(COL[3] + BOX_W + 4, yc, COL[4] - 8, yc));
  node('s:out', 2, 960, COL[4], SEQ.row, L.prediction);
  // the exceptions: the original input may also go to the next recommender (over the top), the earlier output to the combiner (under the bottom)
  route('sd:in-r2', 1260, COL[0] + BOX_W / 2, COL[2] + BOX_W / 2, -1);
  route('sd:r1-c', 1400, COL[1] + BOX_W / 2, COL[3] + BOX_W / 2, 1);
  // the key of the arrows, at the top right of the panel (free of arrows there), with the first dashed arrow: a short solid and a short dashed stroke, each with its word
  const sample = (/** @type {string} */ cls) => { const sv = s(doc, 'svg', { width: '56', height: '10', viewBox: '0 0 56 10', 'aria-hidden': 'true' }); sv.append(s(doc, 'path', { class: cls, d: 'M3 5H53', 'data-gfx': 'stroke' })); return sv; };
  const key = h(doc, 'div', 'dg-key', { 'aria-hidden': 'true' });
  key.append(sample('dg-ksolid'), say(h(doc, 'span', ''), L.keySolid), sample('dg-kdash'), say(h(doc, 'span', ''), L.keyDashed));
  put('lg', 2, [1260, 360], key, `left:1010px;top:314px;width:610px`);
  // the outputs of the recommenders, as in the book: P1 and P2 (the dashed arrow carries P1 to the combiner, the solid one P2)
  pn('sl:1', 2, 1500, 'P1', 822, 456);
  pn('sl:2', 2, 800, 'P2', 985, 365);

  // ---------- press 3: the designs of the taxonomy that belong to each panel ----------
  /** @param {Array<Record<string, string>>} texts @param {number} y @param {string} prefix @param {number} first the index of the first chip of this row among all four */
  const chips = (texts, y, prefix, first) => texts.forEach((text, i) => {
    put(`${prefix}:${i}`, 3, [(first + i) * 120, 340], say(h(doc, 'div', 'dg-chip', { 'data-role': 'term', 'aria-hidden': 'true', 'data-gfx': 'border' }), text), box(CHIP.x[i], y, CHIP.w, CHIP.h));
  });
  chips(D.leavesParallel, CHIP.par, 'lp', 0);
  chips(D.leavesSequential, CHIP.seq, 'ls', D.leavesParallel.length);

  // ---------- frames and timing ----------
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const [key, el] of els) {
      const on = k >= /** @type {number} */ (press.get(key));
      const kind = key.slice(0, key.indexOf(':'));
      if (kind === 'pa' || kind === 'sa') f.set(key, { opacity: '1', strokeDashoffset: on ? '0' : '1.02' });           // a solid arrow: drawn
      else if (kind === 'sd') f.set(key, { opacity: '1', clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' });      // a dashed arrow: wiped in
      else if (key === 'lg' || kind === 'pl' || kind === 'sl') f.set(key, { opacity: on ? '1' : '0' });                    // the key of the arrows and the names of the outputs: fade in
      else f.set(key, on ? { opacity: '1', transform: 'scale(1)' } : { opacity: '0', transform: 'scale(0.7)' });             // a box or a chip: pops
    }
    return f;
  };
  const timing = (/** @type {string} */ key) => /** @type {{start: number, duration: number}} */ (when.get(key));
  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
