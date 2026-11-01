// @ts-check
// WP-74 (D-149, D-150; brief 09): what the new modes of the I2RS w07 deck (evaluation) share. Support module, not a widget: the modes are table-split.js, table-errors.js, table-confusion.js, table-dcg.js, table-timeline.js
// (table-highlight), pipeline-flow.js (pipeline) and compare-ranked.js (compare). Every picture is drawn in a 1680 x 600 design box and scaled once to the room the widget has (frames.js `fit`); the look is css/widgets-w07.css
// (tokens only); motion is the Plan the kit derives from the frame functions (opacity, transform, strokeDashoffset, clipPath only; D-039).
import { stepsFromFrames, h, s, fit } from './frames.js';
import { svg } from './pictos.js';

export const W = 1680, H = 600;
export const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
export const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** A fragment's schema with its default. @param {Record<string, string>} d */
export const fragSchema = (d) => ({ ...FRAGMENT, default: d });
/** The schema of an object of labels: one fragment per key, each with its default. @param {Record<string, Record<string, string>>} labels @param {string} [description] */
export function labelsSchema(labels, description = '') {
  return {
    type: 'object', additionalProperties: false, default: labels, title: 'the short labels of the picture', ...(description ? { description } : {}),
    properties: Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, fragSchema(v)])),
  };
}

/**
 * Round half away from zero to `d` decimals, true minus sign (U+2212), never "-0.00"; Turkish writes the decimal comma. The same rule as table-highlight's `fmt` (kept here so the modes do not import the widget that imports them).
 * @param {number} x @param {number} d @param {string} [lang]
 */
export const fmt = (x, d, lang = 'en') => {
  const f = 10 ** d;
  const v = Math.sign(x) * Math.round(Math.abs(x) * f) / f;
  const t = (v === 0 ? 0 : v).toFixed(d).replace('-', '−');
  return lang === 'tr' ? t.replace('.', ',') : t;
};
/** An i18n fragment of a number. @param {number} x @param {number} d @param {string} [prefix] @param {string} [suffix] */
export const num = (x, d, prefix = '', suffix = '') => ({ en: prefix + fmt(x, d, 'en') + suffix, tr: prefix + fmt(x, d, 'tr') + suffix });
/** A number written as a percentage, e.g. 0.857 -> 85.7 %. @param {number} x @param {number} d */
export const pct = (x, d = 0) => ({ en: `${fmt(x * 100, d, 'en')}%`, tr: `%${fmt(x * 100, d, 'tr')}` });

/**
 * A fragment with its placeholders filled, in every language it has: `{n}` -> value. A language switch re-renders the same fragment, so the substitution is made in the fragment, not in the text on screen.
 * @param {Record<string, string>} f @param {Record<string, string|number>} vars @returns {Record<string, string>}
 */
export const fillFrag = (f, vars) => Object.fromEntries(Object.entries(f).map(([lang, text]) => [lang, Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, String(v)), String(text))]));

/**
 * Like fillFrag, with values that depend on the language (a thousands separator: 1,000 in English, 1.000 in Turkish).
 * @param {Record<string, string>} f @param {(lang: string) => Record<string, string|number>} varsOf @returns {Record<string, string>}
 */
export const fillFragL = (f, varsOf) => Object.fromEntries(Object.entries(f).map(([lang, text]) => [lang, Object.entries(varsOf(lang)).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, String(v)), String(text))]));
/** A whole number with its thousands separator: 1,000 (English) or 1.000 (Turkish). @param {number} n @param {string} lang */
export const group = (n, lang) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'tr' ? '.' : ',');

/** The greatest common divisor of whole numbers (the ratio 12 : 6 : 6 is 2 : 1 : 1). @param {number[]} xs @returns {number} */
export const gcd = (xs) => xs.reduce((a, b) => { let x = Math.abs(a), y = Math.abs(b); while (y) { [x, y] = [y, x % y]; } return x; }, 0);

/** The common frames: shown or not, risen or not, popped or not. */
export const RISE = 'translateY(14px)', NONE = 'translateY(0px)';
export const on = (/** @type {boolean} */ b) => ({ opacity: b ? '1' : '0' });
export const rise = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: NONE } : { opacity: '0', transform: RISE });
export const pop = (/** @type {boolean} */ b) => (b ? { opacity: '1', transform: 'scale(1)' } : { opacity: '0', transform: 'scale(0.55)' });
export const grow = (/** @type {boolean} */ b, /** @type {'x'|'y'} */ axis = 'x') => (b ? { opacity: '1', transform: 'scale(1)' } : { opacity: '0', transform: axis === 'x' ? 'scaleX(0)' : 'scaleY(0)' });

