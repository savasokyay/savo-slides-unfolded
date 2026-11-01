// @ts-check
// WP-18: the words the generated pages themselves draw: the labels above the blocks of the colophon and the small words of its version lines. They are neither the deck's text (that is
// the deck JSON's) nor the build's config (the AI statement, the licence, the citation: DECK_SCHEMA 7.1). Same convention as engine/chrome/strings.js: one table per language with the same keys
// (tests/js/pages-strings.test.mjs holds the two together), a lookup that fails loudly on an unknown key, and English, labelled as such, for a language the tables lack.

/** @typedef {'en'|'tr'} Lang */

/** @type {Record<Lang, Record<string, string>>} */
export const PAGE_STRINGS = {
  en: {
    'colophon.author': 'Author',
    'colophon.orcid': 'ORCID',
    'colophon.ai.made': 'How this deck was made',
    'colophon.ai.use': 'Use of AI',
    'colophon.license': 'Licence',
    'colophon.version': 'Version',
    'colophon.cite': 'How to cite',
    'colophon.deck': 'Deck',
    'colophon.content': 'content',
    'colophon.engine': 'Engine',
    'colophon.built': 'built',
    'colophon.dirty': 'uncommitted changes',
  },
  tr: {
    'colophon.author': 'Yazar',
    'colophon.orcid': 'ORCID',
    'colophon.ai.made': 'Bu deste nasıl hazırlandı',
    'colophon.ai.use': 'Yapay zekâ kullanımı',
    'colophon.license': 'Lisans',
    'colophon.version': 'Sürüm',
    'colophon.cite': 'Nasıl atıf yapılır',
    'colophon.deck': 'Deste',
    'colophon.content': 'içerik',
    'colophon.engine': 'Motor',
    'colophon.built': 'derlendi',
    'colophon.dirty': 'kaydedilmemiş değişiklikler',
  },
};

/**
 * One string of the generated pages in `lang`: its own table, or English with `lang: 'en'` when there is no table for the language (the page then labels the text, as it labels any text
 * that is not in <html lang>). An unknown key is a mistake of the engine, so it throws.
 * @param {string} lang @param {string} key @returns {{text: string, lang?: 'en'}}
 */
export function pageString(lang, key) {
  const own = Object.hasOwn(PAGE_STRINGS, lang) ? PAGE_STRINGS[/** @type {Lang} */ (lang)] : null;
  const table = own ?? PAGE_STRINGS.en;
  if (!Object.hasOwn(table, key)) throw new Error(`pages/strings.js: no string "${key}"`);
  return own ? { text: table[key] } : { text: table[key], lang: 'en' };
}
