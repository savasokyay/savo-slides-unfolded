// @ts-check
// WP-74 (D-149, D-150; brief 09; page 21 `leakage` of the I2RS w07 deck, storyboard §3): the mode `timeline` of table-highlight. Interactions lie along a time axis (a row per user); a random split lets the model learn from the future, a temporal
// split does not (the Netflix Prize kept the newest ratings of every user aside), a taste changes over the years, and which method wins can depend on the split. The data is a toy. Press 5 draws two leaderboards whose bars could be read as a
// measured result, so that press carries a "synthetic data" tag (D-129; the tag is a label of the params, empty hides it).
//
// The grid: a row of 12 time steps per user, a dot where the user interacted (4 users, 29 interactions in all). A training interaction is a blue ring and a round mark, a test one a gold double ring and a square mark (D-068: ring style and shape,
// not colour alone). `random` holds one role character per step (T training, X test, "." none) for the random split; the temporal split is derived: every interaction from step `cut` on is test.
//
// WP-93 (brief 10 item 4, D-162; the user on page 21: "training and test can be told by the ring's line colour"): a LEGEND under the grid for presses 1 to 4 shows each ring as the grid draws it, on its grey dot: training a blue solid ring with a round mark, test a gold double ring with a
// square mark, the word beside it in the same colour (the colour of the line, its style and its mark: never colour alone).
//
// States (five presses; 0 is the dots on the time axis):
//   1 random      the random roles come in (8 of the 29 interactions are test); every test interaction that has a training interaction AFTER it in its row gets a red ring and a line: the model learned from the future
//   2 temporal    the random roles leave; the cut line at t; before it every interaction is training, after it test (9 of 29)
//   3 Netflix     the newest two interactions of every user (all of them test) are emphasised: their gold double rings swell by 15 % while the press lasts and settle back in press 4 (WP-93, D-182: no ring of its own, in this deck purple is validation and dotted is the quiz): the Netflix Prize kept the newest ratings aside (the same idea as the temporal split)
//   4 taste       the first user's row: the years before the middle are "school years", after it "today"; their interactions change shape (round -> diamond): the taste changed
//   5 the winner  the grid steps back; two leaderboards, one per split, each with a bar per method: A wins the random split, B the temporal one (synthetic data)
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): 1470 / 1280 / 1080 / 1180 / 1700 ms.
//   1  max(roles 60 + 28 * 24 + u, rings 600 + 7 * 70 + u, the caption 800 + u)      2  max(roles 60 + 28 * 24 + u, the cut line 300 + 560, its label 700 + u, the caption 900 + u, the rest leaves in 260)
//   3  max(the swell of the 8 newest rings 100 + 7 * 70 + u, the caption 700 + u)      4  max(the shapes 100 + 3 * 80 + u, the brackets 300 + u and 500 + u, the caption 800 + u)
//   5  max(the grid 400, the boards 250 + u and 450 + u, their bars 600 + 3 * 180 + 560, the tag 250 + u)
//
// Motion: opacity and transform (scale pops, scaleY for the cut line, scaleX for a bar). Nothing else.
import { h } from './frames.js';
import { U, finish, frag, grow, labelsSchema, num, on, pop, pressDuration, rise, scene } from './w07-common.js';

const GX = 150, GY = 138, PX = 62, PY = 88, DOT = 40;
const BOARD = { x: 980, y: 150, w: 330, h: 330, gap: 20 };
// WP-93 (the user on page 21, 2026-11-01: a caption that fits on one line stays on one line): the longest caption line is the Netflix sentence of press 3, 683.6 px (EN) and 713.2 px (TR) at 600 32 px; the box is 735 px wide, from x 925 (32 px from the grid, whose step frames end at x 893) to x 1660, the right edge of the two boards of press 5
const CAPTION = { x: 925, y: 150, w: 735 };
// WP-93 (D-182): press 3 emphasises the newest ratings by swelling their own test rings; 1.15 keeps neighbouring rings apart (the rings are 50 px on a 62 px pitch: 57.5 px, 4.5 px between two neighbours)
const SWELL = Object.freeze({ opacity: '1', transform: 'scale(1.15)' });

