// @ts-check
// WP-20 (the first generated page), WP-14, D-020: the renderer of the cover. The card is drawn by engine/chrome/cover.js from the model that engine/chrome/cover-model.js reads out of
// the deck JSON (`coverModel(deck.raw, lang)`; a field it needs and does not find is a CoverModelError with a code and a JSON path, never a blank). The card is STILL: what moves is
// this file's, and it finds its pieces by `data-part` (cover.js: kicker, title, subtitle, course, band, qr-mail, qr-deck, net, mark, stamp, emblem).
//
// States (modern and classic: PAGE_STEPS.cover = 1, one press):
//   0  the big top title (the kicker, `chrome.cover.topic`) alone: the title and its subtitle are not there yet
//   1  the topic has shrunk into a small gold label that sits on the title, and the title is shown
// Variants (`chrome.cover.variant`, chosen per deck, D-020, D-102):
//   none     (WP-46, the default) the plain cover: the course line, the big title (the deck's title), one line under it (the subtitle), no topic line, no press, no motion. It has no
//            step (core/deck.js pageSteps = 0), so the first press goes straight to the first content slide; the deck's `topic` is not read (it repeated the course name)
//   modern   the topic shrinks into the label (transform, 800 ms) and the title rises in (opacity and transform, 700 ms, 220 ms later)
//   classic  the old deck's Random Bars as blinds: the topic leaves by bars (500 ms), then the title enters by bars (500 ms)
// A cover without a topic has its title in the big top slot (cover.js `big`): there is nothing to shrink, so state 0 holds back the subtitle line and the press lets it rise in
// (nothing at all when there is no subtitle either: the press then changes nothing).
// The numbers are the prototype's (prototypes/cover-closing, the user's choice) re-derived for the card of WP-14: the kicker shrinks about its LEFT BOTTOM corner, so it
// docks onto the title (the prototype stacked the two in one place and lifted the label away). The prototype also widened the label's letter-spacing (.01em to .28em); in this
// card that was measured to wrap the topic onto a second line (the box doubled, the label no longer sat on the title) and it re-lays-out the text every frame, so only the
// transform moves (harness row k33 measures the dock). Only the pictures of states 0 and 1 are written as inline styles; everything else is engine/css/cover.css.
// render(k) writes EVERY property any state uses (an empty string clears one), so it is idempotent whatever DOM it finds.
import { planDuration } from '../core/animations.js';
import { buildCover } from '../chrome/cover.js';
import { coverModel, CoverModelError } from '../chrome/cover-model.js';

/** @typedef {import('../core/deck.js').Slide} Slide @typedef {import('../core/deck.js').Deck} Deck @typedef {import('../core/placeholder.js').RenderContext} RenderContext @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer */

const MODERN = Object.freeze({ shrinkMs: 800, riseMs: 700, riseDelayMs: 220, ease: 'cubic-bezier(.2,.8,.2,1)', rise: 'translateY(36px)', scale: 'scale(0.3)' });
const CLASSIC = Object.freeze({ barMs: 500, bars: 14, period: 14 });

/** The blinds mask: `open` is the fraction of each 14 px band that shows. @param {number} open */
export const blindsMask = (open) => `repeating-linear-gradient(to bottom, #000 0 ${(open * CLASSIC.period).toFixed(2)}px, transparent ${(open * CLASSIC.period).toFixed(2)}px ${CLASSIC.period}px)`;
/** The keyframes of blinds going from `from` to `to` (open fractions): a step per 1/14, linear. @param {number} from @param {number} to @param {Record<string, string>} [extra] */
export const blindsFrames = (from, to, extra = {}) => Array.from({ length: CLASSIC.bars + 1 }, (_, q) => ({ maskImage: blindsMask(from + (to - from) * (q / CLASSIC.bars)), ...extra }));

/** Set the given inline properties of an element; an empty string clears one. @param {HTMLElement} el @param {Record<string, string>} style */
const wear = (el, style) => { Object.assign(el.style, style); };

/**
 * Every problem of the cover of this deck in every language, as `slide cover (<lang>): ...` strings: the data the card needs, found at load (core/renderers.js).
 * @param {Deck} deck @returns {string[]}
 */
export function coverProblems(deck) {
  /** @type {string[]} */ const out = [];
  for (const lang of deck.langs) {
    try { coverModel(deck.raw, lang); } catch (e) { out.push(`slide cover (${lang}): ${e instanceof CoverModelError ? e.problems.join('; ') : /** @type {Error} */ (e).message}`); }
  }
  return out;
}

