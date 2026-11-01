// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2 item 7; the page `netflix-finish` of the I2RS w07 deck, storyboard §3): the mode `finish` of chart-draw, a sibling of the mode `milestones` (chart-milestones.js, the w06 page) with the five presses of the w07 page.
// The whole ladder of the Netflix Prize is on the TEST set (the quiz values stand only where the page names them: Cinematch in press 2, the two finalists in press 4): the movie average, Cinematch, the target, the two progress prizes and the Grand Prize.
// The picture draws the numbers it is given (the deck takes them from its evidence records) and never makes one. The ladder is "milestones in order", not a time axis.
//
// State 0 is the frame: the vertical axis "test RMSE (lower is better)" and the empty ladder. Five presses:
//   1 average     the point of the movie average (always predict a film's mean rating), the highest on the ladder (test 1.0540)
//   2 Cinematch   a line down to Netflix's own system (test 0.9525) with its quiz value beside it (0.9514)
//   3 the target  a dashed line at 0.8572 (10 % better than Cinematch); the 2007 and 2008 progress prizes, each a point on the way down (0.8723, 0.8627)
//   4 the finish  two points at the SAME height (test 0.8567, a tie at four decimals: the winner is filled, the runner-up a ring) and a card: on the public quiz the order was the reverse (The Ensemble 0.8553, BellKor's Pragmatic Chaos 0.8554)
//   5 the tie     six decimals (0.856704 and 0.856714), the rule: the earlier submission is scored first and wins (18:18:28 before 18:38:22, 19 min 54 s earlier), and the leaderboard did not decide the winner (the key colour is bold ink, D-074)
//
// duration(k) = pressDuration (SEG 380, POP 300, LABEL 360, FADE 400; every start is in the plan below): 580 / 780 / 1580 / 1000 / 1160 ms.
//   1  the point 100 + 300, its label 220 + 360   2  the line 0 + 380, the point 300 + 300, its labels 420 + 360   3  the target 0 + 500, its label 200 + 360, the lines 300 and 800 (+ 380), the points 600 and 1100 (+ 300), their labels 720 and 1220 (+ 360)
//   4  the line 0 + 380, the two points 300 and 380 (+ 300), the labels 380 + 360, the card 600 + 400   5  the card 100 + 400, its three lines 300, 550 and 800 (+ 360)
//
// Motion: strokeDashoffset (a line draws), clipPath (the dashed target wipes in), opacity + transform (points pop, labels and cards rise). No colour keyframes.
import { h, s } from './frames.js';
import { fmtNum, numFrag, fill } from './chart-milestones.js';
import { fmtPct } from './chart-vote.js';
import { finish, frag, labelsSchema, pressDuration, scene } from './w07-common.js';

const PLOT = Object.freeze({ x0: 150, x1: 1070, yB: 470, yT: 100 });
/** The centres of the five milestone columns; the two Grand Prize points stand on the last one, PAIR px either side. */
const CX = Object.freeze([230, 415, 600, 785, 990]);
const PAIR = 36;
const CARD = Object.freeze({ x: 1090, y: 100, w: 560, h: 240 });
const TIE = Object.freeze({ x: 1090, y: 360, w: 560, h: 190 });
const SEG = 380, POP = 300, LABEL = 360, FADE = 400;
const TIME = /^\d\d:\d\d:\d\d$/;

