// @ts-check
// WP-12b: the model the chrome draws from, and its check. The builders (topbar.js, footer.js, progress.js, index.js) are pure functions
// (document, model) -> Element; they never read the deck, the router or the player. Whoever mounts the chrome (WP-12c) derives this
// model from the deck JSON (docs/DECK_SCHEMA.md section 7) and the current state, and redraws when it changes.
//
// Every string is PLAIN TEXT. The chrome writes it with textContent only, never as markup. A section title is an HTML fragment in the deck
// JSON (sections[].title), so the caller passes its text without the tags (a fragment holding math is not a good section label anyway).

/**
 * @typedef {'en'|'tr'} Lang
 * @typedef {{src: string, alt: string}} Image
 * @typedef {object} ChromeModel
 * @property {Lang} lang                      the language on screen; the chrome's own labels follow it
 * @property {{number: string|null, title: string, lang?: Lang}} section
 *           the section label of the top strip ("19.2" and its title); `lang` only when the title is NOT in `lang` (a fallback text)
 * @property {{text: string, lang?: Lang}|null} source
 *           the footer's left side, deck.yaml chrome.source in the language on screen (D-061); null: nothing is drawn
 * @property {{sections: number[], section: number, slide: number, variant: 'constellation'|'ring'|'none', targets?: string[][], titles?: string[][]}} progress
 *           slide count of each section; the zero-based current section and the zero-based slide inside it; the resolved variant
 *           (chrome.progress.variant of the deck JSON; `none` for a page that has no progress). WP-60 (D-143), optional: the slide id and the plain
 *           title of every pill, in the shape of `sections`; with them the student's page draws each pill as a link to its slide
 * @property {{index: number, total: number}|null} page
 *           the page number (1-based) and the number of NUMBERED pages (D-118: the cover, the contents page and the closing are not counted); null: this page carries no number
 *           (the contents page, which has the footer without it), and the footer then draws none
 * @property {Image|null} emblem              chrome.logo, the ESOGÜ emblem on its disc (92 px)
 * @property {Image|null} mark                the small gold S of the top strip (assets/brand/savo-mark.svg); also the watermark's image
 * @property {'auto'|'center'|'corner'|'none'} watermark
 *           chrome.watermark; `auto` and `none` draw nothing on a content slide (D-061), `center` and `corner` are config options
 */

/** Thrown by the builders for a model that fails `validateModel`: a chrome must not be drawn from numbers that do not add up. */
export class ChromeModelError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`chrome model: ${problems.join('; ')}`);
    this.name = 'ChromeModelError';
    this.problems = problems;
  }
}

const isInt = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isInteger(v);
const isText = (/** @type {unknown} */ v) => typeof v === 'string';
const LANGS = ['en', 'tr'];
const VARIANTS = ['constellation', 'ring', 'none'];
const WATERMARKS = ['auto', 'center', 'corner', 'none'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;                          // a slide id: core/router.js SLUG_RE (the chrome imports nothing from core)

/**
 * Every problem of a model, as `code: detail` strings; an empty list means the model can be drawn.
 * @param {any} m
 * @returns {string[]}
 */
export function validateModel(m) {
  /** @type {string[]} */ const bad = [];
  if (!m || typeof m !== 'object') return ['model_missing: the model is not an object'];
  if (!LANGS.includes(m.lang)) bad.push(`lang_unknown: "${m.lang}"`);
  const sec = m.section;
  if (!sec || typeof sec !== 'object') bad.push('section_missing');
  else {
    if (!isText(sec.title) || sec.title.trim() === '') bad.push('section_title_empty');
    if (sec.number !== null && sec.number !== undefined && !isText(sec.number)) bad.push('section_number_not_text');
    if (sec.lang !== undefined && !LANGS.includes(sec.lang)) bad.push(`section_lang_unknown: "${sec.lang}"`);
  }
  const src = m.source;
  if (src !== null && src !== undefined) {
    if (typeof src !== 'object' || !isText(src.text)) bad.push('source_not_text');
    else if (src.lang !== undefined && !LANGS.includes(src.lang)) bad.push(`source_lang_unknown: "${src.lang}"`);
  }
  const pr = m.progress;
  if (!pr || typeof pr !== 'object') bad.push('progress_missing');
  else {
    if (!VARIANTS.includes(pr.variant)) bad.push(`progress_variant_unknown: "${pr.variant}"`);
    if (!Array.isArray(pr.sections) || pr.sections.length === 0 || !pr.sections.every((n) => isInt(n) && n >= 1)) bad.push('progress_sections_invalid: a non-empty list of positive integers');
    else if (!isInt(pr.section) || pr.section < 0 || pr.section >= pr.sections.length) bad.push(`progress_section_out_of_range: ${pr.section} of ${pr.sections.length}`);
    else if (!isInt(pr.slide) || pr.slide < 0 || pr.slide >= pr.sections[pr.section]) bad.push(`progress_slide_out_of_range: ${pr.slide} of ${pr.sections[pr.section]}`);
    // WP-60 (D-143): one slide id (a slug, the router's rule) and one title per pill, or neither
    /** @param {unknown} rows @param {(v: unknown) => boolean} ok */
    const shaped = (rows, ok) => Array.isArray(rows) && Array.isArray(pr.sections) && rows.length === pr.sections.length
      && rows.every((row, i) => Array.isArray(row) && row.length === pr.sections[i] && row.every(ok));
    if (pr.targets !== undefined && !shaped(pr.targets, (v) => isText(v) && SLUG.test(/** @type {string} */ (v)))) bad.push('progress_targets_invalid: one slide id per pill, in the shape of sections');
    if (pr.titles !== undefined && !shaped(pr.titles, isText)) bad.push('progress_titles_invalid: one plain title per pill, in the shape of sections');
    if ((pr.targets === undefined) !== (pr.titles === undefined)) bad.push('progress_links_half: targets and titles come together');
  }
  const pg = m.page;
  if (pg !== null) {                                                    // D-118: null is the explicit "no number on this page"; a model that leaves the key out is still wrong
    if (!pg || typeof pg !== 'object') bad.push('page_missing');
    else if (!isInt(pg.index) || !isInt(pg.total) || pg.index < 1 || pg.index > pg.total) bad.push(`page_out_of_range: ${pg.index} of ${pg.total}`);
  }
  for (const key of ['emblem', 'mark']) {
    const img = m[key];
    if (img !== null && img !== undefined && (typeof img !== 'object' || !isText(img.src) || img.src === '' || !isText(img.alt))) bad.push(`${key}_invalid: needs src and alt text`);
  }
  if (!WATERMARKS.includes(m.watermark)) bad.push(`watermark_unknown: "${m.watermark}"`);
  else if ((m.watermark === 'center' || m.watermark === 'corner') && !m.mark) bad.push('watermark_needs_mark: no image to draw');
  return bad;
}

/** @param {any} model @returns {ChromeModel} */
export function assertModel(model) {
  const problems = validateModel(model);
  if (problems.length) throw new ChromeModelError(problems);
  return model;
}
