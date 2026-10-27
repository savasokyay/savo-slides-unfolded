// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): table-highlight, a table read one column at a time; here the weighted blend, told as a picture.
// The story (a generic cast, the same on every page of the deck): a user and a NEWLY RELEASED FILM. Five recommenders each predict
// how many stars the user would give it; each prediction gets a weight; the weighted sum is the blend, and it fills the stars on the
// film's poster. The numbers are SYNTHETIC (D-055); the speaker note and the evidence record say so, the picture carries no label (D-129). They are hand-checkable:
//   0.30*3.8 = 1.14   0.25*4.0 = 1.00   0.25*4.2 = 1.05   0.30*3.6 = 1.08   -0.10*4.6 = -0.46   sum = 3.81,  weights sum = 1.00
// The popularity recommender over-predicts for a film everyone is talking about, so the blend gives it a NEGATIVE weight and moves
// away from it. A literature example replaces the numbers later (content-agent); the widget needs rows of {label, icon, prediction, weight}.
// Names follow the student site's weighted blend (EN and TR as on the site); none of the site's numbers (class set) is used.
//
// Kit shape (engine/widgets/kit.js): defineWidget({id, steps, params, stepCount, examples, build}); states k = 0..4; k=0 shows the story
// (the user, the new film, the five recommenders) and nothing of the table.
//   1 predictions (stars and numbers)   2 weights (bars and numbers; a negative weight is red, leans left, keeps its minus sign, gets a note)
//   3 products, with the operators      4 the products travel into the sum, the total lands, the film's stars fill up
// The negative weight is marked by colour (neg role) AND the minus sign AND the bar's direction AND, when the cues are on (D-068), a wavy underline.
// Numbers enter the DOM through ctx.setText with an EN and a TR form (Turkish writes 0,45).
//
// duration(k) = planDuration(plan(k)); m = rows (default 5), s = staggerMs (110), u = unitMs (420):
//   k=1   120 + (m-1)*s + u                      k=2   max(220 + (m-1)*s + u, 120 + (m-1)*s + 250 + 400)   (the bars start 100 after the numbers; the note)
//   k=3   120 + (m-1)*s + 140 + u
//   k=4   max(ruleMs, gather, land + landMs, land + starsLagMs + starsMs), gather = gatherLagMs + (m-1)*cloneStaggerMs + gatherMs,
//         land = gather - overlapMs
// Default numbers: 980 / 1210 / 1120 / 2090 ms (measured: the browser reports the same).
//
// Motion: opacity, transform and clipPath only. The travelling numbers are clones invisible at both ends of the trip and visible in
// between (opacity keyframes), resting at the sum once state 4 is reached; the bands are an opacity crossfade; the bars grow from the zero line.
import { defineWidget } from './kit.js';
import { stepsFromFrames, h, fit } from './frames.js';
import { icon, emblem, starRow, ICON_NAMES, svg } from './pictos.js';
import { matrixSchema, matrixBuild, matrixExamples } from './table-matrix.js';
import { pseudoSchema, pseudoBuild, pseudoExamples, pseudoProblems } from './table-pseudo.js';       // WP-50 (D-112): the mode `pseudo`
import { groupsSchema, groupsBuild, groupsExamples, groupsProblems } from './table-groups.js';         // WP-50 (D-112): the mode `groups`

const W = 1680, H = 600;
const ROW0 = 56, PITCH = 82, CELL_H = 70;
const RULE_Y = 470, TOTAL_Y = 484, TOTAL_H = 100;
/** Left edges and widths of the columns; numbers are right-aligned in their cells. */
const COL = { icon: 0, label: 70, labelW: 340, pred: 430, predW: 270, op1: 712, w: 920, wW: 110, op2: 1042, x: 1100, xW: 190 };
/** The zero line of the weight bars and the length of a bar for a weight of 1 (px). */
const ZERO_X = 830, BAR_PER_UNIT = 200, BAR_H = 16;
/** The story's column on the right: the user, the new film's poster, the stars the blend fills. */
const SCENE = { x: 1350, user: 1366, poster: 1490, posterW: 150, posterH: 196 };
const MAX_ROWS = Math.floor((RULE_Y - 12 - CELL_H - ROW0) / PITCH) + 1;

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });
const ms = (/** @type {number} */ d, min = 0) => ({ type: 'integer', minimum: min, default: d });
const dec = (/** @type {number} */ d) => ({ type: 'integer', minimum: 0, maximum: 4, default: d });