const Y = { min: 0.85, max: 1.06, ticks: [0.86, 0.9, 0.94, 0.98, 1.02, 1.06] };
const AVERAGE = { name: frag('Movie average', 'Film ortalaması'), test: 1.054 };
const BASELINE = { name: frag('Cinematch', 'Cinematch'), test: 0.9525, quiz: 0.9514 };
const TARGET = { value: 0.8572, improvement: 10 };
const PRIZES = [
  { name: frag('2007 Progress Prize', '2007 İlerleme Ödülü'), team: 'KorBell', test: 0.8723 },
  { name: frag('2008 Progress Prize', '2008 İlerleme Ödülü'), team: 'BellKor in BigChaos', test: 0.8627 },
];
const GRAND = {
  name: frag('Grand Prize', 'Büyük Ödül'), date: frag('26 July 2009', '26 Temmuz 2009'),
  teams: [{ name: 'BellKor\'s Pragmatic Chaos', time: '18:18:28', test: 0.8567, quiz: 0.8554, won: true }, { name: 'The Ensemble', time: '18:38:22', test: 0.8567, quiz: 0.8553 }],
};
const SIX = [0.856704, 0.856714];
const LABELS = {
  yTitle: frag('Test RMSE (lower is better)', 'Test RMSE (düşük iyi)'), xTitle: frag('Milestones in order, not drawn to a time scale', 'Kilometre taşları sırayla, zaman ölçeğine göre çizilmedi'),
  target: frag('target {v}', 'hedef {v}'), improvement: frag('{pct} better than Cinematch', 'Cinematch\'ten {pct} daha iyi'), quiz: frag('quiz {v}', 'quiz {v}'),
  finishTitle: frag('the finish', 'bitiş'), quizHead: frag('quiz (public)', 'quiz (açık)'), testHead: frag('test (decides)', 'test (belirler)'),
  quizLead: frag('on the public quiz, {a} was ahead', 'açık quiz\'de {a} öndeydi'),
  six: frag('four decimals: a tie · six decimals: {a} and {b}', 'dört ondalıkla beraberlik · altı ondalıkla {a} ve {b}'),
  rule: frag('the earlier submission wins: {t1} before {t2}, {m} min {s} s earlier', 'önce gönderen kazanır: {t1}, {t2}\'den {m} dk {s} sn önce'),
  undecided: frag('the leaderboard did not decide the winner', 'liderlik tablosu kazananı belirlemedi'),
};
const FIGURE_LABEL = frag(
  'A chart of the published test RMSE values of the Netflix Prize, lower is better, with the milestones in order: the movie average 1.0540, Cinematch 0.9525, the 2007 Progress Prize 0.8723, the 2008 Progress Prize 0.8627 and the two Grand Prize finalists, both 0.8567 on the test set.',
  'Netflix Ödülü\'nün yayımlanmış test RMSE değerlerinin grafiği; düşük olan iyidir, kilometre taşları sırayla: film ortalaması 1,0540, Cinematch 0,9525, 2007 İlerleme Ödülü 0,8723, 2008 İlerleme Ödülü 0,8627 ve test kümesinde ikisi de 0,8567 olan iki Büyük Ödül finalisti.');

const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const NUM = { type: 'number', minimum: 0 };
const TEAM = {
  type: 'object', required: ['name', 'time', 'test', 'quiz'], additionalProperties: false,
  properties: { name: { type: 'string', minLength: 1 }, time: { type: 'string', minLength: 8, maxLength: 8 }, test: NUM, quiz: NUM, won: { type: 'boolean' } },
};

