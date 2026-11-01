// @ts-check
// WP-19 (D-021, D-061, D-064, D-117, D-121), the last generated page: the renderer of the closing. The card is drawn by engine/chrome/closing.js from the model that engine/chrome/closing-model.js reads
// out of the deck JSON (`closingModel(deck.raw, lang)`; a field it needs and does not find is a ClosingModelError with a code, never a blank). The page is STILL, like the plain cover and the
// contents page: the gold S whole in the middle and the identity under it, from the first frame; it has no step (core/deck.js PAGE_STEPS.closing = 0), no plan and no duration. The entrance of the
// old closing slide (the S built of six pieces, the sheen, the 3-D bevel) is left for later (D-121): a frame is a pure function of (slide, step), and this one is the same whether the page is
// entered by a press, a deep link, a language switch or a hidden window.
import { closingModel, ClosingModelError } from '../chrome/closing-model.js';
import { buildClosing } from '../chrome/closing.js';

/** @typedef {import('../core/deck.js').Slide} Slide @typedef {import('../core/deck.js').Deck} Deck @typedef {import('../core/placeholder.js').RenderContext} RenderContext @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer */

/**
 * Every problem of the closing of this deck in every language, as `slide closing (<lang>): ...` strings: the identity the card needs, found at load (core/renderers.js).
 * @param {Deck} deck @returns {string[]}
 */
export function closingProblems(deck) {
  /** @type {string[]} */ const out = [];
  for (const lang of deck.langs) {
    try { closingModel(deck.raw, lang); } catch (e) { out.push(`slide closing (${lang}): ${e instanceof ClosingModelError ? e.problems.join('; ') : /** @type {Error} */ (e).message}`); }
  }
  return out;
}

/** @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer} */
export function createClosing(slide, ctx) {
  const model = closingModel(/** @type {any} */ (ctx.deck).raw, /** @type {'en'|'tr'} */ (ctx.lang));   // ClosingModelError: loud (closingProblems finds it at load for every language)
  return {
    mount(host) { host.appendChild(buildClosing(ctx.doc, model)); },
    render(k) { if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`closing has no state ${k} (0 ... ${slide.stepCount})`); },
    timeline: () => [],
    duration: () => 0,
  };
}
