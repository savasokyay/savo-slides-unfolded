// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): the switch mode of pipeline, told as a picture (storyboard v0.1: s11 `switching`).
// A switch at the entrance and two ways: content-based and collaborative. The generic cast: a NEW user (three ratings) and a user with a
// LONG history (hundreds of ratings). The rule of the switch is how many ratings there are; the rule can also come from a measurement.
//   1 the new user arrives (a token walks along the wire), the lever swings to the content-based way, the token goes through it
//   2 the long-history user arrives, the lever swings to the collaborative way
//   3 the bucket of models: the rule comes from a measurement, the model with the lowest HELD-OUT error is chosen (the left side is veiled)
//   4 wrong <-> right, both labelled: choosing the winner by TRAINING error (every model saw those ratings) <-> by held-out error
//     (the held-out panel slides right, the training panel arrives on its left; the verdicts come after the evidence)
// The errors are SYNTHETIC; the speaker note and the evidence record say so, the picture carries no label (D-129). Hand-checkable: the lowest training error is model C (0.38), the lowest held-out
// error is model B (0.86), so the two rules pick different models: that is what the pair shows.
//
// WP-50 (user's review of the second run): a token (the round figure that walks through the switch) is not there before its press: it appears at the wire's start, beside the user's card, when its walk begins,
// so no two figures lie on top of each other while nothing moves; it stays at its way afterwards as the record of where that user went.
//
// duration(k) = planDuration(plan(k)), measured: the browser reports the same (see the page).
// Motion: transform (the token walks along its waypoints, the lever rotates, panels slide and bars grow), opacity, strokeDashoffset (the chosen
// way is drawn over the grey one). No colour keyframe: rings, veils and the verdict marks are overlays whose opacity moves.
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon, poster, starRow, mark } from './pictos.js';

const W = 1680, H = 600;
const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });

const LABELS = {
  newUser: frag('New user · 3 ratings', 'Yeni kullanıcı · 3 puan'), longUser: frag('Long history · many ratings', 'Uzun geçmiş · çok puan'),
  contentBox: frag('Content-based', 'İçerik tabanlı'), collabBox: frag('Collaborative', 'İşbirlikçi'),
  few: frag('few ratings', 'az puan'), many: frag('many ratings', 'çok puan'), rule: frag('example rule: how many ratings?', 'örnek kural: kaç puan var?'),
  bucket: frag('Bucket of models', 'Model kovası'), heldErr: frag('held-out error', 'ayrı tutulan hata'), trainErr: frag('training error', 'eğitim hatası'),
  wrong: frag('Wrong: pick by training error', 'Yanlış: eğitim hatasıyla seç'), right: frag('Right: pick by held-out error', 'Doğru: ayrı tutulan hatayla seç'),
};

/** The schema of the `switch` param group, merged into pipeline's schema (the registry carries the whole). */
export const switchSchema = {
  type: 'object', additionalProperties: false, title: 'the switch mode (mode switch)',
  default: {
    models: [{ id: 'A', train: 0.62, held: 0.93 }, { id: 'B', train: 0.71, held: 0.86 }, { id: 'C', train: 0.38, held: 1.02 }, { id: 'D', train: 0.78, held: 0.91 }],
    labels: LABELS,
  },
  properties: {
    models: {
      type: 'array', minItems: 3, maxItems: 4, title: 'the bucket of models and their errors (synthetic)',
      description: 'Each {id, train, held}: the error on the ratings the model was fitted on, and on held-out ratings (0..1.2, lower is better). The lowest training error and the lowest held-out error must belong to different models: that is the pair the last press shows.',
      items: { type: 'object', required: ['id', 'train', 'held'], additionalProperties: false, properties: { id: { type: 'string', minLength: 1, maxLength: 2 }, train: { type: 'number', minimum: 0, maximum: 1.2 }, held: { type: 'number', minimum: 0, maximum: 1.2 } } },
      default: [{ id: 'A', train: 0.62, held: 0.93 }, { id: 'B', train: 0.71, held: 0.86 }, { id: 'C', train: 0.38, held: 1.02 }, { id: 'D', train: 0.78, held: 0.91 }],
    },
    labels: {
      type: 'object', additionalProperties: false, default: LABELS, title: 'the short labels of the pictures',
      properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, fragSchema(v)])),
    },
  },
};

