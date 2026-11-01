// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2 item 5; the page `why-evaluate` of the I2RS w07 deck, storyboard §3): the mode `why` of compare. Why evaluate at all: a right prediction is not a good recommendation. One shopper's history
// and two alternative lists, told as a picture (Herlocker et al. 2004, p. 14 and 42: a supermarket recommender that suggests bananas, bread, milk and eggs is right but useless; the use is in the new product the shopper does not know and
// would like). The instructor's milk-and-cheese scenario is the general form of this example. The picture is plainly illustrative (no numbers, no label, D-129).
//
// State 0 is the shopper (a person, the basket the shopper buys every week: banana, bread, milk, eggs). Four presses:
//   1 list A      the four items of the basket come back as list A: every item is a hit (a tick on each), but the shopper would buy them anyway
//   2 list B      one product the shopper has never tried (cheese), in a dashed frame with a "?": it may miss; if it hits, the recommendation really helped
//   3 two questions  the two questions come apart: where do we test (a live system or a lab) and what do we measure (prediction success or benefit), each as two chips and a double arrow
//   4 the gold    "a right prediction is not a good recommendation" (the key colour is bold ink, D-074)
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same). With a basket of four: 1080 / 980 / 680 / 480 ms.
//   1  max(the panel 100 + u, the cards 200 + (n - 1) * 100 + u, the ticks 400 + (n - 1) * 100 + u, the note 700 + u)   2  max(the panel 100 + u, the card 200 + u, the question mark 400 + u, the note 600 + u)
//   3  max(the first question 100 + u, the second 300 + u)   4  100 + u
//
// Motion: opacity and transform (a rise, scale pops). Nothing else.
import { h, s } from './frames.js';
import { icon } from './pictos.js';
import { item, ITEM_NAMES } from './w07-items.js';
import { U, finish, frag, labelsSchema, pop, pressDuration, rise, scene } from './w07-common.js';

const LABELS = {
  week: frag('every week, the same basket', 'her hafta aynı sepet'),
  banana: frag('banana', 'muz'), bread: frag('bread', 'ekmek'), milk: frag('milk', 'süt'), eggs: frag('eggs', 'yumurta'), cheese: frag('cheese', 'peynir'),
  listA: frag('list A', 'liste A'), noteA: frag('every item is a hit, but the shopper would buy them anyway', 'hepsi isabet, ama zaten alacaktı'),   // D-160: no gendered pronoun (613.6 of the note's 652 px, measured)
  listB: frag('list B', 'liste B'), noteB: frag('never tried: it may miss, but a hit really helps', 'hiç denenmemiş: tutmayabilir, tutarsa gerçekten işe yarar'),
  where: frag('where do we test?', 'nerede deneriz?'), live: frag('live system', 'canlı sistem'), lab: frag('lab', 'laboratuvar'),
  what: frag('what do we measure?', 'neyi ölçeriz?'), hit: frag('prediction success', 'tahmin başarısı'), benefit: frag('benefit', 'yarar'),
  gold: frag('a right prediction is not a good recommendation', 'doğru tahmin ile iyi öneri aynı şey değildir'),
};
const BASKET = ['banana', 'bread', 'milk', 'eggs'];

/** The params of the mode `why`, merged into compare's schema (the registry carries the whole). */
export const whySchema = {
  type: 'object', additionalProperties: false, title: 'the why-evaluate mode (mode why)',
  description: '`basket` are the items the shopper buys every week and list A recommends (2 to 4 of banana, bread, milk, eggs, cheese); `fresh` is the one product the shopper has never tried and list B recommends (not in the basket). The picture has no numbers.',
  default: { basket: BASKET, fresh: 'cheese', labels: LABELS },
  properties: {
    basket: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', enum: [...ITEM_NAMES] }, default: BASKET },
    fresh: { type: 'string', enum: [...ITEM_NAMES], default: 'cheese' },
    labels: labelsSchema(LABELS, 'Item names are the labels `banana`, `bread`, `milk`, `eggs` and `cheese`.'),
  },
};
export const whyExamples = [{ mode: 'why' }, { mode: 'why', why: { basket: ['milk', 'bread'], fresh: 'banana' } }];
export const whyPresses = 4;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function whyProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const Q = P.why;
  if (new Set(Q.basket).size !== Q.basket.length) out.push({ path: '$.why.basket', detail: 'names an item twice' });
  if (Q.basket.includes(Q.fresh)) out.push({ path: '$.why.fresh', detail: `is "${Q.fresh}", which is already in the basket: list B recommends something the shopper has never tried` });
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of compare
 */
