// @ts-check
// WP-50 (D-112, brief 07; page s5 `designs` of the I2RS w06 deck): the mode `designs` of pipeline, a support module like pipeline-switch.js. The two designs of an ensemble of recommenders, one above the other,
// as boxes and arrows (redrawn from Aggarwal 2016, Fig. 6.2; the idea is the book's, the picture is ours; with q = 2 recommenders). Both designs end in a COMBINE box, as the book's figure does:
//   SEQUENTIAL  Input -> Recommender 1 -> Recommender 2 -> Combiner -> Prediction; and, dashed, because it MAY be so: the original input also goes to the next recommender (Input -> Recommender 2) and the
//               earlier output to the combiner (Recommender 1 -> Combiner; the last recommender's output reaches it by the solid arrow); Burke 2002 tells the designs apart by whether the order matters (p. 344)
//   PARALLEL    Input -> Recommender 1 and Recommender 2 (the same input, side by side) -> Combiner -> Prediction
// WP-67 (D-148): the SEQUENTIAL panel is the upper one and comes first, the parallel panel the lower one and comes second, in the order the tree of the page before it (2/16) lists them.
// The combiner stands in the same column in both panels (so do the input and the prediction); the two recommenders of the parallel panel stand between the columns of the sequential ones.
// States (three presses; state 0 is the two panel titles and nothing else):
//   1 sequential   the five boxes and the solid arrows in order, the two dashed arrows last (they are the exception, not the rule); a dashed arrow is wiped in from left to right
//   2 parallel     the five boxes pop in, the two recommenders together; each solid arrow is drawn before the box it leads to
//   3 leaves       two chips under each panel: the designs of the taxonomy that belong to it, the upper panel's first (the tree's order: feature augmentation and cascade are sequential; weighted and switching are parallel)
// As in the book the outputs carry names: P1 and P2 stand beside the arrows that carry them to the combiner (the dashed arrow carries P1, the solid one P2), and a key at the top right of the sequential panel says
// what the two kinds of arrow mean: solid, always; dashed, sometimes (it comes with the first dashed arrow). (The book's q recommenders are drawn as two.)
// WP-67 (D-148, the user: the dashed arrows joined badly, the head looked stuck on to a slanting line): a dashed arrow is an ELBOW route, not a curve. It leaves the edge of a box at a right angle, runs along the
// row (over the top of it, or under the bottom) and goes into the edge of the other box at a right angle; the head is an open V on that last straight piece, square to it, and its vertex is where the last dash
// ends. The dashes are drawn as geometry, not as a dash pattern (dashPlan, dashesD): the first dash starts at the route's start, the last one ENDS at the head's vertex (no gap before the head), and a dash is
// CENTRED on each of the two corners and bends round it (a pattern of the stylesheet would leave a corner in a gap); the stretches between are whole dashes with gaps as near the wanted one as the stretch allows.
// The head is a path of its own, solid, and wiped in with the route. elbowRoute, dashPlan and dashesD are pure and checked by hand (tests/js/pipeline-designs.test.mjs).
// No numbers anywhere; nothing is synthetic. Meaning never rests on colour alone (D-068): the combiner, the box where the outputs meet, is the emphasis blue AND a box of its own in both panels; a dashed arrow is
// dashed (a shape), not only lighter; the panel titles and the chips are the page's terms (data-role="term").
//
// duration(k) = planDuration(plan(k)); box pop 300, arrow draw 300 (a dashed wipe 420):
//   1 sequential  in 0, arrow 120, r1 240, arrow 360, r2 480, arrow 600, combiner 720, arrow 840, prediction 960 (each 300, the last ends at 1260), then the dashed arrows at 1260 and 1400 (420 each)  -> 1820 ms
//   2 parallel    in 0, its two arrows 200, the two recommenders 440, their two arrows 640, combiner 840, its arrow 1040, prediction 1240            -> 1540 ms
//   3 leaves      the four chips at 0, 120, 240, 360 (340 each; the upper panel's two first)                                                          -> 700 ms
// Motion: opacity and transform (a box pops), strokeDashoffset (a solid arrow is drawn), clipPath (a dashed arrow wipes in: a dash pattern cannot be offset-revealed).
import { stepsFromFrames, h, s, fit } from './frames.js';

