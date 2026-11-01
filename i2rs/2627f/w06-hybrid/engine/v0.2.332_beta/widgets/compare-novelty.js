// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2 item 6; the page `novelty` of the I2RS w07 deck, storyboard §3): the mode `novelty` of compare. Novelty and serendipity, told as three cards (Herlocker et al. 2004, p. 43: the director example; the
// textbook's restaurant example is not used, D-048, D-055). A user who loves the films of one director: a film of the director the user has already watched (right, not new), the director's new film that the user has not heard of (new, but expected: the user would
// find it alone) and a film of another genre the user would never search for and now loves (new, unexpected and useful: serendipity). The director's films share one emblem shape, the other genre has another. The picture is plainly illustrative
// (no numbers, no label, D-129). WP-93 (D-173 B + B1): the emblem still says the genre, and each film also wears its NAME on a strip (A, B, C on the shelf; "Film A", "Film D", "Film E" on the cards; A, D, E in the rows) and the director's films
// a tiny director's chair in the corner: see `filmPoster` below.
//
// State 0 is the user (a person, three small posters of the director's films) and nothing else. Six presses (WP-93, brief 10 Ek, D-164: the two measures get their formulas on this page, with their numbers in the picture):
//   1 known        the first card: a film of the director the user has already watched: new no, unexpected no, the user likes it yes: "known"
//   2 novelty      the second card: the director's new film: new yes, unexpected no, likes yes: "new, but expected" (a novelty, not serendipity)
//   3 serendipity  the third card: another genre: new yes, unexpected yes, likes yes: "serendipity"; a double gold frame (a frame and a word, D-068: not colour alone)
//   4 measuring    every serendipity is new, not every novelty is serendipity (nested sets); it is hard to measure: online two questions ("did you know it?", "did you like it?"), offline "expected" is defined by a primitive recommender and
//                  the result is sensitive to that choice (Kotkov et al. 2016, p. 189); the gold sentence (it leaves with the cards in press 5, D-176)
//   5 self-info    novelty as surprise (Zhou et al. 2010, PNAS 107(10), "(D2) Surprisal/novelty"): I = log2(u / k) for an item that k of the u users have. The cards leave; the same three films come back as rows: k, the substitution, a bar of I in bits and
//                  its value; the mean of the list under them. The measure says how RARE an item is, not that it is new to this user (that is presses 1 to 3)
//   6 share        serendipity as a share (Ge et al. 2010, p. 259): the list RS of n films; a primitive recommender PM also recommends some of them (dimmed, tagged "PM"); the rest are UNEXP = RS - PM (a blue frame); the user likes some of those
//                  (a tick) and not others (a cross); S = liked unexpected / unexpected
//
// By hand (toy numbers, invented): u = 1,024 users; the known film k = 512: I = log2(1024 / 512) = 1 bit; the director's new film k = 128: log2(8) = 3 bits; the other genre k = 8: log2(128) = 7 bits; the mean of the list (1 + 3 + 7) / 3 = 11 / 3 = 3.67 bits.
// Serendipity: RS has 10 films, PM also recommends the films 1, 2, 4, 5, 7, 9: UNEXP = RS - PM = the films 3, 6, 8, 10 = 10 - 6 = 4; the user likes 3, 8 and 10: S = 3 / 4 = 0.75.
//
// WP-93 (D-174, the user's w07 review: all formulas in all of w07): every division on the page is a fraction with a bar (formula.js), never "a / b" written like text, and a formula reads symbolic fraction = the fraction with the numbers = the value:
//   press 5  the headline I = log_2(frac(u|k)) (the fraction inside the logarithm); a row's log_2(frac(1,024|512)) = then its bar and 1 bit; the mean line: mean I = frac(Σ I|number of films) = frac(1 + 3 + 7|3) = 3.67 bits
//   press 6  S = frac(liked unexpected|unexpected) = frac(3|4) = 0.75 (the subtraction RS − PM = 10 − 6 = 4 is not a division and stays a line of text)
// A fraction line is 72.7 px high at 32 px (59 px at 26 px), so the boxes of these lines are as high as the fraction and their content is centred (css .nv-sform, .nv-ssub, .nv-smean, .nv-sfrac); the durations did not change.
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): 480 / 480 / 880 / 1030 / 1580 / 2380 ms.
//   1, 2  the card 100 + u   3  max(the card 100 + u, the frame 500 + u)   4  max(the sets 100 + u, online 250 + u, offline 400 + u, the sentence 650 + u)
//   5  the formula 250 + u, row i 350 + i * 120 + u, its bar 500 + i * 120 + 450, its value 850 + i * 120 + u, the mean 1100 + u, the tag 1200 + u: 1580
//   6  film j 250 + j * 40 + u, the veil and tag of the m-th PM film 1000 + m * 50 + 300 and 1020 + m * 50 + 300, the frames 1400 + 400, the first line 1500 + u, the mark of the m-th unexpected film 1750 + m * 110 + 300, the second line 2000 + u: 2380 (the big value that stood at 2150 is gone: the line ends in the value, D-174)
//
// Motion: opacity and transform (a rise, a pop, scaleX for a bar). Nothing else.
import { h, s } from './frames.js';
import { icon, poster, svg } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { U, fillFrag, fillFragL, finish, fmt, frag, grow, group, labelsSchema, on, pop, pressDuration, rise, scene } from './w07-common.js';

