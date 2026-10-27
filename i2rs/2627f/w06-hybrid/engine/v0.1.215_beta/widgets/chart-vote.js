// @ts-check
// WP-50 (D-112, brief 07; storyboard W4 `chart-draw`, mode `vote`; page s6 `bias-variance` of the I2RS w06 deck): why a committee wins, in one picture. A support module of chart-draw.js, like table-matrix.js
// is of table-highlight: it holds the mode's params, its example and its picture; the widget itself (id, schema, step count) is chart-draw.js.
// The widget DRAWS numbers, it never makes them: every point comes from the params, and the deck gets them from its own script (`majority_vote.py`, evidence record `our-computation`:
// exact binomial, no seed). tests/js/widgets-story.html recomputes the example's numbers by hand-written exact arithmetic (BigInt) and holds the two equal.
//
// The picture: two panels in the widget-stage box of 1680 x 600. LEFT (a third): the number line of Galton's village fair (1907): the dressed weight of an ox (1198 lb) and the middle of 787 usable
// guesses (1207 lb), 0.8% apart, and nothing else (the single guesses are not known, so no distribution is drawn). RIGHT: the chance that the majority of n members is right.
//
// States (default params, seven presses): 0 the frame (the axes of the chart, the left panel empty); 1 the village fair; 2 independent members, each right 75% of the time: n = 1 and 5; 3 the rest of
// the curve (n = 9, 17 labelled, 3 and 21 unlabelled); 4 copies of one model: a flat dashed line at 0.75 (the same curve stays); 5 `worse`: members right only 40% of the time, the committee gets
// worse (optional: empty `worse.points` drops the press); 6 the decomposition: the chart dims and a three-part bar appears, squared bias + variance + noise, in invented proportions (a tag says "synthetic data", D-127); 7 the key: the
// chart is back and the gap between the independent curve and the flat line is washed in gold (D-009: gold = must know).
//
// Colour and shape (D-009, D-068): the independent curve is green (positive: the committee gains) with round dots, the copies are a neutral dashed line with no dots, the worse curve is red (negative)
// with square dots: a colour never stands alone. Labels are HTML (they take the roles of roles.css), lines and areas are SVG.
//
// duration(k) = planDuration(plan(k)); L = lineMs, F = the share of a curve a press draws, D = max(minLineMs, L * F), a dot pops when the line reaches it and its value follows labelLagMs later:
//   1  the line (0.6 L), the dressed weight at 0.45 L, the median 220 ms later, their names labelLagMs after each, "apart" while the median's name comes up: 0.45 L + 220 + labelLagMs + 200 + labelMs
//   2  D(0 .. share of n = 5) plus the last value's lag        3  D(share of n = 5 .. 1) plus the same        4  L (the wipe) + labelMs for its name
//   5  D(0 .. 1) plus the same, the name and the tag            6  max(fadeMs, 0.4 fadeMs + barMs)            7  max(fadeMs, gapMs)
// Default numbers: 1465 / 1140 / 1176 / 1300 / 1500 / 980 / 800 ms (measured: the browser reports the same).
// Motion: strokeDashoffset (a line draws), clipPath (the dashed line wipes in: a dash pattern cannot be offset-revealed), opacity + transform (dots pop, labels rise). No colour keyframes.
import { stepsFromFrames, h, s, fit } from './frames.js';

/** The design box the picture is drawn in, in stage px; the widget reads ctx.size and scales once when it differs. */
const W = 1680, H = 600;
/** The chart: the box x = n (from the smallest to the largest n of the data), y = the chance (0 to 1). */
const PLOT = Object.freeze({ x0: 650, x1: 1650, y0: 480, y1: 90 });
/** The number line of the village fair. */
const LINE = Object.freeze({ x0: 30, x1: 440, y: 330 });

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });
const ms = (/** @type {number} */ d, min = 0) => ({ type: 'integer', minimum: min, default: d });
const POINT = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
const POINTS = { type: 'array', minItems: 2, items: POINT };
// WP-50: `withDefaults` fills a property that has a `default` of its own; an object-level default is used only when the whole object is missing. A deck that gives `independent: {points: ...}` alone must still get `shown`,
// `labelled` and `label`, so every property of an object below carries the object's default for it (found by content-agent in 2fdf987: a TypeError in voteProblem).
/** @param {Record<string, any>} props @param {Record<string, any>} d the object's default */
export const inherit = (props, d) => Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { ...v, default: d[k] }]));

