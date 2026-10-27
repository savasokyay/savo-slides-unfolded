// @ts-check
// WP-18 (docs/DECK_SCHEMA.md 7.1, D-110): the data of the colophon, read out of the deck. A PURE function: every line is checked by hand in tests/js/pages-colophon.test.mjs; the DOM is engine/pages/colophon.js.
// The entry's `colophon` block holds only what the deck JSON does not hold already: the AI statement and its items, the licence, the citation. The author, the ORCID and the institution come from
// `identity`, the versions and the build stamp from `deck.version` and `provenance` (null in a deck that no build stamped: then the version block is the deck's version alone); the review of the deck
// is already folded into `ai.review` by the build (a sentence that names the reviewer and the date). The engine re-derives none of them.
// Every value is plain text, so the page draws it as text and never parses it. A language the deck has no text for falls back to the default language and says so (`lang`).
import { pageLabel, plainIn } from '../core/chrome-model.js';
import { mailtoHref } from '../chrome/mailto.js';
import { pageString } from './strings.js';

/** @typedef {import('../core/deck.js').Deck} Deck @typedef {import('../core/deck.js').Slide} Slide */
/** @typedef {{text: string, lang?: 'en'|'tr'}} Say */

const isObj = (/** @type {unknown} */ v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (/** @type {unknown} */ v) => typeof v === 'string' && v.trim() !== '';
const isUrl = (/** @type {unknown} */ v) => typeof v === 'string' && /^https:\/\/\S+$/.test(v);
/** What `colophon.utc_offset` looks like: a sign, two digits of hours up to 14, a colon, two digits of minutes. The same pattern as the build's config key `pages.colophon.utc_offset` (savo_slides/config.py). */
const OFFSET = /^([+-])(0\d|1[0-4]):([0-5]\d)$/;

/**
 * Everything the colophon cannot be drawn without, in this language, as sentences with their place (`colophon.ai.items[1].roles[0].name`). The same list is `colophonProblems` at load.
 * @param {Deck} deck @param {Slide} slide @param {string} lang @returns {string[]}
 */
export function colophonCheck(deck, slide, lang) {
  /** @type {string[]} */ const out = [];
  const said = (/** @type {unknown} */ v) => plainIn(deck, v, lang) !== null;
  const c = /** @type {any} */ (slide.entry?.colophon);
  if (!isObj(c)) return ['the entry has no `colophon` block'];
  const ai = c.ai;
  if (!isObj(ai) || typeof ai.declared !== 'boolean' || !Array.isArray(ai.items)) out.push('colophon.ai needs `declared` (a boolean) and `items` (a list)');
  else {
    if (!said(ai.statement)) out.push(`colophon.ai.statement has no text in ${lang} and none in the default language ${deck.defaultLang}`);
    if (ai.declared && ai.review !== null && ai.review !== undefined && !said(ai.review)) out.push(`colophon.ai.review has no text in ${lang} and none in ${deck.defaultLang}`);
    ai.items.forEach((/** @type {any} */ it, /** @type {number} */ i) => {
      if (!isObj(it) || !isText(it.model) || !Array.isArray(it.roles)) { out.push(`colophon.ai.items[${i}] needs a model name and a list of roles`); return; }
      it.roles.forEach((/** @type {any} */ r, /** @type {number} */ j) => { if (!isObj(r) || !said(r.name)) out.push(`colophon.ai.items[${i}].roles[${j}].name has no text in ${lang} and none in ${deck.defaultLang}`); });
    });
  }
  if (!isObj(c.license) || !isText(c.license.name) || !isUrl(c.license.url)) out.push('colophon.license needs a `name` and an https `url`');
  if (!said(c.citation)) out.push(`colophon.citation has no text in ${lang} and none in the default language ${deck.defaultLang}`);
  const a = deck.identity?.author;
  if (!isObj(a) || !isText(a.name)) out.push('identity.author.name is missing');
  const inst = deck.identity?.institution;
  if (!Array.isArray(inst)) out.push('identity.institution is missing'); else inst.forEach((l, i) => { if (!said(l)) out.push(`identity.institution[${i}] has no text in ${lang} and none in ${deck.defaultLang}`); });
  if (!isText(deck.raw && /** @type {any} */ (deck.raw).deck?.version)) out.push('deck.version is missing');
  const build = /** @type {any} */ (deck.raw)?.provenance?.build;
  if (isObj(build) && Number.isFinite(build.source_date_epoch) && !OFFSET.test(String(c.utc_offset))) {
    out.push('colophon.utc_offset is missing or does not look like +03:00: the version lines tell the build\'s time in the fixed offset the build writes into the entry (D-130); the engine has none of its own');
  }
  return out;
}

/**
 * @typedef {object} ColophonModel
 * @property {{title: string, lang?: 'en'}} title
 * @property {{label: Say, name: string, institution: Say[], orcid: {label: Say, id: string, url: string|null}|null, mail: string|null, mailHref: string|null}} author
 *   (an ORCID without an https address is shown as text; `mailHref` is `mailto:<mail>` for a plain address, D-125, chrome/mailto.js, else null: the address is then text)
 * @property {{label: Say, declared: boolean, statement: Say, items: Array<{model: string, roles: Say}>, review: Say|null}} ai
 * @property {{label: Say, name: string, url: string}} license
 * @property {{label: Say, lines: Say[]}} version
 * @property {{label: Say, text: Say}} cite
 */

/**
 * WP-54 (D-130): the moment of a build stamp as `YYYY-MM-DD HH:MM`, the colophon's format for every date (the build writes the review sentence the same way, savo_slides/generated.py `local_minute`): 24 hours,
 * zero padded, one space, a four-digit year, NO seconds: they are cut, not rounded (22:59:59 is 22:59, and 23:59:59 does not turn the day). The wall clock is the UTC clock of the epoch moved by `offset`, a FIXED
 * offset that the build writes into the entry (`colophon.utc_offset`, from the config key `pages.colophon.utc_offset`: `+03:00`, the author's Europe/Istanbul, which Turkey keeps all year), so no time-zone
 * database and no setting of the machine is read and the same epoch gives the same bytes everywhere. The engine has no offset of its own: an entry without one is a problem named at load (`colophonCheck`).
 * @param {number} epoch seconds since 1970 (SOURCE_DATE_EPOCH, `provenance.build.source_date_epoch`) @param {string} offset `+03:00`, `-05:00` ... @returns {string}
 * @throws {RangeError} an offset that does not look like `+03:00`
 */
export function buildStamp(epoch, offset) {
  const m = OFFSET.exec(String(offset));
  if (!m) throw new RangeError(`utc_offset must look like +03:00 (a sign, hours up to 14, minutes), got ${JSON.stringify(offset)}`);
  const seconds = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60);
  return new Date((Math.floor(epoch) + seconds) * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * @param {Deck} deck @param {Slide} slide the `colophon` slide @param {string} lang @returns {ColophonModel}
 */
export function colophonModel(deck, slide, lang) {
  const bad = colophonCheck(deck, slide, lang);
  if (bad.length) throw new Error(bad.join('; '));
  const c = /** @type {any} */ (slide.entry).colophon, ai = c.ai, raw = /** @type {any} */ (deck.raw);
  const say = (/** @type {unknown} */ v) => /** @type {Say} */ (plainIn(deck, v, lang));
  const word = (/** @type {string} */ key) => pageString(lang, key);
  const author = /** @type {any} */ (deck.identity).author;
  /** @type {Say[]} */ const lines = [];
  const mark = word('colophon.deck'), version = raw.deck.version, prov = isObj(raw.provenance) ? raw.provenance : null;
  const tree = prov && isObj(prov.content) && isText(prov.content.tree) ? ` (${word('colophon.content').text} ${prov.content.tree.slice(0, 7)})` : '';
  lines.push({ text: `${mark.text} ${version}${tree}`, ...(mark.lang ? { lang: mark.lang } : {}) });
  if (prov && isObj(prov.engine) && isText(prov.engine.version)) {
    const eng = word('colophon.engine'), built = word('colophon.built'), dirty = word('colophon.dirty');
    const stamp = isObj(prov.build) && Number.isFinite(prov.build.source_date_epoch) ? ` · ${built.text} ${buildStamp(prov.build.source_date_epoch, c.utc_offset)}` : '';
    const mess = prov.engine.dirty === true || (isObj(prov.build) && prov.build.dirty === true) || (isObj(prov.content) && prov.content.dirty === true) ? ` · ${dirty.text}` : '';
    lines.push({ text: `${eng.text} ${prov.engine.version}${stamp}${mess}`, ...(eng.lang ? { lang: eng.lang } : {}) });
  }
  return {
    title: pageLabel(slide, lang),
    author: {
      label: word('colophon.author'), name: author.name,
      institution: /** @type {any[]} */ (deck.identity?.institution).map(say),
      orcid: isText(author.orcid) ? { label: word('colophon.orcid'), id: author.orcid, url: isUrl(author.orcid_url) ? author.orcid_url : null } : null,
      mail: isText(author.mail) ? author.mail : null,
      mailHref: mailtoHref(author.mail),
    },
    ai: {
      label: word(ai.declared ? 'colophon.ai.made' : 'colophon.ai.use'), declared: ai.declared, statement: say(ai.statement),
      items: ai.declared ? ai.items.map((/** @type {any} */ it) => {
        const names = it.roles.map((/** @type {any} */ r) => say(r.name));
        const other = names.find((/** @type {Say} */ n) => n.lang);
        return { model: it.model, roles: { text: names.map((/** @type {Say} */ n) => n.text).join(', '), ...(other ? { lang: other.lang } : {}) } };
      }) : [],
      review: ai.declared && ai.review ? say(ai.review) : null,
    },
    license: { label: word('colophon.license'), name: c.license.name, url: c.license.url },
    version: { label: word('colophon.version'), lines },
    cite: { label: word('colophon.cite'), text: say(c.citation) },
  };
}