const LABELS = {
  user: frag('loves the films of one director', 'bir yönetmenin filmlerini seviyor'),
  // D-160: no gendered pronoun in anything a student reads: "the user" (the TR labels were already neutral except "onun için yeni", now "kullanıcı için yeni")
  text0: frag('a film by the director that the user has already watched', 'yönetmenin zaten izlediği bir filmi'),
  text1: frag('the director\'s new film, which the user has not heard of', 'yönetmenin henüz duymadığı yeni filmi'),
  text2: frag('a film of another genre that the user would never search for', 'hiç aramayacağı başka türden bir film'),
  attrNew: frag('new to the user', 'kullanıcı için yeni'), attrUnexp: frag('unexpected', 'beklenmedik'), attrLike: frag('the user likes it', 'seviyor'),
  known: frag('known', 'bilinen'), novelty: frag('new, but expected', 'yeni ama beklenen'), serendipity: frag('serendipity', 'serendipity'),
  setNew: frag('new', 'yeni'), setSer: frag('serendipity', 'serendipity'),
  online: frag('online', 'çevrimiçi'), q1: frag('did you know it?', 'biliyor muydun?'), q2: frag('did you like it?', 'beğendin mi?'),
  offline: frag('offline', 'çevrimdışı'), offNote: frag('"expected" is whatever a primitive recommender would suggest: the result depends on that choice', '"beklenen"i ilkel bir önerici tanımlar: sonuç o seçime duyarlıdır'),
  gold: frag('every serendipity is new, not every novelty is serendipity', 'her serendipity yenidir, her yenilik serendipity değildir'),
  // WP-93 (D-164) press 5: novelty as surprise, I = log2(u / k); the placeholders {u}, {k}, {v}, {sum}, {m} are filled in the picture (the numbers are params)
  selfFormula: frag('I = log_2(frac(u|k))', 'I = log_2(frac(u|k))'),
  selfLegend: frag('u = {u} users · k = users who rated the film', 'u = {u} kullanıcı · k = filmi puanlayan kullanıcı sayısı'),
  selfK: frag('k = {k}', 'k = {k}'), selfSub: frag('log_2(frac({u}|{k})) =', 'log_2(frac({u}|{k})) ='),
  bitOne: frag('{v} bit', '{v} bit'), bitMany: frag('{v} bits', '{v} bit'),
  selfMean: frag('mean I = frac(Σ I|number of films) = frac({sum}|{n}) = {m} bits', 'ortalama I = frac(Σ I|film sayısı) = frac({sum}|{n}) = {m} bit'), selfTag: frag('popularity-based surprise', 'popülerliğe dayalı sürpriz'),
  // WP-93 (D-164) press 6: serendipity as a share of the unexpected items the user likes
  serList: frag('the system\'s list RS ({n} films)', 'sistemin listesi RS ({n} film)'), serPm: frag('PM', 'PM'),
  serNote: frag('PM: a primitive recommender, here always the most popular films', 'PM: ilkel öneri sistemi, burada hep en popülerleri önerir'),
  serUnexp: frag('unexpected = RS − PM = {n} − {p} = {u} films', 'beklenmedik = RS − PM = {n} − {p} = {u} film'),
  serShare: frag('S = frac(liked unexpected|unexpected) = frac({l}|{u}) = {v}', 'S = frac(beğenilen beklenmedik|beklenmedik) = frac({l}|{u}) = {v}'),
};
/** The attributes of the three cards (new to the user, unexpected, the user likes it): yes or no. */
const ATTRS = Object.freeze([[false, false, true], [true, false, true], [true, true, true]]);
const INFO = { u: 1024, k: [512, 128, 8] };
const SER = { n: 10, pm: [1, 2, 4, 5, 7, 9], liked: [3, 8, 10] };