/**
 * WP-46 (D-102): the plain cover. The card as the model draws it (no topic: the model has none for this variant), still: nothing to hide, nothing to play, and no state but 0.
 * @param {Slide} slide @param {RenderContext} ctx @param {import('../chrome/cover-model.js').CoverModel} model @returns {SlideRenderer}
 */
function createStillCover(slide, ctx, model) {
  return {
    mount(host) { host.appendChild(buildCover(ctx.doc, model)); },
    render(k) { if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`cover has no state ${k} (0 ... ${slide.stepCount})`); },
    timeline: () => [],
    duration: () => 0,
  };
}

/** @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer} */
export function createCover(slide, ctx) {
  const model = coverModel(/** @type {any} */ (ctx.deck).raw, /** @type {'en'|'tr'} */ (ctx.lang));   // CoverModelError: loud (coverProblems finds it at load for every language)
  if (model.variant === 'none') return createStillCover(slide, ctx, model);
  const classic = model.variant === 'classic';
  /** @type {{root: HTMLElement, kicker: HTMLElement|null, title: HTMLElement, subline: HTMLElement|null}|null} */
  let dom = null;
  const need = () => { if (!dom) throw new Error('cover: used before mount()'); return dom; };

  /** The picture of state k, as the style each moving piece wears (a property a state does not use is cleared). @param {number} k */
  function picture(k) {
    const d = need(), on = k >= 1;
    if (d.kicker) {                                                            // a topic: the topic shrinks, the title comes
      if (classic) {
        wear(d.kicker, { maskImage: on ? blindsMask(0) : '', transform: '' });
        wear(d.title, { opacity: on ? '1' : '0', maskImage: on ? blindsMask(1) : '', transform: '' });
      } else {
        wear(d.kicker, { transform: on ? MODERN.scale : '', maskImage: '' });
        wear(d.title, { opacity: on ? '1' : '0', transform: on ? 'none' : '', maskImage: '' });
      }
    } else if (d.subline) {                                                    // no topic: the big title stays, the subtitle line rises in
      wear(d.subline, { opacity: on ? '1' : '0', transform: on ? 'none' : MODERN.rise });
    }
  }

  /** The motion of the press. @param {number} k @returns {import('../core/animations.js').Plan} */
  function timeline(k) {
    const d = need();
    if (k !== 1) return [];                                                    // state 0 is entered by a cut (the cover is the first page: a jump or a language switch draws it at once)
    if (d.kicker) {
      if (classic) return [[d.kicker, blindsFrames(1, 0), 0, CLASSIC.barMs, 'forwards', 'linear'], [d.title, blindsFrames(0, 1, { opacity: '1' }), CLASSIC.barMs, CLASSIC.barMs, 'both', 'linear']];
      return [
        [d.kicker, [{ transform: 'none' }, { transform: MODERN.scale }], 0, MODERN.shrinkMs, 'forwards', MODERN.ease],
        [d.title, [{ opacity: 0, transform: MODERN.rise }, { opacity: 1, transform: 'none' }], MODERN.riseDelayMs, MODERN.riseMs, 'forwards', MODERN.ease],
      ];
    }
    return d.subline ? [[d.subline, [{ opacity: 0, transform: MODERN.rise }, { opacity: 1, transform: 'none' }], 0, MODERN.riseMs, 'forwards', MODERN.ease]] : [];
  }

  return {
    mount(host) {
      const root = buildCover(ctx.doc, model);
      host.appendChild(root);
      const kicker = /** @type {HTMLElement|null} */ (root.querySelector('[data-part="kicker"]'));
      const title = /** @type {HTMLElement} */ (root.querySelector('[data-part="title"]'));
      const subline = kicker ? null : /** @type {HTMLElement|null} */ (root.querySelector('[data-part="subtitle"]'));
      if (kicker) kicker.style.transformOrigin = '0 100%';                       // it shrinks onto the title: about its left bottom corner (static, part of the base DOM)
      dom = { root, kicker, title, subline };
      picture(0);
    },
    render(k) {
      if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`cover has no state ${k} (0 ... ${slide.stepCount})`);
      picture(k);
    },
    timeline,
    duration: (k) => planDuration(timeline(k)),
    destroy() { dom = null; },
  };
}