/** The params' JSON Schema, inside the subset of engine/widgets/params.js (the registry carries the same one). */
export const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: {
      type: 'string', enum: ['blend', 'matrix', 'mnar', 'pseudo', 'groups'], default: 'blend', title: 'what the table shows',
      description: 'blend: the weighted blend (rows, columns, the sum). matrix: a schematic rating matrix and what each recommender sees of it. mnar: the same matrix, its gaps are not random. pseudo: a content-based model fills the empty cells of a sparse matrix with pseudo-ratings, the collaborative model reads it, and the weight of a pair of users grows with their real ratings. Every mode takes four presses.',
    },
    matrix: matrixSchema,
    pseudo: pseudoSchema,
    groups: groupsSchema,
    columns: {
      type: 'object', required: ['prediction', 'weight', 'product'], additionalProperties: false,
      default: { prediction: frag('Prediction', 'Tahmin'), weight: frag('Weight', 'Ağırlık'), product: frag('Product', 'Çarpım') },
      properties: { prediction: fragSchema(frag('Prediction', 'Tahmin')), weight: fragSchema(frag('Weight', 'Ağırlık')), product: fragSchema(frag('Product', 'Çarpım')) },
    },
    rows: {
      type: 'array', minItems: 2, maxItems: MAX_ROWS, title: 'the base recommenders',
      description: `One row each: {label: {en, tr}, icon?, prediction (0..5 stars), weight}. icon is one of ${ICON_NAMES.join(', ')}. The product and the sums are computed. The numbers are an example; the speaker note and the evidence record say so (D-129: a picture that is plainly an example carries no label).`,
      items: { type: 'object', required: ['label', 'prediction', 'weight'], additionalProperties: false,
        properties: { label: FRAGMENT, icon: { type: 'string', enum: [...ICON_NAMES] }, prediction: { type: 'number', minimum: 0, maximum: 5 }, weight: { type: 'number' } } },
      default: [
        { label: frag('User-based kNN', 'Kullanıcı tabanlı kNN'), icon: 'users', prediction: 3.8, weight: 0.3 },
        { label: frag('Item-based kNN', 'Öğe tabanlı kNN'), icon: 'items', prediction: 4.0, weight: 0.25 },
        { label: frag('Matrix factorization', 'Matris ayrıştırma'), icon: 'matrix', prediction: 4.2, weight: 0.25 },
        { label: frag('Content-based', 'İçerik tabanlı'), icon: 'tag', prediction: 3.6, weight: 0.3 },
        { label: frag('Popularity', 'Popülerlik'), icon: 'flame', prediction: 4.6, weight: -0.1 },
      ],
    },
    totalLabel: fragSchema(frag('Hybrid prediction', 'Hibrit tahmin')),
    negativeNote: { ...FRAGMENT, title: 'note on the first negative weight', description: 'Empty `en` shows no note.',
      default: frag('Negative weight: the blend moves away from this recommender', 'Negatif ağırlık: karışım bu önericiden uzaklaşır') },
    badge: { ...FRAGMENT, title: 'the tag on the film poster', default: frag('NEW', 'YENİ'), description: 'The story: a newly released film. Empty `en` shows no tag.' },
    emblem: { type: 'integer', minimum: 0, maximum: 9, default: 4, title: 'the emblem on the poster (a generic shape; no real film)' },
    decimals: {
      type: 'object', additionalProperties: false, default: { prediction: 1, weight: 2, product: 2 },
      properties: { prediction: dec(1), weight: dec(2), product: dec(2) },
    },
    staggerMs: ms(110), unitMs: ms(420, 1), headMs: ms(320, 1), bandInMs: ms(300, 1), bandOutMs: ms(200, 1), ruleMs: ms(420, 1),
    // one number lands (and fades) before the next arrives, so they never pile up unreadably at the sum
    gatherLagMs: ms(300), cloneStaggerMs: ms(110), gatherMs: ms(800, 1), overlapMs: ms(250), landMs: ms(420, 1), starsLagMs: ms(100), starsMs: ms(700, 1),
  },
};