const W = 1680, H = 600;
const BOX_W = 240, BOX_H = 70;
/** The five columns of the sequential panel (x of the left edge of a box); the parallel panel keeps the input, the combiner and the prediction in columns 0, 3 and 4 and puts its two recommenders between columns 1 and 2. */
const COL = [60, 390, 720, 1050, 1380];
const COL_PAR = (COL[1] + COL[2]) / 2;
/**
 * Vertical layout, in the 1680 x 600 design box. WP-67 (D-148): two bands (the panels), the sequential one ABOVE the parallel one. The upper band holds the title, the row of the sequential design with its
 * dashed routes over and under it, and a row of chips beneath; the lower one the title, the two recommenders of the parallel design and a row of chips. Bands are [top, height]; the 22 px gap between them
 * and the 7 px between a chip and its band's inner edge are checked by tests/js/pipeline-designs.test.mjs.
 */
export const LAYOUT = {
  SEQ: { band: [0, 308], title: 10, row: 118 },
  PAR: { band: [330, 266], title: 340, r1: 366, r2: 454 },
  CHIP: { seq: 254, par: 542, w: 320, h: 44, x: [510, 850] },
};
const { SEQ, PAR, CHIP } = LAYOUT;
/**
 * The routes of the dashed arrows (design px): the first dash starts 8 px off the box's edge, the run lies 44 px off it, the head's vertex stops 8 px short of the other box (as the solid arrows do), its wings
 * 22 px behind it and 16 px to each side. 44 and 8 make both end stubs 36 px: a dash at the start (16), a gap (12) and a dash centred on the corner (8 + 8) fill the first stub, and the same the last one.
 */
const ROUTE = { out: 8, run: 44, tip: 8, wing: 22, half: 16 };
/** The wanted dash and gap of a dashed arrow (what the stylesheet's `.dg-kdash`, the key's sample, draws); dashPlan keeps the gap as near as each stretch of a route allows. */
const DASH = 16, GAP = 12;

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
 * WP-67 (D-148): the elbow route of a dashed arrow, in design pixels. It leaves the edge of a box straight out, runs along the row at `run` and goes straight into the edge of another box; the head is an open V
 * on the last piece, which is vertical, so the head is square to it, and its vertex is the end of the route. Pure.
 * @param {{x1: number, x2: number, edge: number, dir: -1|1}} o  x1, x2: the x of the two boxes' centres; edge: the y of the edge the route leaves and enters (the boxes' TOP edge with dir -1: over the row; their BOTTOM edge with dir 1: under it)
 * @returns {{points: Array<[number, number]>, corners: number[], length: number, head: string, tip: [number, number]}}  the four corners (start, two bends, the head's vertex), the distances of the two bends from the start,
 *   the route's length, the path of the head, and the head's vertex (the last corner)
 */
export function elbowRoute({ x1, x2, edge, dir }) {
  const y1 = edge + dir * ROUTE.out, run = edge + dir * ROUTE.run, tip = edge + dir * ROUTE.tip, wing = tip + dir * ROUTE.wing;
  const first = Math.abs(run - y1), along = Math.abs(x2 - x1);
  return {
    points: [[x1, y1], [x1, run], [x2, run], [x2, tip]],
    corners: [first, first + along],
    length: first + along + Math.abs(tip - run),
    head: `M${x2 - ROUTE.half} ${wing}L${x2} ${tip}L${x2 + ROUTE.half} ${wing}`,
    tip: [x2, tip],
  };
}

/**
 * WP-67 (D-148): where the dashes of a route lie, as intervals [from, to] of the distance along it. One dash starts the route, one ENDS it (at the head's vertex: no gap before the head), one is CENTRED on
 * every corner; each stretch between two of them holds the whole number of dashes whose gaps come nearest the wanted gap (the stretch is shared out evenly). Pure.
 * @param {number} length of the route @param {number[]} corners the distance of each bend from the start @param {number} dash @param {number} gap the gap wanted
 * @returns {Array<[number, number]>}  in order along the route
 */
export function dashPlan(length, corners, dash, gap) {
  /** @type {Array<[number, number]>} */
  const anchors = [[0, dash], ...corners.map((c) => /** @type {[number, number]} */ ([c - dash / 2, c + dash / 2])), [length - dash, length]];
  /** @type {Array<[number, number]>} */
  const out = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    const from = anchors[i - 1][1], span = anchors[i][0] - from;
    let k = 0, g = span;                                                            // k whole dashes in the stretch share it out as k + 1 equal gaps: g = (span - k * dash) / (k + 1)
    for (let j = 1; j * dash < span; j++) { const gj = (span - j * dash) / (j + 1); if (Math.abs(gj - gap) < Math.abs(g - gap)) { k = j; g = gj; } }
    for (let j = 0; j < k; j++) { const a = from + g * (j + 1) + dash * j; out.push([a, a + dash]); }
    out.push(anchors[i]);
  }
  return out;
}

