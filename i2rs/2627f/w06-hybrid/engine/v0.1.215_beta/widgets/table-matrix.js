// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): the matrix modes of table-highlight, told as a picture (storyboard v0.1: s3 `why-hybrid`, s17 `limits`).
// A schematic rating matrix, users x films, with NO numbers in a cell: a cell is observed (filled) or empty. The generic cast: a newly
// released film (the empty column on the right) and a new user (the empty row at the bottom). Two modes, one matrix:
//   matrix (s3), four presses: what each recommender SEES of the matrix.
//     0 (WP-50, D-120) the frame only: the empty grid (every cell dashed), the films and the users
//     1 the observed cells appear, row by row, and the collaborative one sees them (they light up); the new column and the new row stay dark, it is blind to the new film
//     2 the content-based one sees the films' attributes (a strip appears, the new film has attributes too) but not the community's taste
//     3 the knowledge-based one sees what the user says (a requirement card at the new user's row): no ratings needed, a knowledge engineer is
//     4 the three blind spots at once: every card marks what it cannot see; none of them sees the whole picture
//   mnar (s17), four presses: the gaps are not random.
//     0 (WP-50, D-120) the frame only: the empty grid (every cell dashed), the films and the users; nothing that carries data is there yet
//     1 the observed cells take their frame and show their rating (a gauge in the cell) and a histogram shows the ratings are piled up high: users rate what they like
//     2 the held-out ratings come from the same selection (rings on observed cells); the weights learn the selection too
//     3 offline gain does not guarantee online gain: what is outside the matrix (the screen) was never measured
//     4 accuracy alone is not enough: coverage, diversity, novelty and the long tail are measured too
// The numbers (the cells' levels) are SYNTHETIC; the speaker note and the evidence record say so, the picture carries no label (D-129: a plainly toy matrix needs none). Matrix-mode cells carry no number at all.
//
// duration(k) = planDuration(plan(k)), measured: the browser reports the same (see the page).
//
// Motion: opacity, transform (and clipPath nowhere here). A glow or a veil is an overlay element whose opacity moves, never a colour keyframe.
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon, emblem, poster, STAR } from './pictos.js';

const W = 1680, H = 600;
const CELL = 60, GAP = 8, PITCH = CELL + GAP, GX = 64, GY = 118;
const CARD = { x: 730, w: 290, gap: 20, y: GY, h: 400 };

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });

const LABELS = {
  cf: frag('Collaborative', 'İşbirlikçi'), cb: frag('Content-based', 'İçerik tabanlı'), kb: frag('Knowledge-based', 'Bilgi tabanlı'),
  ratings: frag('ratings', 'puanlar'), attributes: frag('attributes', 'öznitelikler'), needs: frag('stated needs', 'söylenen gereksinim'),
  cfNote: frag('Blind to the new film', 'Yeni filme kördür'),
  cbNote: frag("Blind to the community's taste", 'Topluluğun zevkine kördür'),
  kbNote: frag('Needs a knowledge engineer', 'Bilgi mühendisi ister'),
  observed: frag('observed ratings', 'gözlenen puanlar'), everyone: frag('if every film were rated', 'her film puanlansaydı'),
  weights: frag('weights', 'ağırlıklar'), heldOut: frag('held-out', 'ayrı tutulan'),
  offline: frag('measured offline', 'çevrimdışı ölçüldü'), online: frag('online: not measured', 'çevrimiçi: ölçülmedi'),
  accuracy: frag('Accuracy', 'Doğruluk'), coverage: frag('Coverage', 'Kapsam'), diversity: frag('Diversity', 'Çeşitlilik'),
  novelty: frag('Novelty', 'Yenilik'), longTail: frag('Long tail', 'Uzun kuyruk'),
};

