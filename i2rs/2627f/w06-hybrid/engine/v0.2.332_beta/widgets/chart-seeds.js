// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2 P2; the page `one-run` of the I2RS w07 deck, storyboard §3): the mode `seeds` of chart-draw. One run is an anecdote: the same algorithm's accuracy moves with the random seed of the split, up to 6.3 % from the mean
// for a single split and at most 2.3 % with cross-validation (Wegmeth et al. 2023, p. 1: measured, with the source); an untuned baseline shows fake progress (Rendle, Zhang and Koren 2019, p. 5: BPMF on ML10M was reported with RMSE 0.8197 and, run carefully,
// reached 0.7633 and passed the best reported method, 0.7634); and the practice (RecSys 2022: only 5 of 26 papers that need seeds repeated them; more than half of the papers that propose a new algorithm have no significance test).
// The deviation bands (6.3 % and 2.3 %), the RMSEs and the paper counts are published numbers. The dots of single seeds are NOT measured: they are drawn inside the measured bands to show the idea, so the picture carries a "synthetic data" tag (D-129; the tag is a label, empty hides it).
//
// State 0 is the frame: the mean line and the axis of the deviation (% from the mean score). Four presses:
//   1 one split   its name, then the band of a single split (+-6.3 %) and eight seeds scattered inside it, the largest on the edge: the winner can change with the seed
//   2 cross-validation  its name, then a narrower band (+-2.3 %) and its eight points: with a larger K the spread shrinks (WP-93: the name comes in with its band, not from the start)
//   3 fake progress     a number line of RMSE: BPMF as reported (0.8197) falls to 0.7633 when run carefully, a ring at 0.7634 is the best reported method: the carefully run baseline passes it (WP-93: the arrow's shaft draws leftwards, THEN its head is swept in from the top)
//   4 practice    two cards (5 of 26 papers repeated the seeds; more than half of the new-algorithm papers have no significance test) and the gold sentence "one run is an anecdote"
//
// duration(k) = pressDuration (FADE 500, POP 300, LABEL 360; every start is in the plan below): 1260 / 1260 / 1700 / 960 ms.
//   1  its name 0 + 360, the band 100 + 500, the eight points 300 + i * 70 (+ 300), the label 900 + 360, the tag 100 + 360   2  the same for the second band, its name 0 + 360   3  the panel 100 + 360, the three points 300 + i * 200 (+ 300), the arrow's shaft 900 + 500, its head 1400 + 300
//   4  the two cards 100 and 300 (+ 360), the sentence 600 + 360
//
// Motion: strokeDashoffset (the arrow's shaft draws), clipPath (the arrow's head is wiped in from the top), opacity + transform (bands fade, points and cards pop and rise). No colour keyframes.
import { h, s } from './frames.js';
import { finish, frag, labelsSchema, num, pressDuration, scene } from './w07-common.js';

const AXIS = Object.freeze({ cx: 480, k: 54, yAxis: 410, yTop: 120 });          // x of a deviation v (%): cx + v * k, so +-6.3 % is 340 px either side
const ROWS = Object.freeze([{ y: 190, label: 100 }, { y: 340, label: 250 }]);
const FADE = 500, POP = 300, LABEL = 360, HEAD = 300;                           // WP-93: HEAD, the wipe of the arrow's head (it is 25 px high)
const RIGHT = Object.freeze({ x: 960, y: 100, w: 680, h: 300 });

const LABELS = {
  axis: frag('deviation from the mean score (%)', 'ortalama skordan sapma (%)'), one: frag('one split (K = 1)', 'tek bölme (K = 1)'), cv: frag('cross-validation', 'çapraz doğrulama'),
  upTo: frag('up to {v} %', '%{v}\'e kadar'), tag: frag('synthetic data', 'sentetik veri'),
  fakeTitle: frag('fake progress: an untuned baseline', 'sahte ilerleme: ayarlanmamış baseline'), rmse: frag('RMSE (lower is better)', 'RMSE (düşük iyi)'),
  reported: frag('BPMF as reported', 'BPMF, raporlanan'), careful: frag('BPMF, run carefully', 'BPMF, özenle koşulmuş'), best: frag('best reported method', 'raporlanmış en iyi yöntem'),
  papers: frag('papers that need seeds repeated them (RecSys 2022)', 'tohum gerektiren makalelerden tohumu tekrarlayanlar (RecSys 2022)'),
  half: frag('of the papers that propose a new algorithm have no significance test', 'yeni algoritma öneren makalelerin yarıdan fazlasında anlamlılık testi yok'),
  gold: frag('one run is an anecdote', 'tek koşu bir anekdottur'),
};
const SINGLE = [-6.3, -3.4, -1.1, 0.6, 2.2, 3.5, 4.8, 5.9];
const CV = [-2.3, -1.4, -0.6, 0.2, 0.9, 1.5, 2, 1.7];

