// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): the pictures of the story widgets, drawn in code in our own form (D-048: no textbook figure, no stock
// image). A picture is a small SVG made of strokes and fills in `currentColor`, so its colour is the colour of the place it stands in
// (a semantic role or a token); the few secondary parts use the --todo token through the classes of story.css (.pg .t, .pg .p).
// The vocabulary is generic and the same everywhere: a person, a film (a poster), a rating (a star), a tag, a box (an algorithm).
// Migration: this file moves to engine/widgets/pictos.js with the modules (it is ui-agent's).
import { s } from './frames.js';

/**
 * @param {Document} doc @param {number} w @param {number} h @param {string} [cls]
 * @returns {SVGElement}
 */
export function svg(doc, w, h, cls = '') {
  return s(doc, 'svg', { class: `pg ${cls}`.trim(), width: String(w), height: String(h), viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true', focusable: 'false' });
}
/** @param {SVGElement} p @param {string} d @param {string} [cls] @param {Record<string, string>} [extra] */
const path = (p, d, cls = '', extra = {}) => { p.append(s(p.ownerDocument, 'path', { d, ...(cls ? { class: cls } : {}), ...extra })); };
/** @param {SVGElement} p @param {number} x @param {number} y @param {number} w @param {number} h @param {number} [r] @param {string} [cls] */
const rect = (p, x, y, w, h, r = 0, cls = '') => { p.append(s(p.ownerDocument, 'rect', { x: String(x), y: String(y), width: String(w), height: String(h), rx: String(r), ...(cls ? { class: cls } : {}) })); };
/** @param {SVGElement} p @param {number} cx @param {number} cy @param {number} r @param {string} [cls] */
const circle = (p, cx, cy, r, cls = '') => { p.append(s(p.ownerDocument, 'circle', { cx: String(cx), cy: String(cy), r: String(r), ...(cls ? { class: cls } : {}) })); };
/** @param {SVGElement} p @param {number} x1 @param {number} x2 @param {number} y */
const arrow = (p, x1, x2, y) => path(p, `M${x1} ${y}H${x2}M${x2 - 7} ${y - 6}L${x2} ${y}L${x2 - 7} ${y + 6}`);

/** A five-pointed star in a 24 x 24 box. */
export const STAR = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z';

/** Ten generic poster emblems (24 x 24 box): the films of the examples are told apart by shape, never by a real title. */
const EMBLEMS = [
  (/** @type {SVGElement} */ p) => circle(p, 12, 12, 8, 'f'),
  (p) => path(p, 'M12 4L21 20H3z', 'f'),
  (p) => rect(p, 5, 5, 14, 14, 2, 'f'),
  (p) => path(p, 'M12 3L21 12L12 21L3 12z', 'f'),
  (p) => path(p, STAR, 'f'),
  (p) => path(p, 'M16 4a9 9 0 1 0 4 12 7 7 0 0 1-4-12z', 'f'),
  (p) => path(p, 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z', 'f'),
  (p) => path(p, 'M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'f'),
  (p) => path(p, 'M12 20S4 14.5 4 9a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 5.5-8 11-8 11z', 'f'),
  (p) => path(p, 'M13 3L5 13h6l-1 8 8-11h-6z', 'f'),
];
export const EMBLEM_COUNT = EMBLEMS.length;

/**
 * One poster emblem, filled with currentColor. @param {Document} doc @param {number} index @param {number} [size]
 */
export function emblem(doc, index, size = 24) {
  const v = svg(doc, 24, 24, 'pg-emblem');
  v.setAttribute('width', String(size));
  v.setAttribute('height', String(size));
  EMBLEMS[index % EMBLEMS.length](v);
  return v;
}

/**
 * A star row showing a rating of `value` out of 5: five outlined stars, each filled as far as the rating reaches (the fraction is a clip
 * of the filled star, so 3.8 is three full stars and four fifths of the fourth). Static: nothing in it is animated.
 * @param {Document} doc @param {number} value @param {number} size star size in px @param {number} [gap] @param {string} [fillCls] class of the fill layer
 */
export function starRow(doc, value, size, gap = 4, fillCls = '') {
  const row = doc.createElement('span');
  row.className = 'pg-stars';
  row.style.cssText = `display:inline-flex;gap:${gap}px;width:${5 * size + 4 * gap}px;height:${size}px`;
  for (let i = 0; i < 5; i++) {
    const cell = doc.createElement('span');
    cell.style.cssText = `position:relative;display:block;width:${size}px;height:${size}px`;
    const base = svg(doc, 24, 24, 'pg-star-base');
    base.setAttribute('width', String(size)); base.setAttribute('height', String(size));
    path(base, STAR);
    const fill = svg(doc, 24, 24, `pg-star-fill ${fillCls}`.trim());
    fill.setAttribute('width', String(size)); fill.setAttribute('height', String(size));
    path(fill, STAR, 'f');
    const f = Math.max(0, Math.min(1, value - i));
    fill.style.cssText = `position:absolute;left:0;top:0;clip-path:inset(0 ${(1 - f) * 100}% 0 0)`;
    cell.append(base, fill);
    row.append(cell);
  }
  return row;
}

/** Row icons of the recommenders (56 x 56 box). */
const ICONS = {
  users: (/** @type {SVGElement} */ p) => {
    circle(p, 19, 18, 8); path(p, 'M5 47c0-9 6-14 14-14s14 5 14 14');
    circle(p, 38, 22, 7, 'g'); path(p, 'M30 47c0-7 4-11 10-11s10 4 10 11', 'g');
  },
  items: (p) => {
    rect(p, 3, 8, 20, 30, 3); path(p, 'M10 17l8 6-8 6z', 'f');
    rect(p, 33, 18, 20, 30, 3); circle(p, 43, 33, 5, 'f');
    path(p, 'M23 23L33 33', 't');
  },
  matrix: (p) => {
    rect(p, 18, 18, 34, 34, 2); path(p, 'M29.3 18v34M40.7 18v34M18 29.3h34M18 40.7h34');
    rect(p, 18, 4, 34, 7, 2, 'f'); rect(p, 4, 18, 7, 34, 2, 'f');
  },
  tag: (p) => {
    path(p, 'M5 6h22l23 23-21 21L5 28z'); circle(p, 16, 17, 3.5, 'f'); path(p, 'M25 31l10-10M31 37l10-10', 't');
  },
  flame: (p) => { path(p, 'M28 4c3 9 14 13 14 26a14 14 0 0 1-28 0c0-7 4-10 7-15 2 4 4 5 5 6 1-7-1-11 2-17z'); path(p, 'M28 49a6 6 0 0 1-6-6c0-4 3-6 4-9 2 2 8 5 8 10a6 6 0 0 1-6 5z', 'f'); },
  user: (p) => { circle(p, 28, 18, 10); path(p, 'M7 51c0-12 9-19 21-19s21 7 21 19'); },
  funnel: (p) => { path(p, 'M6 8h44L33 29v17l-10 4V29z'); path(p, 'M14 14h28', 't'); },
  magnifier: (p) => { circle(p, 23, 23, 15); path(p, 'M34 34l16 16'); path(p, 'M15 23h16M23 15v16', 't'); },
  // what a recommender looks at (the "seen" and the "blind" eye) and the three sources of information of the matrix page
  eye: (p) => { path(p, 'M3 28C13 12 43 12 53 28 43 44 13 44 3 28z'); circle(p, 28, 28, 8, 'f'); },
  eyeoff: (p) => { path(p, 'M3 28C13 12 43 12 53 28 43 44 13 44 3 28z', 'd'); path(p, 'M10 50L46 6', '', { 'stroke-width': '5' }); },
  clipboard: (p) => { rect(p, 9, 10, 38, 42, 5); rect(p, 19, 4, 18, 11, 3, 'g'); rect(p, 19, 4, 18, 11, 3); path(p, 'M17 28l3.5 3.5L27 25M33 28h8M17 41l3.5 3.5L27 38M33 41h8'); },
  ratings: (p) => { for (let i = 0; i < 9; i++) rect(p, 6 + (i % 3) * 16, 6 + Math.floor(i / 3) * 16, 12, 12, 2, [0, 2, 4, 5, 7].includes(i) ? 'f' : 'd t'); },
  attributes: (p) => { path(p, 'M5 6h20l16 16-18 18L5 24z'); circle(p, 15, 16, 3, 'f'); path(p, 'M28 40h22M28 49h14', 't'); },
  sliders: (p) => { path(p, 'M14 6v44M28 6v44M42 6v44', 't'); rect(p, 8, 32, 12, 9, 3, 'f'); rect(p, 22, 14, 12, 9, 3, 'f'); rect(p, 36, 24, 12, 9, 3, 'f'); },
  screen: (p) => { rect(p, 14, 3, 28, 50, 5); circle(p, 28, 46, 2, 'f'); path(p, 'M23 20c0-7 10-7 10 0 0 5-5 5-5 10M28 36v1'); },
  bucket: (p) => { path(p, 'M6 16h44l-6 36H12z'); path(p, 'M6 16c0-6 44-6 44 0'); rect(p, 17, 28, 10, 10, 2, 'f'); rect(p, 30, 28, 10, 10, 2, 'f'); rect(p, 23, 40, 10, 8, 2, 'f'); },
  target: (p) => { circle(p, 28, 28, 22); circle(p, 28, 28, 13); circle(p, 28, 28, 4, 'f'); },
  coverage: (p) => { for (let i = 0; i < 9; i++) rect(p, 6 + (i % 3) * 16, 6 + Math.floor(i / 3) * 16, 12, 12, 2, i === 4 || i === 8 ? 'd t' : 'f'); },
  // WP-51 (the author's review): a circle, a triangle and a square with a gap of about 6 px between them (they touched before)
  diversity: (p) => { circle(p, 9, 29, 7, 'f'); path(p, 'M30 21l8 15H22z', 'f'); rect(p, 44, 22, 10, 14, 3, 'f'); },
  novelty: (p) => { path(p, 'M28 3l7 18 18 7-18 7-7 18-7-18-18-7 18-7z', 'f'); },
  longtail: (p) => { [42, 30, 20, 13, 9, 6, 4].forEach((hh, i) => rect(p, 4 + i * 7.4, 52 - hh, 5, hh, 1, 'f')); },
};
/**
 * @param {Document} doc @param {keyof typeof ICONS} name @param {number} [size]
 */
export function icon(doc, name, size = 56) {
  if (!(name in ICONS)) throw new Error(`pictos: no icon "${name}" (${Object.keys(ICONS).join(', ')})`);
  const v = svg(doc, 56, 56, `pg-icon pg-${name}`);
  v.setAttribute('width', String(size)); v.setAttribute('height', String(size));
  ICONS[name](v);
  return v;
}
export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

/**
 * A film poster: a rounded card with a generic emblem on it (no real film). A `div`, so a tag or a ring can be put on it.
 * @param {Document} doc @param {number} emblemIndex @param {number} w @param {number} hh @param {number} [emblemSize]
 */
export function poster(doc, emblemIndex, w, hh, emblemSize = Math.round(Math.min(w, hh) * 0.5)) {
  const el = doc.createElement('div');
  el.className = 'pg-poster';
  el.style.cssText = `width:${w}px;height:${hh}px`;
  el.append(emblem(doc, emblemIndex, emblemSize));
  return el;
}

/** The check (positive) and the cross (negative) of a verdict, in currentColor. @param {Document} doc @param {'check'|'cross'} kind @param {number} [size] */
export function mark(doc, kind, size = 40) {
  const v = svg(doc, 40, 40, `pg-mark ${kind}`);
  v.setAttribute('width', String(size)); v.setAttribute('height', String(size));
  path(v, kind === 'check' ? 'M7 21l9 9 17-20' : 'M9 9l22 22M31 9L9 31', '', { 'stroke-width': '5', 'data-gfx': 'stroke' });
  return v;
}

/** Cells of a small rating grid: `filled` marks real ratings, `pseudo` guessed ones, the rest are empty. */
function grid(/** @type {SVGElement} */ p, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ cell, /** @type {number} */ gap, /** @type {number[]} */ filled, /** @type {number[]} */ pseudo = [], /** @type {boolean} */ dashedEmpty = false) {
  for (let i = 0; i < 9; i++) {
    const cx = x + (i % 3) * (cell + gap), cy = y + Math.floor(i / 3) * (cell + gap);
    if (filled.includes(i)) rect(p, cx, cy, cell, cell, 2, 'f');
    else if (pseudo.includes(i)) rect(p, cx, cy, cell, cell, 2, 'p');
    else rect(p, cx, cy, cell, cell, 2, dashedEmpty ? 'd t' : '');
  }
}
/** A star placed with its top left corner at (x, y), `scale` times its 24 px box. */
const star = (/** @type {SVGElement} */ p, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ scale) => path(p, STAR, 'f', { transform: `translate(${x} ${y}) scale(${scale})` });

/**
 * The picture of a hybrid type (168 x 72 box): what goes in, what the algorithm does, what comes out. Drawn for the seven types of the
 * taxonomy; an unknown name draws nothing (the node then shows its name only).
 * @param {Document} doc @param {string} name
 * @returns {SVGElement|null}
 */
export function typePicto(doc, name) {
  const v = svg(doc, 168, 72, `pg-type pg-type-${name}`);
  switch (name) {
    case 'combination':        // ratings and attributes enter ONE algorithm
      grid(v, 4, 3, 8, 3, [0, 2, 4, 7]);
      path(v, 'M44 56l8-4v8z', 'f'); path(v, 'M6 46h30l8 10-8 10H6z');   // a tag: the attributes
      path(v, 'M40 20L60 34M40 56L60 40'); rect(v, 62, 12, 44, 48, 8); path(v, 'M72 28h24M72 36h24M72 44h16', 't');
      arrow(v, 106, 124, 36); star(v, 124, 18, 1.5);
      break;
    case 'meta':               // the MODEL of the first becomes the input of the second
      rect(v, 4, 18, 40, 36, 6); path(v, 'M44 36H80M74 30l6 6-6 6');
      circle(v, 52, 26, 3.5, 'f'); circle(v, 62, 14, 3.5, 'f'); circle(v, 72, 26, 3.5, 'f'); path(v, 'M52 26L62 14L72 26Z', 't');
      rect(v, 82, 18, 40, 36, 6); arrow(v, 122, 142, 36); star(v, 142, 24, 1.1);
      break;
    case 'augmentation':       // the first fills the gaps of the matrix; the second runs on the denser one
      grid(v, 4, 18, 10, 3, [0, 4, 8], [], true);
      arrow(v, 46, 62, 36);
      grid(v, 66, 18, 10, 3, [0, 4, 8], [1, 2, 3, 5, 6, 7]);
      arrow(v, 108, 122, 36); rect(v, 124, 16, 40, 40, 6); path(v, 'M132 30h24M132 38h24M132 46h14', 't');
      break;
    case 'cascade':            // a long list, pruned, then ordered
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) circle(v, 12 + c * 13, 26 + r * 18, 4.5, 'f');
      arrow(v, 50, 68, 36);
      circle(v, 80, 28, 4.5, 'f'); circle(v, 94, 28, 4.5, 'f'); circle(v, 80, 46, 4.5, 'f'); circle(v, 94, 46, 4.5, 'd t');
      arrow(v, 106, 122, 36);
      rect(v, 126, 14, 38, 9, 3, 'f'); rect(v, 126, 32, 28, 9, 3, 'f'); rect(v, 126, 50, 18, 9, 3, 'f');
      break;
    case 'weighted':           // several answers, each times a weight, added up
      rect(v, 6, 24, 14, 40, 3, 'f'); rect(v, 26, 36, 14, 28, 3, 'f'); rect(v, 46, 44, 14, 20, 3, 'f');
      path(v, 'M72 40h16M80 32v16'); arrow(v, 96, 112, 40);
      rect(v, 122, 10, 30, 54, 4, 'f'); path(v, 'M4 66h66', 't');
      break;
    case 'switching':          // two recommenders, one is chosen
      rect(v, 4, 6, 40, 24, 5); rect(v, 4, 42, 40, 24, 5);
      path(v, 'M44 18H66L84 36', '', { 'stroke-width': '5' }); path(v, 'M44 54H66L78 42', 'd t');
      circle(v, 86, 36, 5, 'f'); arrow(v, 92, 118, 36); star(v, 120, 20, 1.35);
      break;
    case 'mixed':              // nothing merged: one labelled row per recommender
      for (let r = 0; r < 3; r++) {
        const y = 4 + r * 22;
        rect(v, 4, y + 4, 28, 10, 3, 'f');
        for (let c = 0; c < 3; c++) rect(v, 44 + c * 40, y, 34, 18, 3);
      }
      break;
    default:
      return null;
  }
  return v;
}
