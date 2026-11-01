// @ts-check
// WP-15 (D-106): the data of the contents page, read out of the deck. A PURE function: every number is checked by hand in tests/js/pages-toc.test.mjs; the DOM is engine/pages/toc.js.
// One row per populated section (a section without slides has no pill and no ring, so no row), in the deck's order: its number, its title (the deck's own text fragment, drawn through
// ctx.setText), the slide it opens, and that slide's page number (D-118: `pageNumbers` of core/deck.js, the very rule the footer of that slide uses, so the first row reads 1: the cover and this
// page are not counted). The unit of a row is the SECTION: the build counts `pagination.toc.rows` (`sections` by default, or `sections_and_slides`), but the unit never reaches the deck JSON,
// so the page draws the default's unit; a build that counts the slides too only counts more rows than are drawn, never fewer.
import { DeckError, pageNumbers } from '../core/deck.js';
import { pageLabel, plainIn } from '../core/chrome-model.js';

/** The room of the rows, in stage pixels: from y 300 (the heading ends at about 260) to y 910 (the line of the AI badge begins at 944; the footer band at 1007). */
export const ROWS_ROOM_PX = 610;
/** A row is this many em high: its line (1.3) and the gap under it (0.4). */
export const ROW_HEIGHT_EM = 1.7;
/** The body size of the content layouts (content.css `.savo-steps`): the rows are as big as the room allows, up to this. */
export const ROW_SIZE_MAX_PX = 36;

/**
 * The type size of the rows for this many rows, in px to a tenth, rounded DOWN so the rows never ask for more than the room: the room divided by the rows and their height, at most the body size.
 * @param {number} rows @returns {number}
 */
export const rowSizePx = (rows) => Math.min(ROW_SIZE_MAX_PX, Math.floor((ROWS_ROOM_PX / (Math.max(1, rows) * ROW_HEIGHT_EM)) * 10) / 10);

/**
 * @typedef {object} TocRow
 * @property {string} id           the section's id
 * @property {string|null} number  the section's number as the deck writes it, null when it has none
 * @property {Record<string, string>} title  the section's title, a text fragment per language
 * @property {string} slideId      the slide the section opens with (the address of the row is `#/<slideId>/0`)
 * @property {number} page         that slide's page number
 * @typedef {object} TocModel
 * @property {{title: string, lang?: 'en'}} title  the heading of the page: the name of the page, as the strip says it
 * @property {TocRow[]} rows
 * @property {{text: string, lang?: 'en'|'tr'}|null} badge  the AI badge (one line), null when the deck declares no AI use
 * @property {number} sizePx       the type size of the rows
 */

/**
 * @param {import('../core/deck.js').Deck} deck @param {import('../core/deck.js').Slide} slide the `toc` slide @param {string} lang @returns {TocModel}
 */
export function tocModel(deck, slide, lang) {
  const { numbers } = pageNumbers(deck);
  const rows = deck.sections.filter((s) => s.slides.length > 0).map((s) => {
    const first = deck.byId.get(s.slides[0]);
    if (!first) throw new DeckError('slide_unknown', `$.sections[${s.id}].slides[0]`, `the section "${s.id}" opens with the slide "${s.slides[0]}", which the deck does not have`);
    return { id: s.id, number: s.number === '' ? null : s.number, title: s.title, slideId: first.id, page: /** @type {number} */ (numbers[first.index]) };   // a section lists content slides only (deck.js): always numbered
  });
  const badge = slide.entry?.badge ?? null;
  return { title: pageLabel(slide, lang), rows, badge: badge === null ? null : plainIn(deck, badge, lang), sizePx: rowSizePx(rows.length) };
}