// The numbers of the lecture (decks/i2rs/ch06-ensemble-and-hybrid/scripts/majority_vote.py; exact binomial, four decimals): the chance that the majority of n members is right.
const INDEPENDENT_75 = [[1, 0.75], [3, 0.8438], [5, 0.8965], [9, 0.9511], [17, 0.9876], [21, 0.9936]];
const COPIES_75 = [[1, 0.75], [3, 0.75], [5, 0.75], [9, 0.75], [17, 0.75], [21, 0.75]];
const INDEPENDENT_40 = [[1, 0.4], [3, 0.352], [5, 0.3174], [9, 0.2666], [17, 0.1989], [21, 0.1744]];

const GALTON = {
  min: 1150, max: 1250, dressed: 1198, median: 1207, valid: 787, unit: 'lb',
  dressedLabel: frag('Dressed weight', 'Karkas ağırlığı'), medianLabel: frag('Middle guess', 'Ortanca tahmin'),
  guesses: frag('{n} usable guesses', '{n} geçerli tahmin'), apart: frag('{pct} apart', '{pct} fark'),
};
const INDEPENDENT = { label: frag('Independent members, each right 75% of the time', 'Bağımsız üyeler, her biri zamanın %75\'inde doğru'), points: INDEPENDENT_75, shown: [1, 5], labelled: [1, 5, 9, 17] };
const COPIES = { label: frag('Copies of one model', 'Bir modelin kopyaları'), points: COPIES_75 };
const WORSE = { label: frag('Members right only 40% of the time', 'Üyeler zamanın yalnız %40\'ında doğru'), tag: frag('p = 0.40, chosen by us', 'p = 0,40, bizim seçimimiz'), points: INDEPENDENT_40, labelled: [1, 17] };
const DECOMPOSITION = {
  parts: [{ id: 'bias', label: frag('Squared bias', 'Karesel yanlılık'), share: 34 }, { id: 'variance', label: frag('Variance', 'Varyans'), share: 42 }, { id: 'noise', label: frag('Noise', 'Gürültü'), share: 24 }],
  total: frag('Expected squared error', 'Beklenen kare hata'), synthetic: frag('synthetic data', 'sentetik veri'),
};

/** The params of the mode `vote`, to be merged into chart-draw's schema. */
export const voteProps = {
  galton: {
    type: 'object', additionalProperties: false, title: "Galton's village fair",
    description: 'The number line of the left panel: the scale (`min` .. `max`), the true (dressed) weight, the middle of the guesses, how many usable guesses there were, the unit, and the labels. The percentage is worked out from the two weights.',
    default: GALTON,
    properties: inherit({
      min: { type: 'number' }, max: { type: 'number' }, dressed: { type: 'number' }, median: { type: 'number' }, valid: { type: 'integer', minimum: 1 }, unit: { type: 'string' },
      dressedLabel: FRAGMENT, medianLabel: FRAGMENT, guesses: FRAGMENT, apart: FRAGMENT,
    }, GALTON),
  },
  xTitle: { ...fragSchema(frag('Members in the committee (n)', 'Kurulun üye sayısı (n)')), title: 'the chart\'s horizontal axis' },
  yTitle: { ...fragSchema(frag('Chance the majority is right', 'Çoğunluğun doğru olma olasılığı')), title: 'the chart\'s vertical axis' },
  chanceLabel: { ...fragSchema(frag('coin flip', 'yazı-tura')), title: 'the dashed line at 0.5' },
  xTicks: { type: 'array', minItems: 2, items: { type: 'integer', minimum: 1 }, default: [1, 5, 9, 13, 17, 21], title: 'the numbers of members written under the axis' },
  independent: {
    type: 'object', additionalProperties: false, title: 'independent members',
    description: '`points` are [n, chance] pairs in rising n, from the deck\'s script. `shown` are the n of the first press (the curve is drawn up to the last of them, the rest in the second); `labelled` are the n whose value is written.',
    default: INDEPENDENT,
    properties: inherit({ label: FRAGMENT, points: POINTS, shown: { type: 'array', minItems: 2, items: { type: 'integer', minimum: 1 } }, labelled: { type: 'array', items: { type: 'integer', minimum: 1 } } }, INDEPENDENT),
  },
  copies: {
    type: 'object', additionalProperties: false, title: 'copies of one model',
    description: 'Copies of one model are right or wrong together, so the majority is as right as the one model: a flat dashed line. `points` as above.',
    default: COPIES,
    properties: inherit({ label: FRAGMENT, points: POINTS }, COPIES),
  },
  worse: {
    type: 'object', additionalProperties: false, title: 'members that are right less than half of the time (optional press)',
    description: 'Empty `points` drops the press. `tag` says who chose the number ("chosen by us").',
    default: WORSE,
    properties: inherit({ label: FRAGMENT, tag: FRAGMENT, points: { type: 'array', items: POINT }, labelled: { type: 'array', items: { type: 'integer', minimum: 1 } } }, WORSE),
  },
  decomposition: {
    type: 'object', additionalProperties: false, title: 'the three parts of the expected error (invented proportions)',
    description: '`parts` are the bar\'s segments left to right with a share of the bar each (an invented proportion, not a number of the lecture); `total` names the whole; `synthetic` is the tag that says the proportions are invented (D-127).',
    default: DECOMPOSITION,
    properties: inherit({
      parts: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', required: ['id', 'label', 'share'], properties: { id: { type: 'string', minLength: 1 }, label: FRAGMENT, share: { type: 'number', minimum: 1 } } } },
      total: FRAGMENT, synthetic: FRAGMENT,
    }, DECOMPOSITION),
  },
  figureLabel: {
    ...fragSchema(frag(
      'A chart of the chance that the majority of a committee is right. Independent members, each right 75% of the time, give 75% for one member, 89.65% for five, 95.11% for nine and 98.76% for seventeen. Copies of one model stay at 75%. Members right only 40% of the time make the committee worse. Beside it, Galton\'s village fair: the middle of 787 guesses, 1207 pounds, was within 1% of the ox\'s dressed weight, 1198 pounds.',
      'Bir kurulun çoğunluğunun doğru olma olasılığının grafiği. Her biri zamanın %75\'inde doğru olan bağımsız üyeler, bir üye için %75, beş üye için %89,65, dokuz üye için %95,11 ve on yedi üye için %98,76 verir. Bir modelin kopyaları %75\'te kalır. Zamanın yalnız %40\'ında doğru olan üyeler kurulu daha kötü yapar. Yanında Galton\'ın köy panayırı: 787 tahminin ortancası, 1207 libre, öküzün karkas ağırlığının, 1198 librenin, %1\'in içindeydi.')),
    title: 'the text alternative of the whole figure', description: 'Written for a reader who does not see the chart: the numbers of the curves and of the village fair.',
  },
  lineMs: ms(900, 1), minLineMs: ms(500, 1), popMs: ms(360, 1), labelLagMs: ms(240), labelMs: ms(400, 1), fadeMs: ms(700, 1), barMs: ms(700, 1), gapMs: ms(800, 1), dimTo: { type: 'number', minimum: 0, maximum: 1, default: 0.14 },
};

