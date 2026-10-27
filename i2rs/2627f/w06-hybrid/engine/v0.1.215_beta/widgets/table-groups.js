// @ts-check
// WP-50 (D-112, brief 07; page s15 `feature-combination` of the I2RS w06 deck): the mode `groups` of table-highlight, a support module like table-pseudo.js. Feature combination (Burke 2002, pp. 341-342): the
// inputs of ONE model come in groups, and the model reads all of them together; so a film with few ratings is not lost, because its content can say what its id alone cannot (Basu et al. 1998; Cheng et al. 2016).
// The groups are the three of the lab's naming (evidence record `ev-lab-input-groups`): ids, film content, user profile. Nothing numeric is drawn except the count of the few ratings, which is an example (SYNTHETIC; the speaker note and the evidence record say so, the picture carries no label: D-129).
//   0 the frame             nothing yet
//   1 groups                the three boxes of the inputs pop in, one after the other
//   2 one-model             one box for the model; the three arrows (each drawn from its group) meet in it, then the arrow to the predicted rating and its box
//   3 few-ratings           a film card arrives, rated by only 2 users (synthetic), an arrow to its id: the box of the ids dims (a weak signal) while the box of the film content and its arrow light up in the emphasis blue
//   4 key                   the three arrows are washed in the gold band token together: one model can use identity, content and profile together
// Meaning never rests on colour alone (D-068): a weak group is DIMMED (and its arrow with it), the strong one is ringed (a shape) as well as blue; the gold wash is the key press (D-009: gold = must know).
//
// duration(k) = planDuration(plan(k)); box pop 300, arrow draw 380 (a short one 300, to the output 320):
//   1 groups       the boxes at 0, 160, 320                                                                                                             -> 620 ms
//   2 one-model    the model 0 + 300, its arrows at 200, 300, 400 (+ 380), the arrow to the output 700 + 320, the output 880 + 300                          -> 1180 ms
//   3 few-ratings  the card 0 + 380, its arrow 300 + 300, the dimming 200 + 400, the ring 500 + 380 and the lit arrow 500 + 420                        -> 920 ms
//   4 key          the dimmed group returns 0 + 400, the lit ring and arrow fade 0 + 380, the wash 0 + 700                                              -> 700 ms
// Motion: opacity and transform (a box pops or dims), strokeDashoffset (an arrow is drawn). No colour keyframes; the light is an overlay whose opacity moves.
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon, poster } from './pictos.js';
import { inherit } from './chart-vote.js';
import { fill } from './chart-milestones.js';

const W = 1680, H = 600;
const BOX = { x: 330, w: 330, h: 120, y: { ids: 40, content: 240, profile: 440 } };
const MODEL = { x: 900, y: 205, w: 280, h: 190 };
const OUT = { x: 1340, y: 235, w: 300, h: 130 };
const FILM = { x: 0, y: 36, w: 250, h: 136 };
const ORDER = /** @type {const} */ (['ids', 'content', 'profile']);
const ICON = /** @type {const} */ ({ ids: 'matrix', content: 'attributes', profile: 'user' });

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const LABELS = {
  ids: frag('Ids', 'Kimlikler'), content: frag('Film content', 'Film içeriği'), profile: frag('User profile', 'Kullanıcı profili'),
  model: frag('One model', 'Tek model'), out: frag('Predicted rating', 'Tahmin edilen puan'), film: frag('{n} ratings', '{n} puan'),
};
const GROUPS = { labels: LABELS, filmRatings: 2 };

/** The params of the mode `groups`, merged into table-highlight's schema (the registry carries the whole). */
export const groupsSchema = {
  type: 'object', additionalProperties: false, title: 'the groups mode (mode groups)', default: GROUPS,
  description: '`labels` name the three groups of inputs, the model, its output and the film card (`{n}` is replaced by `filmRatings`, how many ratings the few-ratings film has: an example, the card carries no label, D-129).',
  properties: inherit({
    labels: { type: 'object', additionalProperties: false, default: LABELS, properties: inherit(Object.fromEntries(Object.keys(LABELS).map((k) => [k, FRAGMENT])), LABELS) },
    filmRatings: { type: 'integer', minimum: 2, maximum: 5 },
  }, GROUPS),
};
/** The example of the mode: the lecture's page. */
export const groupsExamples = [{ mode: 'groups' }];