/** The params of the mode `seeds`, merged into chart-draw's schema (the registry carries the whole). */
export const seedsSchema = {
  type: 'object', additionalProperties: false, title: 'one run is an anecdote (mode seeds)',
  description: '`bands` are the measured largest deviations (%) of a single split and of cross-validation (Wegmeth et al. 2023); `single` and `cv` are the deviations (%) of eight seeds each, drawn inside the bands to show the idea: they are not measured, the picture tags them '
    + '(an empty `tag` hides it); the largest of each list sits on the edge of its band. `bpmf` are the published RMSEs of the untuned baseline (as reported), the carefully run baseline and the best reported method (Rendle, Zhang and Koren 2019). `repro` are the published paper counts.',
  default: { bands: [6.3, 2.3], single: SINGLE, cv: CV, bpmf: { reported: 0.8197, careful: 0.7633, best: 0.7634 }, repro: { papers: 26, repeated: 5 }, labels: LABELS },
  properties: {
    bands: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0.1, maximum: 8 }, default: [6.3, 2.3] },
    single: { type: 'array', minItems: 4, maxItems: 10, items: { type: 'number', minimum: -8, maximum: 8 }, default: SINGLE },
    cv: { type: 'array', minItems: 4, maxItems: 10, items: { type: 'number', minimum: -8, maximum: 8 }, default: CV },
    bpmf: { type: 'object', additionalProperties: false, default: { reported: 0.8197, careful: 0.7633, best: 0.7634 }, properties: { reported: { type: 'number', minimum: 0, default: 0.8197 }, careful: { type: 'number', minimum: 0, default: 0.7633 }, best: { type: 'number', minimum: 0, default: 0.7634 } } },
    repro: { type: 'object', additionalProperties: false, default: { papers: 26, repeated: 5 }, properties: { papers: { type: 'integer', minimum: 1, default: 26 }, repeated: { type: 'integer', minimum: 0, default: 5 } } },
    labels: labelsSchema(LABELS, '`upTo` holds {v}.'),
  },
};
export const seedsExamples = [{ mode: 'seeds' }];
export const seedsPresses = 4;

/**
 * What the picture needs of the params that the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function seedsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.seeds;
  const [b1, b2] = Q.bands;
  if (!(b2 < b1)) bad('$.seeds.bands', `are ${b1} and ${b2}: cross-validation must deviate less than a single split`);
  /** @type {Array<[string, number[], number]>} */
  const rows = [['single', Q.single, b1], ['cv', Q.cv, b2]];
  for (const [key, vals, band] of rows) {
    const worst = Math.max(...vals.map((v) => Math.abs(v)));
    if (worst > band) bad(`$.seeds.${key}`, `has a deviation of ${worst} %, outside its band of ${band} %`);
    else if (Math.abs(worst - band) > 0.05) bad(`$.seeds.${key}`, `has its largest deviation at ${worst} %, the band says ${band} %: the largest point sits on the edge of the band`);
  }
  const { reported, careful, best } = Q.bpmf;
  if (!(careful < reported)) bad('$.seeds.bpmf', `the carefully run baseline (${careful}) must be better (lower) than the reported one (${reported})`);
  if (!(careful <= best)) bad('$.seeds.bpmf', `the carefully run baseline (${careful}) must pass the best reported method (${best}): the page says it overtook it`);
  if (Q.repro.repeated > Q.repro.papers) bad('$.seeds.repro', `has ${Q.repro.repeated} papers that repeated the seeds of ${Q.repro.papers}`);
  return out;
}

/**
 * The plan of the picture: every animated element with its press, how it comes in and when (start, duration in ms). Pure: the number of seeds of the two rows is all it needs.
 * @param {any} P the resolved params of chart-draw @returns {Array<{key: string, k: number, kind: 'pop'|'rise'|'draw'|'fade'|'wipe', t: [number, number]}>}
 */
