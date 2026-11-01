// @ts-check
// WP-74 (D-149, D-150; brief 09; pages 3 `ab-test`, 10 `netflix-data` and 11 `netflix-score` of the I2RS w07 deck, storyboard §3): the mode `flow` of pipeline. A flow of people and data through a split and a score, in three views of four
// presses each: `ab` (an A/B test), `data` (how the Netflix Prize data was split) and `score` (how a team was scored: a public quiz, a hidden test). The A/B rates could be read as a measurement, so the view `ab` tags them "synthetic data" from
// press 3 on (D-129; the tag is a label, empty hides it); the leaderboard of `score` is a toy that carries no number; the Netflix shares are published numbers (the source is the slide's caption).
//
// View `ab`, states (0 is the crowd of 24 users):
//   1 split      the users are divided at random into two groups, A and B (12 each; the crowd steps back)
//   2 treat      each group gets one algorithm; everything else is the same, for the same period (a bar under each)
//   3 measure    the conversion rate of each group, a bar and its value (A 4.0 %, B 4.6 %)
//   4 doubt      each rate gets its margin (+-0.8 points): the two intervals overlap, so "B is better" needs more than one day (WP-93: the overlap is a hatched band UNDER the bars and the whiskers, widgets-w07.css)
// View `data`, states (0 is the empty frame of the data on its time axis, 1998 to 2005):
//   1 the data   the whole data fills the frame; three counts above it (ratings, subscribers, films)
//   2 held out   the newest ratings of every user are cut off at the right: the qualifying set (predicting the future is the task)
//   3 the halves the qualifying set splits into quiz and test, with equal probability; the probe set stays INSIDE the training data, with its answers
//   4 the shares a bar to scale: training 95.9 % (without the probe), probe, quiz and test about 1.36 % each, with their values
// View `score`, states (0 is a team, the scoring box with its two halves and an empty leaderboard):
//   1 submit     the team sends a prediction file (once a day) to the scorer
//   2 quiz       the quiz half is scored and its error goes onto the public leaderboard, in the open
//   3 test       the test half is scored and its error is locked away; it decides the prize
//   4 why        a loop from the leaderboard back to the team is crossed out: nobody may tune to the public score
//
// WP-93 (brief 10 item 2, D-162; the user on page 17: "are quiz and test one under the other in the Netflix Prize?", "the colours and the percentages do not match: write each share in its line's colour"; on page 18: "the text is on the line"):
//   - data, press 3: the qualifying set is split AT RANDOM into two halves of the same size (Bennett and Lanning 2007, p. 2: "assigned at random with equal probability"), so neither lies under the other: a 10 x 6 grid of small cells in the block, each dealt
//     to quiz (a solid blue square) or to test (a hatched gold square), 30 and 30; the probe label has a leader to its strip; the labels stand in one right-aligned column under the block;
//   - data, press 4: the three small shares (probe, quiz, test) are 20 px slivers at the end of the bar, so each has a leader line to its label, and the label is written in the share's colour (colour, position and the line, never colour alone);
//   - score, press 4: the sentence stands inside the dashed loop, clear of its lines.
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same). ab: 1080 / 950 / 1130 / 880 ms; data: 1100 / 1030 / 1108 / 1430 ms; score: 880 / 1500 / 1180 / 1000 ms.
//
// Motion: opacity and transform (scale pops, scaleX for bars and arrows). Nothing else.
import { h, s } from './frames.js';
import { icon } from './pictos.js';
import { U, fillFrag, finish, frag, glyph, grow, labelsSchema, num, on, pop, pressDuration, rise, scene } from './w07-common.js';