/** The schema of the `matrix` param group, merged into table-highlight's schema (the registry carries the whole). */
export const matrixSchema = {
  type: 'object', additionalProperties: false, title: 'the matrix modes (mode matrix and mnar)',
  default: {
    cells: ['5.4.55.', '.45.3.5', '4.55.4.', '55.4.2.', '.4.55.4'],
    held: ['0:0', '1:2', '3:3', '4:3'],
    labels: LABELS,
  },
  properties: {
    cells: {
      type: 'array', minItems: 2, maxItems: 5, title: 'the observed cells, row by row (users)',
      description: 'One string per user, one character per film: "." is an empty cell, "1".."5" an observed rating (its level shows only in mnar mode). All strings the same length, 3..7. The new film (a column) and the new user (a row) are added by the widget, empty.',
      items: { type: 'string', minLength: 3, maxLength: 7 },
      default: ['5.4.55.', '.45.3.5', '4.55.4.', '55.4.2.', '.4.55.4'],
    },
    held: {
      type: 'array', maxItems: 6, items: { type: 'string' }, default: ['0:0', '1:2', '3:3', '4:3'], title: 'the held-out cells, "row:column" (mnar mode, press 2)',
      description: 'Each must be an observed cell.',
    },
    labels: {
      type: 'object', additionalProperties: false, default: LABELS, title: 'the short labels of the pictures',
      properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, fragSchema(v)])),
    },
  },
};

/** Two matrix examples: the default, and a smaller one. */
export const matrixExamples = [
  { mode: 'matrix' }, { mode: 'mnar' },
  { mode: 'matrix', matrix: { cells: ['5.4', '.45', '4.5'], held: [] } },
];

/**
 * @param {import('../../../engine/widgets/kit.js').WidgetContext} ctx
 * @param {Record<string, any>} P the resolved params of table-highlight
 * @param {'matrix'|'mnar'} kind
 */