/** The params of the mode `finish`, merged into chart-draw's schema (the registry carries the whole). */
export const finishSchema = {
  type: 'object', additionalProperties: false, title: 'the Netflix Prize finish (mode finish)',
  description: 'The published test RMSEs of the Netflix Prize as ordered milestones (the whole ladder is on the test set), a target line, the Grand Prize tie and its six decimals. `quiz` values are drawn only for Cinematch (press 2) and the two finalists (press 4). '
    + '`grand.teams` are exactly two teams, each with its submission time (HH:MM:SS), test and quiz RMSE; exactly one has `won`; `six` are the two test RMSEs at six decimals (they round to the test value of the finalists). The widget draws the numbers it is given and never makes one.',
  default: { y: Y, average: AVERAGE, baseline: BASELINE, target: TARGET, prizes: PRIZES, grand: GRAND, six: SIX, labels: LABELS, figureLabel: FIGURE_LABEL },
  properties: {
    y: { type: 'object', additionalProperties: false, default: Y, properties: { min: { type: 'number', default: Y.min }, max: { type: 'number', default: Y.max }, ticks: { type: 'array', minItems: 2, items: { type: 'number' }, default: Y.ticks } } },
    average: { type: 'object', additionalProperties: false, default: AVERAGE, properties: { name: { ...FRAGMENT, default: AVERAGE.name }, test: { ...NUM, default: AVERAGE.test } } },
    baseline: { type: 'object', additionalProperties: false, default: BASELINE, properties: { name: { ...FRAGMENT, default: BASELINE.name }, test: { ...NUM, default: BASELINE.test }, quiz: { ...NUM, default: BASELINE.quiz } } },
    target: { type: 'object', additionalProperties: false, default: TARGET, properties: { value: { ...NUM, default: TARGET.value }, improvement: { type: 'number', minimum: 0, maximum: 100, default: TARGET.improvement } } },
    prizes: { type: 'array', minItems: 2, maxItems: 2, default: PRIZES, items: { type: 'object', required: ['name', 'test'], additionalProperties: false, properties: { name: FRAGMENT, team: { type: 'string' }, test: NUM } } },
    grand: {
      type: 'object', additionalProperties: false, default: GRAND,
      properties: { name: { ...FRAGMENT, default: GRAND.name }, date: { ...FRAGMENT, default: GRAND.date }, teams: { type: 'array', minItems: 2, maxItems: 2, default: GRAND.teams, items: TEAM } },
    },
    six: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0 }, default: SIX },
    labels: labelsSchema(LABELS, '`{v}` is a number, `{pct}` the percentage, `{a}` and `{b}` names or numbers, `{t1}` and `{t2}` submission times, `{m}` and `{s}` minutes and seconds, each in the form of the language.'),
    figureLabel: { ...FRAGMENT, default: FIGURE_LABEL },
  },
};
export const finishExamples = [{ mode: 'finish' }];
export const finishPresses = 5;

/** Seconds of day of an HH:MM:SS time. @param {string} t */
export const seconds = (t) => { const [a, b, c] = t.split(':').map(Number); return a * 3600 + b * 60 + c; };
/** The rounding of a number to `d` decimals, the way the contest rounded its public scores. @param {number} x @param {number} d */
export const roundTo = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
/** The vertical position (px, from the top) of a test RMSE on the axis `y` ({min, max}): the smaller the RMSE, the lower the point. @param {{min: number, max: number}} y @param {number} v */
export const yOf = (y, v) => PLOT.yB - ((v - y.min) / (y.max - y.min)) * (PLOT.yB - PLOT.yT);