/** The params of the mode `novelty`, merged into compare's schema (the registry carries the whole). */
export const noveltySchema = {
  type: 'object', additionalProperties: false, title: 'the novelty-and-serendipity mode (mode novelty)',
  description: '`director` is the emblem (0..9) shared by the films of the director and `other` the emblem of the film of another genre (not the same). Presses 1 to 4 have no numbers. '
    + '`info` (press 5, novelty as surprise): `u` users and `k`, the number of users who have each of the three films of the cards (a film that fewer users have is more surprising: I = log2(u / k) bits; k decreases from the known film to the other genre). '
    + '`serendipity` (press 6): the list RS has `n` films numbered from 1; `pm` are the numbers a primitive recommender also recommends; the others are unexpected; `liked` are the numbers the user likes (each must be unexpected). The numbers are a toy.',
  default: { director: 3, other: 7, info: INFO, serendipity: SER, labels: LABELS },
  properties: {
    director: { type: 'integer', minimum: 0, maximum: 9, default: 3 },
    other: { type: 'integer', minimum: 0, maximum: 9, default: 7 },
    info: {
      type: 'object', additionalProperties: false, default: INFO,
      properties: { u: { type: 'integer', minimum: 2, default: 1024 }, k: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'integer', minimum: 1 }, default: [512, 128, 8] } },
    },
    serendipity: {
      type: 'object', additionalProperties: false, default: SER,
      properties: {
        n: { type: 'integer', minimum: 6, maximum: 11, default: 10 },
        pm: { type: 'array', minItems: 1, maxItems: 9, items: { type: 'integer', minimum: 1, maximum: 11 }, default: [1, 2, 4, 5, 7, 9] },
        liked: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'integer', minimum: 1, maximum: 11 }, default: [3, 8, 10] },
      },
    },
    labels: labelsSchema(LABELS, '`selfLegend` holds {u}; `selfK` {k}; `selfSub` {u} and {k}; `bitOne` and `bitMany` {v}; `selfMean` {sum}, {n} and {m}; `serList` {n}; `serUnexp` {n}, {p} and {u}; `serShare` {l}, {u} and {v}.'),
  },
};
export const noveltyExamples = [{ mode: 'novelty' }, { mode: 'novelty', novelty: { director: 1, other: 5 } }];
export const noveltyPresses = 6;

/**
 * The self-information of an item that k of the u users have, in bits: I = log2(u / k). Pure.
 * @param {number} u @param {number} k
 */
export const selfInfo = (u, k) => Math.log2(u / k);

/**
 * The share of the unexpected items that the user likes (Ge et al. 2010, p. 259): unexpected = the films of the list that the primitive recommender does not also recommend; S = liked unexpected / unexpected. Pure.
 * @param {number} n films in the list, numbered 1..n @param {number[]} pm the numbers the primitive recommender also recommends @param {number[]} liked the numbers the user likes
 * @returns {{unexp: number[], hit: number[], miss: number[], share: number}}
 */
export function serendipityShare(n, pm, liked) {
  const unexp = Array.from({ length: n }, (_, i) => i + 1).filter((p) => !pm.includes(p));
  const hit = unexp.filter((p) => liked.includes(p));
  return { unexp, hit, miss: unexp.filter((p) => !liked.includes(p)), share: hit.length / unexp.length };
}

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function noveltyProblems(P) {
  const Q = P.novelty;
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  if (Q.director === Q.other) bad('$.novelty.other', `is the emblem of the director's films (${Q.director}): the third film must look different, it is another genre`);
  for (const key of ['selfFormula', 'selfSub', 'selfMean', 'serShare']) {                                          // WP-93: the formula mark-up of formula.js, refused with its place when it does not parse
    for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.[key] ?? {}))) {
      const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
      if (problem) bad(`$.novelty.labels.${key}.${lang}`, problem);
    }
  }
  const { u, k } = Q.info;
  if (k.some((/** @type {number} */ x) => x > u)) bad('$.novelty.info.k', `has a film that more than the u = ${u} users have: k is at most u`);
  else if (!(k[0] > k[1] && k[1] > k[2])) bad('$.novelty.info.k', 'must decrease (the known film, the director\'s new film, the other genre): the rarer the film, the more surprising');
  const { n, pm, liked } = Q.serendipity;
  const distinct = (/** @type {number[]} */ a) => new Set(a).size === a.length;
  if (!distinct(pm) || pm.some((/** @type {number} */ x) => x > n)) bad('$.novelty.serendipity.pm', `holds distinct numbers from 1 to ${n}`);
  else if (n - pm.length < 2) bad('$.novelty.serendipity.pm', `leaves ${n - pm.length} unexpected film(s) of ${n}: at least 2 must be unexpected`);
  if (!distinct(liked) || liked.some((/** @type {number} */ x) => x > n)) bad('$.novelty.serendipity.liked', `holds distinct numbers from 1 to ${n}`);
  else if (liked.some((/** @type {number} */ x) => pm.includes(x))) bad('$.novelty.serendipity.liked', 'names a film that the primitive recommender also recommends: only unexpected films count');
  return out;
}