export function whyModel(P) {
  const Q = P.why;
  /** @type {string[]} */ const basket = Q.basket;
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    f.set('la', rise(k >= 1)); f.set('na', rise(k >= 1));
    basket.forEach((_, i) => { f.set(`ia:${i}`, pop(k >= 1)); f.set(`ta:${i}`, pop(k >= 1)); });
    f.set('lb', rise(k >= 2)); f.set('ib', pop(k >= 2)); f.set('qb', pop(k >= 2)); f.set('nb', rise(k >= 2));
    f.set('q:0', rise(k >= 3)); f.set('q:1', rise(k >= 3));
    f.set('gs', rise(k >= 4));
    return f;
  };
  /** @param {string} key @returns {import('./frames.js').Timing} */
  const timing = (key) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    switch (kind) {
      case 'la': case 'lb': return { start: 100, duration: U };
      case 'ia': return { start: 200 + i * 100, duration: U };
      case 'ta': return { start: 400 + i * 100, duration: U };
      case 'na': return { start: 700, duration: U };
      case 'ib': return { start: 200, duration: U };
      case 'qb': return { start: 400, duration: U };
      case 'nb': return { start: 600, duration: U };
      case 'q': return { start: 100 + i * 200, duration: U };
      case 'gs': return { start: 100, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { basket, fresh: /** @type {string} */ (Q.fresh), frame, timing, n: whyPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/** A tick in a round badge (a hit). @param {Document} doc */
function tickBadge(doc) {
  const badge = h(doc, 'span', 'wy-badge wy-tick', { 'aria-hidden': 'true' });
  const sv = s(doc, 'svg', { width: '24', height: '24', viewBox: '0 0 34 34', 'aria-hidden': 'true' });
  sv.append(s(doc, 'path', { d: 'M7 18l7 7 14-15' }));
  badge.append(sv);
  return badge;
}

/** A double arrow (the two ends of a question). @param {Document} doc */
function doubleArrow(doc) {
  const sv = s(doc, 'svg', { class: 'wy-arrow', width: '100', height: '30', viewBox: '0 0 100 30', 'aria-hidden': 'true' });
  sv.append(s(doc, 'path', { d: 'M10 15H90M22 5L9 15l13 10M78 5l13 10-13 10' }));
  return sv;
}

/**
 * The picture of the mode `why`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of compare
 * @returns {import('./kit.js').WidgetBuild}
 */
export function whyBuild(ctx, P) {
  const L = P.why.labels;
  const M = whyModel(P);
  const sc = scene(ctx, 'mx-root wy-root');
  const { doc, box, put, add, say } = sc;
  const nameOf = (/** @type {string} */ k) => L[k];
  // state 0: the shopper and the basket the shopper buys every week
  const hist = add(h(doc, 'div', 'wy-hist', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(40, 40, 360, 250));
  const who = icon(doc, 'user', 64); who.classList.add('wy-user');
  add(who, 'left:24px;top:20px', hist);
  add(say(h(doc, 'div', 'wy-week'), L.week), box(104, 22, 236, 70), hist);
  M.basket.forEach((/** @type {string} */ name, /** @type {number} */ i) => {
    add(item(doc, name, 60), `left:${24 + i * 82}px;top:112px`, hist);
    add(say(h(doc, 'div', 'wy-iname'), nameOf(name)), box(14 + i * 82, 178, 80, 32), hist);
  });
  // press 1: list A, the basket again, every item a hit
  const la = put('la', h(doc, 'div', 'wy-list', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(450, 40, 700, 250));
  add(say(h(doc, 'div', 'wy-title'), L.listA), box(24, 12, 400, 44), la);
  M.basket.forEach((/** @type {string} */ name, /** @type {number} */ i) => {
    const card = h(doc, 'div', 'wy-card', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    card.append(item(doc, name, 56), say(h(doc, 'div', 'wy-cname'), nameOf(name)));
    put(`ia:${i}`, card, box(24 + i * 162, 64, 140, 112), la);
    put(`ta:${i}`, tickBadge(doc), `left:${24 + i * 162 + 112}px;top:50px`, la);
  });
  put('na', say(h(doc, 'div', 'wy-note'), L.noteA), box(24, 190, 652, 54), la);
  // press 2: list B, one product the shopper never tried
  const lb = put('lb', h(doc, 'div', 'wy-list', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(1190, 40, 450, 250));
  add(say(h(doc, 'div', 'wy-title'), L.listB), box(24, 12, 400, 44), lb);
  const fresh = h(doc, 'div', 'wy-card wy-fresh', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  fresh.append(item(doc, M.fresh, 56), say(h(doc, 'div', 'wy-cname'), nameOf(M.fresh)));
  put('ib', fresh, box(24, 64, 140, 112), lb);
  const q = h(doc, 'span', 'wy-badge wy-qmark', { 'aria-hidden': 'true' }); q.textContent = '?';
  put('qb', q, 'left:136px;top:50px', lb);
  put('nb', say(h(doc, 'div', 'wy-note'), L.noteB), box(184, 64, 246, 150), lb);
  // press 3: the two questions come apart
  /** @type {Array<[Record<string, string>, Record<string, string>, Record<string, string>, number]>} */
  const qs = [[L.where, L.live, L.lab, 40], [L.what, L.hit, L.benefit, 860]];
  qs.forEach(([title, one, two, x], i) => {
    const card = h(doc, 'div', 'wy-q', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    card.append(say(h(doc, 'div', 'wy-q-title'), title));
    const row = h(doc, 'div', 'wy-q-row');
    row.append(say(h(doc, 'div', 'wy-chip'), one), doubleArrow(doc), say(h(doc, 'div', 'wy-chip'), two));
    card.append(row);
    put(`q:${i}`, card, box(x, 316, 780, 150));
  });
  // press 4: the gold sentence
  put('gs', say(h(doc, 'div', 'wy-gold', { 'data-role': 'key' }), L.gold), box(40, 496, 1600, 74));
  return finish(ctx, sc, M.n, M.frame, M.timing);
}
