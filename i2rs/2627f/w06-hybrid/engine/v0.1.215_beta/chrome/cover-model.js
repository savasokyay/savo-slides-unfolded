// @ts-check
// WP-14: the cover's model and the ONE place that reads the deck JSON for it. `coverModel(deckJson, lang)` turns the engine deck JSON
// (docs/DECK_SCHEMA.md section 7; the cover block approved in plan section 12, 2026-10-22 21:37) into a model whose strings are plain text in the language
// on screen; `buildCover(document, model)` (cover.js) draws from that model and never sees the JSON. A missing field is an error with a code, never a blank.
//
// The paths read (the build writes them; an unknown extra key anywhere is ignored):
//   identity.institution[3]        {en, tr} each            identity.author {name, mail}      identity.emblem, identity.mark   asset ids
//   deck.title_text                {en, tr}                 deck.subtitle_text {en, tr}|null  deck.topic {en, tr}|null
//   course                         {code: string|null, name: {en, tr}}   top level: the course's constants (decks/<course>/course.yaml); a venue deck has code null and its venue name
//   chrome.cover.variant           none|modern|classic      chrome.cover.watermark right|center|none        (`none`, WP-46: a still cover, no press, and `deck.topic` is not read)
//   chrome.cover.qr                [{role: "mail", asset: id}, {role: "deck", alt: {en, tr}, modules: {n, quiet, d, cut}}]   (the deck QR only when there is a public address)
//                                  The e-mail QR is the user's own picture, an asset. The deck QR is DATA (D-078): its dark modules wear the information band's colour, so it is drawn
//                                  inline from the module path (qr.js); an SVG inside an <img> cannot read the page theme's CSS variable.
//   chrome.cover.address           {url, lines: [..]}|null  chrome.cover.net {seed, nodes}
//   assets[]                       {id, url, alt: {en, tr}}  (url is relative to the page)
//   provenance                     engine.version, content.version, build.stamp
// Every {en, tr} text is plain: the build writes plain twins of the fragment fields (title_text, subtitle_text); a cover never shows markup.
import { validateModules } from './qr.js';

/**
 * @typedef {'en'|'tr'} Lang
 * @typedef {{src: string, alt: string}} Image
 * @typedef {object} CoverModel
 * @property {Lang} lang
 * @property {'none'|'modern'|'classic'} variant   the transition the player plays (D-020); `none` plays none and has no press (WP-46, D-102); the card itself is the same
 * @property {Image} emblem                    the ESOGÜ emblem, on its white disc
 * @property {Image} mark                      the gold S; the cover draws it only as the faint watermark
 * @property {string[]} institution            exactly three lines, beside the emblem
 * @property {{code: string|null, name: string}} course
 * @property {string|null} topic               the big top title; without it the title takes its place. Always null for the variant `none` (WP-46: the topic repeated the course name; the field stays in the deck for the other variants)
 * @property {string} title
 * @property {string|null} subtitle
 * @property {{name: string, mail: string}} author
 * @property {{mail: Image, deck: {alt: string, modules: import('./qr.js').QrModules}|null}} qr   the deck QR is module data drawn inline (D-078), not a picture
 * @property {string[]|null} address           the deck address, one whole URL part per line; null together with qr.deck
 * @property {{seed: number, nodes: number}} net
 * @property {'right'|'center'|'none'} watermark
 * @property {{engine: string, content: string, built: string}} stamp
 */

/** Thrown for a cover model, or the JSON it is read from, that cannot be drawn. `problems` are `code: detail` strings. */
export class CoverModelError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`cover model: ${problems.join('; ')}`);
    this.name = 'CoverModelError';
    this.problems = problems;
  }
}

const LANGS = ['en', 'tr'];
const VARIANTS = ['none', 'modern', 'classic'];
const WATERMARKS = ['right', 'center', 'none'];
const isText = (/** @type {unknown} */ v) => typeof v === 'string' && v.trim() !== '';
const isInt = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isInteger(v);
const isImage = (/** @type {any} */ v) => !!v && typeof v === 'object' && isText(v.src) && typeof v.alt === 'string';

