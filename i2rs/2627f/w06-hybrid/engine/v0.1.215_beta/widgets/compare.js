// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): compare, two things side by side; this first mode is the side-by-side lists (storyboard v0.1: s16 `mixed`).
// A user with a long history opens a home page that shows two lists next to each other: one from a content-based recommender ("similar to what
// you watched"), one from a collaborative one ("loved by people like you"). Nothing is merged: the user reads both. The generic cast: a user
// with a long history and a newly released film that only the content-based list can show. No numbers, no real film.
//   1 the two lists appear side by side, each under its own header (an icon and a name)
//   2 the new film joins the content-based list; the collaborative list has an empty place where it would be: it does not know the film yet
//   3 nothing is merged: a crossed-out funnel stands between the lists, the user (ringed) is the one who reads both
// WP-50: the mode `families` (bagging, boosting, stacking and their counterparts for rating matrices, four presses: compare-families.js) is the second; homogeneous vs heterogeneous was cancelled (D-112).
//
// Kit shape (engine/widgets/kit.js): defineWidget({id, steps, params, stepCount, examples, build}); states k = 0..3, k=0 shows the user only.
// duration(k) = planDuration(plan(k)); L = rows of the longer list (default 4):
//   k=1  400 + (L-1)*110 + 460 (the collaborative list starts 100 after the content-based one)
//   k=2  max(80 + 560, 420 + 520, 500 + 360)   k=3  80 + 460
// Default numbers: 1190 / 940 / 540 ms (measured: the browser reports the same).
//
// Motion: opacity and transform only. The ring and the crossed funnel are overlays whose opacity moves.
import { defineWidget } from './kit.js';
import { stepsFromFrames, h, fit } from './frames.js';
import { icon, poster } from './pictos.js';
import { familiesSchema, familiesBuild, familiesExamples, familiesProblems } from './compare-families.js';       // WP-50 (D-112): the mode `families`

const W = 1680, H = 600;
const USER = { x: 10, y: 40, w: 290, h: 172 };      // x 10: its ring (8 px outside the card) stays inside the slot
const FRAME = { x: 340, y: 0, w: 1340, h: 600 };
const LIST_W = 590, LIST_A = 360, LIST_B = 1090, HEAD_Y = 22, ROW0 = 118, PITCH = 84, ROW_H = 72;   // 140 px of air between the lists: the crossed funnel stands there
const MAX_ROWS = 4;

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });
const LABELS = {
  user: frag('Long history · many ratings', 'Uzun geçmiş · çok puan'),
  content: frag('Similar to what you watched', 'İzlediklerine benzeyenler'),
  collab: frag('Loved by people like you', 'Senin gibi izleyenlerin sevdikleri'),
  unknown: frag('not known yet', 'henüz bilinmiyor'),
};

/** The params' JSON Schema, inside the subset of engine/widgets/params.js (the registry carries the same one). */
export const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: { type: 'string', enum: ['lists', 'families'], default: 'lists', title: 'what is compared', description: 'lists: two recommenders\' lists side by side (three presses). families: the three families of ensembles, bagging, boosting and stacking, one schematic picture each, and their counterparts for rating matrices (four presses).' },
    families: familiesSchema,
    contentRows: { type: 'array', minItems: 1, maxItems: MAX_ROWS, items: { type: 'integer', minimum: 0, maximum: 9 }, default: [4, 8, 1, 6], title: 'the content-based list: one generic emblem per film (0..9)' },
    collabRows: { type: 'array', minItems: 1, maxItems: MAX_ROWS, items: { type: 'integer', minimum: 0, maximum: 9 }, default: [9, 2, 7, 3], title: 'the collaborative list: one generic emblem per film (0..9)' },
    newEmblem: { type: 'integer', minimum: 0, maximum: 9, default: 5, title: 'the emblem of the newly released film' },
    badge: { ...FRAGMENT, title: 'the tag on the new film', default: frag('NEW', 'YENİ'), description: 'Empty `en` shows no tag.' },
    labels: {
      type: 'object', additionalProperties: false, default: LABELS, title: 'the short labels of the pictures',
      properties: Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, fragSchema(v)])),
    },
  },
};