/**
 * What the picture needs of the params that the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function finishProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const M = P.finish;
  const { min, max } = M.y;
  if (!(min < max)) bad('$.finish.y', `has min ${min} not below max ${max}`);
  M.y.ticks.forEach((/** @type {number} */ t, /** @type {number} */ i) => {
    if (t < min || t > max) bad(`$.finish.y.ticks[${i}]`, `${t} lies off the axis (${min} .. ${max})`);
    if (i > 0 && t <= M.y.ticks[i - 1]) bad(`$.finish.y.ticks[${i}]`, `${t} does not rise from ${M.y.ticks[i - 1]}`);
  });
  /** @type {Array<[string, number]>} */
  const ladder = [['$.finish.average.test', M.average.test], ['$.finish.baseline.test', M.baseline.test], ['$.finish.prizes[0].test', M.prizes[0].test], ['$.finish.prizes[1].test', M.prizes[1].test]];
  /** @type {Array<{name: string, time: string, test: number, quiz: number, won?: boolean}>} */
  const teams = M.grand.teams;
  const winners = teams.filter((t) => t.won);
  if (winners.length !== 1) { bad('$.finish.grand.teams', `has ${winners.length} winners: exactly one team has won: true`); return out; }
  const win = winners[0], other = teams.find((t) => t !== win);
  if (!other) return out;
  ladder.push(['$.finish.grand.teams[winner].test', win.test]);
  ladder.forEach(([path, v], i) => {
    if (v < min || v > max) bad(path, `${v} lies off the axis (${min} .. ${max})`);
    if (i > 0 && v > ladder[i - 1][1]) bad(path, `${v} is above the milestone before it (${ladder[i - 1][1]}): the test RMSE falls from one milestone to the next`);
  });
  if (M.target.value < min || M.target.value > max) bad('$.finish.target.value', `${M.target.value} lies off the axis (${min} .. ${max})`);
  const real = (1 - M.target.value / M.baseline.test) * 100;
  if (Math.abs(real - M.target.improvement) > 0.05) bad('$.finish.target.improvement', `says ${M.target.improvement}%, but ${M.target.value} against ${M.baseline.test} is ${real.toFixed(2)}% better`);
  teams.forEach((t, i) => { if (!TIME.test(t.time)) bad(`$.finish.grand.teams[${i}].time`, `"${t.time}" is not HH:MM:SS`); });
  if (teams.every((t) => TIME.test(t.time)) && win.test === other.test && !(seconds(win.time) < seconds(other.time))) bad('$.finish.grand.teams', `the winner submitted at ${win.time}, not before ${other.time}: a tie goes to the earlier submission`);
  if (win.test > other.test) bad('$.finish.grand.teams', `the winner scored ${win.test}, worse than the other team's ${other.test}`);
  if (win.test !== other.test) bad('$.finish.grand.teams', `the two finalists have test ${win.test} and ${other.test}: the page is about a tie at four decimals`);
  if (!(win.quiz > other.quiz)) bad('$.finish.grand.teams', `the winner has quiz ${win.quiz}, not worse than ${other.name}'s ${other.quiz}: the page says the quiz order was the reverse of the final one`);
  const [a, b] = M.six;
  if (roundTo(a, 4) !== win.test || roundTo(b, 4) !== win.test) bad('$.finish.six', `${a} and ${b} must both round to the finalists' test value ${win.test} at four decimals`);
  if (a === b) bad('$.finish.six', 'are the same number: six decimals must tell the two apart');
  return out;
}

/**
 * The plan of the picture: every animated element with its press, how it comes in and when (start, duration in ms). Pure: the order of the milestones and the two teams are all it needs.
 * @param {any} P the resolved params of chart-draw @returns {Array<{key: string, k: number, kind: 'pop'|'rise'|'draw'|'wipe', t: [number, number]}>}
 */
export function finishPlan(P) {
  /** @type {Array<{won?: boolean}>} */ const teams = P.finish.grand.teams;
  const win = Math.max(0, teams.findIndex((t) => t.won));
  /** @type {Array<{key: string, k: number, kind: 'pop'|'rise'|'draw'|'wipe', t: [number, number]}>} */
  const plan = [];
  /** @param {string} key @param {number} k @param {'pop'|'rise'|'draw'|'wipe'} kind @param {number} start @param {number} dur */
  const at = (key, k, kind, start, dur) => { plan.push({ key, k, kind, t: [start, dur] }); };
  at('dot:avg', 1, 'pop', 100, POP); at('val:avg', 1, 'rise', 220, LABEL); at('cat:avg', 1, 'rise', 220, LABEL);
  at('seg:1', 2, 'draw', 0, SEG); at('dot:bl', 2, 'pop', 300, POP); at('val:bl', 2, 'rise', 420, LABEL); at('cat:bl', 2, 'rise', 420, LABEL);
  at('tg-line', 3, 'wipe', 0, 500); at('tg-lbl', 3, 'rise', 200, LABEL);
  at('seg:2', 3, 'draw', 300, SEG); at('dot:p0', 3, 'pop', 600, POP); at('val:p0', 3, 'rise', 720, LABEL); at('cat:p0', 3, 'rise', 720, LABEL);
  at('seg:3', 3, 'draw', 800, SEG); at('dot:p1', 3, 'pop', 1100, POP); at('val:p1', 3, 'rise', 1220, LABEL); at('cat:p1', 3, 'rise', 1220, LABEL);
  at('seg:4', 4, 'draw', 0, SEG);
  teams.forEach((_, i) => at(`dot:g${i}`, 4, 'pop', i === win ? 300 : 380, POP));
  at('val:g', 4, 'rise', 380, LABEL); at('cat:g', 4, 'rise', 380, LABEL); at('fc', 4, 'rise', 600, FADE);
  at('tcard', 5, 'rise', 100, FADE); at('t6', 5, 'rise', 300, LABEL); at('fr', 5, 'rise', 550, LABEL); at('nb', 5, 'rise', 800, LABEL);
  return plan;
}

