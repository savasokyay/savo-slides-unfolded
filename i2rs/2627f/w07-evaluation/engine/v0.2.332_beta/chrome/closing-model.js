// @ts-check
// WP-19 (D-021, D-061, D-064, D-117, D-121): the closing page's model and the ONE place that reads the deck JSON for it, as cover-model.js does for the cover. `closingModel(deckJson, lang)` turns the
// engine deck JSON (docs/DECK_SCHEMA.md section 7) into a model whose strings are plain text in the language on screen; `buildClosing(document, model)` (closing.js) draws from it and never sees the JSON.
// A missing field is an error with a code, never a blank.
//
// The paths read (the build writes them; an unknown extra key anywhere is ignored):
//   identity.author {name, mail}      identity.mark   an asset id: assets[] {id, url, alt {en, tr}} gives the S's picture and its text alternative
//   chrome.closing.variant            modern|classic (D-021; `modern` when the deck says nothing). The still page of D-121 looks the same for both; the name is read and checked so the animated page
//                                     that may come later finds it in every deck already
//   chrome.cover.net {seed, nodes}    the network of the cover is the closing's too
// The page (D-061, D-064, D-117, D-125, the lead's reading of 2026-10-25): the gold S in the middle on the navy card with the faint network; the identity at the bottom, one line under the other: the name
// in gold and the e-mail address as a mailto link (D-125, the one exception to D-088's https-only rule); no institution lines any more (D-125: the cover has them) and no "Thank you" in a lecture deck.
// `identity.institution` is not read: a deck whose institution is incomplete can still close.
import { mailtoHref } from './mailto.js';

/**
 * @typedef {'en'|'tr'} Lang
 * @typedef {object} ClosingModel
 * @property {Lang} lang
 * @property {'modern'|'classic'} variant        D-021: how the S would be built if it were animated; the still page ignores it
 * @property {{name: string, mail: string, mailHref: string|null}} author   `mailHref`: `mailto:<mail>` when the address is a plain one (chrome/mailto.js), else null and the address is shown as text
 * @property {{src: string, alt: string}} mark   the gold S: the asset's address as the deck JSON writes it (relative to the page) and its text alternative in `lang`
 * @property {{seed: number, nodes: number}} net
 */

/** Thrown for a closing model, or the JSON it is read from, that cannot be drawn. `problems` are `code: detail` strings. */
export class ClosingModelError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`closing model: ${problems.join('; ')}`);
    this.name = 'ClosingModelError';
    this.problems = problems;
  }
}

const LANGS = ['en', 'tr'];
const VARIANTS = ['modern', 'classic'];
const isText = (/** @type {unknown} */ v) => typeof v === 'string' && v.trim() !== '';
const isInt = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isInteger(v);

/**
 * Every problem of a closing model; an empty list means it can be drawn.
 * @param {any} m @returns {string[]}
 */
export function validateClosingModel(m) {
  /** @type {string[]} */ const bad = [];
  if (!m || typeof m !== 'object') return ['model_missing: the model is not an object'];
  if (!LANGS.includes(m.lang)) bad.push(`lang_unknown: "${m.lang}"`);
  if (!VARIANTS.includes(m.variant)) bad.push(`variant_unknown: "${m.variant}"`);
  if (!m.author || !isText(m.author.name) || !isText(m.author.mail)) bad.push('author_invalid: needs name and mail');
  else if (m.author.mailHref !== null && m.author.mailHref !== undefined && m.author.mailHref !== mailtoHref(m.author.mail)) bad.push('mail_href_invalid: the link is `mailto:` and the address, nothing else');
  if (!m.mark || !isText(m.mark.src) || !isText(m.mark.alt)) bad.push('mark_invalid: needs src and alt text');
  if (!m.net || !isInt(m.net.seed) || !isInt(m.net.nodes) || m.net.nodes < 2) bad.push('net_invalid: needs an integer seed and at least two nodes');
  return bad;
}

/** @param {any} m @returns {asserts m is ClosingModel} */
export function assertClosingModel(m) {
  const bad = validateClosingModel(m);
  if (bad.length) throw new ClosingModelError(bad);
}

/**
 * The model of the closing page from the engine deck JSON (the raw object, `deck.raw` of core/deck.js).
 * @param {any} raw @param {string} lang @returns {ClosingModel}
 */
export function closingModel(raw, lang) {
  /** @type {string[]} */ const bad = [];
  const identity = raw?.identity;
  if (!identity || typeof identity !== 'object') bad.push('field_missing: identity');
  const author = identity?.author;
  if (!author || typeof author !== 'object') bad.push('field_missing: identity.author');
  const assets = new Map((Array.isArray(raw?.assets) ? raw.assets : []).map((/** @type {any} */ a) => [a?.id, a]));
  const markAsset = isText(identity?.mark) ? assets.get(identity.mark) : undefined;
  let markAlt = '';
  if (!markAsset) bad.push(`asset_missing: identity.mark (${identity?.mark})`);
  else if (markAsset.alt && isText(markAsset.alt[lang])) markAlt = markAsset.alt[lang];
  else bad.push(`text_missing: assets[${identity.mark}].alt.${lang}`);
  const variant = raw?.chrome?.closing?.variant ?? 'modern';
  const net = raw?.chrome?.cover?.net;
  if (!net || typeof net !== 'object') bad.push('field_missing: chrome.cover.net');
  /** @type {ClosingModel} */
  const model = {
    lang: /** @type {Lang} */ (lang),
    variant,
    author: { name: isText(author?.name) ? author.name : '', mail: isText(author?.mail) ? author.mail : '', mailHref: mailtoHref(author?.mail) },
    mark: { src: markAsset ? String(markAsset.url ?? '') : '', alt: markAlt },
    net: { seed: net?.seed, nodes: net?.nodes },
  };
  bad.push(...validateClosingModel(model));
  if (bad.length) throw new ClosingModelError([...new Set(bad)]);
  return model;
}