/**
 * What the picture needs of the params and the schema subset cannot say, with paths (empty: fine). Pure.
 * @param {any} P the params with the schema's defaults filled in @returns {Array<{path: string, detail: string}>}
 */
export function groupsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const G = P.groups;
  for (const [name, text] of Object.entries(G.labels)) if (!String(/** @type {any} */ (text).en ?? '').trim()) out.push({ path: `$.groups.labels.${name}`, detail: 'has no English text: a box must say what it is' });
  if (!String(G.labels.film.en ?? '').includes('{n}')) out.push({ path: '$.groups.labels.film', detail: 'does not hold {n}: the card must say how many ratings the film has' });
  return out;
}

/**
 * The picture of the mode `groups`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function groupsBuild(ctx, P) {
  const doc = ctx.slot.ownerDocument;
  const G = P.groups, L = G.labels;
  const n = 4;
  const root = h(doc, 'div', 'w-root gx-root');
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  /** @type {Map<string, {start: number, duration: number}>} */
  const when = new Map();
  /** @type {Map<string, number>} the press each keyed element belongs to */
  const press = new Map();
  /** @type {Map<string, (k: number) => Record<string, string>>} the frame of each key */
  const frameOf = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** Register a keyed element with the press it comes in and its [start, duration]. @param {string} key @param {Element} el @param {number} k @param {[number, number]} t @param {string} css @param {Element} [parent] */
  const put = (key, el, k, t, css, parent) => { if (css) /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); press.set(key, k); when.set(key, { start: t[0], duration: t[1] }); (parent ?? root).append(el); return el; };
  /** @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  const arrowD = (/** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ x2, /** @type {number} */ y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), p = (/** @type {number} */ d) => `${+(x2 - 15 * Math.cos(a + d)).toFixed(1)} ${+(y2 - 15 * Math.sin(a + d)).toFixed(1)}`;
    return `M${x1} ${y1}L${x2} ${y2}L${p(0.5)}L${x2} ${y2}L${p(-0.5)}`;       // one subpath: the head is drawn when the line has reached it
  };
  const POP = (/** @type {boolean} */ on, /** @type {number} */ o = 1) => (on ? { opacity: String(o), transform: 'scale(1)' } : { opacity: '0', transform: 'scale(0.7)' });

  // the wash of the key press lies behind everything (the three arrows between the boxes and the model)
  const wash = h(doc, 'div', 'gx-wash', { 'aria-hidden': 'true' });
  put('wash', wash, 4, [0, 700], box(BOX.x + BOX.w + 4, 48, MODEL.x - (BOX.x + BOX.w) - 8, 504));
  frameOf.set('wash', (k) => ({ opacity: k === 4 ? '1' : '0' }));
  const svg = s(doc, 'svg', { class: 'cv-svg', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  root.append(svg);
  /** An arrow of the picture, drawn by dash offset. @param {string} key @param {number} k @param {[number, number]} t @param {string} d @param {string} [cls] */
  const arrow = (key, k, t, d, cls = 'gx-arrow') => put(key, s(doc, 'path', { class: cls, d, pathLength: '1', 'data-gfx': 'stroke' }), k, t, '', svg);

  // ---------- press 1: the three groups of inputs ----------
  ORDER.forEach((name, i) => {
    const b = h(doc, 'div', 'gx-box', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    b.append(icon(doc, ICON[name], 52), say(h(doc, 'span', ''), L[name]));
    put(`g:${name}`, b, 1, [i * 160, 300], box(BOX.x, BOX.y[name], BOX.w, BOX.h));
    frameOf.set(`g:${name}`, (k) => POP(k >= 1, name === 'ids' && k === 3 ? 0.4 : 1));        // the box of the ids dims while the film has few ratings
  });

  // ---------- press 2: one model; the three arrows meet in it, then the predicted rating ----------
  const mid = MODEL.y + MODEL.h / 2;
  const model = h(doc, 'div', 'gx-box gx-model', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  model.append(icon(doc, 'sliders', 64), say(h(doc, 'span', ''), L.model));
  put('m', model, 2, [0, 300], box(MODEL.x, MODEL.y, MODEL.w, MODEL.h));
  frameOf.set('m', (k) => POP(k >= 2));
  /** @type {Record<string, number>} where each arrow meets the model's edge */
  const meet = { ids: mid - 38, content: mid, profile: mid + 38 };
  ORDER.forEach((name, i) => {
    arrow(`a:${name}`, 2, [200 + i * 100, 380], arrowD(BOX.x + BOX.w + 6, BOX.y[name] + BOX.h / 2, MODEL.x - 8, meet[name]));
    frameOf.set(`a:${name}`, (k) => ({ opacity: name === 'ids' && k === 3 ? '0.4' : '1', strokeDashoffset: k >= 2 ? '0' : '1.02' }));
  });
  arrow('a:out', 2, [700, 320], arrowD(MODEL.x + MODEL.w + 6, mid, OUT.x - 8, mid));
  frameOf.set('a:out', (k) => ({ opacity: '1', strokeDashoffset: k >= 2 ? '0' : '1.02' }));
  const out = h(doc, 'div', 'gx-box gx-out', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  out.append(icon(doc, 'target', 48), say(h(doc, 'span', ''), L.out));
  put('o', out, 2, [880, 300], box(OUT.x, OUT.y, OUT.w, OUT.h));
  frameOf.set('o', (k) => POP(k >= 2));

  // ---------- press 3: a film with few ratings; the ids say little, the content more ----------
  const card = h(doc, 'div', 'gx-film', { 'aria-hidden': 'true' });
  const pz = poster(doc, P.emblem, 70, 84, 38);
  pz.style.cssText += ';position:absolute;left:16px;top:20px';
  card.append(pz);
  const users = h(doc, 'div', 'gx-raters');
  for (let i = 0; i < G.filmRatings; i++) users.append(icon(doc, 'user', 30));
  card.append(users, say(h(doc, 'div', 'gx-count'), fill(L.film, { n: () => String(G.filmRatings) })));
  put('film', card, 3, [0, 380], box(FILM.x, FILM.y, FILM.w, FILM.h));
  frameOf.set('film', (k) => (k >= 3 ? { opacity: '1', transform: 'translateY(0px)' } : { opacity: '0', transform: 'translateY(14px)' }));
  arrow('fa', 3, [300, 300], arrowD(FILM.x + FILM.w + 4, FILM.y + 70, BOX.x - 8, BOX.y.ids + BOX.h / 2 - 8));
  frameOf.set('fa', (k) => ({ opacity: '1', strokeDashoffset: k >= 3 ? '0' : '1.02' }));
  // the light on the film content: a ring round its box and its arrow drawn again in the emphasis blue (an overlay whose opacity moves; it goes out in the key press)
  put('cr', h(doc, 'div', 'gx-ring', { 'aria-hidden': 'true', 'data-gfx': 'border' }), 3, [500, 380], box(BOX.x - 8, BOX.y.content - 8, BOX.w + 16, BOX.h + 16));
  frameOf.set('cr', (k) => ({ opacity: k === 3 ? '1' : '0' }));
  arrow('ag', 3, [500, 420], arrowD(BOX.x + BOX.w + 6, BOX.y.content + BOX.h / 2, MODEL.x - 8, meet.content), 'gx-arrow gx-lit');
  frameOf.set('ag', (k) => ({ opacity: k === 3 ? '1' : '0', strokeDashoffset: k >= 3 ? '0' : '1.02' }));

  // ---------- frames and timing ----------
  /** The press-4 timings of the keys that change there (everything else keeps its own). @type {Record<string, [number, number]>} */
  const BACK = { 'g:ids': [0, 400], 'a:ids': [0, 400], cr: [0, 380], ag: [0, 380] };
  const frame = (/** @type {number} */ k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    for (const [key, fn] of frameOf) f.set(key, fn(k));
    return f;
  };
  const timing = (/** @type {string} */ key, /** @type {number} */ k) => {
    if (k === 4 && BACK[key]) return { start: BACK[key][0], duration: BACK[key][1] };
    if (k === 3 && (key === 'g:ids' || key === 'a:ids')) return { start: 200, duration: 400 };                  // the dimming of the ids
    return /** @type {{start: number, duration: number}} */ (when.get(key));
  };
  ctx.slot.append(root);
  const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => root.remove() };
}