const LABELS = {
  // WP-74 (brief 09, Ek 2 item 4; Amatriain and Basilico 2012): the labels of the view `ab` follow Netflix: members are split into cells, one control and one new version; the measure is engagement and retention (the rates are a toy: tagged)
  // WP-93 (D-162 follow-up, the user on page 3, 2026-11-01): the label above the bars names what the percentages ARE, the conversion rate (a defined term: the term role, in purple); engagement and retention stay in the caption as what Netflix decides by
  crowd: frag('Netflix members', 'Netflix üyeleri'), groupA: frag('control cell', 'kontrol hücresi'), groupB: frag('new version cell', 'yeni sürüm hücresi'), algoA: frag('current algorithm', 'mevcut algoritma'), algoB: frag('new algorithm', 'yeni algoritma'),
  same: frag('same conditions, same period', 'aynı koşullar, aynı süre'), period: frag('period', 'süre'), conversion: frag('conversion rate', 'dönüşüm oranı'), tag: frag('synthetic data', 'sentetik veri'),
  doubt: frag('the intervals overlap: one day does not show the new version is better', 'aralıklar örtüşüyor: tek gün yeni sürümün daha iyi olduğunu göstermez'),
  ratings: frag('ratings', 'puan'), subscribers: frag('anonymous subscribers', 'anonim abone'), films: frag('films', 'film'), years: frag('1998 to 2005', '1998–2005'),
  newest: frag('the newest ratings of every user', 'her kullanıcının en yeni puanları'), qualifying: frag('qualifying set', 'qualifying kümesi'), quiz: frag('quiz', 'quiz'), test: frag('test', 'test'),
  probe: frag('probe (with its answers, inside the training data)', 'probe (cevaplarıyla, eğitimin içinde)'), probeShort: frag('probe', 'probe'), training: frag('training', 'eğitim'), coin: frag('equal chance for each', 'her biri eşit olasılıkla'),
  team: frag('team', 'takım'), file: frag('one prediction file a day', 'günde bir tahmin dosyası'), scorer: frag('scoring', 'puanlama'), board: frag('public leaderboard', 'herkese açık liderlik tablosu'),
  hidden: frag('hidden: it decides the prize', 'gizli: ödülü o belirler'), tune: frag('tuning to the public score: no', 'açık skora göre ayar: hayır'), teamN: frag('team {i}', '{i}. takım'),
};
const COUNTS = { ratings: frag('over 100 million', '100 milyonun üzerinde'), subscribers: frag('over 480 thousand', '480 binin üzerinde'), films: frag('about 18 thousand', 'yaklaşık 18 bin') };

/** The params of the mode `flow`, merged into pipeline's schema (the registry carries the whole). */
export const flowSchema = {
  type: 'object', additionalProperties: false, title: 'the flow mode (mode flow)',
  description: '`view` is `ab` (an A/B test), `data` (the Netflix Prize data split) or `score` (the public quiz and the hidden test). `rates` are the conversion rates of group A and B (0..0.2) and `margin` the half-width of each rate\'s interval (a toy). '
    + '`counts` are the three counts of the data (text; they are published numbers: the slide\'s caption names the source). `shares` are the percentages of the data: training (without the probe), probe, quiz, test (they add up to 100 and quiz = test). '
    + '`quiz` are the errors of three teams on the quiz half, best first (lower is better; drawn as bars, no number).',
  default: { view: 'ab', rates: [0.04, 0.046], margin: 0.008, counts: COUNTS, shares: { training: 95.9, probe: 1.36, quiz: 1.36, test: 1.36 }, quiz: [0.857, 0.861, 0.874], labels: LABELS },
  properties: {
    view: { type: 'string', enum: ['ab', 'data', 'score'], default: 'ab' },
    rates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 0.2 }, default: [0.04, 0.046] },
    margin: { type: 'number', minimum: 0, maximum: 0.05, default: 0.008 },
    counts: {
      type: 'object', additionalProperties: false, default: COUNTS,
      properties: { ratings: { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } }, default: COUNTS.ratings }, subscribers: { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } }, default: COUNTS.subscribers }, films: { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } }, default: COUNTS.films } },
    },
    shares: {
      type: 'object', additionalProperties: false, default: { training: 95.9, probe: 1.36, quiz: 1.36, test: 1.36 },
      properties: { training: { type: 'number', minimum: 0, maximum: 100, default: 95.9 }, probe: { type: 'number', minimum: 0, maximum: 100, default: 1.36 }, quiz: { type: 'number', minimum: 0, maximum: 100, default: 1.36 }, test: { type: 'number', minimum: 0, maximum: 100, default: 1.36 } },
    },
    quiz: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0 }, default: [0.857, 0.861, 0.874] },
    labels: labelsSchema(LABELS, '`teamN` holds {i}.'),
  },
};
export const flowExamples = [{ mode: 'flow' }, { mode: 'flow', flow: { view: 'data' } }, { mode: 'flow', flow: { view: 'score' } }];
export const flowPresses = 4;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function flowProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.flow;
  if (Q.view === 'ab') {
    const [a, b] = Q.rates;
    if (Math.abs(b - a) >= 2 * Q.margin) bad('$.flow.margin', `is ${Q.margin}: the two intervals (${a} +- ${Q.margin}, ${b} +- ${Q.margin}) do not overlap, but the page says one day is not enough to tell`);
    if (!(b > a)) bad('$.flow.rates', 'must have B above A: the page says B looks better');
  } else if (Q.view === 'data') {
    const s = Q.shares, sum = s.training + s.probe + s.quiz + s.test;
    if (Math.abs(sum - 100) > 0.2) bad('$.flow.shares', `add up to ${sum.toFixed(2)}: training, probe, quiz and test make the whole data (100, to 0.2)`);
    if (s.quiz !== s.test) bad('$.flow.shares', `have quiz ${s.quiz} and test ${s.test}: the qualifying set is split between them with equal probability`);
  } else {
    const q = Q.quiz;
    if (!(q[0] < q[1] && q[1] < q[2])) bad('$.flow.quiz', 'must be in increasing order (best, lowest error, first): the leaderboard is ordered');
  }
  return out;
}