export function seedsPlan(P) {
  const Q = P.seeds;
  /** @type {Array<{key: string, k: number, kind: 'pop'|'rise'|'draw'|'fade'|'wipe', t: [number, number]}>} */
  const plan = [];
  /** @param {string} key @param {number} k @param {'pop'|'rise'|'draw'|'fade'|'wipe'} kind @param {number} start @param {number} dur */
  const at = (key, k, kind, start, dur) => { plan.push({ key, k, kind, t: [start, dur] }); };
  at('band:0', 1, 'fade', 100, FADE); at('nm:0', 1, 'rise', 0, LABEL); Q.single.forEach((_, i) => at(`pt0:${i}`, 1, 'pop', 300 + i * 70, POP)); at('lb:0', 1, 'rise', 900, LABEL); at('tg', 1, 'rise', 100, LABEL);
  at('band:1', 2, 'fade', 100, FADE); at('nm:1', 2, 'rise', 0, LABEL); Q.cv.forEach((_, i) => at(`pt1:${i}`, 2, 'pop', 300 + i * 70, POP)); at('lb:1', 2, 'rise', 900, LABEL);
  at('rp', 3, 'rise', 100, LABEL); at('p3:0', 3, 'pop', 300, POP); at('p3:1', 3, 'pop', 500, POP); at('p3:2', 3, 'pop', 700, POP); at('ra', 3, 'draw', 900, FADE); at('rh', 3, 'wipe', 900 + FADE, HEAD);   // WP-93: the head starts when the shaft has arrived
  at('st:0', 4, 'rise', 100, LABEL); at('st:1', 4, 'rise', 300, LABEL); at('gs', 4, 'rise', 600, LABEL);
  return plan;
}

/**
 * The picture's pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of chart-draw
 */
