// @ts-check
// WP-50 (D-112, brief 07; page s9 `netflix-prize` of the I2RS w06 deck): the mode `milestones` of chart-draw, a support module like chart-vote.js. The published test RMSEs of the Netflix Prize as an ordered ladder of
// milestones, NOT a time axis (the dates of the two progress prizes are not in our verified records, so the horizontal axis says "milestones in order"), and, kept apart, the numbers Netflix wrote about what went into
// production. The widget draws the numbers it is given (the deck takes them from its evidence records) and never makes one.
//   0 the frame           the vertical axis "test RMSE (lower is better)" and the empty ladder
//   1 contest             the Cinematch point (test, with the quiz value beside it) and its line; the target line (dashed, 10% better, 0.8572) and the bracket between the two lines
//   2 milestones          the points of the 2007 and 2008 progress prizes and of the Grand Prize come one after the other, joined by a line; the Grand Prize is two teams at the SAME height (a tie) with their
//                         submission times in a card: the earlier submission won (filled point against ring)
//   3 foil                the leaderboard dims; a card of its own appears: what ran in production (three numbers, "set not stated"); no shared axis, no difference is drawn between the two
//   4 key                 nothing new: the leaderboard returns and both are washed in the gold band token together
// Meaning never rests on colour alone (D-068): the winner is a filled point and the runner-up a ring; the target is dashed AND the emphasis blue; the production numbers are in a dashed card (a different set) with
// square marks, the leaderboard has round points; the gold wash is the key press (D-009: gold = must know).
//
// duration(k) = planDuration(plan(k)), constants SEG 380, POP 300, LABEL 360, FADE 400, WASH 700; every start is written where the element is made:
//   1 contest     the Cinematch line 0 + 380; its point 100, its labels 220 + 360; the target line 380 + 500, its label 460 + 360; the bracket 820 + 300 and its label 900 + 360                                  -> 1260 ms
//   2 milestones  segment 1 at 0, the 2007 point 300, its labels 420 + 360; segment 2 at 560, the 2008 point 860, its labels 980 + 360; segment 3 at 1120, the two Grand Prize points 1420 and 1500, the card 1560 + 400   -> 1960 ms
//   3 foil        the leaderboard dims 0 + 400; the card 150 + 400, its three rows 450, 560, 670 (300 each), the note 800 + 360                                                                                -> 1160 ms
//   4 key         the leaderboard returns 0 + 400, the two washes 0 + 700                                                                                                                                     -> 700 ms
// Motion: strokeDashoffset (a line draws), clipPath (the dashed target wipes in: a dash pattern cannot be offset-revealed), opacity + transform (points and cards pop, labels rise). No colour keyframes.
import { stepsFromFrames, h, s, fit } from './frames.js';
import { fmtPct, inherit } from './chart-vote.js';

const W = 1680, H = 600;
/** The plot: x0 .. x1 and the vertical span from the bottom (the smallest RMSE of the axis) to the top. */
const PLOT = Object.freeze({ x0: 150, x1: 1190, yB: 470, yT: 100 });
/** The centres of the four milestone columns; the two Grand Prize points stand on the last one, PAIR px either side. */
const CX = Object.freeze([310, 580, 850, 1110]);       // 270 px between the columns: the widest names ("2007 İlerleme Ödülü", 242 px) keep a gap of 28 px
const PAIR = 45;
const CARD = Object.freeze({ x: 740, y: 140, w: 490, h: 212 });      // right edge 1230: clear of the production card (x 1250), which stands in front of it from press 3; the longest row (BellKor's Pragmatic Chaos, 295 px, + 20 + 90 + gaps = 429 px) has 11 px to spare
const PROD = Object.freeze({ x: 1250, y: 100, w: 400, h: 380 });
const BRACE_X = 190;
const SEG = 380, POP = 300, LABEL = 360, FADE = 400, WASH = 700;

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** The submission time of a team, HH:MM:SS (the schema subset has no `pattern` keyword, so milestonesProblems checks it). */
const TIME = /^\d\d:\d\d:\d\d$/;