/**
 * WP-67 (D-148): the path of the dashes: each interval of dashPlan is the piece of the route between its two distances, one subpath, and a dash that spans a bend goes round it. Coordinates to 0.01 px. Pure.
 * @param {Array<[number, number]>} points the corners of the route @param {Array<[number, number]>} intervals @returns {string}
 */
export function dashesD(points, intervals) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const at = (/** @type {number} */ s) => {
    let i = 0;
    while (i < points.length - 2 && s > cum[i + 1]) i++;
    const t = (s - cum[i]) / (cum[i + 1] - cum[i]);
    return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
  };
  const xy = (/** @type {number[]} */ p) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`;
  return intervals.map(([a, b]) => `M${[at(a), ...points.slice(1, -1).filter((_, i) => cum[i + 1] > a && cum[i + 1] < b), at(b)].map(xy).join('L')}`).join('');
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
  for (const [y, hh] of [SEQ.band, PAR.band]) { const band = h(doc, 'div', 'dg-band', { 'aria-hidden': 'true', 'data-gfx': 'border' }); band.style.cssText = box(0, y, W, hh); root.append(band); }
  const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  root.append(svg);
  /** A box of a panel. @param {string} key @param {number} k @param {number} start @param {number} x @param {number} y @param {Record<string, string>} text @param {string} [cls] */
  const node = (key, k, start, x, y, text, cls = '') => put(key, k, [start, 300], say(h(doc, 'div', `dg-box ${cls}`.trim(), { 'aria-hidden': 'true', 'data-gfx': 'border' }), text), box(x, y, BOX_W, BOX_H));
  /** A solid arrow, drawn from its tail to its head (pathLength 1 and the dash pattern "1 2": offset 1.02 hides it). @param {string} key @param {number} k @param {number} start @param {string} d */
  const link = (key, k, start, d) => put(key, k, [start, 300], s(doc, 'path', { class: 'dg-arrow', d, pathLength: '1', 'data-gfx': 'stroke' }), '', svg);
  /**
   * WP-67 (D-148): a dashed ELBOW route over (dir -1) or under (dir 1) the sequential row, from the top (or bottom) edge of one box to the same edge of another, wiped in from the left. The dashes are one path of
   * dash-long subpaths (dashPlan, dashesD; the stylesheet draws no pattern on it): one starts the route, one ends it at the head's vertex, one is centred on each bend. The head is a solid path of its own.
   * @param {string} key @param {number} start @param {number} x1 @param {number} x2 the x of the two boxes' centres @param {-1|1} dir
   */
  const route = (key, start, x1, x2, dir) => {
    const r = elbowRoute({ x1, x2, edge: dir < 0 ? SEQ.row : SEQ.row + BOX_H, dir });
    const wrap = h(doc, 'div', 'dg-wipe', { 'aria-hidden': 'true' });
    const sv = s(doc, 'svg', { width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}` });
    const shaft = s(doc, 'path', { class: 'dg-arrow dg-dash', d: dashesD(r.points, dashPlan(r.length, r.corners, DASH, GAP)), 'data-gfx': 'stroke' });
    sv.append(shaft, s(doc, 'path', { class: 'dg-arrow dg-head', d: r.head, 'data-gfx': 'stroke' }));
    wrap.append(sv);
    put(key, 1, [start, 420], wrap, '');
  };

  /** The name of an output, P1 or P2, beside the arrow that carries it (a plain label, no translation). @param {string} key @param {number} k @param {number} start @param {string} name @param {number} x @param {number} y */
  const pn = (key, k, start, name, x, y) => { const e = h(doc, 'div', 'dg-pn', { 'aria-hidden': 'true' }); e.textContent = name; return put(key, k, [start, 300], e, `left:${x}px;top:${y}px`); };
  // the two panel titles are part of the first picture (state 0)
  const title = (/** @type {Record<string, string>} */ text, /** @type {number} */ y) => { const t = h(doc, 'div', 'dg-title', { 'data-role': 'term' }); t.style.cssText = `left:28px;top:${y}px`; root.append(say(t, text)); };
  title(L.sequential, SEQ.title);
  title(L.parallel, PAR.title);

  // ---------- press 1: the sequential design: the solid arrows in order, the dashed ones last ----------
  const yc = SEQ.row + BOX_H / 2;
  node('s:in', 1, 0, COL[0], SEQ.row, L.input);
  link('sa:in-r1', 1, 120, arrowD(COL[0] + BOX_W + 4, yc, COL[1] - 8, yc));
  node('s:r1', 1, 240, COL[1], SEQ.row, L.r1);
  link('sa:r1-r2', 1, 360, arrowD(COL[1] + BOX_W + 4, yc, COL[2] - 8, yc));
  node('s:r2', 1, 480, COL[2], SEQ.row, L.r2);
  link('sa:r2-c', 1, 600, arrowD(COL[2] + BOX_W + 4, yc, COL[3] - 8, yc));
  node('s:c', 1, 720, COL[3], SEQ.row, L.combiner, 'dg-comb');
  link('sa:c-out', 1, 840, arrowD(COL[3] + BOX_W + 4, yc, COL[4] - 8, yc));
  node('s:out', 1, 960, COL[4], SEQ.row, L.prediction);
  // the exceptions: the original input may also go to the next recommender (over the top), the earlier output to the combiner (under the bottom)
  route('sd:in-r2', 1260, COL[0] + BOX_W / 2, COL[2] + BOX_W / 2, -1);
  route('sd:r1-c', 1400, COL[1] + BOX_W / 2, COL[3] + BOX_W / 2, 1);
  // the key of the arrows, at the top right of the panel (free of arrows there), with the first dashed arrow: a short solid and a short dashed stroke, each with its word
  const sample = (/** @type {string} */ cls) => { const sv = s(doc, 'svg', { width: '56', height: '10', viewBox: '0 0 56 10', 'aria-hidden': 'true' }); sv.append(s(doc, 'path', { class: cls, d: 'M3 5H53', 'data-gfx': 'stroke' })); return sv; };
  const key = h(doc, 'div', 'dg-key', { 'aria-hidden': 'true' });
  key.append(sample('dg-ksolid'), say(h(doc, 'span', ''), L.keySolid), sample('dg-kdash'), say(h(doc, 'span', ''), L.keyDashed));
  put('lg', 1, [1260, 360], key, `left:1010px;top:${SEQ.title + 6}px;width:610px`);
  // the outputs of the recommenders, as in the book: P1 and P2 (the dashed arrow carries P1 to the combiner, the solid one P2)
  pn('sl:1', 1, 1500, 'P1', 822, SEQ.row + BOX_H + 4);
  pn('sl:2', 1, 800, 'P2', 985, yc - 42);

  // ---------- press 2: the parallel design ----------
  const mid = (PAR.r1 + PAR.r2 + BOX_H) / 2, top = mid - BOX_H / 2;               // the input, the combiner and the prediction stand between the two recommenders
  const r1c = PAR.r1 + BOX_H / 2, r2c = PAR.r2 + BOX_H / 2;
  node('p:in', 2, 0, COL[0], top, L.input);
  link('pa:in-r1', 2, 200, arrowD(COL[0] + BOX_W + 4, mid - 12, COL_PAR - 8, r1c));
  link('pa:in-r2', 2, 200, arrowD(COL[0] + BOX_W + 4, mid + 12, COL_PAR - 8, r2c));
  node('p:r1', 2, 440, COL_PAR, PAR.r1, L.r1);
  node('p:r2', 2, 440, COL_PAR, PAR.r2, L.r2);
  link('pa:r1-c', 2, 640, arrowD(COL_PAR + BOX_W + 4, r1c, COL[3] - 8, mid - 12));
  link('pa:r2-c', 2, 640, arrowD(COL_PAR + BOX_W + 4, r2c, COL[3] - 8, mid + 12));
  node('p:c', 2, 840, COL[3], top, L.combiner, 'dg-comb');
  link('pa:c-out', 2, 1040, arrowD(COL[3] + BOX_W + 4, mid, COL[4] - 8, mid));
  node('p:out', 2, 1240, COL[4], top, L.prediction);
  pn('pl:1', 2, 840, 'P1', 884, PAR.r1 + 4);
  pn('pl:2', 2, 840, 'P2', 884, PAR.r2 + 30);

  // ---------- press 3: the designs of the taxonomy that belong to each panel, the upper panel's first ----------
  /** @param {Array<Record<string, string>>} texts @param {number} y @param {string} prefix @param {number} first the index of the first chip of this row among all four */
  const chips = (texts, y, prefix, first) => texts.forEach((text, i) => {
    put(`${prefix}:${i}`, 3, [(first + i) * 120, 340], say(h(doc, 'div', 'dg-chip', { 'data-role': 'term', 'aria-hidden': 'true', 'data-gfx': 'border' }), text), box(CHIP.x[i], y, CHIP.w, CHIP.h));
  });
  chips(D.leavesSequential, CHIP.seq, 'ls', 0);
  chips(D.leavesParallel, CHIP.par, 'lp', D.leavesSequential.length);

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
