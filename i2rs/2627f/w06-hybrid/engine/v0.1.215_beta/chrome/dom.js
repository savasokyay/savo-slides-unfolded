// @ts-check
// WP-12b: the two element helpers of the chrome builders. Text goes in through textContent and attributes only, never as markup, so
// nothing a deck says can become an element (the same rule as the console's DOM, engine/presenter/console-ui.js).

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * An HTML element with attributes and text.
 * @param {Document} doc
 * @param {string} tag
 * @param {Record<string, string|number|undefined>} [attrs]  an undefined value leaves the attribute out
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function h(doc, tag, attrs = {}, text) {
  const el = doc.createElement(tag);
  setAttrs(el, attrs);
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * An SVG element with attributes.
 * @param {Document} doc
 * @param {string} tag
 * @param {Record<string, string|number|undefined>} [attrs]
 * @returns {SVGElement}
 */
export function s(doc, tag, attrs = {}) {
  const el = doc.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  return /** @type {SVGElement} */ (el);
}

/** @param {Element} el @param {Record<string, string|number|undefined>} attrs */
function setAttrs(el, attrs) {
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) el.setAttribute(name, String(value));
}

/** A number as an attribute value, without float noise (132.50000000000003 -> 132.5). @param {number} n */
export const num = (n) => String(Math.round(n * 1000) / 1000);