const Y = { min: 0.85, max: 0.96, ticks: [0.86, 0.88, 0.90, 0.92, 0.94, 0.96] };
const BASELINE = { name: frag('Cinematch', 'Cinematch'), test: 0.9525, quiz: 0.9514 };
const TARGET = { value: 0.8572, improvement: 10 };
const PRIZES = [
  { name: frag('2007 Progress Prize', '2007 İlerleme Ödülü'), team: 'KorBell', test: 0.8723 },
  { name: frag('2008 Progress Prize', '2008 İlerleme Ödülü'), team: 'BellKor in BigChaos', test: 0.8627 },
];
const GRAND = {
  name: frag('Grand Prize', 'Büyük Ödül'), date: frag('26 July 2009', '26 Temmuz 2009'),
  teams: [{ name: 'BellKor\'s Pragmatic Chaos', time: '18:18:28', test: 0.8567, won: true }, { name: 'The Ensemble', time: '18:38:22', test: 0.8567 }],
};
const PRODUCTION = {
  title: frag('In production', 'Üretimde'), note: frag('set not stated', 'küme belirtilmemiş'),
  items: [{ name: frag('SVD', 'SVD'), value: 0.8914 }, { name: frag('RBM', 'RBM'), value: 0.8990 }, { name: frag('Linear blend', 'Doğrusal karışım'), value: 0.88, decimals: 2 }],
};
const LABELS = {
  yTitle: frag('Test RMSE (lower is better)', 'Test RMSE (düşük iyi)'),
  xTitle: frag('Milestones in order, not drawn to a time scale', 'Kilometre taşları sırayla, zaman ölçeğine göre çizilmedi'),
  target: frag('target {v}', 'hedef {v}'), improvement: frag('{pct} better than Cinematch', 'Cinematch\'ten {pct} daha iyi'),
  quiz: frag('quiz {v}', 'quiz {v}'), tie: frag('tie at {v}', 'beraberlik: {v}'), earlier: frag('earlier submission won', 'önce gönderilen kazandı'),
};
const FIGURE_LABEL = frag(
  'A chart of published test RMSE values of the Netflix Prize, lower is better, with the milestones in order. Cinematch scored 0.9525 on the test set (0.9514 on the quiz set). The 2007 Progress Prize reached 0.8723 and the 2008 Progress Prize 0.8627. The Grand Prize ended in a tie at 0.8567 on 26 July 2009 between BellKor\'s Pragmatic Chaos (18:18:28) and The Ensemble (18:38:22); the earlier submission won. The target was 0.8572, 10% better than Cinematch. Beside the chart, a card of three numbers Netflix gave for what ran in production: SVD 0.8914, RBM 0.8990 and their linear blend 0.88, with the set not stated.',
  'Netflix Ödülü\'nün yayımlanmış test RMSE değerlerinin grafiği; düşük olan iyidir, kilometre taşları sırayla. Cinematch test kümesinde 0,9525 aldı (quiz kümesinde 0,9514). 2007 İlerleme Ödülü 0,8723\'e, 2008 İlerleme Ödülü 0,8627\'ye ulaştı. Büyük Ödül, 26 Temmuz 2009\'da BellKor\'s Pragmatic Chaos (18:18:28) ile The Ensemble (18:38:22) arasında 0,8567\'de beraberlikle bitti; önce gönderilen kazandı. Hedef, Cinematch\'ten %10 iyi olan 0,8572\'ydi. Grafiğin yanında Netflix\'in üretimde çalışan şey için verdiği üç sayının kartı: SVD 0,8914, RBM 0,8990 ve doğrusal karışımları 0,88; hangi kümede ölçüldükleri belirtilmemiş.');
const DEFAULTS = { y: Y, baseline: BASELINE, target: TARGET, prizes: PRIZES, grand: GRAND, production: PRODUCTION, labels: LABELS, figureLabel: FIGURE_LABEL, dimTo: 0.3 };

/** An object schema whose every property carries the object's own default for it (a deck may name only some of them). */
const obj = (/** @type {Record<string, any>} */ props, /** @type {Record<string, any>} */ d, /** @type {Record<string, any>} */ extra = {}) => ({ type: 'object', additionalProperties: false, ...extra, default: d, properties: inherit(props, d) });