/**
 * The picture's pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of chart-draw
 */
export function finishModel(P) {
  const plan = finishPlan(P);
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
      else f.set(e.key, { opacity: '1', clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' });
    }
    return f;
  };
  /** @param {string} key @returns {import('./frames.js').Timing} */
  const timing = (key) => { const e = /** @type {{t: [number, number]}} */ (by.get(key)); return { start: e.t[0], duration: e.t[1] }; };
  return { plan, frame, timing, n: finishPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `finish`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of chart-draw
 * @returns {import('./kit.js').WidgetBuild}
 */
export function finishBuild(ctx, P) {
  const problems = finishProblems(P);
  if (problems.length) throw new Error(`chart-draw finish: ${problems.map((p) => `${p.path} ${p.detail}`).join('; ')}`);
  const M = P.finish, L = M.labels;
  const model = finishModel(P);
  const sc = scene(ctx, 'cv-root fn-root');
  const { doc, root, box, put, say } = sc;
  root.setAttribute('role', 'img'); root.setAttribute('aria-label', ctx.text(M.figureLabel));
  const fy = (/** @type {number} */ v) => yOf(M.y, v);
  /** @type {Array<{name: string, time: string, test: number, quiz: number, won?: boolean}>} */
  const teams = M.grand.teams;
  const winIdx = Math.max(0, teams.findIndex((t) => t.won)), win = teams[winIdx], other = teams[1 - winIdx];
  const gx = (/** @type {number} */ i) => CX[4] + (i === 0 ? -PAIR : PAIR);
  const pctFrag = fill({ en: '{pct}', tr: '{pct}' }, { pct: (lang) => fmtPct(M.target.improvement / 100, lang, 0) });
  const svg = s(doc, 'svg', { class: 'cv-svg', width: '1680', height: '600', viewBox: '0 0 1680 600' });
  root.append(svg);
  /** A text label of the chart. @param {string|null} key @param {string} cls @param {Record<string, string>} text @param {string} css @param {string} [role] */
  const label = (key, cls, text, css, role = '') => {
    const e = h(doc, 'div', `cv-lbl ${cls}`, role ? { 'data-role': role } : {});
    say(e, text);
    if (key) put(key, e, css); else { e.style.cssText += `;${css}`; root.append(e); }
    return e;
  };
  // the frame (state 0): the grid and the ticks of the vertical axis, the axis, its title and the note on the order of the milestones
  for (const t of M.y.ticks) {
    svg.append(s(doc, 'path', { class: 'cv-grid', d: `M${PLOT.x0} ${fy(t)}H${PLOT.x1}` }));
    label(null, 'cv-ytick', numFrag(t, 2), `left:${PLOT.x0 - 100}px;top:${fy(t) - 18}px;width:84px`);
  }
  svg.append(s(doc, 'path', { class: 'cv-axis', d: `M${PLOT.x0} ${PLOT.yT - 30}V${PLOT.yB}H${PLOT.x1 + 10}` }));
  label(null, 'cv-axtitle', L.yTitle, `left:30px;top:6px;width:420px;text-align:left`);
  label(null, 'cv-axtitle fn-xnote', L.xTitle, `left:520px;top:6px;width:900px;text-align:left`);

  const dot = (/** @type {string} */ key, /** @type {number} */ x, /** @type {number} */ y, /** @type {boolean} */ ring = false) => put(key, h(doc, 'div', `ms-dot${ring ? ' ms-ring' : ''}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), `left:${x - 13}px;top:${y - 13}px`);
  /** A name under the axis, wrapped, with a softer second line. @param {string} key @param {number} x @param {Record<string, string>} name @param {string} [sub] */
  const category = (key, x, name, sub) => {
    const c = label(key, 'fn-cat', name, `left:${x - 85}px;top:${PLOT.yB + 16}px;width:170px`);
    if (sub) { const sp = h(doc, 'span', 'fn-sub'); sp.textContent = sub; c.append(sp); }
  };
  const seg = (/** @type {string} */ key, /** @type {number[]} */ a, /** @type {number[]} */ b) => put(key, s(doc, 'path', { class: 'ms-seg', d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, pathLength: '1', 'data-gfx': 'stroke' }), '', undefined);
  // the points of the ladder, in order: the movie average, Cinematch, the two progress prizes, the winner of the Grand Prize
  const pts = [[CX[0], fy(M.average.test)], [CX[1], fy(M.baseline.test)], [CX[2], fy(M.prizes[0].test)], [CX[3], fy(M.prizes[1].test)], [gx(winIdx), fy(win.test)]];
  // press 1: the movie average
  dot('dot:avg', pts[0][0], pts[0][1]);
  label('val:avg', 'cv-val', numFrag(M.average.test, 4), `left:${CX[0] + 18}px;top:${pts[0][1] - 18}px`);
  category('cat:avg', CX[0], M.average.name);
  // press 2: Cinematch, its quiz value beside the test value
  svg.append(seg('seg:1', pts[0], pts[1]));
  dot('dot:bl', pts[1][0], pts[1][1]);
  const valBl = label('val:bl', 'cv-val', numFrag(M.baseline.test, 4), `left:${CX[1] + 18}px;top:${pts[1][1] - 66}px`);
  valBl.append(say(h(doc, 'span', 'ms-quiz fn-quiz'), fill(L.quiz, { v: (lang) => fmtNum(M.baseline.quiz, 4, lang) })));   // WP-93 (D-182): the quiz value beside Cinematch is in the quiz amber, as the quiz head of the card
  category('cat:bl', CX[1], M.baseline.name);
  // press 3: the target, the two progress prizes
  const yTarget = fy(M.target.value);
  const tgWrap = h(doc, 'div', 'cv-wipe', { 'aria-hidden': 'true' });
  const tgSvg = s(doc, 'svg', { width: '1680', height: '600', viewBox: '0 0 1680 600' });
  tgSvg.append(s(doc, 'path', { class: 'ms-target', d: `M${PLOT.x0} ${yTarget}H${PLOT.x1}`, 'data-gfx': 'stroke' }));
  tgWrap.append(tgSvg);
  put('tg-line', tgWrap, '');
  const tgl = label('tg-lbl', 'cv-series fn-tg', fill(L.target, { v: (lang) => fmtNum(M.target.value, 4, lang) }), `left:${PLOT.x0 + 22}px;top:${yTarget - 74}px;width:380px`, 'emph');
  tgl.append(say(h(doc, 'span', 'fn-sub'), fill(L.improvement, { pct: (lang) => pctFrag[/** @type {'en'|'tr'} */ (lang)] })));
  svg.append(seg('seg:2', pts[1], pts[2]), seg('seg:3', pts[2], pts[3]));
  M.prizes.forEach((/** @type {{name: Record<string, string>, team?: string, test: number}} */ p, /** @type {number} */ i) => {
    dot(`dot:p${i}`, pts[i + 2][0], pts[i + 2][1]);
    label(`val:p${i}`, 'cv-val', numFrag(p.test, 4), `left:${CX[i + 2] + 18}px;top:${pts[i + 2][1] - 50}px`);
    category(`cat:p${i}`, CX[i + 2], p.name, p.team);
  });
  // press 4: the Grand Prize, two points at the same height (the winner filled, the runner-up a ring) and the card of the quiz against the test
  svg.append(seg('seg:4', pts[3], pts[4]));
  teams.forEach((t, i) => dot(`dot:g${i}`, gx(i), fy(t.test), i !== winIdx));
  label('val:g', 'cv-val fn-gval', numFrag(win.test, 4), `left:${CX[4] - 60}px;top:${fy(win.test) - 66}px;width:120px;text-align:center`);
  category('cat:g', CX[4], M.grand.name, undefined);
  const card = h(doc, 'div', 'fn-card', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  card.append(say(h(doc, 'div', 'fn-card-title'), L.finishTitle));
  const grid = h(doc, 'div', 'fn-table');
  // WP-93 (D-179 (6)): the heads wear the roles of pages 17 and 18: quiz amber + dotted underline, test gold + double underline. WP-93 (D-183, the user's review of 2026-11-01): only the FIRST word of a head is underlined (the shape cue of the role);
  // the rest of the head, "(public)" or "(decides)", is a line of its own in the head's colour with no underline (an underline on both lines looked heavy). The word and the rest are cut from the one label of each language, at its first space.
  /** @param {'fn-th-q'|'fn-th-t'} role @param {Record<string, string>} f */
  const head = (role, f) => {
    const cut = (/** @type {string} */ t) => { const i = t.indexOf(' '); return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 1)]; };
    const part = (/** @type {number} */ n) => Object.fromEntries(Object.entries(f).map(([lang, t]) => [lang, cut(String(t))[n]]));
    const el = h(doc, 'span', `fn-th ${role}`);
    el.append(say(h(doc, 'span', 'fn-w'), part(0)), ' ', say(h(doc, 'span', 'fn-rest'), part(1)));
    return el;
  };
  grid.append(h(doc, 'span'), head('fn-th-q', L.quizHead), head('fn-th-t', L.testHead));
  const byQuiz = [...teams].sort((a, b) => a.quiz - b.quiz);                           // the order of the public quiz: the best (lowest) first
  byQuiz.forEach((t) => {
    const nm = h(doc, 'span', 'fn-tname');
    nm.append(h(doc, 'i', `ms-mark${t === win ? '' : ' ms-ring'}`), t.name);
    const isBestQuiz = t === byQuiz[0];
    const qv = h(doc, 'span', `fn-num${isBestQuiz ? ' fn-best' : ''}`); say(qv, numFrag(t.quiz, 4));
    const tv = h(doc, 'span', 'fn-num fn-best'); say(tv, numFrag(t.test, 4));
    grid.append(nm, qv, tv);
  });
  card.append(grid, say(h(doc, 'div', 'fn-foot'), fill(L.quizLead, { a: () => byQuiz[0].name })));
  put('fc', card, box(CARD.x, CARD.y, CARD.w, CARD.h));
  // press 5: six decimals, the rule, the verdict
  put('tcard', h(doc, 'div', 'fn-card', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(TIE.x, TIE.y, TIE.w, TIE.h));
  const gap = seconds(other.time) - seconds(win.time);
  const six = fill(L.six, { a: (lang) => fmtNum(M.six[0], 6, lang), b: (lang) => fmtNum(M.six[1], 6, lang) });
  const rule = fill(L.rule, { t1: () => win.time, t2: () => other.time, m: () => String(Math.floor(gap / 60)), s: () => String(gap % 60) });
  put('t6', say(h(doc, 'div', 'fn-line'), six), box(TIE.x + 22, TIE.y + 14, TIE.w - 44, 58));
  put('fr', say(h(doc, 'div', 'fn-line'), rule), box(TIE.x + 22, TIE.y + 76, TIE.w - 44, 58));
  put('nb', say(h(doc, 'div', 'fn-line fn-gold', { 'data-role': 'key' }), L.undecided), box(TIE.x + 22, TIE.y + 142, TIE.w - 44, 34));
  return finish(ctx, sc, model.n, model.frame, model.timing);
}