/** The example the harness builds a slide from: the lecture's own page, seven presses. */
export const voteExample = {};

/** @param {{worse: {points: unknown[]}}} P @returns {boolean} whether the optional press of the worse curve is there */
export const hasWorse = (P) => Array.isArray(P.worse?.points) && P.worse.points.length > 0;
/** Presses of the mode: the village fair, two for the independent curve, the copies, the worse curve (optional), the decomposition, the key. @param {{worse: {points: unknown[]}}} P */
export const votePresses = (P) => (hasWorse(P) ? 7 : 6);

/**
 * A ratio as a percentage in the language of the page: the ONE place a percent sign is written. English "89.65%" (no space, a decimal point), Turkish "%89,65" (the sign in front, a decimal comma).
 * At most `decimals` decimals, trailing zeros dropped (0.75 -> "75%" / "%75", 0.352 -> "35.2%" / "%35,2", 1 -> "100%"); integer arithmetic on the scaled value, so no float noise reaches the digits.
 * @param {number} ratio 0 or more (a chance, or 9 / 1198) @param {string} lang @param {number} [decimals]
 * @returns {string}
 */
export function fmtPct(ratio, lang, decimals = 2) {
  const scale = 10 ** decimals;
  const n = Math.round(ratio * 100 * scale + 1e-9);                          // 0.8965 * 100 * 100 is 8965.000000000001: rounded to the integer it stands for
  const whole = Math.floor(n / scale), frac = String(n % scale).padStart(decimals, '0').replace(/0+$/, '');
  const digits = frac ? `${whole}${lang === 'tr' ? ',' : '.'}${frac}` : String(whole);
  return lang === 'tr' ? `%${digits}` : `${digits}%`;
}

/**
 * The curve through [n, p] points as an SVG path in design px, and how much of its length is behind each point.
 * @param {number[][]} points @param {(n: number) => number} fx @param {(p: number) => number} fy
 * @returns {{d: string, xy: Array<[number, number]>, frac: number[], total: number}}
 */
export function curveOf(points, fx, fy) {
  /** @type {Array<[number, number]>} */
  const xy = points.map(([n, p]) => [fx(n), fy(p)]);
  /** @type {number[]} */
  const cum = [0];
  for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
  const total = cum[cum.length - 1];
  return { d: `M${xy.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')}`, xy, frac: cum.map((c) => (total === 0 ? 0 : c / total)), total };
}
/** The dash offset that shows the first `f` of a path of pathLength 1 drawn with the dash pattern "1 2" (1.02 hides it all, 0 shows it all). @param {number} f */
const offsetFor = (f) => (f <= 0 ? '1.02' : f >= 1 ? '0' : String(+(1 - f).toFixed(4)));

