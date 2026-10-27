// @ts-check
// WP-12c: the chrome model of a slide, derived from the deck JSON. engine/chrome/ (ui-agent, WP-12b) draws a ChromeModel and knows nothing of the deck;
// this module is the bridge from the other side: (deck, slide, language) -> model, a PURE function (the DOM enters only through the two functions the caller
// passes in), so every number on the strip and in the footer is checked by hand in tests/js/chrome-model-derive.test.mjs. Since a slide's picture is a pure
// function of (slide, step) (plan 3.2) and the chrome shows no step, the chrome is a function of (slide, language): deep links and presses draw the same one.
//
// Who has chrome (plan section 12, 2026-10-22 20:14 and 21:37):
//   content slide   top strip (emblem, section label, small S), footer (source, progress, page number)
//   cover, closing  none: they are cards with a page of their own (WP-14, WP-19); no page number and no progress
//   toc             the strip and the footer's source line, no progress and NO page number (D-118: the contents page is the introduction, like the cover it is not counted)
//   colophon        the same: the strip and the footer's source line, NO page number (D-122: the book's own page; D-118 had numbered it with the back pages)
//   references, evidence (generated back pages)   the page number (the numbering continues from the last content slide), no progress
//   (a generated page's strip names the page: the entry's own `label` (the build writes it from config/engine.yaml pages.labels, DECK_SCHEMA 7.1), and PAGE_LABELS for an entry that has none
//   (WP-15: a build that lists no page writes no entry, so this is the stopgap for a deck of an older build))
// The page number (D-118, D-122, `pageNumbers` of core/deck.js) is 1 on the first page that is not the cover, the contents page, the colophon or the closing; the total counts the numbered pages only.
import { DeckError, pageNumbers, text } from './deck.js';
import { validateModel } from '../chrome/model.js';

/** @typedef {import('./deck.js').Deck} Deck @typedef {import('./deck.js').Slide} Slide @typedef {import('../chrome/model.js').ChromeModel} ChromeModel */

/** The strip label of a generated page that has chrome. Stopgap (WP-12c): EN and TR, the names the plan uses (contents, references, evidence, colophon). */
// WP-12c: stopgap until K16 (build) supplies page labels
export const PAGE_LABELS = Object.freeze({
  toc: Object.freeze({ en: 'Contents', tr: 'İçindekiler' }),
  references: Object.freeze({ en: 'References', tr: 'Kaynakça' }),
  evidence: Object.freeze({ en: 'Evidence', tr: 'Kanıtlar' }),
  colophon: Object.freeze({ en: 'Colophon', tr: 'Künye' }),
});
/** Pages that are cards of their own: no strip, no footer. */
const NO_CHROME = new Set(['cover', 'closing']);

/**
 * @param {Deck} deck @param {string|null|undefined} id the asset id (`identity.emblem`, `identity.mark`) @param {string} lang @param {string} base what the asset's relative `url` is resolved against
 * @returns {{src: string, alt: string}|null}
 */
function image(deck, id, lang, base) {
  if (!id) return null;
  const a = deck.assets.find((x) => x.id === id);
  if (!a) throw new DeckError('asset_missing', '$.identity', `the identity names the asset "${id}", which $.assets does not list`);
  return { src: new URL(a.url, base).href, alt: a.alt ? text(deck, a.alt, lang) : '' };
}

/**
 * The text of a deck-level `{en, tr}` plain-text object in `lang`, with the language it is really in when that is not `lang` (the chrome then labels it).
 * @param {Deck} deck @param {any} value @param {string} lang @returns {{text: string, lang?: 'en'|'tr'}|null}
 */
export function plainIn(deck, value, lang) {
  if (!value || typeof value !== 'object') return null;
  const own = value[lang];
  if (typeof own === 'string' && own.trim() !== '') return { text: own };
  const fb = value[deck.defaultLang];
  return typeof fb === 'string' && fb.trim() !== '' ? { text: fb, lang: /** @type {'en'|'tr'} */ (deck.defaultLang) } : null;
}

/**
 * WP-15: the name of a generated page in `lang`: the entry's own `label` (plain text per language, DECK_SCHEMA 7.1), else the stopgap PAGE_LABELS; English, and labelled as such, when the
 * language is missing. The strip of the page and its own heading both say it.
 * @param {Slide} slide @param {string} lang @returns {{title: string, lang?: 'en'}}
 */