/** The bar of press 5: pixels per bit (a bar at most 300 px, a bit at most 48 px) and the largest bar's end. */
const BAR_MAX = 300, BAR_UNIT = 48;

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of compare
 */
export function noveltyModel(P) {
  const Q = P.novelty;
  const { u, k: ks } = Q.info;
  const bits = /** @type {number[]} */ (ks).map((x) => selfInfo(u, x));
  const mean = bits.reduce((a, b) => a + b, 0) / bits.length;
  const unit = Math.min(BAR_UNIT, BAR_MAX / Math.max(...bits));
  const ser = serendipityShare(Q.serendipity.n, Q.serendipity.pm, Q.serendipity.liked);
  const nPm = Q.serendipity.pm.length, nUn = ser.unexp.length, n = Q.serendipity.n;
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    const old = k < 5;                                                               // the cards, the ring and the sets of presses 1 to 4 leave in press 5
    for (let i = 0; i < 3; i++) f.set(`c:${i}`, rise(k >= i + 1 && old));
    f.set('sr', on(k >= 3 && old));
    f.set('nd', rise(k >= 4 && old)); f.set('on', rise(k >= 4 && old)); f.set('of', rise(k >= 4 && old));
    f.set('gs', rise(k >= 4 && old));                                                // WP-93 (D-176, the user's review of 2026-11-01): the gold sentence of press 4 LEAVES with the cards when the formula presses begin (it stayed under presses 5 and 6)
    const p5 = k === 5;                                                              // press 5: the self-information rows (they leave in press 6)
    f.set('sf', rise(p5)); f.set('sm', rise(p5)); f.set('st', rise(p5));
    for (let i = 0; i < 3; i++) { f.set(`si:${i}`, rise(p5)); f.set(`sb:${i}`, grow(p5)); f.set(`sv:${i}`, rise(p5)); }
    const p6 = k >= 6;                                                               // press 6: the list, the primitive recommender, the unexpected films, the share
    f.set('sl', rise(p6)); f.set('sn', rise(p6)); f.set('s1', rise(p6)); f.set('s2', rise(p6));
    for (let j = 0; j < n; j++) f.set(`rp:${j}`, rise(p6));
    for (let m = 0; m < nPm; m++) { f.set(`dv:${m}`, on(p6)); f.set(`pm:${m}`, pop(p6)); }
    for (let m = 0; m < nUn; m++) { f.set(`fr:${m}`, on(p6)); f.set(`mk:${m}`, pop(p6)); }
    return f;
  };
  const out = { start: 0, duration: 260 };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    if (k === 5 && ['c', 'sr', 'nd', 'on', 'of', 'gs'].includes(kind)) return out;
    if (k === 6 && ['sf', 'si', 'sb', 'sv', 'sm', 'st'].includes(kind)) return out;
    switch (kind) {
      case 'c': return { start: 100, duration: U };
      case 'sr': return { start: 500, duration: U };
      case 'nd': return { start: 100, duration: U };
      case 'on': return { start: 250, duration: U };
      case 'of': return { start: 400, duration: U };
      case 'gs': return { start: 650, duration: U };
      case 'sf': return { start: 250, duration: U };
      case 'si': return { start: 350 + i * 120, duration: U };
      case 'sb': return { start: 500 + i * 120, duration: 450 };
      case 'sv': return { start: 850 + i * 120, duration: U };
      case 'sm': return { start: 1100, duration: U };
      case 'st': return { start: 1200, duration: U };
      case 'sl': return { start: 250, duration: U };
      case 'rp': return { start: 250 + i * 40, duration: U };
      case 'dv': return { start: 1000 + i * 50, duration: 300 };
      case 'pm': return { start: 1020 + i * 50, duration: 300 };
      case 'sn': return { start: 1200, duration: U };
      case 'fr': return { start: 1400, duration: 400 };
      case 's1': return { start: 1500, duration: U };
      case 'mk': return { start: 1750 + i * 110, duration: 300 };
      case 's2': return { start: 2000, duration: U };
      default: return { start: 0, duration: U };
    }
  };
  return { attrs: ATTRS, bits, mean, unit, ser, frame, timing, n: noveltyPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/** A tick (yes) or a cross (no), drawn in currentColor: the shape cue next to the colour. @param {Document} doc @param {boolean} good */
function mark(doc, good) {
  const sv = s(doc, 'svg', { class: `nv-mark ${good ? 'nv-yes' : 'nv-no'}`, width: '34', height: '34', viewBox: '0 0 34 34', 'aria-hidden': 'true' });
  sv.append(s(doc, 'path', { d: good ? 'M6 18l8 8 14-16' : 'M8 8l18 18M26 8L8 26' }));
  return sv;
}

// WP-93 (D-173 B + B1, the user's choice on review board 2): the films wear their NAME and the director's films a CHAIR, while the emblem keeps saying the GENRE as in every lecture (D-173: "the genre pattern is the same across lectures, so let us not break it").
// Why: two identical cards made one wonder whether it was the same film. So every poster of the page that stands for ONE film carries a strip along its foot with the film's invented name (no real film, D-055, D-129): "Film A" on the cards, "A" on the small
// posters; and the films of the director also carry a tiny director's chair in the top right corner (the other genre's film has none). The story the names tell: the user has already watched A, B and C (the shelf of state 0); card 1 IS the watched film A, card 2 is the
// new film D (not on the shelf), card 3 is the film E of another genre; the rows of press 5 repeat A, D and E. Press 6 draws a list of TEN films, each with its OWN emblem: there the shapes already tell films apart and the posters stay as they are.
// The strip and the chair are children of their poster (no key, no animation of their own): they come and go with it. Strip: the ground colour on the ink, 13.48 : 1 (light) and 13.82 : 1 (dark); chair: the symbol's own colour (ink-soft) on the poster, 6.79 : 1 and 6.94 : 1.
// The name is the same word in both languages ("Film A"), so it is not a label (it would need a registry row for nothing) and is aria-hidden like the posters.
/** Which film stands where: the zone of the poster in the picture (the shelf of state 0, the cards of presses 1 to 3, the rows of press 5) and its position in that zone, left to right or top to bottom. */
export const FILMS = Object.freeze({ shelf: ['A', 'B', 'C'], card: ['A', 'D', 'E'], row: ['A', 'D', 'E'] });
/** The size class of a zone's posters: the posters of the cards are 96 x 120 px, those of the shelf and of the rows 56 x 72 px. */
const FILM_SIZE = Object.freeze({ shelf: 'sm', card: 'lg', row: 'sm' });
/** The corner chair in px, by size class. */
export const CHAIR_PX = Object.freeze({ lg: 22, sm: 13 });

/**
 * The film at a place: its name, the size class of its poster and the text of its strip ("Film A" on a card, "A" on a small poster). Pure.
 * @param {'shelf'|'card'|'row'} zone @param {number} index position in the zone, from 0
 * @returns {{film: string, size: 'sm'|'lg', strip: string}}
 */
export function filmPlan(zone, index) {
  const film = FILMS[zone]?.[index];
  if (film === undefined) throw new RangeError(`no film at ${zone} ${index}`);
  const size = FILM_SIZE[zone];
  return { film, size, strip: size === 'lg' ? `Film ${film}` : film };
}

/**
 * The director's chair in the 24 x 24 box of the poster emblems: two posts, the canvas of the back, an arm bar, the canvas of the seat and the crossed legs. Filled shapes (class f) and two strokes, in currentColor like every emblem.
 * @type {ReadonlyArray<readonly ['rect', number, number, number, number] | readonly ['line', number, number, number, number, number]>}
 */
export const CHAIR = Object.freeze([
  ['rect', 4, 2, 2.4, 19], ['rect', 17.6, 2, 2.4, 19],     // the posts
  ['rect', 6.4, 3, 11.2, 5.5],                              // the canvas of the back
  ['rect', 3, 11, 18, 2],                                   // the arm bar
  ['rect', 6.4, 14.5, 11.2, 2.5],                           // the canvas of the seat
  ['line', 6.4, 17, 17.6, 21.5, 1.8], ['line', 17.6, 17, 6.4, 21.5, 1.8],   // the crossed legs
]);

/** The corner mark: the chair as a small svg (css .nv-chair puts it in the top right corner). @param {Document} doc @param {number} size px */
function chairMark(doc, size) {
  const v = svg(doc, 24, 24, 'nv-chair');
  v.setAttribute('width', String(size)); v.setAttribute('height', String(size));
  v.setAttribute('data-nv', 'chair');
  for (const p of CHAIR) {
    if (p[0] === 'rect') v.append(s(doc, 'rect', { x: String(p[1]), y: String(p[2]), width: String(p[3]), height: String(p[4]), class: 'f' }));
    else v.append(s(doc, 'path', { d: `M${p[1]} ${p[2]}L${p[3]} ${p[4]}`, 'stroke-width': String(p[5]) }));
  }
  return v;
}

/**
 * The poster of one film of the page: the genre emblem as before, the strip with the film's name along the foot and, when the film is the director's (its emblem is the director's), the chair in the top right corner. Posters of another zone are made by `poster`.
 * @param {Document} doc @param {'shelf'|'card'|'row'} zone @param {number} index position in the zone @param {number} emblem the genre emblem (0..9) @param {number} director the director's emblem
 * @param {number} w @param {number} hh @param {number} emblemSize
 */
function filmPoster(doc, zone, index, emblem, director, w, hh, emblemSize) {
  const plan = filmPlan(zone, index);
  const el = poster(doc, emblem, w, hh, emblemSize);
  el.className = `${el.className} nv-film nv-film-${plan.size}`;
  if (emblem === director) el.append(chairMark(doc, CHAIR_PX[plan.size]));
  const strip = doc.createElement('div');
  strip.className = 'nv-plate'; strip.setAttribute('aria-hidden', 'true'); strip.setAttribute('data-film', plan.film);
  strip.textContent = plan.strip;
  el.append(strip);
  return el;
}

const CARD = { x: 310, pitch: 445, y: 40, w: 410, h: 316 };
/** Press 6: the share line S = ... = 0.75 starts 36 px below the line above it (which ends at 394); it stood against that line at 394 ("too cramped", the user's review of 2026-11-01), so it breathes now: 430 to 506 of 600. WP-93 (D-176) */
const S2_Y = 430;
/** Press 5: the rows start at x 310; a row is 96 px high, the bar starts 870 px into it. */
const ROW5 = { x: 310, y0: 112, pitch: 112, h: 96, bar: 870 };

/**
 * A number of bits: whole when it is whole, else two decimals (3.67). @param {number} v @param {string} lang
 */
const bitsText = (v, lang) => fmt(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2, lang);

/**
 * The picture of the mode `novelty`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of compare
 * @returns {import('./kit.js').WidgetBuild}
 */
export function noveltyBuild(ctx, P) {
  const Q = P.novelty, L = Q.labels;
  const M = noveltyModel(P);
  const sc = scene(ctx, 'mx-root nv-root');
  const { doc, box, put, add, say } = sc;
  // state 0: the user and three small posters, the films of the director the user loves (one emblem shape stands for one director)
  const who = icon(doc, 'user', 72); who.classList.add('nv-user');
  add(who, 'left:30px;top:60px');
  add(say(h(doc, 'div', 'nv-cap'), L.user), box(30, 150, 250, 100));
  for (let i = 0; i < 3; i++) add(filmPoster(doc, 'shelf', i, Q.director, Q.director, 56, 72, 30), `position:absolute;left:${30 + i * 66}px;top:270px`);   // WP-93 (D-173 B1): the films A, B, C the user has watched
  // presses 1 to 3: the three cards
  /** @type {Array<[string, number, string]>} */
  const cards = [['text0', Q.director, 'known'], ['text1', Q.director, 'novelty'], ['text2', Q.other, 'serendipity']];
  cards.forEach(([textKey, emb, verdictKey], i) => {
    const el = h(doc, 'div', `nv-card nv-${verdictKey}`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
    add(filmPoster(doc, 'card', i, emb, Q.director, 96, 120, 52), 'position:absolute;left:20px;top:20px', el);                 // WP-93 (D-173 B1): "Film A", "Film D", "Film E"
    add(say(h(doc, 'div', 'nv-text'), L[textKey]), box(136, 20, 254, 120), el);
    ['attrNew', 'attrUnexp', 'attrLike'].forEach((key, r) => {
      add(say(h(doc, 'div', 'nv-attr'), L[key]), box(20, 150 + r * 38, 290, 34), el);
      add(mark(doc, M.attrs[i][r]), `left:${CARD.w - 20 - 34 - 6}px;top:${150 + r * 38}px`, el);
    });
    add(say(h(doc, 'div', 'nv-verdict'), L[verdictKey]), box(20, 268, CARD.w - 40, 38), el);
    put(`c:${i}`, el, box(CARD.x + i * CARD.pitch, CARD.y, CARD.w, CARD.h));
  });
  put('sr', h(doc, 'div', 'nv-ring', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(CARD.x + 2 * CARD.pitch - 9, CARD.y - 9, CARD.w + 18, CARD.h + 18));
  // press 4: the sets, the two ways of measuring, the gold sentence
  const nd = h(doc, 'div', 'nv-sets', { 'aria-hidden': 'true' });
  const big = h(doc, 'div', 'nv-big', { 'data-gfx': 'border' }); big.append(say(h(doc, 'span'), L.setNew));
  const small = h(doc, 'div', 'nv-small', { 'data-gfx': 'border' }); small.append(say(h(doc, 'span'), L.setSer));
  nd.append(big, small);
  put('nd', nd, box(60, 380, 200, 152));
  const online = h(doc, 'div', 'nv-box', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  online.append(say(h(doc, 'div', 'nv-box-title'), L.online));
  const qs = h(doc, 'div', 'nv-qs'); qs.append(say(h(doc, 'div', 'nv-q'), L.q1), say(h(doc, 'div', 'nv-q'), L.q2));
  online.append(qs);
  put('on', online, box(310, 380, 600, 148));
  const offline = h(doc, 'div', 'nv-box', { 'aria-hidden': 'true', 'data-gfx': 'border' });
  offline.append(say(h(doc, 'div', 'nv-box-title'), L.offline), say(h(doc, 'div', 'nv-off'), L.offNote));
  put('of', offline, box(950, 380, 690, 148));
  put('gs', say(h(doc, 'div', 'nv-gold', { 'data-role': 'key' }), L.gold), box(40, 540, 1600, 50));

  // press 5: novelty as surprise. The formula and what u and k are, three rows (the films of the cards: k, the substitution, a bar of I in bits, its value), the mean of the list
  const { u, k: ks } = Q.info;
  const sf = h(doc, 'div', 'nv-sf', { 'aria-hidden': 'true' });
  const sform = say(h(doc, 'div', 'nv-sform'), L.selfFormula);
  renderFormula(doc, sform);                                                                                       // WP-93 (D-174): I = log_2(frac(u|k)), the fraction inside the logarithm
  add(sform, box(0, 0, 330, 76), sf);
  add(say(h(doc, 'div', 'nv-slegend'), fillFragL(L.selfLegend, (lg) => ({ u: group(u, lg) }))), box(340, 22, 960, 32), sf);
  put('sf', sf, box(ROW5.x, 24, 1300, 76));                                                                         // 76 px: the fraction line at 32 px is 72.7 px high (it was 52 px for the one-line formula)
  /** @type {Array<[string, number]>} */
  const films = [['text0', Q.director], ['text1', Q.director], ['text2', Q.other]];
  films.forEach(([textKey, emb], i) => {
    const y = ROW5.y0 + i * ROW5.pitch, k = ks[i], bits = M.bits[i];
    const row = h(doc, 'div', 'nv-srow', { 'aria-hidden': 'true' });
    add(filmPoster(doc, 'row', i, emb, Q.director, 56, 72, 30), 'position:absolute;left:0;top:12px', row);                     // WP-93 (D-173 B1): A, D, E again
    add(say(h(doc, 'div', 'nv-stext'), L[textKey]), box(76, 14, 366, 70), row);                                        // 366 px: the longest text is 345 px wide (measured with fontTools), so it stays at two lines with 6 % to spare
    add(say(h(doc, 'div', 'nv-sk'), fillFragL(L.selfK, (lg) => ({ k: group(k, lg) }))), box(450, 28, 140, 40), row);
    const sub = say(h(doc, 'div', 'nv-ssub'), fillFragL(L.selfSub, (lg) => ({ u: group(u, lg), k: group(k, lg) })));
    renderFormula(doc, sub);                                                                                       // WP-93 (D-174): log_2(frac(1,024|512)) =, centred on the row (96 px high)
    add(sub, box(590, 0, 270, ROW5.h), row);
    put(`si:${i}`, row, box(ROW5.x, y, 1300, ROW5.h));
    const w = Math.max(6, Math.round(bits * M.unit));
    put(`sb:${i}`, h(doc, 'div', 'nv-sbar', { 'data-gfx': 'fill' }), `${box(ROW5.x + ROW5.bar, y + 34, w, 28)};transform-origin:0 50%`);
    const val = fillFragL(bits === 1 ? L.bitOne : L.bitMany, (lg) => ({ v: bitsText(bits, lg) }));
    put(`sv:${i}`, say(h(doc, 'div', 'nv-sval'), val), box(ROW5.x + ROW5.bar + w + 14, y + 28, 150, 40));
  });
  const sum = M.bits.map((b) => bitsText(b, 'en')).join(' + '), sumTr = M.bits.map((b) => bitsText(b, 'tr')).join(' + ');
  const meanText = Object.fromEntries(Object.entries(L.selfMean).map(([lg, t]) => [lg, String(t).replace('{sum}', lg === 'tr' ? sumTr : sum).replace('{n}', String(M.bits.length)).replace('{m}', bitsText(M.mean, lg))]));
  const smean = say(h(doc, 'div', 'nv-smean'), meanText);
  renderFormula(doc, smean);                                                                                       // WP-93 (D-174): mean I = frac(Σ I|number of films) = frac(1 + 3 + 7|3) = 3.67 bits
  put('sm', smean, box(ROW5.x, 440, 960, 100));
  put('st', say(h(doc, 'div', 'nv-stag'), L.selfTag), box(1310, 446, 300, 44));

  // press 6: serendipity as a share. The list of n films; the primitive recommender's films dim and carry a tag; the unexpected ones get a frame; a tick for the ones the user likes, a cross for the others
  const n = Q.serendipity.n, pitch = Math.floor(1300 / n), px = (/** @type {number} */ j) => CARD.x + j * pitch + Math.floor((pitch - 96) / 2);
  put('sl', say(h(doc, 'div', 'nv-slab'), fillFrag(L.serList, { n })), box(CARD.x, 44, 900, 36));
  for (let j = 0; j < n; j++) put(`rp:${j}`, poster(doc, j % 10, 96, 120, 52), `position:absolute;left:${px(j)}px;top:100px`);
  const pmList = /** @type {number[]} */ (Q.serendipity.pm);
  pmList.forEach((p, m) => {
    put(`dv:${m}`, h(doc, 'div', 'nv-veil', { 'aria-hidden': 'true' }), box(px(p - 1), 100, 96, 120));
    put(`pm:${m}`, say(h(doc, 'div', 'nv-pm'), L.serPm), box(px(p - 1) + 16, 232, 64, 32));
  });
  M.ser.unexp.forEach((p, m) => {
    put(`fr:${m}`, h(doc, 'div', 'nv-frame', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(px(p - 1) - 9, 91, 114, 138));
    put(`mk:${m}`, mark(doc, M.ser.hit.includes(p)), `left:${px(p - 1) + 31}px;top:232px`);
  });
  put('sn', say(h(doc, 'div', 'nv-snote'), L.serNote), box(CARD.x, 284, 1300, 34));
  put('s1', say(h(doc, 'div', 'nv-sline'), fillFrag(L.serUnexp, { n, p: pmList.length, u: M.ser.unexp.length })), box(CARD.x, 350, 1000, 44));
  const shareLine = Object.fromEntries(Object.entries(L.serShare).map(([lg, t]) => [lg, String(t).replace('{l}', String(M.ser.hit.length)).replace('{u}', String(M.ser.unexp.length)).replace('{v}', fmt(M.ser.share, 2, lg))]));
  const s2 = say(h(doc, 'div', 'nv-sline nv-sfrac'), shareLine);
  renderFormula(doc, s2);                                                                                          // WP-93 (D-174): S = frac(liked unexpected|unexpected) = frac(3|4) = 0.75, centred where the one-line text was
  put('s2', s2, box(CARD.x, S2_Y, 1000, 76));
  return finish(ctx, sc, M.n, M.frame, M.timing);
}