/** The params of the mode `milestones`, merged into chart-draw's schema (the registry carries the whole). */
export const milestonesSchema = obj({
  y: obj({ min: { type: 'number' }, max: { type: 'number' }, ticks: { type: 'array', minItems: 2, items: { type: 'number' } } }, Y, { title: 'the vertical axis (test RMSE)', description: '`min` is the bottom, `max` the top; `ticks` are the values written along it.' }),
  baseline: obj({ name: FRAGMENT, test: { type: 'number' }, quiz: { type: 'number' } }, BASELINE, { title: 'the system to beat (Cinematch)', description: '`test` is plotted; `quiz` is written beside it.' }),
  target: obj({ value: { type: 'number' }, improvement: { type: 'number', minimum: 0, maximum: 100 } }, TARGET, { title: 'the target line', description: '`value` is the RMSE of the target, `improvement` the percentage it is better than the baseline (checked against the two numbers).' }),
  prizes: { type: 'array', minItems: 1, maxItems: 3, title: 'the progress prizes, in order', default: PRIZES, items: { type: 'object', required: ['name', 'test'], additionalProperties: false, properties: { name: FRAGMENT, team: { type: 'string' }, test: { type: 'number' } } } },
  grand: obj({
    name: FRAGMENT, date: FRAGMENT,
    teams: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', required: ['name', 'time', 'test'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1 }, time: { type: 'string', minLength: 8, maxLength: 8 }, test: { type: 'number' }, won: { type: 'boolean' } } } },
  }, GRAND, { title: 'the Grand Prize', description: 'Two teams drawn side by side at their own heights (the same height is a tie), each with its submission time (HH:MM:SS); exactly one has `won`.' }),
  production: obj({
    title: FRAGMENT, note: FRAGMENT,
    items: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', required: ['name', 'value'], additionalProperties: false, properties: { name: FRAGMENT, value: { type: 'number' }, decimals: { type: 'integer', minimum: 0, maximum: 4 } } } },
  }, PRODUCTION, { title: 'what ran in production (a card of its own)', description: 'Numbers Netflix gave without saying on which set they were measured; they are never put on the axis of the chart.' }),
  labels: obj(Object.fromEntries(Object.entries(LABELS).map(([k]) => [k, FRAGMENT])), LABELS, { title: 'the short labels', description: '`{v}` is replaced by the number, `{pct}` by the percentage, each in the form of the language.' }),
  figureLabel: FRAGMENT,
  dimTo: { type: 'number', minimum: 0, maximum: 1 },
}, DEFAULTS, { title: 'the milestones mode (mode milestones)', description: 'The published test RMSEs of the Netflix Prize as ordered milestones, a target line, the Grand Prize tie, and a separate card of production numbers.' });

/** The example of the mode: the lecture's page. */
export const milestonesExamples = [{ mode: 'milestones' }];

/** A number in the form of a language: EN "0.9525", TR "0,9525". @param {number} x @param {number} decimals @param {string} lang @returns {string} */
export const fmtNum = (x, decimals, lang) => { const t = x.toFixed(decimals); return lang === 'tr' ? t.replace('.', ',') : t; };
/** A number as a fragment {en, tr}. @param {number} x @param {number} decimals @returns {{en: string, tr: string}} */
export const numFrag = (x, decimals) => ({ en: fmtNum(x, decimals, 'en'), tr: fmtNum(x, decimals, 'tr') });
/**
 * A fragment with its {placeholders} filled in each language (a missing Turkish text falls back to the English one).
 * @param {Record<string, string>} text @param {Record<string, (lang: string) => string>} vars @returns {{en: string, tr: string}}
 */
export function fill(text, vars) {
  const one = (/** @type {string} */ lang) => (text[lang] ?? text.en).replace(/\{(\w+)\}/g, (m, name) => (vars[name] ? vars[name](lang) : m));
  return { en: one('en'), tr: one('tr') };
}