const LABELS = {
  time: frag('time', 'zaman'), train: frag('training', 'eğitim'), test: frag('test', 'test'),
  future: frag('the model learns from the future', 'model gelecekten öğrenir'), randomSplit: frag('random split', 'rastgele bölme'), temporalSplit: frag('temporal split', 'zamansal bölme'),
  cut: frag('t', 't'), before: frag('before t: training', 't öncesi: eğitim'), after: frag('after t: test', 't sonrası: test'),
  netflix: frag('Netflix kept the newest ratings of every user aside', 'Netflix her kullanıcının en yeni puanlarını saklı tuttu'),
  school: frag('school years', 'okul yılları'), today: frag('today', 'bugün'), drift: frag('the taste changes', 'zevk değişir'),
  winner: frag('the winner depends on the split', 'kazanan bölmeye göre değişir'), methodA: frag('method A', 'yöntem A'), methodB: frag('method B', 'yöntem B'), tag: frag('synthetic data', 'sentetik veri'),
};
const EVENTS = ['xx.x.xx.x.xx', '.xx.x.xxx..x', 'x.x.xx.x.xx.', 'xxx..x.xx.x.'];
const RANDOM = ['TX.T.TX.T.TT', '.TT.X.TXT..T', 'T.X.TT.T.XT.', 'TTX..T.TX.T.'];
const BOARDS = { random: [0.82, 0.78], temporal: [0.61, 0.66] };

/** The params of the mode `timeline`, merged into table-highlight's schema (the registry carries the whole). */
export const timelineSchema = {
  type: 'object', additionalProperties: false, title: 'the time-line mode (mode timeline)',
  description: '`events` is one string per user, one character per time step ("x" an interaction, "." none; up to 4 users and 12 steps). `random` has a role exactly where `events` has an "x": T training or X test, for the random split of press 1. '
    + '`cut` is the first time step of the temporal split (every interaction from it on is test). `latest` is how many of the newest interactions of every user press 3 rings. `boards` are the toy scores of two methods on each split (0..1): A must win the random split and B the temporal one. '
    + 'The tag of press 5 says the leaderboards are synthetic (an empty `en` hides it).',
  default: { events: EVENTS, random: RANDOM, cut: 8, latest: 2, boards: BOARDS, labels: LABELS },
  properties: {
    events: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', minLength: 4, maxLength: 12 }, default: EVENTS },
    random: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', minLength: 4, maxLength: 12 }, default: RANDOM },
    cut: { type: 'integer', minimum: 1, maximum: 11, default: 8 },
    latest: { type: 'integer', minimum: 1, maximum: 3, default: 2 },
    boards: {
      type: 'object', additionalProperties: false, default: BOARDS,
      properties: {
        random: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 1 }, default: BOARDS.random },
        temporal: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 1 }, default: BOARDS.temporal },
      },
    },
    labels: labelsSchema(LABELS, 'An empty `tag` (en) shows no synthetic-data tag.'),
  },
};
export const timelineExamples = [{ mode: 'timeline' }, { mode: 'timeline', timeline: { events: ['x.xx.x', 'xx.x.x'], random: ['T.XT.T', 'TX.T.T'], cut: 4, latest: 1, boards: { random: [0.7, 0.6], temporal: [0.5, 0.55] } } }];
export const timelinePresses = 5;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function timelineProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.timeline;
  /** @type {string[]} */ const ev = Q.events, ra = Q.random;
  const steps = ev[0]?.length ?? 0;
  ev.forEach((row, u) => { if (row.length !== steps) bad(`$.timeline.events[${u}]`, `has ${row.length} steps, the first row has ${steps}: every row must have the same length`); if (!/^[x.]+$/.test(row)) bad(`$.timeline.events[${u}]`, `holds "x" or ".", found "${row}"`); });
  if (ra.length !== ev.length) bad('$.timeline.random', `has ${ra.length} rows, events has ${ev.length}: one row of roles for every user`);
  else {
    ra.forEach((row, u) => {
      if (row.length !== ev[u].length) { bad(`$.timeline.random[${u}]`, `has ${row.length} steps, events[${u}] has ${ev[u].length}`); return; }
      if (!/^[TX.]+$/.test(row)) { bad(`$.timeline.random[${u}]`, `holds ".", T or X, found "${row}"`); return; }
      for (let c = 0; c < row.length; c++) {
        if (ev[u][c] === '.' && row[c] !== '.') bad(`$.timeline.random[${u}]`, `step ${c} has no interaction and has a role`);
        if (ev[u][c] === 'x' && row[c] === '.') bad(`$.timeline.random[${u}]`, `step ${c} is an interaction and has no role`);
      }
    });
  }
  if (out.length === 0) {
    const m = timelineData(Q);
    if (m.cells.filter((x) => x.rand === 'X' && x.leak).length === 0) bad('$.timeline.random', 'has no test interaction before a training one in its row: the page says the model learns from the future');
    if (m.cells.filter((x) => x.temporal === 'X').length === 0) bad('$.timeline.cut', `is ${Q.cut}: no interaction falls from that step on, so the temporal split has no test`);
    if (m.cells.filter((x) => x.temporal === 'T').length === 0) bad('$.timeline.cut', `is ${Q.cut}: no interaction falls before that step, so the temporal split has no training`);
    if (Q.cut >= steps) bad('$.timeline.cut', `is ${Q.cut} but a row has ${steps} steps: the cut must fall inside the time axis`);
  }
  const [ra0, rb0] = Q.boards.random, [ra1, rb1] = Q.boards.temporal;
  if (!(ra0 > rb0)) bad('$.timeline.boards.random', 'must have method A ahead of B: A wins the random split');
  if (!(rb1 > ra1)) bad('$.timeline.boards.temporal', 'must have method B ahead of A: B wins the temporal split');
  return out;
}