/** Switch-mode examples: the default, and a bucket of three models. */
export const switchExamples = [
  { mode: 'switch' },
  { mode: 'switch', switch: { models: [{ id: 'X', train: 0.3, held: 0.9 }, { id: 'Y', train: 0.6, held: 0.7 }, { id: 'Z', train: 0.5, held: 0.8 }] } },
];

// Geometry of the left half (the switch) and the right half (the bucket and the pair of panels), design pixels.
const NEW_USER = { x: 0, y: 40, w: 290, h: 150 }, LONG_USER = { x: 0, y: 392, w: 290, h: 172 };
const INPUT = { x: 330, y: 300 }, PIVOT = { x: 400, y: 300 }, LEVER = 118, ANGLE = 26;
const TIP = { up: { x: PIVOT.x + LEVER * Math.cos((ANGLE * Math.PI) / 180), y: PIVOT.y - LEVER * Math.sin((ANGLE * Math.PI) / 180) } };
const TIP_DOWN = { x: TIP.up.x, y: PIVOT.y + (PIVOT.y - TIP.up.y) };
const BOX1 = { x: 640, y: 96, w: 180, h: 130 }, BOX2 = { x: 640, y: 374, w: 180, h: 130 };
const PANEL = { x: 860, y: 60, w: 380, h: 430, shift: 410 };
const WALK_AT = 640;                                             // WP-50: when a token appears: the lever (520 .. 1000) has begun, and the token reaches the pivot (about 650 ms later) once it has settled
const ERR_PX = 200;                                            // bar length for an error of 1.0 (1.2, the largest, plus its number stays inside the panel)

/**
 * @param {import('../../../engine/widgets/kit.js').WidgetContext} ctx
 * @param {Record<string, any>} P the resolved params of pipeline
 */