export function seedsModel(P) {
  const plan = seedsPlan(P);
  const by = new Map(plan.map((e) => [e.key, e]));
  const RISE_OFF = { opacity: '0', transform: 'translateY(10px)' }, RISE_ON = { opacity: '1', transform: 'translateY(0px)' };
  const POP_OFF = { opacity: '0', transform: 'scale(0.5)' }, POP_ON = { opacity: '1', transform: 'scale(1)' };
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const e of plan) {
      const on = k >= e.k;
      if (e.kind === 'pop') f.set(e.key, on ? POP_ON : POP_OFF);
      else if (e.kind === 'rise') f.set(e.key, on ? RISE_ON : RISE_OFF);
      else if (e.kind === 'draw') f.set(e.key, { strokeDashoffset: on ? '0' : '1.02' });
      else if (e.kind === 'wipe') f.set(e.key, { opacity: '1', clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' });   // WP-93: hidden by a clip that is all of the bottom, revealed from the top down
      else f.set(e.key, { opacity: on ? '1' : '0' });
    }
    return f;
  };
  /** @param {string} key @returns {import('./frames.js').Timing} */
  const timing = (key) => { const e = /** @type {{t: [number, number]}} */ (by.get(key)); return { start: e.t[0], duration: e.t[1] }; };
  return { plan, frame, timing, n: seedsPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/** The horizontal position (px) of a deviation of `v` % from the mean. @param {number} v */
export const xOf = (v) => AXIS.cx + v * AXIS.k;

// WP-74 (headless deck tour 2026-10-31, lead: fix it, measure English too): the band label ("up to 2.3 %") ends at the band's right edge and is as wide as its text, so for a narrow band it reaches over the
// vertical lines of the axis (the grid lines span y 140..410, the mean line y 120..410). By the font metrics of Source Sans 3 600 at 24 px (advances, no kerning; scratch text_widths.py, 1 to 2 % margin):
//   row 1 (band 2.3 %, right edge x 604.2, y 250..279): English "up to 2.3 %" 114.5 px spans x 489.7..604.2: clear of the line at 480 by 9.7 px; Turkish "%2,3'e kadar" 134.8 px spans x 469.4..604.2:
//   the line at 480 runs through its first character, 10.6 px in (seen in the 2026-10-31 screenshot). Row 0 (band 6.3 %, y 100..129) is above the grid lines (they start at y 140): no collision either way.
// Any placement of a 115 to 135 px label in that row meets a line, so the label gets a plate in the ground colour (the line passes BEHIND it) and is anchored by its RIGHT edge, hugging its text, so the
// plate hides nothing but the stretch of line under the text and no width is guessed per language. The plate's padding (LABEL_PAD, the same 6 px as the CSS rule) sits outside the band's edge, the text ends on it.
export const LABEL_PAD = 6;
/** The inline position of the band label of a band that reaches `band` % on the right: right-anchored at the band's edge, hugging its text. @param {number} band @param {number} top @returns {string} */
export const bandLabelCss = (band, top) => `right:${Math.round((1680 - xOf(band) - LABEL_PAD) * 100) / 100}px;top:${top}px;width:max-content;text-align:right`;

/**
 * The picture of the mode `seeds`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of chart-draw
 * @returns {import('./kit.js').WidgetBuild}
 */
export function seedsBuild(ctx, P) {
  const problems = seedsProblems({ seeds: P.seeds });
  if (problems.length) throw new Error(`chart-draw seeds: ${problems.map((p) => `${p.path} ${p.detail}`).join('; ')}`);
  const Q = P.seeds, L = Q.labels;
  const M = seedsModel(P);
  const sc = scene(ctx, 'cv-root sd-root');
  const { doc, root, box, put, add, say } = sc;
  const svg = s(doc, 'svg', { class: 'cv-svg', width: '1680', height: '600', viewBox: '0 0 1680 600' });
  root.append(svg);
  /** @param {string|null} key @param {string} cls @param {Record<string, string>} text @param {string} css */
  const label = (key, cls, text, css) => {
    const e = h(doc, 'div', `sd-lbl ${cls}`);
    say(e, text);
    if (key) put(key, e, css); else { e.style.cssText += `;${css}`; root.append(e); }
    return e;
  };
  // the frame (state 0): the mean line, the ticks of the deviation axis
  svg.append(s(doc, 'path', { class: 'cv-axis', d: `M${xOf(-7.2)} ${AXIS.yAxis}H${xOf(7.2)}` }));
  svg.append(s(doc, 'path', { class: 'sd-mean', d: `M${xOf(0)} ${AXIS.yTop}V${AXIS.yAxis}` }));
  for (const t of [-6, -3, 0, 3, 6]) {
    svg.append(s(doc, 'path', { class: 'cv-grid', d: `M${xOf(t)} ${AXIS.yTop + 20}V${AXIS.yAxis}` }));
    label(null, 'sd-tick', { en: String(t), tr: String(t) }, `left:${xOf(t) - 30}px;top:${AXIS.yAxis + 6}px;width:60px;text-align:center`);
  }
  label(null, 'sd-axis', L.axis, `left:${xOf(-7.2)}px;top:${AXIS.yAxis + 38}px;width:${xOf(7.2) - xOf(-7.2)}px;text-align:center`);
  // presses 1 and 2: a band and the dots of its seeds
  /** @type {Array<[number, number[], Record<string, string>, number]>} */
  const rows = [[0, Q.single, L.one, Q.bands[0]], [1, Q.cv, L.cv, Q.bands[1]]];
  for (const [r, vals, name, band] of rows) {
    const y = ROWS[r].y;
    put(`band:${r}`, h(doc, 'div', `sd-band sd-band-${r}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(xOf(-band), y - 56, 2 * band * AXIS.k, 112));
    vals.forEach((v, i) => put(`pt${r}:${i}`, h(doc, 'div', `sd-dot sd-dot-${r}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), `left:${xOf(v) - 13}px;top:${y + ((i % 3) - 1) * 26 - 13}px`));
    const nameEl = say(h(doc, 'div', 'sd-name'), name), nameCss = `left:${xOf(-7.2)}px;top:${ROWS[r].label}px`;
    put(`nm:${r}`, nameEl, nameCss);   // WP-93 (the user on page 22, D-182): a row's name comes in with its band ("one split (K = 1)" in press 1, "cross-validation" in press 2), not from the start
    const bandText = { en: L.upTo.en.replace('{v}', band.toFixed(1)), tr: (L.upTo.tr ?? L.upTo.en).replace('{v}', band.toFixed(1).replace('.', ',')) };
    label(`lb:${r}`, 'sd-band-lbl', bandText, bandLabelCss(band, ROWS[r].label));   // WP-74: right-anchored with a ground plate (see bandLabelCss)
  }
  const tg = label('tg', 'sd-tag', L.tag, `left:${xOf(7.2) - 250}px;top:34px;width:250px`);
  if (!L.tag.en) /** @type {HTMLElement} */ (tg).hidden = true;
  // press 3: a number line of RMSE: the reported baseline, the carefully run one and the best reported method
  const rp = put('rp', h(doc, 'div', 'sd-panel', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h));
  add(say(h(doc, 'div', 'sd-title'), L.fakeTitle), box(0, 12, RIGHT.w, 40), rp);
  const lo = 0.75, hi = 0.83, nx = (/** @type {number} */ v) => 50 + ((v - lo) / (hi - lo)) * (RIGHT.w - 100), ny = 180;
  add(h(doc, 'div', 'sd-line'), box(50, ny - 2, RIGHT.w - 100, 4), rp);
  add(say(h(doc, 'div', 'sd-cap'), L.rmse), box(50, ny + 70, 400, 30), rp);
  const { reported, careful, best } = Q.bpmf;
  const pt = (/** @type {string} */ key, /** @type {string} */ cls, /** @type {number} */ v) => { const d = h(doc, 'div', `sd-pt ${cls}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }); put(key, d, `left:${nx(v) - 15}px;top:${ny - 15}px`, rp); };
  pt('p3:0', 'sd-pt-rep', reported); pt('p3:1', 'sd-pt-car', careful); pt('p3:2', 'sd-pt-best', best);
  /** @param {Record<string, string>} name @param {number} v @param {string} css */
  const tagged = (name, v, css) => add(say(h(doc, 'div', 'sd-val'), { en: `${name.en} ${num(v, 4).en}`, tr: `${name.tr ?? name.en} ${num(v, 4).tr}` }), css, rp);
  tagged(L.reported, reported, `left:${nx(reported) - 280}px;top:${ny + 24}px;width:320px;text-align:right`);
  tagged(L.careful, careful, `left:${nx(careful) - 20}px;top:${ny - 78}px;width:340px`);
  tagged(L.best, best, `left:${nx(careful) - 20}px;top:${ny - 118}px;width:340px`);
  // the arrow from the reported value to the careful one
  // (inside the panel: an svg of the panel's own size, so the panel's background does not cover it)
  const asv = s(doc, 'svg', { class: 'cv-svg', width: String(RIGHT.w), height: String(RIGHT.h), viewBox: `0 0 ${RIGHT.w} ${RIGHT.h}` });
  rp.append(asv);
  const ax = nx(reported) - 24, bx = nx(careful) + 26;
  put('ra', s(doc, 'path', { class: 'sd-arrow', d: `M${ax} ${ny - 36}H${bx}`, pathLength: '1', 'data-gfx': 'stroke' }), '', asv);
  // WP-93 (the user on page 22: first the line comes leftwards, then the head sweeps from the top down): the head is its own small svg (28 x 32, in the panel's coordinates), wiped in by a clip-path on it; the shaft and the head were one path
  // with two subpaths, and a dash pattern restarts on every subpath, so the head flashed in at the very start of the draw
  const HX = bx - 6, HY = ny - 52, HW = 28, HH = 32;
  const head = s(doc, 'svg', { class: 'sd-head', width: String(HW), height: String(HH), viewBox: `${HX} ${HY} ${HW} ${HH}`, 'aria-hidden': 'true' });
  head.append(s(doc, 'path', { class: 'sd-arrow-head', d: `M${bx + 10} ${ny - 46}L${bx} ${ny - 36}L${bx + 10} ${ny - 26}`, 'data-gfx': 'stroke' }));
  put('rh', head, `left:${HX}px;top:${HY}px;width:${HW}px;height:${HH}px`, rp);
  // press 4: the practice
  const card = (/** @type {string} */ key, /** @type {string} */ big, /** @type {Record<string, string>} */ text, /** @type {number} */ x) => {
    const el = h(doc, 'div', 'sd-card', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    el.append(h(doc, 'b', 'sd-big'), say(h(doc, 'span', 'sd-card-text'), text));
    el.querySelector('b').textContent = big;
    put(key, el, box(x, 500, 500, 90));
  };
  card('st:0', `${Q.repro.repeated} / ${Q.repro.papers}`, L.papers, 60);
  card('st:1', '> 50 %', L.half, 590);
  put('gs', say(h(doc, 'div', 'sd-gold', { 'data-role': 'key' }), L.gold), box(1130, 500, 510, 90));
  return finish(ctx, sc, M.n, M.frame, M.timing);
}