/** Number of presses: the lists mode takes three (the lists, the new film, nothing merged), the families mode four (bagging, boosting, stacking, the matrix). @param {{mode?: string}} [P] */
const presses = (P) => (P?.mode === 'families' ? 4 : 3);

export default defineWidget({
  id: 'compare',
  steps: 'lists mode, three presses: a long-history user\'s home page shows two lists side by side (content-based and collaborative); the newly released film appears only in the content-based list (the collaborative list has an empty place); nothing is merged, the user reads both. families mode, four presses (WP-50): bagging (three resamples of the data with replacement, each into a model, three synthetic predictions averaged), boosting (a chain of three models, the examples a model gets wrong ringed and grown for the next, a weighted vote), stacking (three base models, their predictions as columns, a second-level learner, one prediction), and the same ideas for rating matrices (resampled ratings, k of 2k neighbours, two random starts of a factorization); every picture is schematic.',
  params: schema,
  stepCount: presses,
  check: (params) => (params.mode === 'families' ? familiesProblems(params) : []),       // WP-50: the mode's own rules, pure
  examples: [{}, { contentRows: [4, 8], collabRows: [9, 2] }, ...familiesExamples],
  build(ctx, P) {
    if (P.mode === 'families') return familiesBuild(ctx, P);                      // WP-50: the families mode has its own picture (compare-families.js)
    const doc = ctx.slot.ownerDocument;
    const L = P.labels;
    /** @type {number[]} */ const rowsA = P.contentRows;
    /** @type {number[]} */ const rowsB = P.collabRows;
    const n = presses(P);

    const root = h(doc, 'div', 'w-root cp-root');
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

    // ---------- the user with a long history ----------
    const user = h(doc, 'div', 'sw-user', { 'aria-hidden': 'true' });
    user.style.cssText = box(USER.x, USER.y, USER.w, USER.h);
    const av = icon(doc, 'user', 60);
    av.style.cssText = 'position:absolute;left:14px;top:14px';
    user.append(av);
    for (let i = 0; i < 18; i++) {
      const p = poster(doc, i % 10, 32, 36, 16);
      p.style.cssText += `;position:absolute;left:${84 + (i % 6) * 34}px;top:${10 + Math.floor(i / 6) * 42}px;border-width:2px;border-radius:6px`;
      user.append(p);
    }
    const ulab = say(h(doc, 'div', 'sw-user-label'), L.user);
    user.append(ulab);
    root.append(user);
    put('ur', h(doc, 'div', 'sw-ring', { 'data-gfx': 'border', 'aria-hidden': 'true' }), box(USER.x - 8, USER.y - 8, USER.w + 16, USER.h + 16));

    // ---------- the home page: a frame with two lists ----------
    put('fr', h(doc, 'div', 'cp-frame', { 'aria-hidden': 'true' }), box(FRAME.x, FRAME.y, FRAME.w, FRAME.h));
    /** @param {string} key @param {number} x @param {string} ic @param {Record<string, string>} label */
    const head = (key, x, ic, label) => {
      const hd = h(doc, 'div', 'cp-head');
      hd.append(icon(doc, /** @type {any} */ (ic), 52), say(h(doc, 'span', ''), label));
      put(key, hd, box(x, HEAD_Y, LIST_W, 64));
    };
    head('ha', LIST_A, 'tag', L.content);
    head('hb', LIST_B, 'users', L.collab);
    /** One film of a list: a poster and two grey lines for its title. @param {string} key @param {number} x @param {number} row @param {number} emb */
    const film = (key, x, row, emb) => {
      const f = h(doc, 'div', 'cp-film', { 'aria-hidden': 'true' });
      const p = poster(doc, emb, 56, ROW_H, 28);
      p.style.cssText += ';position:absolute;left:0;top:0';
      f.append(p);
      const l1 = h(doc, 'i', 'cp-line'); l1.style.cssText = 'left:76px;top:16px;width:310px';
      const l2 = h(doc, 'i', 'cp-line soft'); l2.style.cssText = 'left:76px;top:42px;width:200px';
      f.append(l1, l2);
      return put(key, f, box(x, ROW0 + row * PITCH, LIST_W - 20, ROW_H));
    };
    rowsA.forEach((emb, i) => film(`a:${i + 1}`, LIST_A + 10, i + 1, emb));
    rowsB.forEach((emb, i) => film(`b:${i + 1}`, LIST_B + 10, i + 1, emb));
    // the newly released film joins the first place of the content-based list; the collaborative list has an empty place there
    // WP-50 (user's review of the second run): the blue ring comes BEFORE the film in the DOM, so the tag on the film's corner lies over the ring's border and reads whole (the film is a stacking context of its own, so no z-index could lift the tag over a ring that came after it)
    put('nr', h(doc, 'div', 'cp-newring', { 'data-gfx': 'border', 'aria-hidden': 'true' }), box(LIST_A + 10 - 8, ROW0 - 8, LIST_W - 4, ROW_H + 16));
    const nf = film('na', LIST_A + 10, 0, P.newEmblem);
    nf.classList.add('cp-new');
    if (P.badge.en) { const b = h(doc, 'div', 'th-badge cp-badge', { 'data-role': 'key' }); say(b, P.badge); nf.firstElementChild?.append(b); }
    const ghost = h(doc, 'div', 'cp-ghost', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    ghost.append(icon(doc, 'eyeoff', 40), say(h(doc, 'span', ''), L.unknown));
    put('gb', ghost, box(LIST_B + 10, ROW0, LIST_W - 20, ROW_H));

    // ---------- nothing is merged: a funnel crossed out between the lists ----------
    const mg = h(doc, 'div', 'cp-merge', { 'aria-hidden': 'true' });
    mg.append(icon(doc, 'funnel', 72));
    const slash = h(doc, 'i', 'cp-slash');
    mg.append(slash);
    put('mg', mg, box((LIST_A + LIST_W + LIST_B) / 2 - 36, 280, 72, 72));

    // ---------- frames and timing ----------
    const RISE = 'translateY(16px)', NONE = 'translateY(0px)';
    const on = (/** @type {boolean} */ b) => ({ opacity: b ? '1' : '0' });
    const shown = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
    const frame = (/** @type {number} */ k) => {
      /** @type {Map<string, Record<string, string>>} */
      const f = new Map();
      f.set('fr', on(k >= 1)); f.set('ha', shown(k >= 1)); f.set('hb', shown(k >= 1));
      rowsA.forEach((_, i) => f.set(`a:${i + 1}`, shown(k >= 1)));
      rowsB.forEach((_, i) => f.set(`b:${i + 1}`, shown(k >= 1)));
      f.set('na', shown(k >= 2)); f.set('nr', on(k === 2)); f.set('gb', shown(k >= 2));
      f.set('mg', on(k >= 3)); f.set('ur', on(k >= 3));
      return f;
    };
    /** @param {string} key @param {number} k */
    const timing = (key, k) => {
      const [kind, idx] = key.split(':');
      const i = Number(idx);
      if (key === 'fr') return { start: 0, duration: 380 };
      if (key === 'ha' || key === 'hb') return { start: key === 'ha' ? 120 : 220, duration: 420 };
      if (kind === 'a') return { start: 300 + (i - 1) * 110, duration: 460 };
      if (kind === 'b') return { start: 400 + (i - 1) * 110, duration: 460 };
      if (key === 'na') return { start: 80, duration: 560 };
      if (key === 'nr') return k === 2 ? { start: 500, duration: 360 } : { start: 0, duration: 300 };
      if (key === 'gb') return { start: 420, duration: 520 };
      return { start: 80, duration: 460 };                                  // mg, ur
    };

    ctx.slot.append(root);
    const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
    steps[0].final();
    return { steps, destroy: () => root.remove() };
  },
});