/** The unit of a short motion, ms. */
export const U = 380;

/**
 * The scene every mode draws on: the root box scaled to the room, the element table, and the small helpers `box`, `put`, `say`, `add`.
 * @param {import('./kit.js').WidgetContext} ctx @param {string} cls the mode's own class (its prefix root, e.g. 'sp-root')
 */
export function scene(ctx, cls) {
  const doc = ctx.slot.ownerDocument;
  const root = h(doc, 'div', `w-root ${cls}`);
  root.style.cssText = `width:${W}px;height:${H}px`;
  const sc = fit(ctx, W, H);
  if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
  /** @type {Map<string, Element>} */
  const els = new Map();
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
  /** Put an element under a key (animated) in `parent` (default: the root). @param {string} key @param {Element} el @param {string} css @param {Element} [parent] */
  const put = (key, el, css, parent) => { /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; el.setAttribute('data-key', key); els.set(key, el); (parent ?? root).append(el); return el; };
  /** Put an element that never changes. @param {Element} el @param {string} css @param {Element} [parent] */
  const add = (el, css, parent) => { /** @type {HTMLElement} */ (el).style.cssText += `;${css}`; (parent ?? root).append(el); return el; };
  /** Set bilingual text. @param {HTMLElement} el @param {Record<string, string>} text */
  const say = (el, text) => { ctx.setText(el, text); return el; };
  return { doc, root, els, box, put, add, say };
}

/**
 * Finish a mode: put the root into the slot, derive the steps from the frame functions, set state 0 and return the build.
 * @param {import('./kit.js').WidgetContext} ctx @param {ReturnType<typeof scene>} sc @param {number} n @param {(k: number) => Map<string, Record<string, string>>} frame
 * @param {(key: string, k: number) => import('./frames.js').Timing} timing @returns {import('./kit.js').WidgetBuild}
 */
export function finish(ctx, sc, n, frame, timing) {
  ctx.slot.append(sc.root);
  const steps = stepsFromFrames({ n, els: sc.els, frame, timing, easing: ctx.defaults.easing });
  steps[0].final();                                                          // the base DOM is the picture of state 0
  return { steps, destroy: () => sc.root.remove() };
}

/**
 * The duration of press k from the timing function and the frames: the latest end of any key whose style changes, the same arithmetic as the kit's planDuration (a pure twin that tests can call without a DOM).
 * @param {number} k @param {(k: number) => Map<string, Record<string, string>>} frame @param {(key: string, k: number) => import('./frames.js').Timing} timing @returns {number}
 */
export function pressDuration(k, frame, timing) {
  if (k === 0) return 0;
  const a = frame(k - 1), b = frame(k);
  let end = 0;
  for (const [key, to] of b) {
    const from = /** @type {Record<string, string>} */ (a.get(key));
    const ks = Object.keys(to);
    if (ks.length === Object.keys(from).length && ks.every((p) => from[p] === to[p])) continue;
    const t = timing(key, k);
    end = Math.max(end, t.start + t.duration);
  }
  return end;
}

/**
 * A small custom picture in the style of pictos.js (stroke in currentColor): `lock`, `book`. Others come from pictos.js `icon`.
 * @param {Document} doc @param {'lock'|'book'} name @param {number} size
 */
export function glyph(doc, name, size) {
  const sv = svg(doc, size, size, 'pg pg-icon');
  sv.setAttribute('viewBox', '0 0 56 56');
  const path = (/** @type {string} */ d, cls = '') => { const p = s(doc, 'path', { d }); if (cls) p.setAttribute('class', cls); sv.append(p); };
  if (name === 'lock') { path('M16 25V18a12 12 0 0 1 24 0v7'); const r = s(doc, 'rect', { x: '9', y: '25', width: '38', height: '27', rx: '5' }); sv.append(r); path('M28 35v8'); }
  else { path('M28 12C21 7 12 7 5 10v36c7-3 16-3 23 2 7-5 16-5 23-2V10c-7-3-16-3-23 2z'); path('M28 12v36'); }
  return sv;
}