/**
 * Every problem of a cover model; an empty list means it can be drawn.
 * @param {any} m
 * @returns {string[]}
 */
export function validateCoverModel(m) {
  /** @type {string[]} */ const bad = [];
  if (!m || typeof m !== 'object') return ['model_missing: the model is not an object'];
  if (!LANGS.includes(m.lang)) bad.push(`lang_unknown: "${m.lang}"`);
  if (!VARIANTS.includes(m.variant)) bad.push(`variant_unknown: "${m.variant}"`);
  if (!isImage(m.emblem) || !isText(m.emblem.alt)) bad.push('emblem_invalid: needs src and alt text');
  if (!isImage(m.mark)) bad.push('mark_invalid: needs src');
  if (!Array.isArray(m.institution) || m.institution.length !== 3 || !m.institution.every(isText)) bad.push('institution_invalid: exactly three non-empty lines');
  if (!m.course || typeof m.course !== 'object' || !isText(m.course.name) || (m.course.code !== null && !isText(m.course.code))) bad.push('course_invalid: needs a name and a code or null');
  if (m.topic !== null && !isText(m.topic)) bad.push('topic_invalid: text or null');
  if (!isText(m.title)) bad.push('title_empty');
  if (m.subtitle !== null && !isText(m.subtitle)) bad.push('subtitle_invalid: text or null');
  if (!m.author || !isText(m.author.name) || !isText(m.author.mail)) bad.push('author_invalid: needs name and mail');
  if (!m.qr || !isImage(m.qr.mail) || !isText(m.qr.mail.alt)) bad.push('qr_mail_invalid: the e-mail QR needs src and alt text');
  if (m.qr && m.qr.deck !== null) {
    if (!m.qr.deck || typeof m.qr.deck !== 'object' || !isText(m.qr.deck.alt)) bad.push('qr_deck_invalid: alt text and the module path, or null');
    else for (const p of validateModules(m.qr.deck.modules)) bad.push(`qr_deck_${p}`);
  }
  if (m.address !== null && (!Array.isArray(m.address) || m.address.length < 1 || m.address.length > 4 || !m.address.every(isText))) bad.push('address_invalid: one to four non-empty lines, or null');
  if (m.qr && (m.address === null) !== (m.qr.deck === null)) bad.push('address_qr_mismatch: the address and the deck QR come together or not at all (D-022)');
  if (!m.net || !isInt(m.net.seed) || !isInt(m.net.nodes) || m.net.nodes < 1) bad.push('net_invalid: integer seed, positive integer node count');
  if (!WATERMARKS.includes(m.watermark)) bad.push(`watermark_unknown: "${m.watermark}"`);
  if (!m.stamp || !isText(m.stamp.engine) || !isText(m.stamp.content) || !isText(m.stamp.built)) bad.push('stamp_invalid: engine, content and built as text');
  return bad;
}

/** @param {any} model @returns {CoverModel} */
export function assertCoverModel(model) {
  const problems = validateCoverModel(model);
  if (problems.length) throw new CoverModelError(problems);
  return model;
}

/**
 * Read the cover model out of the deck JSON, in `lang`.
 * @param {any} deckJson  the parsed contents of <script id="savo-deck">
 * @param {Lang} lang
 * @returns {CoverModel}
 */