/**
 * What the picture needs of the params and the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function milestonesProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const M = P.milestones;
  const { min, max } = M.y;
  if (!(min < max)) bad('$.milestones.y', `has min ${min} not below max ${max}`);
  M.y.ticks.forEach((/** @type {number} */ t, /** @type {number} */ i) => {
    if (t < min || t > max) bad(`$.milestones.y.ticks[${i}]`, `${t} lies off the axis (${min} .. ${max})`);
    if (i > 0 && t <= M.y.ticks[i - 1]) bad(`$.milestones.y.ticks[${i}]`, `${t} does not rise from ${M.y.ticks[i - 1]}`);
  });
  /** @param {string} path @param {number} v */
  const onAxis = (path, v) => { if (v < min || v > max) bad(path, `${v} lies off the axis (${min} .. ${max})`); };
  onAxis('$.milestones.baseline.test', M.baseline.test);
  if (typeof M.baseline.quiz === 'number' && M.baseline.quiz <= 0) bad('$.milestones.baseline.quiz', `${M.baseline.quiz} is not a score`);
  onAxis('$.milestones.target.value', M.target.value);
  M.prizes.forEach((/** @type {{test: number}} */ p, /** @type {number} */ i) => onAxis(`$.milestones.prizes[${i}].test`, p.test));
  M.grand.teams.forEach((/** @type {{test: number}} */ t, /** @type {number} */ i) => onAxis(`$.milestones.grand.teams[${i}].test`, t.test));
  M.grand.teams.forEach((/** @type {{time: string}} */ t, /** @type {number} */ i) => { if (!TIME.test(t.time)) bad(`$.milestones.grand.teams[${i}].time`, `"${t.time}" is not HH:MM:SS`); });
  const winners = M.grand.teams.filter((/** @type {{won?: boolean}} */ t) => t.won);
  if (winners.length !== 1) { bad('$.milestones.grand.teams', `has ${winners.length} winners: exactly one team has won: true`); return out; }
  const win = winners[0], other = M.grand.teams.find((/** @type {any} */ t) => t !== win);
  if (win.test === other.test && !(win.time < other.time)) bad('$.milestones.grand.teams', `the winner submitted at ${win.time}, not before ${other.time}: a tie goes to the earlier submission`);
  if (win.test > other.test) bad('$.milestones.grand.teams', `the winner scored ${win.test}, worse than the other team's ${other.test}`);
  // the ladder: each milestone is no worse than the one before it
  /** @type {Array<[string, number]>} */
  const ladder = [['$.milestones.baseline.test', M.baseline.test], ...M.prizes.map((/** @type {{test: number}} */ p, /** @type {number} */ i) => /** @type {[string, number]} */ ([`$.milestones.prizes[${i}].test`, p.test])), ['$.milestones.grand.teams (the winner)', win.test]];
  ladder.forEach(([path, v], i) => { if (i > 0 && v > ladder[i - 1][1]) bad(path, `${v} is above the milestone before it (${ladder[i - 1][1]}): the test RMSE falls from one milestone to the next`); });
  // the percentage of the target is a claim about two numbers: check it
  const real = (1 - M.target.value / M.baseline.test) * 100;
  if (Math.abs(real - M.target.improvement) > 0.05) bad('$.milestones.target.improvement', `says ${M.target.improvement}%, but ${M.target.value} against ${M.baseline.test} is ${real.toFixed(2)}% better`);
  return out;
}

/**
 * The picture of the mode `milestones`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of chart-draw
 * @returns {import('./kit.js').WidgetBuild}
 */