/** Number of presses: predictions, weights, products, the sum. */
const presses = () => 4;

/**
 * Round half away from zero to `d` decimals, true minus sign (U+2212), never "-0.00"; Turkish writes the decimal comma.
 * @param {number} x @param {number} d @param {string} [lang]
 */
export const fmt = (x, d, lang = 'en') => {
  const f = 10 ** d;
  const v = Math.sign(x) * Math.round(Math.abs(x) * f) / f;
  const t = (v === 0 ? 0 : v).toFixed(d).replace('-', '−');
  return lang === 'tr' ? t.replace('.', ',') : t;
};
/** An i18n fragment of a number. @param {number} x @param {number} d @param {string} [prefix] */
const num = (x, d, prefix = '') => ({ en: prefix + fmt(x, d, 'en'), tr: prefix + fmt(x, d, 'tr') });

export default defineWidget({
  id: 'table-highlight',
  steps: 'Four presses in every mode. blend: the base recommenders\' predictions for the new film (stars and numbers), their weights (bars; a negative weight leans left and is marked), the products, then the products travel into the sum, the total lands and fills the film\'s stars. matrix: what the collaborative, the content-based and the knowledge-based recommender each see of a rating matrix, then their three blind spots together. mnar: the observed ratings pile up high, the held-out ratings come from the same selection, the screen outside the matrix was never measured, accuracy is not the only measure. pseudo (WP-50): the real ratings of a sparse matrix, the pseudo-ratings of a content-based model fill every empty cell, the filled vectors of two users side by side with an arc of similar taste, then the weight multipliers of three pairs of users (a bar that grows with their real ratings and is full from `full` of them; the counts are shown, the bars carry no number). groups (WP-50): the three groups of inputs (ids, film content, user profile), one model that reads them all, its predicted rating, a film with only two ratings (synthetic) for which the box of the ids dims and the film content lights up, then the three arrows washed in gold together.',
  params: schema,
  stepCount: presses,
  check: (params) => (params.mode === 'pseudo' ? pseudoProblems(params) : params.mode === 'groups' ? groupsProblems(params) : []),       // WP-50: the mode's own rules, pure (the older modes keep theirs in build)
  // The sample blend, the smallest table (two rows, no negative weight, so no note), the matrix modes and the pseudo-rating mode.
  examples: [{}, { rows: [{ label: { en: 'First' }, prediction: 3, weight: 0.5 }, { label: { en: 'Second' }, prediction: 4, weight: 0.5 }] }, ...matrixExamples, ...pseudoExamples, ...groupsExamples],
  build(ctx, P) {
    if (P.mode === 'pseudo') return pseudoBuild(ctx, P);                 // WP-50: the pseudo-rating mode has its own picture (table-pseudo.js)
    if (P.mode === 'groups') return groupsBuild(ctx, P);                 // WP-50: so has the groups mode (table-groups.js)
    if (P.mode !== 'blend') return matrixBuild(ctx, P, P.mode);          // the matrix modes have their own picture (table-matrix.js)
    const doc = ctx.slot.ownerDocument;
    /** @type {Array<{label: Record<string,string>, icon?: string, prediction: number, weight: number}>} */
    const rows = P.rows;
    const m = rows.length;
    const prods = rows.map((r) => r.prediction * r.weight);
    const total = prods.reduce((a, b) => a + b, 0);
    const sumW = rows.reduce((a, r) => a + r.weight, 0);
    const firstNeg = rows.findIndex((r) => r.weight < 0);
    const note = firstNeg >= 0 && P.negativeNote.en ? P.negativeNote : null;
    const n = presses();
    const D = P.decimals;
    const rowY = (/** @type {number} */ i) => ROW0 + i * PITCH;

    const root = h(doc, 'div', 'w-root th-root');
    root.style.cssText = `width:${W}px;height:${H}px`;
    const sc = fit(ctx, W, H);
    if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
    /** @type {Map<string, Element>} */
    const els = new Map();
    const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
    /** Put an element in the slot under a key. @param {string} key @param {HTMLElement} el @param {string} css @param {Record<string, string>} [text] */
    const put = (key, el, css, text) => {
      el.style.cssText += `;${css}`;
      if (text) ctx.setText(el, text);
      el.setAttribute('data-key', key);
      els.set(key, el);
      root.append(el);
      return el;
    };

    // ---------- the story: a user, a newly released film, the stars the blend will fill ----------
    const scene = h(doc, 'div', 'th-scene', { 'aria-hidden': 'true' });
    scene.style.cssText = box(SCENE.x, 0, 330, 280);
    const user = icon(doc, 'user', 64);
    user.style.cssText = `position:absolute;left:${SCENE.user - SCENE.x}px;top:70px`;
    const toward = svg(doc, 40, 24, 'pg-toward');
    toward.style.cssText = `position:absolute;left:${SCENE.user - SCENE.x + 74}px;top:92px`;
    toward.innerHTML = '<path d="M2 12H34M26 5L34 12L26 19"/>';
    const poster = h(doc, 'div', 'th-poster');
    poster.style.cssText = box(SCENE.poster - SCENE.x, 0, SCENE.posterW, SCENE.posterH);
    const emb = emblem(doc, P.emblem, 84);
    emb.style.cssText = 'position:absolute;left:33px;top:56px';
    poster.append(emb);
    if (P.badge.en) {
      const badge = h(doc, 'div', 'th-badge', { 'data-role': 'key' });
      ctx.setText(badge, P.badge);
      poster.append(badge);
    }
    const starsBase = starRow(doc, 0, 28, 5);
    starsBase.style.cssText += `;position:absolute;left:${SCENE.poster - SCENE.x - 5}px;top:${SCENE.posterH + 14}px`;
    scene.append(user, toward, poster, starsBase);
    root.append(scene);
    // the stars the blend fills (state 4): the same row, filled to the total, revealed left to right
    const res = starRow(doc, total, 28, 5);
    res.className += ' th-res';
    res.style.cssText += `;position:absolute;left:${SCENE.poster - 5}px;top:${SCENE.posterH + 14}px`;
    res.setAttribute('data-key', 'res');
    res.setAttribute('data-role', 'key');
    res.setAttribute('aria-hidden', 'true');
    els.set('res', res);
    root.append(res);

    // bands behind the column in focus (states 1..3) and behind the total (state 4); all inside the slot
    const bandH = rowY(m - 1) + CELL_H + 12;
    [box(COL.pred - 18, 0, COL.predW + 36, bandH), box(ZERO_X - 100, 0, COL.w + COL.wW - ZERO_X + 118, bandH), box(COL.x - 18, 0, COL.xW + 36, bandH),
      box(0, TOTAL_Y - 12, COL.x + COL.xW + 20, TOTAL_H + 16)]
      .forEach((css, i) => put(`band:${i + 1}`, h(doc, 'div', 'th-band', { 'aria-hidden': 'true' }), css));

    // headers
    put('hd:p', h(doc, 'div', 'th-head'), box(COL.pred, 0, COL.predW, 44), P.columns.prediction);
    put('hd:w', h(doc, 'div', 'th-head'), box(COL.w - 110, 0, COL.wW + 110, 44), P.columns.weight);
    put('hd:x', h(doc, 'div', 'th-head'), box(COL.x, 0, COL.xW, 44), P.columns.product);

    // the zero line of the weight bars
    put('wz', h(doc, 'div', 'th-zero', { 'data-gfx': 'fill', 'aria-hidden': 'true' }), box(ZERO_X - 1, ROW0 - 6, 3, rowY(m - 1) + CELL_H - ROW0 + 12));

    // rows
    rows.forEach((r, i) => {
      const y = rowY(i);
      const neg = r.weight < 0;
      if (r.icon) {
        const ic = icon(doc, /** @type {any} */ (r.icon), 52);
        ic.style.cssText = `position:absolute;left:${COL.icon}px;top:${y + (CELL_H - 52) / 2}px`;
        ic.classList.add('th-rowicon');
        root.append(ic);
      }
      const lab = h(doc, 'div', 'th-label');
      lab.style.cssText = box(r.icon ? COL.label : 0, y, COL.labelW, CELL_H);
      ctx.setText(lab, r.label);
      root.append(lab);
      // the prediction: stars and the number
      const cell = h(doc, 'div', 'th-pred');
      cell.append(starRow(doc, r.prediction, 28, 4));
      const pn = h(doc, 'span', 'th-num');
      ctx.setText(pn, num(r.prediction, D.prediction));
      cell.append(pn);
      put(`p:${i}`, cell, box(COL.pred, y, COL.predW, CELL_H));
      const role = neg ? { 'data-role': 'neg' } : {};
      put(`w:${i}`, h(doc, 'div', 'th-cell', role), box(COL.w, y, COL.wW, CELL_H), num(r.weight, D.weight));
      const len = Math.max(2, Math.abs(r.weight) * BAR_PER_UNIT);
      put(`wb:${i}`, h(doc, 'div', `th-bar${neg ? ' neg' : ''}`, { 'data-gfx': 'fill', 'aria-hidden': 'true' }),
        `${box(neg ? ZERO_X - len : ZERO_X, y + (CELL_H - BAR_H) / 2, len, BAR_H)};transform-origin:${neg ? '100%' : '0'} 50%`);
      put(`x:${i}`, h(doc, 'div', 'th-cell', role), box(COL.x, y, COL.xW, CELL_H), num(prods[i], D.product));
      put(`o1:${i}`, h(doc, 'div', 'th-op'), box(COL.op1, y, 40, CELL_H), frag('×', '×'));
      put(`o2:${i}`, h(doc, 'div', 'th-op'), box(COL.op2, y, 40, CELL_H), frag('=', '='));
      put(`cl:${i}`, h(doc, 'div', 'th-cell th-clone', { 'aria-hidden': 'true', ...role }), box(COL.x, y, COL.xW, CELL_H), num(prods[i], D.product));
    });

    // the note on the first negative weight (D-129: no "synthetic data" label; the example is plainly an example)
    if (note) put('tag', h(doc, 'div', 'th-note', { 'data-role': 'neg' }), box(SCENE.x, rowY(firstNeg) - 6, 320, 100), note);

    // the sum row
    put('rule', h(doc, 'div', 'th-rule', { 'data-gfx': 'fill', 'aria-hidden': 'true' }), box(0, RULE_Y, COL.x + COL.xW, 4));
    put('tl', h(doc, 'div', 'th-total-label', { 'data-role': 'key' }), box(0, TOTAL_Y, COL.pred - 20, TOTAL_H), P.totalLabel);
    put('sw', h(doc, 'div', 'th-sumw'), box(COL.w - 40, TOTAL_Y, COL.wW + 40, TOTAL_H), num(sumW, D.weight, 'Σ '));
    put('tot', h(doc, 'div', 'th-total', { 'data-role': 'key' }), box(COL.x, TOTAL_Y, COL.xW, TOTAL_H), num(total, D.product));

    // ---------- frames and timing ----------
    const RISE = 'translateY(14px)', NONE = 'translateY(0px)';
    const shown = (/** @type {boolean} */ on) => (on ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
    /** How far the product of row i travels down to the total's line. @param {number} i */
    const dyOf = (i) => TOTAL_Y + (TOTAL_H - CELL_H) / 2 - rowY(i);
    const landStart = P.gatherLagMs + (m - 1) * P.cloneStaggerMs + P.gatherMs - P.overlapMs;
    const frame = (/** @type {number} */ k) => {
      /** @type {Map<string, Record<string, string>>} */
      const f = new Map();
      for (let b = 1; b <= 4; b++) f.set(`band:${b}`, { opacity: k === b ? '1' : '0' });
      f.set('hd:p', shown(k >= 1)); f.set('hd:w', shown(k >= 2)); f.set('hd:x', shown(k >= 3));
      f.set('wz', { opacity: k >= 2 ? '1' : '0' });
      rows.forEach((_, i) => {
        f.set(`p:${i}`, shown(k >= 1)); f.set(`w:${i}`, shown(k >= 2)); f.set(`x:${i}`, shown(k >= 3));
        f.set(`wb:${i}`, { opacity: k >= 2 ? '1' : '0', transform: k >= 2 ? 'scaleX(1)' : 'scaleX(0)' });
        f.set(`o1:${i}`, { opacity: k >= 3 ? '1' : '0' }); f.set(`o2:${i}`, { opacity: k >= 3 ? '1' : '0' });
        // the clones rest invisible AT the sum once state 4 is reached (the end of their trip), so the picture of 4 is what the trip ends in
        f.set(`cl:${i}`, { opacity: '0', transform: k >= 4 ? `translateY(${dyOf(i)}px)` : NONE });
      });
      if (note) f.set('tag', shown(k >= 2));
      f.set('rule', { opacity: '1', transform: k >= 4 ? 'scaleX(1)' : 'scaleX(0)' });
      f.set('tl', shown(k >= 4)); f.set('sw', shown(k >= 4)); f.set('tot', shown(k >= 4));
      f.set('res', { clipPath: k >= 4 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' });
      return f;
    };
    /** @param {string} key @param {number} k */
    const timing = (key, k) => {
      const [kind, idx] = key.split(':');
      const i = Number(idx);
      if (kind === 'band') return { start: 0, duration: i === k ? P.bandInMs : P.bandOutMs };
      if (kind === 'hd') return { start: 0, duration: P.headMs };
      if (kind === 'p' || kind === 'w') return { start: 120 + i * P.staggerMs, duration: P.unitMs };
      if (kind === 'wb') return { start: 220 + i * P.staggerMs, duration: P.unitMs };
      if (key === 'wz') return { start: 120, duration: 300 };
      if (kind === 'o1' || kind === 'o2') return { start: 120 + i * P.staggerMs, duration: 300 };
      if (kind === 'x') return { start: 120 + i * P.staggerMs + 140, duration: P.unitMs };
      if (key === 'tag') return { start: 120 + (m - 1) * P.staggerMs + 250, duration: 400 };
      if (key === 'rule') return { start: 0, duration: P.ruleMs };
      if (key === 'res') return { start: landStart + P.starsLagMs, duration: P.starsMs };
      // The numbers of the products travel into the sum: invisible at both ends, visible in between (opacity keyframes), moving
      // from the row's line to the total's. Their rest state is "at the sum", so state 4 is what the trip ends in.
      if (kind === 'cl') {
        return { start: P.gatherLagMs + i * P.cloneStaggerMs, duration: P.gatherMs, via: [
          { offset: 0.12, opacity: '1', transform: NONE },
          { offset: 0.8, opacity: '1', transform: `translateY(${dyOf(i)}px)`, easing: 'linear' }] };
      }
      // tl, sw, tot: they land when the travelling numbers arrive
      return { start: landStart, duration: P.landMs };
    };

    ctx.slot.append(root);
    const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
    steps[0].final();                                                          // the base DOM is the picture of state 0
    return { steps, destroy: () => root.remove() };
  },
});
