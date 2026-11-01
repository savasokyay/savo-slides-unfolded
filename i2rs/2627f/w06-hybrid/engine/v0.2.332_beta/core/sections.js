// @ts-check
// WP-86 (D-156, D-159, D-161): which navigation OPENS a section, for the transition the player plays when a `next` press lands on the first content page of a section (engine/chrome/section-transition.js
// draws it; engine/core/player.js plays it). The decision is a pure function of the deck and the two slide ids, so the whole trigger matrix is checked by hand (tests/js/sections.test.mjs).
//
// The setting is the deck's `chrome.section_transition` (engine JSON, docs/DECK_SCHEMA.md): `map_band` plays the transition, `none` (and a deck that does not carry the key) plays none. A value the engine
// does not know refuses the deck at load (`section_transition_invalid`, core/deck.js), as a wrong `chrome.key_style` does.
//
// What is NOT decided here: when the transition does not play although the navigation opens a section (back, a jump, a deep link, a pill link, the first load, reduced motion, a hidden document, the
// console's preview): those never ask for it, because only `Player.next()` into a new slide does (core/player.js `_enter`), and a still player draws the last frame at once.

/** @typedef {import('./deck.js').Deck} Deck */

/** The values of `chrome.section_transition`. */
export const SECTION_TRANSITIONS = Object.freeze(['map_band', 'none']);

/**
 * What is wrong with a `chrome.section_transition` value, or null (absent is fine: `none`).
 * @param {unknown} v @returns {string|null}
 */
export function sectionTransitionProblem(v) {
  if (v === undefined) return null;
  return typeof v === 'string' && SECTION_TRANSITIONS.includes(v) ? null : `expected "map_band" or "none", found ${JSON.stringify(v)}`;
}

/** The deck's setting: `map_band`, or `none` when the key is absent. @param {{chrome: any}} deck @returns {'map_band'|'none'} */
export function sectionTransitionOf(deck) {
  return deck.chrome?.section_transition === 'map_band' ? 'map_band' : 'none';
}

/**
 * The section a slide OPENS: the section whose first slide it is. Only a content page opens one (a generated page belongs to no section), and an empty section opens nothing. `index` counts the
 * populated sections only, as the progress block does (a section without a slide has no ring).
 * @param {Deck} deck @param {string} slideId @returns {{id: string, index: number}|null}
 */
export function sectionOpenedBy(deck, slideId) {
  const slide = deck.byId.get(slideId);
  if (!slide || slide.kind !== 'content') return null;
  const populated = deck.sections.filter((s) => s.slides.length > 0);
  const index = populated.findIndex((s) => s.id === slide.section);
  const section = populated[index];
  return section && section.slides[0] === slideId ? { id: section.id, index } : null;
}

/**
 * The transition that a `next` press from the slide `from` into the slide `to` plays, or null when it plays none: the deck says `none`, or `to` opens no section.
 *   `section`  the zero-based index of the section that opens (among the populated ones)
 *   `previous` the index of the section the press leaves, or null when it leaves none: the contents page, the cover or any page that belongs to no section; then `first` is true: there is no previous
 *              name to send away and no previous ring to tick
 * @param {Deck} deck @param {{from: string|null, to: string}} o
 * @returns {{section: number, previous: number|null, first: boolean}|null}
 */
export function sectionTransitionFor(deck, { from, to }) {
  if (sectionTransitionOf(deck) === 'none') return null;
  const opened = sectionOpenedBy(deck, to);
  if (!opened) return null;
  const leaving = from === null ? undefined : deck.byId.get(from);
  const populated = deck.sections.filter((s) => s.slides.length > 0);
  const previous = leaving && leaving.kind === 'content' ? populated.findIndex((s) => s.id === leaving.section) : -1;
  if (previous === opened.index) return null;                                  // the press stays inside the section: it opens nothing (the slides are not in the order of their sections)
  return { section: opened.index, previous: previous >= 0 ? previous : null, first: previous < 0 };
}