export function pageLabel(slide, lang) {
  const given = slide.entry?.label;
  const names = given !== null && typeof given === 'object' && !Array.isArray(given) ? /** @type {Record<string, string>} */ (given) : /** @type {Record<string, Record<string, string>>} */ (PAGE_LABELS)[slide.kind];
  const own = names?.[lang];
  return { title: own ?? names?.en ?? slide.kind, ...(own === undefined ? { lang: /** @type {'en'} */ ('en') } : {}) };
}

/**
 * @param {Deck} deck @param {Slide} slide @param {string} lang
 * @param {{plain: (fragment: string) => string, assetBase: string}} o
 *   `plain`: a text fragment of the deck (an HTML fragment per the contract) as plain text; the caller parses it inertly (boot.js plainTitle).
 *   `assetBase`: the address the page's relative asset URLs are resolved against (`document.baseURI`)
 * @returns {ChromeModel|null} null: this page has no chrome
 */
export function chromeModelFor(deck, slide, lang, { plain, assetBase }) {
  if (NO_CHROME.has(slide.kind)) return null;
  const content = slide.kind === 'content';
  /** @type {ChromeModel['section']} */
  let section;
  /** @type {ChromeModel['progress']} */
  let progress;
  if (content) {
    const populated = deck.sections.filter((s) => s.slides.length > 0);          // an empty section has no pill and no ring
    const si = populated.findIndex((s) => s.id === slide.section);
    const sec = populated[si];
    const k = sec ? sec.slides.indexOf(slide.id) : -1;
    if (si < 0 || k < 0) throw new DeckError('slide_not_in_section', `$.slides[${slide.index}].section`, `the slide "${slide.id}" names the section "${slide.section}", but that section does not list it`);
    const fallback = typeof sec.title[lang] !== 'string';
    section = { number: sec.number === '' ? null : sec.number, title: plain(text(deck, sec.title, lang)), ...(fallback ? { lang: /** @type {'en'|'tr'} */ (deck.defaultLang) } : {}) };
    // WP-60 (D-143): the slide of every pill and its title, so that on the student's page each pill is a link to its slide (engine/chrome/progress.js)
    const titleOf = (/** @type {string} */ id) => { const s = deck.slides.find((x) => x.id === id); return s?.title ? plain(text(deck, s.title, lang)) : id; };
    progress = { sections: populated.map((s) => s.slides.length), section: si, slide: k, variant: deck.chrome.progress?.variant,
      targets: populated.map((s) => [...s.slides]), titles: populated.map((s) => s.slides.map(titleOf)) };
  } else {
    section = { number: null, ...pageLabel(slide, lang) };                              // WP-15: the entry's own label; PAGE_LABELS when the entry has none
    progress = { sections: [1], section: 0, slide: 0, variant: 'none' };                // the model wants numbers even when nothing is drawn
  }
  const src = plainIn(deck, deck.chrome.source, lang);
  const wm = deck.chrome.watermark;
  const { numbers, total } = pageNumbers(deck);
  const number = numbers[slide.index] ?? null;
  return {
    lang: /** @type {'en'|'tr'} */ (lang),
    section,
    source: src,                                                                         // the footer is the same on every page that has one: only the progress block differs
    progress,
    page: number === null ? null : { index: number, total },                             // D-118, D-122: the contents page and the colophon have the footer, not the number
    emblem: image(deck, deck.identity?.emblem, lang, assetBase),
    mark: image(deck, deck.identity?.mark, lang, assetBase),
    watermark: wm === 'center' || wm === 'corner' ? wm : 'none',                         // `right` is the cover's own; `auto` and `none` draw nothing on a slide
  };
}

/**
 * Every problem of every chrome the deck can show, as `slide <id> (<lang>): <code: detail>` strings. boot.js runs this once, so a deck whose chrome cannot be drawn
 * (an unreadable section, a progress variant the chrome does not know, a language it has no strings for) stops the page loudly at load, not at slide 17 of the lecture.
 * @param {Deck} deck @param {{plain: (fragment: string) => string, assetBase: string}} o @returns {string[]}
 */
export function chromeProblems(deck, o) {
  /** @type {string[]} */ const out = [];
  for (const slide of deck.slides) {
    for (const lang of deck.langs) {
      let model;
      try { model = chromeModelFor(deck, slide, lang, o); } catch (e) { out.push(`slide ${slide.id} (${lang}): ${/** @type {any} */ (e).detail ?? /** @type {Error} */ (e).message}`); continue; }
      if (model) for (const p of validateModel(model)) out.push(`slide ${slide.id} (${lang}): ${p}`);
    }
  }
  return out;
}