export function milestonesBuild(ctx, P) {
  const problems = milestonesProblems(P);
  if (problems.length) throw new Error(`chart-draw milestones: ${problems.map((p) => `${p.path} ${p.detail}`).join('; ')}`);
  const doc = ctx.slot.ownerDocument;
  const M = P.milestones, L = M.labels;
  const n = 4;
  const fy = (/** @type {number} */ v) => PLOT.yB - ((v - M.y.min) / (M.y.max - M.y.min)) * (PLOT.yB - PLOT.yT);
  /** @type {Array<{win?: boolean, name: string, time: string, test: number}>} */
  const teams = M.grand.teams;
  const win = teams.find((t) => t.won) ?? teams[0];
  const gx = (/** @type {number} */ i) => CX[3] + (i === 0 ? -PAIR : PAIR);
  const pctFrag = fill({ en: '{pct}', tr: '{pct}' }, { pct: (lang) => fmtPct(M.target.improvement / 100, lang, 0) });

  const root = h(doc, 'div', 'w-root cv-root ms-root', { role: 'img', 'aria-label': ctx.text(M.figureLabel) });
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @type {Map<string, {start: number, duration: number}>} */
  const when = new Map();
  /** @type {Map<string, number>} the press each keyed element belongs to */
  const press = new Map();
  /** @type {Map<string, 'pop'|'rise'|'draw'|'wipe'|'fade'>} how a keyed element comes in */
  const how = new Map();
  /** Register a keyed element. @param {string} key @param {Element} el @param {number} k @param {'pop'|'rise'|'draw'|'wipe'|'fade'} kind @param {[number, number]} t [start, duration] */
  const reg = (key, el, k, kind, t) => { el.setAttribute('data-key', key); els.set(key, el); press.set(key, k); how.set(key, kind); when.set(key, { start: t[0], duration: t[1] }); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;

  // the washes of the key press lie behind everything
  const wash0 = reg('wash:0', h(doc, 'div', 'ms-wash', { 'aria-hidden': 'true' }), 4, 'fade', [0, WASH]);
  /** @type {HTMLElement} */ (wash0).style.cssText = box(24, 70, 1196, 522);                    // from the tick labels to the title of the ladder, short of the production card's wash (x 1228)
  const wash1 = reg('wash:1', h(doc, 'div', 'ms-wash', { 'aria-hidden': 'true' }), 4, 'fade', [0, WASH]);
  /** @type {HTMLElement} */ (wash1).style.cssText = box(PROD.x - 22, PROD.y - 24, PROD.w + 44, PROD.h + 48);
  root.append(wash0, wash1);

  // the leaderboard: everything of the chart, in a group that dims for the foil press and returns for the key
  const chart = h(doc, 'div', 'cv-layer', { 'aria-hidden': 'true' });
  els.set('cg', chart);
  chart.setAttribute('data-key', 'cg');
  root.append(chart);
  const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}` });
  chart.append(svg);
  /** A text label inside the chart. @param {string|null} key @param {number} k @param {[number, number]} t @param {string} cls @param {Record<string, string>} text @param {string} css @param {string} [role] */
  const label = (key, k, t, cls, text, css, role = '') => {
    const e = h(doc, 'div', `cv-lbl ${cls}`, role ? { 'data-role': role } : {});
    e.style.cssText = css;
    say(e, text);
    chart.append(e);
    if (key) reg(key, e, k, 'rise', t);
    return e;
  };

  // the frame (state 0): the grid and the ticks of the vertical axis, the axis, its title and the title of the ladder
  for (const t of M.y.ticks) {
    svg.append(s(doc, 'path', { class: 'cv-grid', d: `M${PLOT.x0} ${fy(t)}H${PLOT.x1}` }));
    label(null, 0, [0, 0], 'cv-ytick', numFrag(t, 2), `left:${PLOT.x0 - 100}px;top:${fy(t) - 18}px;width:84px`);
  }
  svg.append(s(doc, 'path', { class: 'cv-axis', d: `M${PLOT.x0} ${PLOT.yT - 30}V${PLOT.yB}H${PLOT.x1 + 10}` }));
  label(null, 0, [0, 0], 'cv-axtitle', L.yTitle, `left:${PLOT.x0 - 120}px;top:6px;width:900px;text-align:left`);
  label(null, 0, [0, 0], 'cv-axtitle', L.xTitle, `left:${PLOT.x0}px;top:${PLOT.yB + 84}px;width:${PLOT.x1 - PLOT.x0}px;text-align:center`);

  // ---------- press 1: Cinematch, the target and the 10% between them ----------
  const yBase = fy(M.baseline.test), yTarget = fy(M.target.value);
  reg('bl-line', s(doc, 'path', { class: 'ms-ref', d: `M${PLOT.x0} ${yBase}H${PLOT.x1}`, pathLength: '1', 'data-gfx': 'stroke' }), 1, 'draw', [0, SEG]);
  svg.append(/** @type {Element} */ (els.get('bl-line')));
  /** A round point of the leaderboard, centred on (x, y). @param {string} key @param {number} k @param {number} start @param {number} x @param {number} y @param {boolean} [ring] */
  const dot = (key, k, start, x, y, ring = false) => { const d = reg(key, h(doc, 'div', `ms-dot${ring ? ' ms-ring' : ''}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), k, 'pop', [start, POP]); /** @type {HTMLElement} */ (d).style.cssText = `left:${x - 13}px;top:${y - 13}px`; chart.append(d); };
  dot('dot:bl', 1, 100, CX[0], yBase);
  const valBl = label('val:bl', 1, [220, LABEL], 'cv-val', numFrag(M.baseline.test, 4), `left:${CX[0] + 18}px;top:${yBase - 66}px`);
  if (typeof M.baseline.quiz === 'number') valBl.append(say(h(doc, 'span', 'ms-quiz'), fill(L.quiz, { v: (lang) => fmtNum(M.baseline.quiz, 4, lang) })));
  /** The name of a milestone under the axis, with a softer second line. @param {string} key @param {number} k @param {number} start @param {number} x @param {Record<string, string>} name @param {Record<string, string>|string} [sub] */
  const category = (key, k, start, x, name, sub) => {
    const c = label(key, k, [start, LABEL], 'ms-cat', name, `left:${x - 125}px;top:${PLOT.yB + 16}px;width:250px`);
    if (sub) { const sp = h(doc, 'span', 'ms-sub'); if (typeof sub === 'string') sp.textContent = sub; else say(sp, sub); c.append(sp); }
  };
  category('cat:bl', 1, 220, CX[0], M.baseline.name);
  // the target: a dashed line wiped in from the left (the emphasis blue), its label and the bracket
  const tgWrap = h(doc, 'div', 'cv-wipe', { 'aria-hidden': 'true' });
  const tgSvg = s(doc, 'svg', { width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}` });
  tgSvg.append(s(doc, 'path', { class: 'ms-target', d: `M${PLOT.x0} ${yTarget}H${PLOT.x1}`, 'data-gfx': 'stroke' }));
  tgWrap.append(tgSvg);
  chart.append(reg('tg-line', tgWrap, 1, 'wipe', [380, 500]));
  label('tg-lbl', 1, [460, LABEL], 'cv-series', fill(L.target, { v: (lang) => fmtNum(M.target.value, 4, lang) }), `left:${BRACE_X + 22}px;top:${yTarget - 46}px;width:420px`, 'emph');
  const brace = s(doc, 'path', { class: 'ms-brace', d: `M${BRACE_X - 12} ${yBase}H${BRACE_X + 12}M${BRACE_X} ${yBase}V${yTarget}M${BRACE_X - 12} ${yTarget}H${BRACE_X + 12}` });
  reg('br', brace, 1, 'fade', [820, POP]);
  svg.append(brace);
  label('br-lbl', 1, [900, LABEL], 'cv-series', fill(L.improvement, { pct: (lang) => pctFrag[/** @type {'en'|'tr'} */ (lang)] }), `left:${BRACE_X + 22}px;top:${(yBase + yTarget) / 2 - 36}px;width:230px;white-space:normal`, 'emph');

  // ---------- press 2: the milestones, then the tie ----------
  const pts = [[CX[0], yBase], [CX[1], fy(M.prizes[0].test)], [CX[2], fy(M.prizes[1 % M.prizes.length].test)], [gx(teams.indexOf(win)), fy(win.test)]];
  if (M.prizes.length !== 2) throw new Error('chart-draw milestones: the picture has the two progress prizes of the contest (prizes needs two entries)');
  const SEG_AT = [0, 560, 1120];
  SEG_AT.forEach((t, i) => {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    svg.append(reg(`seg:${i + 1}`, s(doc, 'path', { class: 'ms-seg', d: `M${x1} ${y1}L${x2} ${y2}`, pathLength: '1', 'data-gfx': 'stroke' }), 2, 'draw', [t, SEG]));
  });
  M.prizes.forEach((/** @type {{name: Record<string, string>, team?: string, test: number}} */ p, /** @type {number} */ i) => {
    const t0 = i === 0 ? 300 : 860, tl = i === 0 ? 420 : 980;
    dot(`dot:p${i}`, 2, t0, CX[i + 1], fy(p.test));
    label(`val:p${i}`, 2, [tl, LABEL], 'cv-val', numFrag(p.test, 4), `left:${CX[i + 1] + 18}px;top:${fy(p.test) - 50}px`);
    category(`cat:p${i}`, 2, tl, CX[i + 1], p.name, p.team);
  });
  teams.forEach((t, i) => dot(`dot:g${i}`, 2, i === teams.indexOf(win) ? 1420 : 1500, gx(i), fy(t.test), t !== win));
  category('cat:g', 2, 1500, CX[3], M.grand.name, M.grand.date);
  // the card of the tie, and a leader from it to each of the two points
  const card = h(doc, 'div', 'ms-card', { 'aria-hidden': 'true' });
  card.append(say(h(doc, 'div', 'ms-tie'), fill(L.tie, { v: (lang) => fmtNum(win.test, 4, lang) })));
  teams.forEach((t) => {
    const row = h(doc, 'div', 'ms-team');
    row.append(h(doc, 'i', `ms-mark${t === win ? '' : ' ms-ring'}`));
    const nm = h(doc, 'span', 'ms-tname');
    nm.textContent = t.name;
    const tm = h(doc, 'span', 'ms-ttime');
    tm.textContent = t.time;
    row.append(nm, tm);
    card.append(row);
  });
  card.append(say(h(doc, 'div', 'ms-won', { 'data-role': 'key' }), L.earlier));
  card.style.cssText = box(CARD.x, CARD.y, CARD.w, CARD.h);
  chart.append(reg('gp', card, 2, 'rise', [1560, 400]));
  teams.forEach((t, i) => svg.append(reg(`gl:${i}`, s(doc, 'path', { class: 'ms-leader', d: `M${gx(i)} ${CARD.y + CARD.h}V${fy(t.test) - 24}` }), 2, 'fade', [1560 + i * 60, POP])));

  // ---------- press 3: the production card, a different set ----------
  const prod = h(doc, 'div', 'ms-prod', { 'aria-hidden': 'true' });
  prod.style.cssText = box(PROD.x, PROD.y, PROD.w, PROD.h);
  prod.append(say(h(doc, 'div', 'ms-ptitle'), M.production.title));
  root.append(reg('pc', prod, 3, 'pop', [150, FADE]));
  M.production.items.forEach((/** @type {{name: Record<string, string>, value: number, decimals?: number}} */ it, /** @type {number} */ i) => {
    const row = h(doc, 'div', 'ms-prow');
    row.style.cssText = `top:${78 + i * 74}px`;
    row.append(h(doc, 'i', 'ms-psq'), say(h(doc, 'span', 'ms-pname'), it.name), say(h(doc, 'span', 'ms-pval'), numFrag(it.value, it.decimals ?? 4)));
    prod.append(reg(`pr:${i}`, row, 3, 'rise', [450 + i * 110, 300]));
  });
  prod.append(reg('pc-note', say(h(doc, 'div', 'ms-pnote'), M.production.note), 3, 'rise', [800, LABEL]));

  // ---------- frames and timing ----------
  const RISE_OFF = { opacity: '0', transform: 'translateY(10px)' }, RISE_ON = { opacity: '1', transform: 'translateY(0px)' };
  const POP_OFF = { opacity: '0', transform: 'scale(0.5)' }, POP_ON = { opacity: '1', transform: 'scale(1)' };
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('cg', { opacity: k === 3 ? String(M.dimTo) : '1' });
    for (const [key, kind] of how) {
      const on = k >= /** @type {number} */ (press.get(key));
      if (key.startsWith('wash:')) f.set(key, { opacity: k === 4 ? '1' : '0' });
      else if (kind === 'pop') f.set(key, on ? POP_ON : POP_OFF);
      else if (kind === 'rise') f.set(key, on ? RISE_ON : RISE_OFF);
      else if (kind === 'draw') f.set(key, { strokeDashoffset: on ? '0' : '1.02' });
      else if (kind === 'wipe') f.set(key, { opacity: '1', clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' });
      else f.set(key, { opacity: on ? '1' : '0' });
    }
    return f;
  };
  /** @param {string} key @param {number} k */
  const timing = (key, k) => (key === 'cg' ? { start: 0, duration: FADE } : /** @type {{start: number, duration: number}} */ (when.get(key)));
  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