const POP_OFF = { opacity: '0', transform: 'scale(0.4)' }, POP_ON = { opacity: '1', transform: 'scale(1)' };
const RISE_OFF = { opacity: '0', transform: 'translateY(10px)' }, RISE_ON = { opacity: '1', transform: 'translateY(0px)' };
const SHOW = { opacity: '1' }, HIDE = { opacity: '0' };

/**
 * Check the params the schema subset cannot (the points rise in n, shared n across the curves, labelled and shown n exist) and say what is wrong.
 * @param {any} P @returns {string|null}
 */
export function voteProblem(P) {
  /** @param {string} name @param {any} pts */
  const rising = (name, pts) => (pts.every((/** @type {number[]} */ p, /** @type {number} */ i) => i === 0 || p[0] > pts[i - 1][0]) ? null : `chart-draw vote: the points of ${name} must rise in n`);
  const ns = (/** @type {any} */ pts) => pts.map((/** @type {number[]} */ p) => p[0]);
  const sets = [['independent', P.independent.points], ['copies', P.copies.points], ...(hasWorse(P) ? [['worse', P.worse.points]] : [])];
  for (const [name, pts] of sets) {
    const r = rising(String(name), pts);
    if (r) return r;
    for (const [, v] of pts) if (!(v >= 0 && v <= 1)) return `chart-draw vote: a chance of ${name} is ${v}, it must be between 0 and 1`;
  }
  const all = ns(P.independent.points).join(',');
  if (ns(P.copies.points).join(',') !== all) return 'chart-draw vote: the copies need the same n as the independent members';
  if (hasWorse(P) && ns(P.worse.points).some((/** @type {number} */ n) => !all.split(',').map(Number).includes(n))) return 'chart-draw vote: the worse curve may only use n that the independent curve has';
  const have = new Set(ns(P.independent.points));
  const shown = P.independent.shown;
  if (!shown.every((/** @type {number} */ n) => have.has(n))) return 'chart-draw vote: independent.shown names an n the curve does not have';
  if (shown[0] !== ns(P.independent.points)[0]) return 'chart-draw vote: independent.shown starts at the first n of the curve';
  if (!P.independent.labelled.every((/** @type {number} */ n) => have.has(n))) return 'chart-draw vote: independent.labelled names an n the curve does not have';
  if (hasWorse(P) && !P.worse.labelled.every((/** @type {number} */ n) => ns(P.worse.points).includes(n))) return 'chart-draw vote: worse.labelled names an n the curve does not have';
  const g = P.galton;
  if (!(g.min < g.max && g.dressed >= g.min && g.dressed <= g.max && g.median >= g.min && g.median <= g.max)) return 'chart-draw vote: the weights of the village fair must lie on its scale';
  if (P.decomposition.parts.some((/** @type {any} */ p) => !p.label || typeof p.label.en !== 'string')) return 'chart-draw vote: every part of the decomposition needs a label {en}';
  return null;
}

/**
 * The picture of the mode `vote`.
 * @param {import('./kit.js').WidgetContext} ctx @param {any} P the params with the schema's defaults filled in
 * @returns {import('./kit.js').WidgetBuild}
 */