/** WP-93 (D-162): how the 60 cells of the qualifying block are dealt: 10 columns x 6 rows, 30 "Q" (quiz) and 30 "T" (test), mixed so that neither half lies above the other (the Q of the rows: 4, 6, 5, 5, 5, 5). */
export const DEAL = Object.freeze(['QTTQTTQTQT', 'TQQTQTQQTQ', 'QTQTTQTQQT', 'TQTQQTQTTQ', 'QQTTQTQTTQ', 'TTQQTQTQTQ']);
const DEAL_CELLS = DEAL.flatMap((row, r) => [...row].map((ch, c) => ({ ch, r, c })));

const AB = { crowd: { x: 70, y: 130, cols: 4, pitch: 70 }, pa: { x: 520, y: 70, w: 520, h: 420 }, pb: { x: 1100, y: 70, w: 520, h: 420 }, scale: 420 / 0.1 };

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of pipeline
 */
export function flowModel(P) {
  const Q = P.flow;
  const view = Q.view;
  /** @type {(k: number) => Map<string, Record<string, string>>} */ let frame;
  /** @type {(key: string, k: number) => import('./frames.js').Timing} */ let timing;
  const gone = { start: 0, duration: 260 };
  if (view === 'ab') {
    frame = (k) => {
      /** @type {Map<string, Record<string, string>>} */ const f = new Map();
      f.set('cr', { opacity: k === 0 ? '1' : '0.25' });
      f.set('pa', rise(k >= 1)); f.set('pb', rise(k >= 1));
      for (let j = 0; j < 12; j++) { f.set(`ua:${j}`, pop(k >= 1)); f.set(`ub:${j}`, pop(k >= 1)); }
      f.set('al:0', rise(k >= 2)); f.set('al:1', rise(k >= 2)); f.set('eq', rise(k >= 2)); f.set('tm:0', grow(k >= 2)); f.set('tm:1', grow(k >= 2));
      f.set('cvl', rise(k >= 3)); f.set('tg', rise(k >= 3)); f.set('cv:0', grow(k >= 3)); f.set('cv:1', grow(k >= 3)); f.set('cvv:0', rise(k >= 3)); f.set('cvv:1', rise(k >= 3));
      f.set('wh:0', grow(k >= 4)); f.set('wh:1', grow(k >= 4)); f.set('ov:0', on(k >= 4)); f.set('ov:1', on(k >= 4)); f.set('wy', rise(k >= 4));
      return f;
    };
    timing = (key, k) => {
      const [kind, a] = key.split(':');
      const i = Number(a);
      switch (kind) {
        case 'cr': return { start: 0, duration: 400 };
        case 'pa': return { start: 100, duration: U };
        case 'pb': return { start: 200, duration: U };
        case 'ua': return { start: 200 + i * 40, duration: U };
        case 'ub': return { start: 260 + i * 40, duration: U };
        case 'al': return { start: 100 + i * 150, duration: U };
        case 'eq': return { start: 450, duration: U };
        case 'tm': return { start: 300 + i * 150, duration: 500 };
        case 'cvl': return { start: 100, duration: U };
        case 'tg': return { start: 100, duration: U };
        case 'cv': return { start: 150 + i * 150, duration: 600 };
        case 'cvv': return { start: 600 + i * 150, duration: U };
        case 'wh': return { start: 100 + i * 120, duration: 400 };
        case 'ov': return { start: 400, duration: U };
        case 'wy': return { start: 500, duration: U };
        default: return { start: 0, duration: U };
      }
    };
  } else if (view === 'data') {
    frame = (k) => {
      /** @type {Map<string, Record<string, string>>} */ const f = new Map();
      f.set('gs', { opacity: k === 4 ? '0' : '1' });                                  // the schematic leaves: the bar to scale replaces it
      f.set('db', pop(k >= 1)); for (let i = 0; i < 3; i++) f.set(`st:${i}`, rise(k >= 1));
      f.set('ql', grow(k >= 2)); f.set('qll', rise(k >= 2)); f.set('nw', rise(k >= 2));
      f.set('tr', on(k >= 2)); f.set('trl', rise(k >= 2));                                  // WP-93 (D-180): the training part, outlined in blue, and its word, from the press that cuts the qualifying set off
      DEAL_CELLS.forEach((_, i) => f.set(`qc:${i}`, pop(k >= 3))); f.set('pr', pop(k >= 3)); f.set('pl', grow(k >= 3, 'y')); f.set('qzl', rise(k >= 3)); f.set('tsl', rise(k >= 3)); f.set('prl', rise(k >= 3)); f.set('cn', rise(k >= 3));
      f.set('sb', rise(k >= 4)); for (let i = 0; i < 4; i++) f.set(`sh:${i}`, grow(k >= 4)); for (let i = 0; i < 4; i++) f.set(`sv:${i}`, rise(k >= 4));
      for (let i = 1; i < 4; i++) f.set(`ld:${i}`, { strokeDashoffset: k >= 4 ? '0' : '1.02' });          // WP-93: a leader from each of the three slivers to its label
      return f;
    };
    timing = (key, k) => {
      const [kind, a] = key.split(':');
      const i = Number(a);
      switch (kind) {
        case 'gs': return { start: 0, duration: 400 };
        case 'db': return { start: 100, duration: 500 };
        case 'st': return { start: 400 + i * 160, duration: U };
        case 'ql': return { start: 150, duration: 500 };
        case 'qll': return { start: 500, duration: U };
        case 'tr': return { start: 150, duration: 500 };                           // with the qualifying block (it grows 150 + 500)
        case 'trl': return { start: 500, duration: U };                            // with the word of the qualifying set
        case 'nw': return { start: 650, duration: U };
        case 'qc': return { start: 100 + i * 12, duration: 300 };                 // WP-93: the cells are dealt one after the other, left to right, top to bottom
        case 'pr': return { start: 500, duration: U };
        case 'pl': return { start: 560, duration: 300 };
        case 'qzl': return { start: 600, duration: U };
        case 'tsl': return { start: 650, duration: U };
        case 'prl': return { start: 700, duration: U };
        case 'cn': return { start: 660, duration: U };
        case 'sb': return { start: 200, duration: U };
        case 'sh': return { start: 300 + i * 150, duration: 500 };
        case 'sv': return { start: i === 0 ? 500 : 600 + i * 150, duration: U };     // WP-93: a label of a small share comes after its leader
        case 'ld': return { start: 450 + i * 150, duration: 280 };
        default: return { start: 0, duration: U };
      }
    };
  } else {
    frame = (k) => {
      /** @type {Map<string, Record<string, string>>} */ const f = new Map();
      f.set('fl', pop(k >= 1)); f.set('a1', grow(k >= 1)); f.set('fll', rise(k >= 1));
      f.set('qh', on(k >= 2)); f.set('a2', grow(k >= 2)); f.set('lb', rise(k >= 2)); for (let i = 0; i < 3; i++) f.set(`rw:${i}`, grow(k >= 2));
      f.set('th', on(k >= 3)); f.set('a3', grow(k >= 3)); f.set('lk', pop(k >= 3)); f.set('lkl', rise(k >= 3));
      f.set('lp', grow(k >= 4)); f.set('x', pop(k >= 4)); f.set('lt', rise(k >= 4));
      return f;
    };
    timing = (key) => {
      const [kind, a] = key.split(':');
      const i = Number(a);
      switch (kind) {
        case 'fl': return { start: 300, duration: U };
        case 'a1': return { start: 100, duration: 500 };
        case 'fll': return { start: 500, duration: U };
        case 'qh': return { start: 0, duration: U };
        case 'a2': return { start: 200, duration: 500 };
        case 'lb': return { start: 500, duration: U };
        case 'rw': return { start: 700 + i * 150, duration: 500 };
        case 'th': return { start: 0, duration: U };
        case 'a3': return { start: 200, duration: 500 };
        case 'lk': return { start: 600, duration: U };
        case 'lkl': return { start: 800, duration: U };
        case 'lp': return { start: 100, duration: 500 };
        case 'x': return { start: 500, duration: U };
        case 'lt': return { start: 620, duration: U };
        default: return { start: 0, duration: U };
      }
    };
  }
  return { view, frame, timing, n: flowPresses, gone, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `flow` (all three views).
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of pipeline
 * @returns {import('./kit.js').WidgetBuild}
 */
export function flowBuild(ctx, P) {
  const Q = P.flow, L = Q.labels;
  const M = flowModel(P);
  const sc = scene(ctx, 'mx-root fl-root');
  const { doc, box, put, add, say } = sc;
  const arrow = (/** @type {string} */ key, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {string} */ cls = '') => put(key, h(doc, 'div', `fl-arrow ${cls}`, { 'aria-hidden': 'true' }), `${box(x, y, w, 26)};transform-origin:0 50%`);
  const user = (/** @type {string} */ cls, /** @type {number} */ size) => { const u = icon(doc, 'user', size); u.classList.add('fl-user'); if (cls) u.classList.add(...cls.split(' ')); return u; };

  if (M.view === 'ab') {
    const [ra, rb] = Q.rates, mg = Q.margin;
    const crowd = h(doc, 'div', 'fl-crowd');
    put('cr', crowd, box(0, 0, 1680, 600));
    for (let i = 0; i < 24; i++) { const u = user('', 44); add(u, `left:${AB.crowd.x + (i % AB.crowd.cols) * AB.crowd.pitch}px;top:${AB.crowd.y + Math.floor(i / AB.crowd.cols) * AB.crowd.pitch}px`, crowd); }
    add(say(h(doc, 'div', 'fl-cap'), L.crowd), `left:${AB.crowd.x}px;top:${AB.crowd.y - 56}px`, crowd);
    [[AB.pa, 'a', L.groupA, L.algoA, ra, 'fl-a'], [AB.pb, 'b', L.groupB, L.algoB, rb, 'fl-b']].forEach(([pn, id, name, algo, rate, cls], i) => {
      const p = /** @type {{x: number, y: number, w: number, h: number}} */ (pn);
      const panel = h(doc, 'div', `fl-panel ${cls}`, { 'aria-hidden': 'true' });
      panel.append(say(h(doc, 'div', 'fl-panel-title'), /** @type {Record<string, string>} */ (name)));
      put(`p${id}`, panel, box(p.x, p.y, p.w, p.h));
      for (let j = 0; j < 12; j++) put(`u${id}:${j}`, user(/** @type {string} */ (cls), 38), `left:${24 + (j % 6) * 56}px;top:${58 + Math.floor(j / 6) * 50}px`, panel);
      put(`al:${i}`, say(h(doc, 'div', 'fl-algo'), /** @type {Record<string, string>} */ (algo)), `left:24px;top:170px;width:${p.w - 48}px`, panel);
      put(`tm:${i}`, h(doc, 'div', 'fl-period', { 'data-gfx': 'fill' }), `${box(24, 214, p.w - 48, 10)};transform-origin:0 50%`, panel);
      const w = Math.round(/** @type {number} */ (rate) * AB.scale);
      put(`cv:${i}`, h(doc, 'div', `fl-bar ${cls}`, { 'data-gfx': 'fill' }), `${box(24, 272, w, 34)};transform-origin:0 50%`, panel);
      put(`cvv:${i}`, say(h(doc, 'div', 'fl-val'), { en: `${num(/** @type {number} */ (rate) * 100, 1).en} %`, tr: `%${num(/** @type {number} */ (rate) * 100, 1).tr}` }), `left:24px;top:230px`, panel);                  // above the bar: the overlap band and the whiskers lie beside it
      const half = Math.round(mg * AB.scale);
      put(`wh:${i}`, h(doc, 'div', 'fl-whisker', { 'aria-hidden': 'true' }), `${box(24 + w - half, 322, 2 * half, 14)};transform-origin:50% 50%`, panel);
      const lo = Math.min(ra, rb), hi = Math.max(ra, rb);
      const x0 = 24 + Math.round(hi * AB.scale) - half, x1 = 24 + Math.round(lo * AB.scale) + half;        // WP-93: the band's ends ARE the whiskers' pixel ends (the higher rate's lower end, the lower rate's upper end), so the two never differ by a rounding pixel (B's cap stood 1 px left of the band's edge)
      put(`ov:${i}`, h(doc, 'div', 'fl-overlap', { 'aria-hidden': 'true' }), box(x0, 262, Math.max(4, x1 - x0), 90), panel);
    });
    put('eq', say(h(doc, 'div', 'fl-same'), L.same), box(AB.pa.x, AB.pa.y + AB.pa.h + 14, AB.pb.x + AB.pb.w - AB.pa.x, 40));
    put('cvl', say(h(doc, 'div', 'fl-cap fl-cap-term', { 'data-role': 'term' }), L.conversion), box(AB.pa.x, AB.pa.y - 36, 700, 32));      // WP-93: the term role (purple); the cue of a term is the dotted underline when cues are on (D-068)
    const tg = put('tg', say(h(doc, 'div', 'fl-tag'), L.tag), box(AB.pb.x + AB.pb.w - 260, 22, 260, 40));                       // D-129: the toy rates could be read as a measurement
    if (!L.tag.en) /** @type {HTMLElement} */ (tg).hidden = true;                                                                // an empty tag hides the label (the key stays: the frames do not depend on the text)
    put('wy', say(h(doc, 'div', 'fl-doubt', { 'data-role': 'neg' }), L.doubt), box(AB.pa.x, AB.pa.y + AB.pa.h + 62, AB.pb.x + AB.pb.w - AB.pa.x, 40));
  } else if (M.view === 'data') {
    const X = 120, Wd = 1440;
    const gs = h(doc, 'div', 'fl-gs');
    put('gs', gs, box(0, 0, 1680, 600));
    add(h(doc, 'div', 'fl-empty', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(X, 190, Wd, 150), gs);
    add(h(doc, 'div', 'fl-axis', { 'aria-hidden': 'true' }), box(X, 360, Wd, 4), gs);
    add(say(h(doc, 'div', 'fl-cap'), L.years), `left:${X}px;top:372px`, gs);
    put('db', h(doc, 'div', 'fl-data', { 'data-gfx': 'fill' }), box(X, 190, Wd, 150), gs);
    ['ratings', 'subscribers', 'films'].forEach((key, i) => {
      const chip = h(doc, 'div', 'fl-stat', { 'aria-hidden': 'true' });
      chip.append(say(h(doc, 'b'), Q.counts[key]), say(h(doc, 'span'), L[key]));
      put(`st:${i}`, chip, box(X + i * 500, 80, 480, 90));                          // the counts stay for the bar to scale
    });
    const QW = 250;
    put('tr', h(doc, 'div', 'fl-train', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(X, 190, Wd - QW, 150), gs);                 // WP-93 (D-180): training is blue (page 16's role): its outline and its word; the fill is soft
    put('ql', h(doc, 'div', 'fl-qual', { 'data-gfx': 'fill' }), `${box(X + Wd - QW, 190, QW, 150)};transform-origin:100% 50%`, gs);
    put('trl', say(h(doc, 'div', 'fl-cap fl-cap-t'), L.training), box(X, 390, 480, 34), gs);
    // the labels of the qualifying block stand in ONE column, right-aligned under it (WP-93): the set, what it is, then (press 3) the legend and the chance
    put('qll', say(h(doc, 'div', 'fl-cap fl-cap-r'), L.qualifying), box(X + Wd - QW - 40, 390, QW + 40, 34), gs);
    put('nw', say(h(doc, 'div', 'fl-cap fl-cap-r'), L.newest), box(X + Wd - 760, 424, 760, 34), gs);
    // press 3: the qualifying set is dealt AT RANDOM into two halves of the same size: a grid of 10 x 6 small cells in the block, a quiz cell solid blue, a test cell hatched gold (a pattern and a colour), 30 and 30
    DEAL_CELLS.forEach(({ ch, r, c }, i) => put(`qc:${i}`, h(doc, 'div', `fl-qc ${ch === 'Q' ? 'fl-qc-q' : 'fl-qc-t'}`, { 'aria-hidden': 'true', 'data-gfx': 'fill' }), `left:${X + Wd - QW + 12 + c * 23}px;top:${198 + r * 23}px`, gs));
    /** The legend chip of a half: its swatch (the cell's own look) and its word. @param {string} key @param {string} cls @param {Record<string, string>} text @param {number} x */
    const legend = (key, cls, text, x) => {
      const chip = h(doc, 'div', 'fl-lg', { 'aria-hidden': 'true' });
      chip.append(h(doc, 'span', `fl-qc fl-qc-sw ${cls}`, { 'data-gfx': 'fill' }), say(h(doc, 'span'), text));
      put(key, chip, box(x, 466, 100, 34), gs);
    };
    legend('qzl', 'fl-qc-q', L.quiz, X + Wd - 210); legend('tsl', 'fl-qc-t', L.test, X + Wd - 100);
    put('cn', say(h(doc, 'div', 'fl-cap fl-cap-r'), L.coin), box(X + Wd - QW - 40, 506, QW + 40, 34), gs);
    put('pr', h(doc, 'div', 'fl-probe', { 'data-gfx': 'fill' }), box(X + Wd - QW - 90, 190, 60, 150), gs);
    put('pl', h(doc, 'div', 'fl-pl', { 'aria-hidden': 'true' }), `${box(X + Wd - QW - 61, 344, 3, 42)};transform-origin:50% 0`, gs);     // the probe's label has a leader to its strip
    put('prl', say(h(doc, 'div', 'fl-cap fl-cap-r fl-cap-p'), L.probe), box(662, 390, 600, 34), gs);
    // press 4: a bar to scale, the four shares
    const sb = h(doc, 'div', 'fl-sb', { 'aria-hidden': 'true' });
    put('sb', sb, box(X, 170, 4, 4));
    const sh = Q.shares, parts = [['training', sh.training, 'fl-sh-t'], ['probe', sh.probe, 'fl-sh-p'], ['quiz', sh.quiz, 'fl-sh-q'], ['test', sh.test, 'fl-sh-s']];
    const lsvg = s(doc, 'svg', { class: 'cv-svg', width: '1680', height: '600', viewBox: '0 0 1680 600' });
    sc.root.append(lsvg);
    let x = 0;
    parts.forEach(([key, v, cls], i) => {
      const w = Math.max(6, Math.round(/** @type {number} */ (v) / 100 * Wd));
      put(`sh:${i}`, h(doc, 'div', `fl-share ${cls}`, { 'data-gfx': 'fill' }), `${box(X + x, 250, w, 90)};transform-origin:0 50%`);
      const lab = h(doc, 'div', 'fl-share-label');
      lab.append(say(h(doc, 'b'), { en: `${num(/** @type {number} */ (v), /** @type {number} */ (v) < 10 ? 2 : 1).en} %`, tr: `%${num(/** @type {number} */ (v), /** @type {number} */ (v) < 10 ? 2 : 1).tr}` }), say(h(doc, 'span'), L[key === 'probe' ? 'probeShort' : /** @type {string} */ (key)]));
      // WP-93 (D-162): the labels of the three small shares stand in a row of their own, each in its share's colour and joined to its sliver by a leader (an elbow: down, along, down; the higher the label, the shorter its run, so none crosses)
      if (i === 0) { lab.classList.add('fl-sl-t'); put(`sv:${i}`, lab, `left:${X + 8}px;top:352px;width:600px`); }                // WP-93 (D-180): the training share is written in blue (page 16's role)
      else {
        const mid = X + x + w / 2, land = [0, 1216, 1383, 1551][i], level = 368 + (i - 1) * 16;
        lab.classList.add(`fl-sl-${['', 'p', 'q', 's'][i]}`);
        lab.style.cssText += ';text-align:center';
        put(`sv:${i}`, lab, `left:${land - 80}px;top:412px;width:160px`);
        put(`ld:${i}`, s(doc, 'path', { class: `fl-ld fl-ld-${['', 'p', 'q', 's'][i]}`, d: `M${mid} 344V${level}H${land}V408`, pathLength: '1', 'data-gfx': 'stroke' }), '', lsvg);
      }
      x += w;
    });
  } else {
    const TX = 110;
    // the team, the scorer with its two halves, the leaderboard frame and the hidden box
    const team = h(doc, 'div', 'fl-team', { 'aria-hidden': 'true' });
    team.append(icon(doc, 'users', 64), say(h(doc, 'span'), L.team));
    add(team, box(TX, 210, 160, 130));
    add(h(doc, 'div', 'fl-scorer', { 'aria-hidden': 'true' }), box(600, 130, 300, 330));
    add(say(h(doc, 'div', 'fl-scorer-title'), L.scorer), box(600, 96, 300, 32));
    add(say(h(doc, 'div', 'fl-half fl-half-q'), L.quiz), box(620, 160, 260, 130));
    add(say(h(doc, 'div', 'fl-half fl-half-t'), L.test), box(620, 300, 260, 130));
    put('qh', h(doc, 'div', 'fl-lit', { 'aria-hidden': 'true' }), box(612, 152, 276, 146));
    put('th', h(doc, 'div', 'fl-lit fl-lit-t', { 'aria-hidden': 'true' }), box(612, 292, 276, 146));
    const file = h(doc, 'div', 'fl-file', { 'aria-hidden': 'true' });
    file.append(icon(doc, 'clipboard', 56));
    put('fl', file, box(380, 190, 80, 80));
    put('fll', say(h(doc, 'div', 'fl-cap'), L.file), box(300, 140, 280, 40));
    arrow('a1', 280, 270, 300);
    arrow('a2', 910, 210, 150);
    arrow('a3', 910, 360, 150);
    const lb = h(doc, 'div', 'fl-board', { 'aria-hidden': 'true' });
    lb.append(say(h(doc, 'div', 'fl-board-title'), L.board));
    put('lb', lb, box(1080, 130, 520, 200));
    const quiz = Q.quiz, worst = Math.max(...quiz);
    quiz.forEach((/** @type {number} */ v, /** @type {number} */ i) => {
      const y = 62 + i * 44;
      const name = say(h(doc, 'div', 'fl-row-name'), fillFrag(L.teamN, { i: i + 1 })); name.style.cssText += `;left:18px;top:${y}px`;
      lb.append(name);
      put(`rw:${i}`, h(doc, 'div', 'fl-rowbar', { 'data-gfx': 'fill' }), `${box(150, y + 6, Math.round(330 * (1 - (v - quiz[0]) / (worst - quiz[0] + 0.02))), 22)};transform-origin:0 50%`, lb);
    });
    const lock = h(doc, 'div', 'fl-hidden', { 'aria-hidden': 'true' });
    lock.append(glyph(doc, 'lock', 64));
    put('lk', lock, box(1080, 360, 140, 100));
    put('lkl', say(h(doc, 'div', 'fl-cap'), L.hidden), box(1240, 380, 380, 60));
    // press 4: the loop back to the team, crossed out
    put('lp', h(doc, 'div', 'fl-loop', { 'aria-hidden': 'true' }), `${box(240, 484, 1000, 80)};transform-origin:100% 50%`);
    put('x', cross(doc), 'left:660px;top:498px');
    put('lt', say(h(doc, 'div', 'fl-doubt', { 'data-role': 'neg' }), L.tune), `${box(730, 510, 480, 40)};text-align:left`);                 // WP-93: inside the dashed loop (x 240 to 1240), 26 px clear of its right side; the longest text is 351 px (fontTools)
  }
  return finish(ctx, sc, M.n, M.frame, M.timing);
}

/** A cross, drawn in currentColor. @param {Document} doc */
function cross(doc) {
  const ns = 'http://www.w3.org/2000/svg';
  const sv = doc.createElementNS(ns, 'svg');
  sv.setAttribute('class', 'fl-cross'); sv.setAttribute('width', '52'); sv.setAttribute('height', '52'); sv.setAttribute('viewBox', '0 0 34 34'); sv.setAttribute('aria-hidden', 'true');
  const p = doc.createElementNS(ns, 'path'); p.setAttribute('d', 'M6 6l22 22M28 6L6 28');
  sv.append(p);
  return /** @type {SVGElement} */ (sv);
}