/** The interactions with their roles in both splits. @param {any} Q the params of the mode */
function timelineData(Q) {
  /** @type {string[]} */ const ev = Q.events, ra = Q.random;
  const steps = ev[0].length;
  /** @type {Array<{u: number, c: number, i: number, rand: string, temporal: string, leak: boolean, latest: boolean, drift: boolean}>} */ const cells = [];
  ev.forEach((row, u) => {
    const cols = [...row].map((ch, c) => (ch === 'x' ? c : -1)).filter((c) => c >= 0);
    cols.forEach((c, j) => {
      const rand = ra[u][c];
      const trainLater = cols.some((d) => d > c && ra[u][d] === 'T');
      cells.push({ u, c, i: cells.length, rand, temporal: c >= Q.cut ? 'X' : 'T', leak: rand === 'X' && trainLater, latest: j >= cols.length - Q.latest, drift: u === 0 });
    });
  });
  const half = Math.floor(steps / 2);
  for (const x of cells) x.drift = x.u === 0 && x.c >= half;
  return { cells, steps, half, rows: ev.length };
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function timelineModel(P) {
  const Q = P.timeline;
  const D = timelineData(Q);
  const leaks = D.cells.filter((x) => x.leak), latest = D.cells.filter((x) => x.latest), drifts = D.cells.filter((x) => x.drift);
  const count = { random: { T: D.cells.filter((x) => x.rand === 'T').length, X: D.cells.filter((x) => x.rand === 'X').length }, temporal: { T: D.cells.filter((x) => x.temporal === 'T').length, X: D.cells.filter((x) => x.temporal === 'X').length } };
  const idx = (/** @type {typeof D.cells} */ list, /** @type {number} */ i) => list.findIndex((x) => x.i === i);
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('grid', { opacity: k === 5 ? '0.3' : '1' });
    for (const x of D.cells) { f.set(`r1:${x.i}`, pop(k === 1)); f.set(`r2:${x.i}`, x.latest && k === 3 ? { ...SWELL } : pop(k >= 2)); }
    for (const x of leaks) f.set(`lk:${x.i}`, on(k === 1));
    for (const x of drifts) f.set(`dr:${x.i}`, pop(k === 4));
    f.set('cl', grow(k >= 2, 'y')); f.set('clt', rise(k >= 2)); f.set('br1', rise(k === 4)); f.set('br2', rise(k === 4));
    f.set('lgd', rise(k >= 1 && k < 5));                                            // WP-93: the legend of the two rings stays while the rings do (presses 1 to 4)
    for (let j = 1; j <= 4; j++) f.set(`cap${j}`, rise(k === j));
    f.set('lb0', rise(k === 5)); f.set('lb1', rise(k === 5)); f.set('wn', rise(k === 5)); f.set('tg', rise(k === 5));
    for (let b = 0; b < 4; b++) f.set(`bb:${b}`, grow(k === 5));
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    const gone = { start: 0, duration: 260 };
    switch (kind) {
      case 'grid': return { start: 0, duration: 400 };
      case 'r1': return k === 1 ? { start: 60 + i * 24, duration: U } : gone;
      case 'r2': {                                                                // WP-93 (D-182): the newest rings swell in press 3 (staggered 70 ms) and settle back in press 4; every other change of r2 is the pop-in of press 2
        const j = idx(latest, i);
        if (j >= 0 && k === 3) return { start: 100 + j * 70, duration: U };
        if (j >= 0 && k === 4) return gone;
        return { start: 60 + i * 24, duration: U };
      }
      case 'lk': return k === 1 ? { start: 600 + idx(leaks, i) * 70, duration: U } : gone;
      case 'dr': return k === 4 ? { start: 100 + idx(drifts, i) * 80, duration: U } : gone;
      case 'lgd': return k === 1 ? { start: 700, duration: U } : gone;
      case 'cl': return { start: 300, duration: 560 };
      case 'clt': return { start: 700, duration: U };
      case 'br1': return k === 4 ? { start: 300, duration: U } : gone;
      case 'br2': return k === 4 ? { start: 500, duration: U } : gone;
      case 'cap1': return k === 1 ? { start: 800, duration: U } : gone;
      case 'cap2': return k === 2 ? { start: 900, duration: U } : gone;
      case 'cap3': return k === 3 ? { start: 700, duration: U } : gone;
      case 'cap4': return k === 4 ? { start: 800, duration: U } : gone;
      case 'lb0': return k === 5 ? { start: 250, duration: U } : gone;
      case 'lb1': return k === 5 ? { start: 450, duration: U } : gone;
      case 'wn': return k === 5 ? { start: 800, duration: U } : gone;
      case 'tg': return k === 5 ? { start: 250, duration: U } : gone;
      case 'bb': return k === 5 ? { start: 600 + i * 180, duration: 560 } : gone;
      default: return { start: 0, duration: U };
    }
  };
  return { ...D, leaks, latest, drifts, count, frame, timing, n: timelinePresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `timeline`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function timelineBuild(ctx, P) {
  const Q = P.timeline, L = Q.labels;
  const M = timelineModel(P);
  const sc = scene(ctx, 'mx-root tl-root');
  const { doc, box, put, add, say } = sc;
  const cx = (/** @type {number} */ c) => GX + c * PX, cy = (/** @type {number} */ u) => GY + u * PY;

  const grid = h(doc, 'div', 'tl-grid');
  put('grid', grid, box(0, 0, 1680, 600));
  // rows of dashed frames (the time steps), the interactions as dots, the axis
  for (let u = 0; u < M.rows; u++) for (let c = 0; c < M.steps; c++) add(h(doc, 'i', 'tl-step', { 'aria-hidden': 'true' }), box(cx(c) + 1, cy(u) + 1, PX - 2, PY - 8), grid);
  for (let u = 0; u < M.rows; u++) { const ic = h(doc, 'div', 'tl-user', { 'aria-hidden': 'true' }); add(ic, `left:${GX - 62}px;top:${cy(u) + 22}px`, grid); ic.append(userGlyph(doc)); }
  const axisY = cy(M.rows) + 6;
  add(h(doc, 'div', 'tl-axis', { 'aria-hidden': 'true' }), box(GX, axisY, M.steps * PX, 4), grid);
  add(h(doc, 'div', 'tl-arrow', { 'aria-hidden': 'true' }), `left:${GX + M.steps * PX - 6}px;top:${axisY - 8}px`, grid);
  add(say(h(doc, 'div', 'tl-time'), L.time), `left:${GX}px;top:${axisY + 10}px`, grid);
  for (const x of M.cells) {
    const left = cx(x.c) + (PX - DOT) / 2, top = cy(x.u) + (PY - 8 - DOT) / 2;
    add(h(doc, 'i', 'tl-dot', { 'aria-hidden': 'true', 'data-gfx': 'fill' }), box(left, top, DOT, DOT), grid);
  }
  // the roles of the two splits, and the rings of presses 1, 3 and 4 (each lies on its interaction)
  const ring = (/** @type {string} */ key, /** @type {{c: number, u: number}} */ x, /** @type {string} */ cls, /** @type {boolean} */ withMark) => {
    const el = h(doc, 'i', cls, { 'aria-hidden': 'true', 'data-gfx': 'border' });
    if (withMark) el.append(h(doc, 'i', 'tl-mk'));
    put(key, el, box(cx(x.c) + (PX - DOT) / 2 - 5, cy(x.u) + (PY - 8 - DOT) / 2 - 5, DOT + 10, DOT + 10), grid);
  };
  for (const x of M.cells) { ring(`r1:${x.i}`, x, `tl-ro tl-${x.rand}`, true); ring(`r2:${x.i}`, x, `tl-ro tl-${x.temporal}`, true); }
  for (const x of M.leaks) ring(`lk:${x.i}`, x, 'tl-leak', false);
  for (const x of M.drifts) { const el = h(doc, 'i', 'tl-diamond', { 'aria-hidden': 'true', 'data-gfx': 'fill' }); put(`dr:${x.i}`, el, box(cx(x.c) + (PX - DOT) / 2 + 2, cy(x.u) + (PY - 8 - DOT) / 2 + 2, DOT - 4, DOT - 4), grid); }
  // WP-93: the legend of the two rings, each drawn as in the grid (its grey dot, its ring, its mark), the word in the ring's colour
  const legend = h(doc, 'div', 'tl-lgd', { 'aria-hidden': 'true' });
  [['T', L.train, 0], ['X', L.test, 250]].forEach(([role, word, dx]) => {
    const at = `left:${dx}px;top:4px`;
    add(h(doc, 'i', 'tl-dot tl-lg-dot', { 'data-gfx': 'fill' }), `left:${Number(dx) + 4}px;top:8px`, legend);
    const ring = h(doc, 'i', `tl-ro tl-lg-ring tl-${role}`, { 'data-gfx': 'border' });
    ring.append(h(doc, 'i', 'tl-mk'));
    add(ring, at, legend);
    add(say(h(doc, 'div', `tl-lg-word tl-lg-${role}`), /** @type {Record<string, string>} */ (word)), `left:${Number(dx) + 52}px;top:6px`, legend);
  });
  put('lgd', legend, box(GX, 546, 560, 44));
  // the cut line and its label
  put('cl', h(doc, 'div', 'tl-cut', { 'aria-hidden': 'true' }), `${box(cx(Q.cut) - 2, cy(0) - 6, 4, M.rows * PY + 12)};transform-origin:50% 100%`, grid);
  put('clt', say(h(doc, 'div', 'tl-cut-label'), L.cut), `left:${cx(Q.cut) - 20}px;top:${cy(M.rows) + 14}px;width:40px;text-align:center`, grid);                // the label under the cut, by the time axis
  // the brackets over the first row's two halves (press 4)
  const bracket = (/** @type {string} */ key, /** @type {number} */ from, /** @type {number} */ to, /** @type {Record<string, string>} */ text) => {
    const el = h(doc, 'div', 'tl-bracket', { 'aria-hidden': 'true' });
    el.append(say(h(doc, 'span'), text));
    put(key, el, box(cx(from), cy(0) - 44, (to - from) * PX, 32), grid);
  };
  bracket('br1', 0, M.half, L.school); bracket('br2', M.half, M.steps, L.today);
  // the captions of presses 1 to 4 (one box; one line each, the caption of the press)
  const caption = (/** @type {string} */ key, /** @type {Record<string, string>[]} */ lines, /** @type {string} */ cls) => {
    const el = h(doc, 'div', `tl-caption ${cls}`, { 'aria-hidden': 'true' });
    for (const ln of lines) el.append(say(h(doc, 'div'), ln));
    put(key, el, box(CAPTION.x, CAPTION.y, CAPTION.w, 200));
  };
  caption('cap1', [L.randomSplit, L.future], 'tl-bad');
  caption('cap2', [L.temporalSplit, L.before, L.after], '');
  caption('cap3', [L.netflix], '');
  caption('cap4', [L.drift], '');
  // press 5: two leaderboards, one per split, a bar per method
  const board = (/** @type {string} */ key, /** @type {number} */ i, /** @type {Record<string, string>} */ title, /** @type {number[]} */ vals) => {
    const el = h(doc, 'div', 'tl-board', { 'aria-hidden': 'true' });
    el.append(say(h(doc, 'div', 'tl-board-title'), title));
    [[L.methodA, vals[0], 'tl-bar-a'], [L.methodB, vals[1], 'tl-bar-b']].forEach(([name, v, cls], j) => {
      const y = 96 + j * 100;
      const lab = say(h(doc, 'div', 'tl-bar-label'), /** @type {Record<string, string>} */ (name)); lab.style.cssText += `;left:20px;top:${y}px`;
      el.append(lab);
      put(`bb:${i * 2 + j}`, h(doc, 'div', `tl-bar ${cls}`, { 'data-gfx': 'fill' }), `${box(20, y + 34, Math.max(4, Math.round(/** @type {number} */ (v) * 290)), 26)};transform-origin:0 50%`, el);
      const val = say(h(doc, 'div', 'tl-bar-val'), num(/** @type {number} */ (v), 2)); val.style.cssText += `;left:${BOARD.w - 20 - 70}px;top:${y}px;width:70px`;
      el.append(val);
    });
    put(key, el, box(BOARD.x + i * (BOARD.w + BOARD.gap), BOARD.y, BOARD.w, BOARD.h));
  };
  board('lb0', 0, L.randomSplit, Q.boards.random); board('lb1', 1, L.temporalSplit, Q.boards.temporal);
  put('wn', say(h(doc, 'div', 'tl-winner'), L.winner), box(BOARD.x, BOARD.y + BOARD.h + 24, 2 * BOARD.w + BOARD.gap, 44));
  if (L.tag.en) put('tg', say(h(doc, 'div', 'tl-tag'), L.tag), `left:${BOARD.x}px;top:${BOARD.y - 52}px`);
  else put('tg', h(doc, 'div', 'tl-tag tl-tag-off'), `left:${BOARD.x}px;top:${BOARD.y - 52}px`);

  return finish(ctx, sc, M.n, M.frame, M.timing);
}

/** A user, drawn in currentColor. @param {Document} doc */
function userGlyph(doc) {
  const ns = 'http://www.w3.org/2000/svg';
  const sv = doc.createElementNS(ns, 'svg');
  sv.setAttribute('width', '40'); sv.setAttribute('height', '40'); sv.setAttribute('viewBox', '0 0 56 56'); sv.setAttribute('class', 'pg'); sv.setAttribute('aria-hidden', 'true');
  const c = doc.createElementNS(ns, 'circle'); c.setAttribute('cx', '28'); c.setAttribute('cy', '18'); c.setAttribute('r', '10');
  const p = doc.createElementNS(ns, 'path'); p.setAttribute('d', 'M7 51c0-12 9-19 21-19s21 7 21 19');
  sv.append(c, p);
  return sv;
}
