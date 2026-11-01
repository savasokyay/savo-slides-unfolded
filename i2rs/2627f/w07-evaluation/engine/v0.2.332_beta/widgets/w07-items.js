// @ts-check
// WP-74 (D-149, D-055; brief 09 Ek 1 and Ek 2, items 5 and 8): small pictures of the w07 pages that pictos.js has no word for: the grocery basket of the page `why-evaluate` (Herlocker et al. 2004, p. 14 and 42: a supermarket recommender that
// suggests bananas, bread, milk and eggs is right but useless) and a die for the page `mnar` (a random test sample), drawn in code in our own form (D-048) in the style of pictos.js: a 56 x 56 box, strokes and fills in currentColor
// (the classes `.pg .f` and `.pg .t` of widgets.css give the filled and the secondary parts).
import { s } from './frames.js';
import { svg } from './pictos.js';

/** The names of the items of the grocery basket. */
export const ITEM_NAMES = Object.freeze(['banana', 'bread', 'milk', 'eggs', 'cheese']);

/** @param {SVGElement} p @param {string} d @param {string} [cls] */
const path = (p, d, cls = '') => { p.append(s(p.ownerDocument, 'path', { d, ...(cls ? { class: cls } : {}) })); };
/** @param {SVGElement} p @param {number} cx @param {number} cy @param {number} r @param {string} [cls] */
const circle = (p, cx, cy, r, cls = '') => { p.append(s(p.ownerDocument, 'circle', { cx: String(cx), cy: String(cy), r: String(r), ...(cls ? { class: cls } : {}) })); };

/** @type {Record<string, (p: SVGElement) => void>} */
const DRAW = {
  banana: (p) => { path(p, 'M42 7c-1 17-11 29-31 33-3 1-4 4-1 6 22 4 38-9 42-34l1-6-6-1z'); path(p, 'M20 36c10-4 18-12 20-22', 't'); },
  bread: (p) => { path(p, 'M8 25C8 14 18 9 28 9s20 5 20 16c0 3-1 5-3 6v15c0 3-2 5-5 5H16c-3 0-5-2-5-5V31c-2-1-3-3-3-6z'); path(p, 'M19 19l4 9M29 17l4 9M39 19l3 8', 't'); },
  milk: (p) => { path(p, 'M14 22L20 8h16l6 14'); path(p, 'M14 22h28v28a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z'); path(p, 'M20 8v14M36 8v14', 't'); path(p, 'M21 36h14M21 43h9', 't'); },
  eggs: (p) => { path(p, 'M19 9c-8 0-12 13-12 22 0 8 5 13 12 13s12-5 12-13C31 22 27 9 19 9z'); path(p, 'M39 17c-6 0-9 10-9 17 0 7 4 11 9 11s9-4 9-11c0-7-3-17-9-17z', 't'); },
  cheese: (p) => { path(p, 'M5 43V29L51 13v30a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z'); circle(p, 17, 38, 3.4, 'f'); circle(p, 33, 31, 3, 'f'); circle(p, 42, 39, 2.6, 'f'); circle(p, 27, 40, 2, 'f'); },
  dice: (p) => { path(p, 'M12 6h32a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z'); circle(p, 18, 18, 3.6, 'f'); circle(p, 38, 18, 3.6, 'f'); circle(p, 28, 28, 3.6, 'f'); circle(p, 18, 38, 3.6, 'f'); circle(p, 38, 38, 3.6, 'f'); },
};

/**
 * One small picture: an item of the basket or a die.
 * @param {Document} doc @param {string} name one of ITEM_NAMES or `dice` @param {number} [size]
 */
export function item(doc, name, size = 56) {
  if (!(name in DRAW)) throw new Error(`w07-items: no picture "${name}" (${Object.keys(DRAW).join(', ')})`);
  const v = svg(doc, 56, 56, `pg-icon pg-item pg-${name}`);
  v.setAttribute('width', String(size)); v.setAttribute('height', String(size));
  DRAW[name](v);
  return v;
}