export function switchBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const S = P.switch;
  const L = S.labels;
  /** @type {Array<{id: string, train: number, held: number}>} */
  const models = S.models;
  const argmin = (/** @type {'train'|'held'} */ key) => models.reduce((b, m, i) => (m[key] < models[b][key] ? i : b), 0);
  const wrongIdx = argmin('train'), rightIdx = argmin('held');
  if (wrongIdx === rightIdx) throw new Error('pipeline switch: the lowest training error and the lowest held-out error belong to the same model, so the pair shows nothing');
  const n = 4;

  const root = h(doc, 'div', 'w-root sw-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** @param {string} key @param {Element} el @param {string} css @param {Element} [parent] */
  const put = (key, el, css, parent) => {
    /** @type {HTMLElement} */ (el).style.cssText += `;${css}`;
    el.setAttribute('data-key', key);
    els.set(key, el);
    (parent ?? root).append(el);
    return el;
  };
  /** @param {HTMLElement} e @param {Record<string, string>} text */
  const say = (e, text) => { ctx.setText(e, text); return e; };

  // ---------- the wires and the ways (SVG): grey always, the chosen way drawn over it in the emphasis colour ----------
  const svg = s(doc, 'svg', { class: 'sw-wires', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const wire = (/** @type {string} */ d, /** @type {string} */ cls, /** @type {string} */ key) => {
    const p = s(doc, 'path', { class: cls, d, pathLength: '1', ...(key ? { 'data-key': key } : {}), 'data-gfx': 'stroke' });
    svg.append(p);
    if (key) els.set(key, p);
    return p;
  };
  const yNew = NEW_USER.y + 44, yLong = LONG_USER.y + 44;
  wire(`M${NEW_USER.w} ${yNew}H${INPUT.x}V${INPUT.y}`, 'sw-wire plain', '');
  wire(`M${LONG_USER.w} ${yLong}H${INPUT.x}V${INPUT.y}`, 'sw-wire plain', '');
  wire(`M${INPUT.x} ${INPUT.y}H${PIVOT.x}`, 'sw-wire plain', '');
  const upper = `M${TIP.up.x} ${TIP.up.y}H580V${BOX1.y + BOX1.h / 2}H${BOX1.x}`;
  const lower = `M${TIP_DOWN.x} ${TIP_DOWN.y}H580V${BOX2.y + BOX2.h / 2}H${BOX2.x}`;
  wire(upper, 'sw-wire plain', '');
  wire(lower, 'sw-wire plain', '');
  wire(upper, 'sw-wire pick', 'pa:1');
  wire(lower, 'sw-wire pick', 'pa:2');
  root.append(svg);

  // ---------- the users: a new user with three ratings, a user with a long history ----------
  const userCard = (/** @type {typeof NEW_USER} */ g, /** @type {Record<string, string>} */ label, /** @type {number} */ nPosters) => {
    const card = h(doc, 'div', 'sw-user', { 'aria-hidden': 'true' });
    card.style.cssText = box(g.x, g.y, g.w, g.h);
    const av = icon(doc, 'user', 60);
    av.style.cssText = 'position:absolute;left:14px;top:14px';
    card.append(av);
    if (nPosters === 3) {
      [5, 4, 2].forEach((r, i) => {
        const p = poster(doc, [4, 8, 1][i], 54, 62, 26);
        p.style.cssText += `;position:absolute;left:${88 + i * 66}px;top:14px`;
        const st = starRow(doc, r, 12, 1);
        st.style.cssText += ';position:absolute;left:-3px;top:68px';
        p.append(st);
        card.append(p);
      });
    } else {
      for (let i = 0; i < 18; i++) {                          // a stack of many small posters: hundreds, drawn as a crowd
        const p = poster(doc, i % 10, 32, 36, 16);
        p.style.cssText += `;position:absolute;left:${84 + (i % 6) * 34}px;top:${10 + Math.floor(i / 6) * 42}px;border-width:2px;border-radius:6px`;
        card.append(p);
      }
    }
    const lab = h(doc, 'div', 'sw-user-label');
    say(lab, label);
    card.append(lab);
    root.append(card);
    return card;
  };
  userCard(NEW_USER, L.newUser, 3);
  userCard(LONG_USER, L.longUser, 18);

  // ---------- the switch: a base, a lever that swings, the rule ----------
  const base = h(doc, 'div', 'sw-pivot', { 'aria-hidden': 'true' });
  base.style.cssText = box(PIVOT.x - 14, PIVOT.y - 14, 28, 28);
  root.append(base);
  put('lv', h(doc, 'div', 'sw-lever', { 'aria-hidden': 'true' }), `left:${PIVOT.x}px;top:${PIVOT.y - 5}px;width:${LEVER}px;height:10px;transform-origin:0 50%`);
  const rule = say(h(doc, 'div', 'sw-rule'), L.rule);
  rule.style.cssText = box(PIVOT.x - 60, PIVOT.y + 62, 230, 60);
  root.append(rule);
  // which way takes what: named at the way's box (above the content-based one, under the collaborative one)
  const few = say(h(doc, 'div', 'sw-way-label'), L.few);
  few.style.cssText = box(BOX1.x, BOX1.y - 38, BOX1.w, 30);
  const many = say(h(doc, 'div', 'sw-way-label'), L.many);
  many.style.cssText = box(BOX2.x, BOX2.y + BOX2.h + 8, BOX2.w, 30);
  root.append(few, many);

  // ---------- the two ways: content-based and collaborative recommenders ----------
  /** @param {string} key @param {typeof BOX1} g @param {string} ic @param {Record<string, string>} label */
  const way = (key, g, ic, label) => {
    const b = h(doc, 'div', 'sw-box', { 'aria-hidden': 'true' });
    b.style.cssText = box(g.x, g.y, g.w, g.h);
    b.append(icon(doc, /** @type {any} */ (ic), 56), say(h(doc, 'span', ''), label));
    root.append(b);
    put(key, h(doc, 'div', 'sw-ring', { 'data-gfx': 'border', 'aria-hidden': 'true' }), box(g.x - 8, g.y - 8, g.w + 16, g.h + 16));
  };
  way('bx:1', BOX1, 'tag', L.contentBox);
  way('bx:2', BOX2, 'users', L.collabBox);

  // ---------- the tokens that walk: the user who arrives is carried along the wire, through the switch, into the chosen way ----------
  /** The waypoints (centres) a token passes: its card, along the wire to the input, the pivot, the lever's tip, the way, the recommender's box. @param {number} y0 @param {{x: number, y: number}} tip @param {typeof BOX1} g */
  // WP-50: a token starts where the wire leaves the user's card (x = card edge + 18), not on the user's own figure: it appears there when its walk begins, so no two figures lie on top of each other
  const route = (y0, tip, g) => [[NEW_USER.w + 18, y0], [INPUT.x, y0], [INPUT.x, INPUT.y], [PIVOT.x, PIVOT.y], [tip.x, tip.y], [580, tip.y], [580, g.y + g.h / 2], [g.x - 32, g.y + g.h / 2]];          // and rests on the wire just before the way's box, not on its border
  const routes = { 1: route(yNew, TIP.up, BOX1), 2: route(yLong, TIP_DOWN, BOX2) };
  /** @param {number[][]} r @param {number} i */
  const at = (r, i) => `translate(${r[i][0] - r[0][0]}px, ${r[i][1] - r[0][1]}px)`;
  for (const key of /** @type {const} */ ([1, 2])) {
    const r = routes[key];
    const tk = icon(doc, 'user', 44);
    tk.classList.add('sw-token');
    put(`tk:${key}`, /** @type {any} */ (tk), `left:${r[0][0] - 22}px;top:${r[0][1] - 22}px`);
  }

  // ---------- the veil over the switch, the bucket of models, the pair of panels ----------
  put('vl', h(doc, 'div', 'sw-veil', { 'aria-hidden': 'true' }), box(0, 0, 840, H));
  /** One panel: a header, a row per model (the model's letter, its error as a bar, the number), the ring on the model that wins. */
  const panel = (/** @type {string} */ key, /** @type {Record<string, string>} */ head, /** @type {'train'|'held'} */ which, /** @type {number} */ winner, /** @type {'neg'|'emph'} */ ringRole, /** @type {boolean} */ withBucketIcon) => {
    const p = h(doc, 'div', 'sw-panel');
    p.style.cssText = box(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    const hd = h(doc, 'div', 'sw-panel-head');
    if (withBucketIcon) hd.append(icon(doc, 'bucket', 44));
    hd.append(say(h(doc, 'span', ''), head));
    p.append(hd);
    models.forEach((m, i) => {
      const y = 84 + i * 84;
      const letter = h(doc, 'div', 'sw-model');
      letter.style.cssText = box(16, y, 52, 52);
      letter.textContent = m.id;
      p.append(letter);
      const bar = h(doc, 'div', 'sw-err', { 'data-gfx': 'fill' });
      const len = Math.max(4, Math.round(m[which] * ERR_PX));
      put(`${key}b:${i}`, bar, `${box(84, y + 12, len, 28)};transform-origin:0 50%`, p);
      const num = h(doc, 'div', 'sw-errnum');
      num.style.cssText = `left:${84 + len + 10}px;top:${y + 8}px`;
      ctx.setText(num, { en: m[which].toFixed(2), tr: m[which].toFixed(2).replace('.', ',') });
      put(`${key}n:${i}`, num, '', p);
    });
    const ring = h(doc, 'div', `sw-wring ${ringRole}`, { 'data-gfx': 'border', 'aria-hidden': 'true' });
    put(`${key}r`, ring, box(8, 84 + winner * 84 - 8, PANEL.w - 16, 68), p);
    put(key, p, '');
    return p;
  };
  panel('hp', L.heldErr, 'held', rightIdx, 'emph', true);
  panel('tp', L.trainErr, 'train', wrongIdx, 'neg', false);
  /** The verdict under a panel, after the evidence. @param {string} key @param {Record<string, string>} text @param {'check'|'cross'} kind @param {number} x */
  const verdict = (key, text, kind, x) => {
    const v = h(doc, 'div', 'sw-verdict', { 'data-role': kind === 'check' ? 'pos' : 'neg' });
    v.append(mark(doc, kind, 36), say(h(doc, 'span', ''), text));
    put(key, v, box(x, PANEL.y + PANEL.h + 14, PANEL.w, 70));
  };
  verdict('vd:w', L.wrong, 'cross', PANEL.x);
  verdict('vd:r', L.right, 'check', PANEL.x + PANEL.shift);

  // ---------- frames and timing ----------
  const NONE = 'translateY(0px)', RISE = 'translateY(14px)';
  const on = (/** @type {boolean} */ b) => ({ opacity: b ? '1' : '0' });
  const shown = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
  const grown = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: 'scaleX(1)' } : { opacity: '0', transform: 'scaleX(0)' });
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    // WP-50: a token is not there before its press (nothing waits on the cards); it stays at its way afterwards as the record of where that user went
    f.set('tk:1', { opacity: k >= 1 ? '1' : '0', transform: k >= 1 ? at(routes[1], routes[1].length - 1) : 'translate(0px, 0px)' });
    f.set('tk:2', { opacity: k >= 2 ? '1' : '0', transform: k >= 2 ? at(routes[2], routes[2].length - 1) : 'translate(0px, 0px)' });
    f.set('lv', { transform: `rotate(${k === 0 ? 0 : k === 1 ? -ANGLE : ANGLE}deg)` });
    // the way the CURRENT user takes is drawn; the tokens and rings stay as the record of where each user went
    f.set('pa:1', { strokeDashoffset: k === 1 ? '0' : '1.02' }); f.set('pa:2', { strokeDashoffset: k === 2 ? '0' : '1.02' });
    f.set('bx:1', on(k >= 1)); f.set('bx:2', on(k >= 2));
    f.set('vl', { opacity: k >= 3 ? '0.64' : '0' });
    f.set('hp', k >= 4 ? { opacity: '1', transform: `translateX(${PANEL.shift}px)` } : k === 3 ? { opacity: '1', transform: 'translateX(0px)' } : { opacity: '0', transform: 'translateX(0px)' });
    f.set('tp', k >= 4 ? { opacity: '1', transform: 'translateX(0px)' } : { opacity: '0', transform: 'translateX(-24px)' });
    for (let i = 0; i < models.length; i++) {
      f.set(`hpb:${i}`, grown(k >= 3)); f.set(`hpn:${i}`, on(k >= 3));
      f.set(`tpb:${i}`, grown(k >= 4)); f.set(`tpn:${i}`, on(k >= 4));
    }
    f.set('hpr', on(k >= 3)); f.set('tpr', on(k >= 4));
    f.set('vd:w', shown(k >= 4)); f.set('vd:r', shown(k >= 4));
    return f;
  };
  /** The walk of a token: the same length of path per millisecond whichever user it is. @param {1|2} key */
  const walk = (key) => {
    const r = routes[key];
    const lens = r.slice(1).map((p, i) => Math.hypot(p[0] - r[i][0], p[1] - r[i][1]));
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    /** @type {Array<Record<string, string> & {offset: number, easing: string}>} */
    const via = [{ offset: 0.02, opacity: '1', easing: 'linear' }];                    // WP-50: the figure appears as it starts to move (opacity only: the transform runs on between its neighbours)
    for (let i = 1; i < r.length - 1; i++) { acc += lens[i - 1]; via.push({ offset: acc / total, transform: at(r, i), easing: 'linear' }); }
    return { start: WALK_AT, duration: Math.round(total * 2.1), via, firstEasing: 'linear' };
  };
  /** @param {string} key @param {number} k */
  const timing = (key, k) => {
    const [kind, idx] = key.split(':');
    const i = Number(idx);
    if (kind === 'tk') return walk(/** @type {1|2} */ (i));
    if (key === 'lv') return { start: 520, duration: 480 };
    if (kind === 'pa') return i === k ? { start: 1100, duration: 700 } : { start: 0, duration: 360 };      // drawn when its user passes, taken back when the next one arrives
    if (kind === 'bx') return { start: 1700, duration: 380 };
    if (key === 'vl') return { start: 0, duration: 420 };
    if (key === 'hp') return k === 3 ? { start: 160, duration: 520 } : { start: 0, duration: 620 };
    if (key === 'tp') return { start: 300, duration: 520 };
    if (kind === 'hpb') return { start: 700 + i * 110, duration: 520 };
    if (kind === 'hpn') return { start: 700 + i * 110 + 260, duration: 300 };
    if (kind === 'tpb') return { start: 800 + i * 110, duration: 520 };
    if (kind === 'tpn') return { start: 800 + i * 110 + 260, duration: 300 };
    if (key === 'hpr') return { start: 700 + models.length * 110 + 300, duration: 360 };
    if (key === 'tpr') return { start: 800 + models.length * 110 + 300, duration: 360 };
    if (key === 'vd:w') return { start: 800 + models.length * 110 + 800, duration: 420 };
    return { start: 800 + models.length * 110 + 1200, duration: 420 };                  // vd:r
  };

  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();
  return { steps, destroy: () => root.remove() };
}