export function coverModel(deckJson, lang) {
  /** @type {string[]} */ const bad = [];
  if (!LANGS.includes(lang)) throw new CoverModelError([`lang_unknown: "${lang}"`]);
  const at = (/** @type {any} */ obj, /** @type {string} */ path) => path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  /** A required bilingual text in `lang`, or an error naming the path. */
  const text = (/** @type {any} */ v, /** @type {string} */ path) => {
    const t = v && typeof v === 'object' ? v[lang] : undefined;
    if (!isText(t)) { bad.push(`text_missing: ${path}.${lang}`); return ''; }
    return t;
  };
  /** An optional bilingual text: null when absent, an error when given without `lang`. */
  const maybe = (/** @type {any} */ v, /** @type {string} */ path) => (v === null || v === undefined ? null : text(v, path));
  const need = (/** @type {any} */ v, /** @type {string} */ path) => { if (v === null || v === undefined) bad.push(`field_missing: ${path}`); return v; };

  const identity = need(at(deckJson, 'identity'), 'identity') ?? {};
  const cover = need(at(deckJson, 'chrome.cover'), 'chrome.cover') ?? {};
  const deck = need(at(deckJson, 'deck'), 'deck') ?? {};
  const assets = new Map(((/** @type {any[]} */ (Array.isArray(deckJson?.assets) ? deckJson.assets : []))).map((a) => [a.id, a]));
  /** An asset id resolved to its url and its alt text in `lang`. */
  const image = (/** @type {any} */ id, /** @type {string} */ path) => {
    const a = isText(id) ? assets.get(id) : undefined;
    if (!a) { bad.push(`asset_missing: ${path} (${id})`); return { src: '', alt: '' }; }
    return { src: String(a.url ?? ''), alt: a.alt ? text(a.alt, `assets[${id}].alt`) : (bad.push(`text_missing: assets[${id}].alt.${lang}`), '') };
  };

  for (const key of ['variant', 'watermark', 'net']) need(cover[key], `chrome.cover.${key}`);
  for (const key of ['name', 'mail']) if (!isText(identity.author?.[key])) bad.push(`field_missing: identity.author.${key}`);
  const institution = Array.isArray(identity.institution) ? identity.institution.map((/** @type {any} */ l, /** @type {number} */ i) => text(l, `identity.institution[${i}]`)) : (bad.push('field_missing: identity.institution'), []);
  const course = need(at(deckJson, 'course'), 'course') ?? {};
  const qrList = Array.isArray(cover.qr) ? cover.qr : [];
  const qrOf = (/** @type {string} */ role) => qrList.find((/** @type {any} */ q) => q && q.role === role);
  const mailQr = qrOf('mail'), deckQr = qrOf('deck');
  if (!mailQr) bad.push('field_missing: chrome.cover.qr[role=mail]');
  const address = cover.address ?? null;
  const prov = deckJson?.provenance ?? {};
  const orNone = (/** @type {any} */ v) => (isText(v) ? String(v) : 'n/a');   // an unstamped build (a fixture, a dirty tree) prints "n/a", not nothing

  const model = {
    lang,
    variant: cover.variant,
    emblem: image(identity.emblem, 'identity.emblem'),
    mark: image(identity.mark, 'identity.mark'),
    institution,
    course: { code: isText(course.code) ? String(course.code) : null, name: text(course.name, 'course.name') },
    topic: cover.variant === 'none' ? null : maybe(deck.topic, 'deck.topic'),       // WP-46: the plain cover has no topic line (it repeated the course name); the field is not even read
    title: text(deck.title_text, 'deck.title_text'),
    subtitle: maybe(deck.subtitle_text, 'deck.subtitle_text'),
    author: { name: String(identity.author?.name ?? ''), mail: String(identity.author?.mail ?? '') },
    qr: {
      mail: mailQr ? image(mailQr.asset, 'chrome.cover.qr[mail]') : { src: '', alt: '' },
      deck: deckQr ? { alt: text(deckQr.alt, 'chrome.cover.qr[deck].alt'), modules: need(deckQr.modules, 'chrome.cover.qr[deck].modules') ?? {} } : null,
    },
    address: address ? (Array.isArray(address.lines) ? address.lines.map(String) : (bad.push('field_missing: chrome.cover.address.lines'), [])) : null,
    net: { seed: cover.net?.seed, nodes: cover.net?.nodes },
    watermark: cover.watermark,
    stamp: { engine: orNone(prov.engine?.version), content: orNone(prov.content?.version), built: orNone(prov.build?.stamp) },
  };
  // What is absent is reported with its JSON path (the placeholders above only keep the walk going); only a JSON that has everything is then checked
  // for what is present but wrong (a bad enum, a text that is blank).
  if (bad.length) throw new CoverModelError(bad);
  return assertCoverModel(model);
}