export function matrixBuild(ctx, P, kind) {
  const doc = ctx.slot.ownerDocument;
  const M = P.matrix;
  const L = M.labels;
  /** @type {string[]} */
  const cells = M.cells;
  const cols0 = cells[0].length, rows0 = cells.length;
  for (const row of cells) {
    if (row.length !== cols0) throw new Error('table-highlight: every row of matrix.cells must have the same length');
    if (!/^[.1-5]+$/.test(row)) throw new Error(`table-highlight: matrix.cells holds "." or 1..5, found "${row}"`);
  }
  const cols = cols0 + 1, rows = rows0 + 1;                     // + the new film (a column) and the new user (a row)
  const gridW = cols * PITCH - GAP, gridH = rows * PITCH - GAP;
  const levelAt = (/** @type {number} */ r, /** @type {number} */ c) => (r < rows0 && c < cols0 && cells[r][c] !== '.' ? Number(cells[r][c]) : 0);
  const held = /** @type {string[]} */ (M.held).map((x) => x.split(':').map(Number));
  for (const [r, c] of held) if (!(levelAt(r, c) > 0)) throw new Error(`table-highlight: held-out cell ${r}:${c} is not an observed cell`);
  const n = 4;
  const mnar = kind === 'mnar';
  const cx = (/** @type {number} */ c) => GX + c * PITCH;
  const cy = (/** @type {number} */ r) => GY + r * PITCH;

  const root = h(doc, 'div', 'w-root mx-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {HTMLElement} el @param {string} css @param {Element} [parent] */
  const put = (key, el, css, parent) => {
    el.style.cssText += `;${css}`;
    el.setAttribute('data-key', key);
    els.set(key, el);
    (parent ?? root).append(el);
    return el;
  };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };

  // ---------- the matrix: overlays first (they sit under the cells), then the cells ----------
  put('dk:row', h(doc, 'div', 'mx-dark', { 'aria-hidden': 'true' }), box(GX - 6, cy(rows - 1) - 6, gridW + 12, CELL + 12));
  put('dk:col', h(doc, 'div', 'mx-dark', { 'aria-hidden': 'true' }), box(cx(cols - 1) - 6, GY - 6, CELL + 12, gridH + 12));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lv = levelAt(r, c);
      // WP-50 (D-120, the user's review of the second run): in both modes the picture before the first press is the frame only (every cell dashed and empty); an observed cell takes its solid frame (`ob`) in press 1,
      // with its fill and glow (matrix mode) or its gauge (`br`, mnar mode)
      const cell = h(doc, 'div', 'mx-cell', { 'aria-hidden': 'true', 'data-gfx': 'border' });
      cell.style.cssText = box(cx(c), cy(r), CELL, CELL);
      if (lv) {
        put(`ob:${r}:${c}`, h(doc, 'div', 'mx-obs', { 'aria-hidden': 'true' }), '', cell);
        if (!mnar) {
          put(`fl:${r}:${c}`, h(doc, 'div', 'mx-fill'), '', cell);
          put(`gl:${r}:${c}`, h(doc, 'div', 'mx-glow'), '', cell);
        }
        if (mnar) put(`br:${r}:${c}`, h(doc, 'div', 'mx-bar', { 'data-gfx': 'fill' }), `height:${Math.round((CELL - 14) * lv / 5)}px;transform-origin:50% 100%`, cell);
        if (mnar && held.some(([hr, hc]) => hr === r && hc === c)) put(`hd:${r}:${c}`, h(doc, 'div', 'mx-ring', { 'data-gfx': 'border' }), '', cell);
      }
      root.append(cell);
    }
  }
  // the veil over the whole grid ("not seen"): a ground-coloured overlay whose opacity moves
  if (!mnar) put('vl', h(doc, 'div', 'mx-veil', { 'aria-hidden': 'true' }), box(GX - 6, GY - 6, gridW + 12, gridH + 12));

  // films across the top (the last one is the new film, tagged) and users down the left (the last one is the new user)
  for (let c = 0; c < cols; c++) {
    const p = poster(doc, [4, 8, 1, 5, 9, 3, 6, 0][c % 8], CELL, 58, 30);
    p.style.cssText += `;position:absolute;left:${cx(c)}px;top:${GY - 72}px`;
    if (c === cols - 1 && P.badge.en) {
      const b = h(doc, 'div', 'th-badge mx-badge', { 'data-role': 'key' });
      say(b, P.badge);
      p.append(b);
    }
    root.append(p);
  }
  for (let r = 0; r < rows; r++) {
    const u = icon(doc, 'user', 46);
    u.classList.add('mx-user');
    u.style.cssText = `left:${GX - 62}px;top:${cy(r) + (CELL - 46) / 2}px`;
    root.append(u);
    if (r === rows - 1 && P.badge.en) {
      const b = h(doc, 'div', 'th-badge mx-badge mx-ubadge', { 'data-role': 'key' });
      b.style.cssText = `left:${GX - 82}px;top:${cy(r) - 8}px`;
      say(b, P.badge);
      root.append(b);
    }
  }

  if (!mnar) {
    // ---------- matrix mode: the attribute strip, the requirement card, the three recommenders' cards ----------
    const stripY = GY + gridH + 14;
    put('stg', h(doc, 'div', 'mx-glowbox', { 'aria-hidden': 'true' }), box(GX - 16, stripY - 12, gridW + 32, 72));
    const strip = h(doc, 'div', 'mx-strip', { 'aria-hidden': 'true' });
    strip.style.cssText = box(GX - 8, stripY - 4, gridW + 16, 56);
    for (let c = 0; c < cols; c++) {
      const e1 = emblem(doc, (c * 3 + 1) % 10, 20), e2 = emblem(doc, (c * 3 + 6) % 10, 20);
      e1.style.cssText = `position:absolute;left:${cx(c) - GX + 8 + 8}px;top:16px`;
      e2.style.cssText = `position:absolute;left:${cx(c) - GX + 8 + 32}px;top:16px`;
      strip.append(e1, e2);
    }
    put('st', strip, '');
    const rqX = GX + gridW + 16, rqY = cy(rows - 1) - 18;
    put('rqg', h(doc, 'div', 'mx-glowbox', { 'aria-hidden': 'true' }), box(rqX - 8, rqY - 8, 96, 96));
    const rq = icon(doc, 'clipboard', 80);
    rq.classList.add('mx-req');
    put('rq', /** @type {any} */ (rq), `left:${rqX}px;top:${rqY}px`);

    // the three cards: name, the three sources of information with an eye (seen) or a crossed eye (blind), a short note
    const SOURCES = /** @type {const} */ (['ratings', 'attributes', 'needs']);
    const SRC_ICON = { ratings: 'ratings', attributes: 'attributes', needs: 'clipboard' };
    const cards = [
      { id: 'cf', icon: 'users', name: L.cf, note: L.cfNote, sees: [true, false, false] },
      { id: 'cb', icon: 'tag', name: L.cb, note: L.cbNote, sees: [false, true, false] },
      { id: 'kb', icon: 'clipboard', name: L.kb, note: L.kbNote, sees: [false, true, true] },
    ];
    cards.forEach((cd, i) => {
      const card = h(doc, 'div', 'mx-card');
      card.style.cssText = box(CARD.x + i * (CARD.w + CARD.gap), CARD.y, CARD.w, CARD.h);
      const head = h(doc, 'div', 'mx-card-head');
      head.append(icon(doc, /** @type {any} */ (cd.icon), 52));
      head.append(say(h(doc, 'span', 'mx-card-name'), cd.name));
      card.append(head);
      SOURCES.forEach((src, j) => {
        const row = h(doc, 'div', 'mx-src');
        row.append(icon(doc, /** @type {any} */ (SRC_ICON[src]), 40));
        row.append(say(h(doc, 'span', 'mx-src-label'), L[src]));
        const eye = icon(doc, cd.sees[j] ? 'eye' : 'eyeoff', 40);
        eye.classList.add('mx-eye');
        row.append(eye);
        if (!cd.sees[j]) {
          const red = icon(doc, 'eyeoff', 40);
          red.classList.add('mx-eye', 'mx-eye-neg');
          red.setAttribute('data-key', `bl:${i}:${j}`);
          els.set(`bl:${i}:${j}`, red);
          row.append(red);
        }
        card.append(row);
      });
      card.append(say(h(doc, 'div', 'mx-card-note'), cd.note));
      put(`cd:${i}`, card, '');
    });
  } else {
    // ---------- mnar mode: the histogram, the held-out rings and their weights, the screen, the metrics ----------
    const counts = [1, 2, 3, 4, 5].map((lv) => cells.join('').split('').filter((ch) => ch === String(lv)).length);
    const top = Math.max(...counts), flat = counts.reduce((a, b) => a + b, 0) / 5;
    const HX = 750, BASE = 350, MAXH = 190, BW = 52, BG = 28;
    const hist = h(doc, 'div', 'mx-hist', { 'aria-hidden': 'true' });
    hist.style.cssText = box(HX - 20, GY - 10, 420, 296);                      // the grey panel ends 18 px under the star labels (the legend no longer hangs below it, see `legend`)
    put('hs', hist, '');
    for (let i = 0; i < 5; i++) {
      const x = HX + i * (BW + BG);
      put(`hr:${i}`, h(doc, 'div', 'mx-ref', { 'data-gfx': 'border' }), box(x, BASE - Math.round(MAXH * flat / top), BW, Math.round(MAXH * flat / top)));
      put(`hb:${i}`, h(doc, 'div', 'mx-hbar', { 'data-gfx': 'fill' }), `${box(x, BASE - Math.round(MAXH * counts[i] / top), BW, Math.max(2, Math.round(MAXH * counts[i] / top)))};transform-origin:50% 100%`);
      const lab = h(doc, 'div', 'mx-hlab', { 'aria-hidden': 'true' });
      lab.style.cssText = box(x - 8, BASE + 6, BW + 16, 30);
      const num = h(doc, 'span', '');
      num.textContent = String(i + 1);
      const st = s(doc, 'svg', { width: '18', height: '18', viewBox: '0 0 24 24', class: 'pg', 'aria-hidden': 'true' });
      st.append(s(doc, 'path', { d: STAR, class: 'f' }));
      lab.append(num, st);
      put(`hx:${i}`, lab, '');                                                 // WP-50: the star labels of the histogram come with it (they stood alone before the first press)
    }
    // WP-51 (the author's review): the legend stands in the top left corner of the grey panel, where the two shortest bars leave room, not under the panel: the five metrics of press 4 come in right
    // below it (a row at y 462), and a legend there was in their way. It ends at x 1046, before the tallest bar (x 1070, top at y 160); the 4-star bar (x 990) is lower (top at y 229).
    const legend = h(doc, 'div', 'mx-legend');
    legend.style.cssText = box(HX - 4, GY + 2, 300, 60);
    const l1 = h(doc, 'div', 'mx-lg'); l1.append(h(doc, 'i', 'mx-sw'), say(h(doc, 'span', ''), L.observed));
    const l2 = h(doc, 'div', 'mx-lg'); l2.append(h(doc, 'i', 'mx-sw ref'), say(h(doc, 'span', ''), L.everyone));
    legend.append(l1, l2);
    put('lg', legend, '');

    // the weights card: it learns from the held-out ratings, so it learns the selection too (same emphasis colour as the rings)
    const wt = h(doc, 'div', 'mx-wt');
    wt.append(icon(doc, 'sliders', 64), say(h(doc, 'span', ''), L.weights));
    put('wt', wt, box(1190, GY, 190, 150));
    put('hl', say(h(doc, 'div', 'mx-hl', { 'data-role': 'emph' }), L.heldOut), box(1190, GY + 158, 190, 34));
    // the screen: what happens online was never in the matrix
    const scr = h(doc, 'div', 'mx-scr');
    scr.append(icon(doc, 'screen', 110), say(h(doc, 'span', ''), L.online));
    put('scr', scr, box(1420, GY, 220, 220));
    // the dashed boundary of what was measured offline
    put('bd', h(doc, 'div', 'mx-bound', { 'data-gfx': 'border', 'aria-hidden': 'true' }), box(GX - 16, GY - 16, gridW + 32, gridH + 32));
    put('off', say(h(doc, 'div', 'mx-off'), L.offline), box(GX - 16, GY + gridH + 22, gridW + 32, 32));
    // the metrics beyond accuracy
    const METRICS = [['target', L.accuracy], ['coverage', L.coverage], ['diversity', L.diversity], ['novelty', L.novelty], ['longtail', L.longTail]];
    METRICS.forEach(([ic, label], i) => {
      const m = h(doc, 'div', 'mx-metric');
      m.append(icon(doc, /** @type {any} */ (ic), 56), say(h(doc, 'span', ''), /** @type {any} */ (label)));
      put(`mt:${i}`, m, box(750 + i * 180, 462, 170, 110));
    });
  }

  // ---------- frames and timing ----------
  const RISE = 'translateY(16px)', NONE = 'translateY(0px)';
  const on = (/** @type {boolean} */ b) => ({ opacity: b ? '1' : '0' });
  const shown = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('dk:row', on(!mnar && k === 1)); f.set('dk:col', on(!mnar && k === 1));
    for (let r = 0; r < rows0; r++) {
      for (let c = 0; c < cols0; c++) {
        if (levelAt(r, c) === 0) continue;
        f.set(`ob:${r}:${c}`, on(k >= 1));
        if (mnar) {
          f.set(`br:${r}:${c}`, k >= 1 ? { opacity: '1', transform: 'scaleY(1)' } : { opacity: '0', transform: 'scaleY(0)' });
          if (els.has(`hd:${r}:${c}`)) f.set(`hd:${r}:${c}`, on(k >= 2));
        } else {
          f.set(`fl:${r}:${c}`, on(k >= 1));
          f.set(`gl:${r}:${c}`, on(k === 1));
        }
      }
    }
    if (!mnar) {
      f.set('vl', { opacity: k === 2 || k === 3 ? '0.62' : '0' });
      f.set('stg', on(k === 2 || k === 3)); f.set('st', shown(k >= 2));
      f.set('rqg', on(k === 3)); f.set('rq', shown(k >= 3));
      for (let i = 0; i < 3; i++) {
        f.set(`cd:${i}`, k >= i + 1 ? { opacity: '1', transform: NONE } : { opacity: '0', transform: 'translateX(28px)' });
      }
      [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0]].forEach(([i, j]) => f.set(`bl:${i}:${j}`, on(k >= 4)));
    } else {
      f.set('hs', on(k >= 1)); f.set('lg', on(k >= 1));
      for (let i = 0; i < 5; i++) {
        f.set(`hx:${i}`, on(k >= 1));
        f.set(`hb:${i}`, k >= 1 ? { opacity: '1', transform: 'scaleY(1)' } : { opacity: '0', transform: 'scaleY(0)' });
        f.set(`hr:${i}`, on(k >= 1));
      }
      f.set('wt', shown(k >= 2)); f.set('hl', shown(k >= 2));
      f.set('bd', on(k >= 3)); f.set('off', on(k >= 3)); f.set('scr', shown(k >= 3));
      for (let i = 0; i < 5; i++) f.set(`mt:${i}`, shown(k >= 4));
    }
    return f;
  };
  /** @param {string} key @param {number} k */
  const timing = (key, k) => {
    const kind0 = key.split(':')[0];
    const i = Number(key.split(':').pop());
    if (kind0 === 'dk' || kind0 === 'vl' || kind0 === 'stg' || kind0 === 'rqg') return { start: 0, duration: 380 };
    // WP-50 (D-120): the observed cells come with press 1. Matrix mode: row by row (70 ms a row), the fill with the frame and the glow 120 ms later; mnar mode: cell by cell, the frame a moment before its gauge
    if (kind0 === 'ob') return mnar ? { start: 40 + (Number(key.split(':')[1]) * cols0 + Number(key.split(':')[2])) * 18, duration: 380 } : { start: Number(key.split(':')[1]) * 70, duration: 380 };
    if (kind0 === 'fl') return { start: Number(key.split(':')[1]) * 70, duration: 380 };
    if (kind0 === 'gl') return { start: Number(key.split(':')[1]) * 70 + 120, duration: 380 };
    if (kind0 === 'hx') return { start: 160, duration: 380 };
    if (kind0 === 'br') return { start: 120 + (Number(key.split(':')[1]) * cols0 + Number(key.split(':')[2])) * 18, duration: 520 };
    if (kind0 === 'cd') return { start: 80, duration: 520 };
    if (kind0 === 'st' || kind0 === 'rq') return { start: 140, duration: 520 };
    if (kind0 === 'bl') return { start: i * 90, duration: 380 };
    if (kind0 === 'hs' || kind0 === 'lg') return { start: 160, duration: 380 };
    if (kind0 === 'hb') return { start: 360 + i * 110, duration: 520 };
    if (kind0 === 'hr') return { start: 360 + 5 * 110 + i * 60, duration: 380 };
    if (kind0 === 'hd') return { start: 60, duration: 420 };
    if (kind0 === 'wt' || kind0 === 'hl') return { start: 260, duration: 480 };
    if (kind0 === 'bd' || kind0 === 'off') return { start: 0, duration: 420 };
    if (kind0 === 'scr') return { start: 260, duration: 520 };
    if (kind0 === 'mt') return { start: 80 + i * 130, duration: 480 };
    return { start: 0, duration: 400 };
  };

  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();
  return { steps, destroy: () => root.remove() };
}