export function voteBuild(ctx, P) {
  const problem = voteProblem(P);
  if (problem) throw new Error(problem);
  const doc = ctx.slot.ownerDocument;
  const lang = ctx.lang;
  const worse = hasWorse(P);
  const n = votePresses(P);
  /** Which press does what. */
  const S = { fair: 1, m5: 2, m17: 3, copies: 4, worse: worse ? 5 : 0, dec: worse ? 6 : 5, key: worse ? 7 : 6 };

  const allN = /** @type {number[]} */ (P.independent.points.map((/** @type {number[]} */ p) => p[0]));
  const nMin = allN[0], nMax = allN[allN.length - 1];
  const fx = (/** @type {number} */ v) => PLOT.x0 + ((v - nMin) / (nMax - nMin)) * (PLOT.x1 - PLOT.x0);
  const fy = (/** @type {number} */ p) => PLOT.y0 - p * (PLOT.y0 - PLOT.y1);
  const cA = curveOf(P.independent.points, fx, fy), cB = curveOf(P.copies.points, fx, fy), cC = worse ? curveOf(P.worse.points, fx, fy) : null;
  /** The share of the independent curve behind the last n of the first press. */
  const lastShown = P.independent.shown[P.independent.shown.length - 1];
  const fShown = cA.frac[allN.indexOf(lastShown)];
  const idxA = (/** @type {number} */ v) => allN.indexOf(v);

  // ---------- DOM ----------
  const root = h(doc, 'div', 'w-root cv-root', { role: 'img', 'aria-label': ctx.text(P.figureLabel) });
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @param {HTMLElement} parent @param {string} key @param {string} cls @param {string} tag @param {Record<string, string>} [attrs] */
  const node = (parent, key, cls, tag = 'div', attrs = {}) => { const e = h(doc, tag, cls, { 'data-key': key, ...attrs }); parent.append(e); els.set(key, e); return e; };
  /** An absolutely placed text label. @param {HTMLElement} parent @param {string|null} key @param {string} cls @param {Record<string, string>|string} text a fragment, or a ready string @param {string} css */
  const label = (parent, key, cls, text, css, role = '') => {
    const e = h(doc, 'div', `cv-lbl ${cls}`, { ...(key ? { 'data-key': key } : {}), ...(role ? { 'data-role': role } : {}) });
    e.style.cssText = css;
    if (typeof text === 'string') e.textContent = text; else ctx.setText(e, text);
    parent.append(e);
    if (key) els.set(key, e);
    return e;
  };
  const px = (/** @type {number} */ v) => `${+v.toFixed(2)}px`;

  const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const left = h(doc, 'div', 'cv-layer', { 'aria-hidden': 'true' });                   // the village fair
  const chart = h(doc, 'div', 'cv-layer', { 'data-key': 'cg', 'aria-hidden': 'true' });  // everything of the chart: it dims for the decomposition and comes back
  els.set('cg', chart);
  const csvg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });   // the chart's lines and areas: inside the chart group
  chart.append(csvg);
  root.append(svg, left, chart);

  // the chart's frame (static: it is the picture of state 0)
  const gridG = s(doc, 'g', {});
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    if (t === 0.5) continue;
    gridG.append(s(doc, 'path', { class: 'cv-grid', d: `M${PLOT.x0} ${fy(t)}H${PLOT.x1}` }));
  }
  csvg.append(gridG);
  csvg.append(s(doc, 'path', { class: 'cv-chance', d: `M${PLOT.x0} ${fy(0.5)}H${PLOT.x1}` }));
  csvg.append(s(doc, 'path', { class: 'cv-axis', d: `M${PLOT.x0} ${PLOT.y1 - 10}V${PLOT.y0}H${PLOT.x1 + 10}` }));
  for (const t of [0, 0.25, 0.5, 0.75, 1]) label(chart, null, 'cv-ytick', fmtPct(t, lang), `left:${PLOT.x0 - 100}px;top:${fy(t) - 18}px;width:84px`);
  for (const v of P.xTicks) label(chart, null, 'cv-xtick', String(v), `left:${fx(v) - 40}px;top:${PLOT.y0 + 14}px;width:80px`);
  label(chart, null, 'cv-axtitle', P.xTitle, `left:${PLOT.x0}px;top:${PLOT.y0 + 64}px;width:${PLOT.x1 - PLOT.x0}px;text-align:center`);
  label(chart, null, 'cv-axtitle', P.yTitle, `left:${PLOT.x0 - 120}px;top:8px;width:700px;text-align:left`);
  label(chart, null, 'cv-chance-lbl', P.chanceLabel, `left:${PLOT.x1 - 400}px;top:${fy(0.5) - 38}px;width:400px;text-align:right`);

  // the gold wash between the independent curve and the flat line (the key press)
  const gapPts = [...cA.xy, ...cB.xy.slice().reverse()].map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L');
  csvg.append(s(doc, 'path', { class: 'cv-gap', d: `M${gapPts}Z`, 'data-key': 'gap' }));
  els.set('gap', /** @type {Element} */ (csvg.lastElementChild));

  // the curves (SVG, drawn by dash offset) and the dashed line (wiped in)
  const curve = (/** @type {string} */ key, /** @type {string} */ cls, /** @type {string} */ d) => {
    const p = s(doc, 'path', { class: `cv-line ${cls}`, d, pathLength: '1', 'data-gfx': 'stroke', 'data-key': key });
    csvg.append(p);
    els.set(key, p);
  };
  curve('a-line', 'cv-a', cA.d);
  const bWrap = h(doc, 'div', 'cv-wipe', { 'data-key': 'b-line', 'aria-hidden': 'true' });
  const bSvg = s(doc, 'svg', { width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}` });
  bSvg.append(s(doc, 'path', { class: 'cv-line cv-b', d: cB.d, 'data-gfx': 'stroke' }));
  bWrap.append(bSvg);
  chart.append(bWrap);
  els.set('b-line', bWrap);
  if (cC) curve('c-line', 'cv-c', cC.d);

  // dots and value labels
  /** @param {string} key @param {string} cls @param {number} x @param {number} y */
  const dot = (key, cls, x, y) => { const e = node(chart, key, `cv-dot ${cls}`); e.style.cssText = `left:${x - 13}px;top:${y - 13}px`; return e; };
  /** @param {number[][]} pts @param {string} cls @param {string} pre */
  const dots = (pts, cls, pre) => pts.forEach(([v, p]) => dot(`${pre}-dot:${v}`, cls, fx(v), fy(p)));
  dots(P.independent.points, 'cv-dot-a', 'a');
  if (cC) dots(P.worse.points, 'cv-dot-c', 'c');
  /** @param {number[][]} pts @param {number[]} want @param {string} pre @param {string} role */
  const values = (pts, want, pre, role) => pts.forEach(([v, p]) => {
    if (!want.includes(v)) return;
    label(chart, `${pre}-val:${v}`, 'cv-val', fmtPct(p, lang), `left:${fx(v) + 10}px;top:${fy(p) + 12}px`, role);
  });
  values(P.independent.points, P.independent.labelled, 'a', 'pos');
  if (cC) values(P.worse.points, P.worse.labelled, 'c', 'neg');

  // the series' own names, at the right edge of their lines
  label(chart, 'a-lbl', 'cv-series', P.independent.label, `left:${PLOT.x1 - 780}px;top:22px;width:780px;text-align:right`, 'pos');
  label(chart, 'b-lbl', 'cv-series cv-soft', P.copies.label, `left:${PLOT.x1 - 520}px;top:${fy(0.75) + 14}px;width:520px;text-align:right`);
  if (cC) {
    label(chart, 'c-lbl', 'cv-series', P.worse.label, `left:${PLOT.x1 - 620}px;top:${fy(P.worse.points[P.worse.points.length - 1][1]) - 86}px;width:620px;text-align:right`, 'neg');
    label(chart, 'c-tag', 'cv-tag', P.worse.tag, `left:${PLOT.x1 - 520}px;top:${fy(P.worse.points[P.worse.points.length - 1][1]) - 46}px;width:520px;text-align:right`);
  }

  // the village fair (left panel)
  const g = P.galton;
  const gx = (/** @type {number} */ w) => LINE.x0 + ((w - g.min) / (g.max - g.min)) * (LINE.x1 - LINE.x0);
  const ticksG = s(doc, 'g', {});
  for (const w of [g.min, g.max]) ticksG.append(s(doc, 'path', { class: 'cv-axis cv-gtick', d: `M${gx(w)} ${LINE.y - 12}V${LINE.y + 12}` }));
  svg.append(ticksG);
  els.set('gt', ticksG);
  ticksG.setAttribute('data-key', 'gt');
  const gl = s(doc, 'path', { class: 'cv-line cv-gline', d: `M${LINE.x0} ${LINE.y}H${LINE.x1}`, pathLength: '1', 'data-gfx': 'stroke', 'data-key': 'gl' });
  svg.append(gl);
  els.set('gl', gl);
  label(left, 'gt-min', 'cv-gend', `${g.min}`, `left:${LINE.x0 - 10}px;top:${LINE.y + 22}px;width:90px`);
  label(left, 'gt-max', 'cv-gend', `${g.max}`, `left:${LINE.x1 - 80}px;top:${LINE.y + 22}px;width:90px;text-align:right`);
  const dressedDot = node(left, 'g-dressed', 'cv-gdot cv-gdot-fill');
  dressedDot.style.cssText = `left:${gx(g.dressed) - 15}px;top:${LINE.y - 15}px`;
  const medianDot = node(left, 'g-median', 'cv-gdot cv-gdot-ring');
  medianDot.style.cssText = `left:${gx(g.median) - 15}px;top:${LINE.y - 15}px`;
  const gl1 = label(left, 'g-dressed-l', 'cv-gval', `${g.dressed} ${g.unit}`, `left:${gx(g.dressed) - 110}px;top:${LINE.y - 118}px;width:220px`);
  gl1.append(h(doc, 'span', 'cv-gsub'));
  ctx.setText(/** @type {HTMLElement} */ (gl1.lastElementChild), g.dressedLabel);
  const gl2 = label(left, 'g-median-l', 'cv-gval', `${g.median} ${g.unit}`, `left:${gx(g.median) - 110}px;top:${LINE.y + 62}px;width:220px`);
  gl2.append(h(doc, 'span', 'cv-gsub'));
  ctx.setText(/** @type {HTMLElement} */ (gl2.lastElementChild), g.medianLabel);
  label(left, 'g-n', 'cv-gnote', ctx.text(g.guesses).replace('{n}', String(g.valid)), `left:0;top:${LINE.y - 190}px;width:${LINE.x1 + 10}px;text-align:center`);
  label(left, 'g-apart', 'cv-gnote cv-soft', ctx.text(g.apart).replace('{pct}', fmtPct(Math.abs(g.median - g.dressed) / g.dressed, lang, 1)), `left:0;top:${LINE.y + 192}px;width:${LINE.x1 + 10}px;text-align:center`);

  // the decomposition bar (invented proportions, tagged synthetic data)
  const bar = h(doc, 'div', 'cv-dec', { 'data-key': 'dec', 'aria-hidden': 'true' });
  const BAR = { x: 730, y: 250, w: 860, h: 96 };
  const total = P.decomposition.parts.reduce((a, /** @type {any} */ p) => a + p.share, 0);
  let acc = 0;
  P.decomposition.parts.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
    const w = (p.share / total) * BAR.w, x = BAR.x + acc;
    acc += w;
    const seg = h(doc, 'div', `cv-seg cv-seg-${i}`, { 'data-seg': p.id });
    seg.style.cssText = `left:${x}px;top:${BAR.y}px;width:${w}px;height:${BAR.h}px`;
    bar.append(seg);
    const t = h(doc, 'div', 'cv-lbl cv-segname', i < 2 ? { 'data-role': 'term' } : {});
    t.style.cssText = `left:${x}px;top:${BAR.y - 54}px;width:${w}px;text-align:center`;
    ctx.setText(t, p.label);
    bar.append(t);
    if (i > 0) { const plus = h(doc, 'div', 'cv-lbl cv-plus'); plus.style.cssText = `left:${x - 24}px;top:${BAR.y - 62}px;width:48px;text-align:center`; plus.textContent = '+'; bar.append(plus); }
  });
  const brace = s(doc, 'svg', { class: 'cv-brace', width: String(BAR.w), height: '34', viewBox: `0 0 ${BAR.w} 34` });
  brace.append(s(doc, 'path', { class: 'cv-axis', d: `M2 4V22H${BAR.w - 2}V4M${BAR.w / 2} 22V32` }));
  brace.style.cssText = `left:${BAR.x}px;top:${BAR.y + BAR.h + 12}px`;
  bar.append(brace);
  const tot = h(doc, 'div', 'cv-lbl cv-segname', {});
  tot.style.cssText = `left:${BAR.x}px;top:${BAR.y + BAR.h + 52}px;width:${BAR.w}px;text-align:center`;
  ctx.setText(tot, P.decomposition.total);
  bar.append(tot);
  const tag = h(doc, 'div', 'cv-lbl cv-tag', {});
  tag.style.cssText = `left:${BAR.x}px;top:${BAR.y + BAR.h + 110}px;width:${BAR.w}px;text-align:center`;
  ctx.setText(tag, P.decomposition.synthetic);
  bar.append(tag);
  root.append(bar);
  els.set('dec', bar);

  // ---------- frames and timing ----------
  const fAt = (/** @type {number} */ k) => (k >= S.m17 ? 1 : k >= S.m5 ? fShown : 0);
  const fairOn = (/** @type {number} */ k) => k >= S.fair;
  const dimmed = (/** @type {number} */ k) => k === S.dec;
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const m = new Map();
    // the village fair
    m.set('gl', { strokeDashoffset: fairOn(k) ? '0' : '1.02' });
    m.set('gt', fairOn(k) ? SHOW : HIDE);
    for (const key of ['g-dressed', 'g-median']) m.set(key, fairOn(k) ? POP_ON : POP_OFF);
    for (const key of ['gt-min', 'gt-max', 'g-dressed-l', 'g-median-l', 'g-n', 'g-apart']) m.set(key, fairOn(k) ? RISE_ON : RISE_OFF);
    // the chart as a whole, and the decomposition that takes its place for one press
    m.set('cg', { opacity: dimmed(k) ? String(P.dimTo) : '1' });
    m.set('dec', k === S.dec ? SHOW : HIDE);
    m.set('gap', k === S.key ? SHOW : HIDE);
    // the independent curve: drawn up to the last n of `shown` in press 2, the rest in press 3
    m.set('a-line', { strokeDashoffset: offsetFor(fAt(k)) });
    allN.forEach((v) => {
      const on = P.independent.shown.includes(v) ? k >= S.m5 : k >= S.m17;
      m.set(`a-dot:${v}`, on ? POP_ON : POP_OFF);
      if (P.independent.labelled.includes(v)) m.set(`a-val:${v}`, (P.independent.shown.includes(v) ? k >= S.m5 : k >= S.m17) ? RISE_ON : RISE_OFF);
    });
    m.set('a-lbl', k >= S.m5 ? RISE_ON : RISE_OFF);
    // the copies: a dashed line wiped in from the left
    m.set('b-line', { opacity: '1', clipPath: k >= S.copies ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' });
    m.set('b-lbl', k >= S.copies ? RISE_ON : RISE_OFF);
    // the worse curve
    if (cC) {
      m.set('c-line', { strokeDashoffset: k >= S.worse ? '0' : '1.02' });
      P.worse.points.forEach((/** @type {number[]} */ [v]) => {
        m.set(`c-dot:${v}`, k >= S.worse ? POP_ON : POP_OFF);
        if (P.worse.labelled.includes(v)) m.set(`c-val:${v}`, k >= S.worse ? RISE_ON : RISE_OFF);
      });
      m.set('c-lbl', k >= S.worse ? RISE_ON : RISE_OFF);
      m.set('c-tag', k >= S.worse ? RISE_ON : RISE_OFF);
    }
    return m;
  };
  /** The time a curve takes to draw the share [a, b] of itself. */
  const drawMs = (/** @type {number} */ a, /** @type {number} */ b) => Math.max(P.minLineMs, Math.round(P.lineMs * (b - a)));
  /** When, inside a press that draws [a, b] of a curve, the line reaches the share f. */
  const reach = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ f) => Math.max(0, Math.round(drawMs(a, b) * ((f - a) / (b - a || 1))));   // (a dot that lies on the part already drawn, n = 3, pops at once)
  /** @param {string} key @param {number} k */
  const timing = (key, k) => {
    const name = key.includes(':') ? Number(key.slice(key.indexOf(':') + 1)) : NaN;
    if (key === 'cg') return { start: 0, duration: P.fadeMs };
    if (key === 'dec') return k === S.dec ? { start: P.fadeMs * 0.4, duration: P.barMs } : { start: 0, duration: P.fadeMs };           // it comes in behind the dimming chart and leaves with the chart's return
    if (key === 'gap') return { start: 0, duration: P.gapMs };
    // press 1: the village fair
    if (k === S.fair) {
      const t = P.popMs;
      if (key === 'gl') return { start: 0, duration: P.lineMs * 0.6 };
      if (key === 'gt' || key === 'gt-min' || key === 'gt-max') return { start: 0, duration: P.labelMs };
      if (key === 'g-dressed') return { start: P.lineMs * 0.45, duration: t };
      if (key === 'g-median') return { start: P.lineMs * 0.45 + 220, duration: t };
      if (key === 'g-dressed-l') return { start: P.lineMs * 0.45 + P.labelLagMs, duration: P.labelMs };
      if (key === 'g-median-l') return { start: P.lineMs * 0.45 + 220 + P.labelLagMs, duration: P.labelMs };
      if (key === 'g-n') return { start: 0, duration: P.labelMs };
      return { start: P.lineMs * 0.45 + 220 + P.labelLagMs + 200, duration: P.labelMs };                  // g-apart: while the median's name comes up
    }
    // presses 2 and 3: the independent curve; a dot pops when the line reaches it, its value a moment later
    if (k === S.m5 || k === S.m17) {
      const a = k === S.m5 ? 0 : fShown, b = k === S.m5 ? fShown : 1;
      if (key === 'a-line') return { start: 0, duration: drawMs(a, b) };
      if (key === 'a-lbl') return { start: drawMs(a, b), duration: P.labelMs };
      if (!Number.isNaN(name)) {
        const at = reach(a, b, cA.frac[idxA(name)]);
        return key.startsWith('a-dot:') ? { start: at, duration: P.popMs } : { start: at + P.labelLagMs, duration: P.labelMs };
      }
    }
    // press 4: the dashed line wipes in, its name follows
    if (k === S.copies) return key === 'b-line' ? { start: 0, duration: P.lineMs } : { start: P.lineMs, duration: P.labelMs };
    // press 5: the worse curve draws, dots pop along it, then its name and its tag
    if (k === S.worse && cC) {
      if (key === 'c-line') return { start: 0, duration: drawMs(0, 1) };
      if (!Number.isNaN(name)) {
        const at = reach(0, 1, cC.frac[P.worse.points.findIndex((/** @type {number[]} */ p) => p[0] === name)]);
        return key.startsWith('c-dot:') ? { start: at, duration: P.popMs } : { start: at + P.labelLagMs, duration: P.labelMs };
      }
      return { start: drawMs(0, 1) + (key === 'c-tag' ? P.labelMs / 2 : 0), duration: P.labelMs };
    }
    return { start: 0, duration: P.labelMs };
  };

  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
