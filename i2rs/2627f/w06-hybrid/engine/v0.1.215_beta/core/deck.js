// @ts-check
// WP-09: the deck JSON interface of the engine (contract: docs/DECK_SCHEMA.md section 7, draft v1). Every other engine
// module reads a deck through this file only, so a contract change is a change here and nowhere else.
//
// The engine never reads YAML, applies no defaults and re-derives nothing. This module validates what the build wrote,
// fails LOUDLY when it does not understand it (no fallback rendering) and tolerates the ABSENCE of presenter-only fields:
// the student JSON has no `notes`, `slides[].budget_s`, `slides[].in_class` or `chrome.lock_default` (D-028). The role of
// a deck is its `target` field, never inferred from missing fields. Only what the engine reads is validated; everything
// else (review, public_url, cover.qr, provenance, ...) passes through untouched so contract additions need no code here.
//
// States. A content slide with n steps has the states 0 ... n: 0 is the slide as it appears, k is the final picture
// after the k-th step. Deep link: `#/<slide-id>/<k>`.
//
// Math. A text fragment carries math as an EMPTY placeholder `<span data-math="m-<12 hex>"></span>`; the build puts the
// rendered KaTeX in the top-level `math` map ({id: {tex, display, html}}). The placeholder passes the text gate, the KaTeX
// html does not need to (it is trusted build output, not authored text) and is poured in by i18n.js fillMath().
//
// Engine numbers (WP-12c). The top-level `engine` block carries the engine's timing and presenter defaults; `loadDeck` validates it
// (defaults.js resolveEngine) and returns it as `deck.engine` in camelCase. A deck JSON WITHOUT the block gets the built-in DEFAULTS
// (an older build, a fixture); a block that is there but wrong refuses the deck (`engine_invalid`), like every other contract error.
import { resolveEngine } from './defaults.js';
import { keyStyleProblem } from './root.js';

export const FORMAT = 'savo-slides-deck';
export const FORMAT_VERSION = 1;
export const TARGETS = Object.freeze(['presenter', 'student']);
export const THEMES = Object.freeze(['light', 'dark']);
export const PAGE_KINDS = Object.freeze(['cover', 'toc', 'references', 'evidence', 'colophon', 'closing']);
/**
 * Steps of the generated pages are defined by the engine's own page implementations (contract section 7). The table holds what does not depend on the page's entry: the modern and
 * the classic cover have one press (D-020); the contents page, the colophon and the closing page have none. The two paginated pages (references, evidence) take their number from
 * their entry (`pageSteps`): P pages are P - 1 steps (WP-15/17, docs/DECK_SCHEMA.md 7.1); the table's 0 is such a page without a `pages` list (one page, no step).
 * `pageSteps` is what the loader uses: the cover of the variant `none` has no step (WP-46, D-102).
 */
export const PAGE_STEPS = Object.freeze({ cover: 1, toc: 0, references: 0, evidence: 0, colophon: 0, closing: 0 });
/** The kinds the build splits over states: their entry carries `pages`, a list of pages, each a list of record ids (DECK_SCHEMA 7.1). */
export const PAGINATED = Object.freeze(['references', 'evidence']);
/**
 * The steps of a generated page of this deck. `entry` is the page's entry in the deck JSON (or only its kind, for a page that needs nothing from the entry).
 * The cover has none when its variant is `none` (`chrome.cover.variant`, WP-46, D-102): the first press then goes straight to the first content slide.
 * A paginated page has one step per page after the first (WP-15/17, DECK_SCHEMA 7.1: P pages are the states 0 ... P - 1, state s shows `pages[s]`).
 * @param {string|{kind: string, pages?: unknown}} entry @param {any} chrome the deck's chrome block @returns {number}
 */
export function pageSteps(entry, chrome) {
  const kind = typeof entry === 'string' ? entry : entry.kind;
  if (kind === 'cover' && isObj(chrome) && isObj(chrome.cover) && chrome.cover.variant === 'none') return 0;
  if (PAGINATED.includes(kind) && typeof entry !== 'string' && Array.isArray(entry.pages)) return Math.max(0, entry.pages.length - 1);
  return PAGE_STEPS[/** @type {keyof typeof PAGE_STEPS} */ (kind)];
}
/**
 * The kinds that carry no page number (D-118, D-122): the cover and the closing are cards of their own, the contents page is the introduction (D-106), the colophon is the book's own page and
 * not a page of the lecture (D-122; D-118 had counted it with the back pages). The console shows an icon instead of a number for each of them (presenter/page-marks.js).
 */
export const UNNUMBERED = Object.freeze(['cover', 'toc', 'colophon', 'closing']);
/**
 * WP-15 (D-118, changed by D-122): the page numbers of a deck, ONE rule for the footer of every page, for the rows of the contents page and for every number the console shows. The number is 1 on
 * the first page that is not the cover, the contents page, the colophon or the closing, and every later page that is numbered at all (the content slides and the back pages that continue the
 * numbering: references, evidence) takes the next one. `numbers[i]` is the number of `slides[i]`, null when it has none; `total` is how many pages are numbered, so the footer says
 * "n / total" and the last numbered page reads "total / total".
 * @param {{slides: ReadonlyArray<{kind: string}>}} deck @returns {{numbers: Array<number|null>, total: number}}
 */
export function pageNumbers(deck) {
  let total = 0;
  const numbers = deck.slides.map((s) => (UNNUMBERED.includes(s.kind) ? null : ++total));
  return { numbers, total };
}
/** Id of a math placeholder (contract: `m-` and twelve lowercase hex digits). */
export const MATH_ID = /^m-[0-9a-f]{12}$/;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANG = /^[a-z]{2,3}$/;

/** Machine-readable failure of the deck contract. `code` is stable, `path` is a JSON path such as `$.slides[1].title.en`. */
export class DeckError extends Error {
  /** @param {string} code @param {string} path @param {string} message */
  constructor(code, path, message) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'DeckError';
    this.code = code;
    this.path = path;
    this.detail = message;      // the bare explanation, for UIs that print code and path separately
  }
}

/**
 * @typedef {{k: number, beat: string, html: Record<string, string>|null, evidence: string[]}} Step
 * @typedef {object} Slide
 * @property {string} id
 * @property {'content'|'cover'|'toc'|'references'|'evidence'|'colophon'|'closing'} kind
 * @property {number} index         position in reading order
 * @property {boolean} generated    true for the six generated pages
 * @property {number} stepCount     n: the slide has the states 0 ... n
 * @property {number} maxStep       n again, named for clamping
 * @property {string|null} section
 * @property {string|null} layout
 * @property {{use: string, params: object}|null} widget
 * @property {Record<string, string>|null} title   HTML fragments per language (content slides)
 * @property {Record<string, string>|null} hook
 * @property {Step[]} steps
 * @property {string[]} evidence
 * @property {string|null} inClass  presenter only: absent in the student JSON
 * @property {number|null} budgetS  presenter only: absent in the student JSON
 * @property {Record<string, any>|null} entry  WP-15: a generated page's entry as the deck JSON has it (`label`, `badge`, `pages`, `colophon`: DECK_SCHEMA 7.1), read-only; null for a content slide
 * @typedef {{tex: string, display: boolean, html: string}} MathEntry
 * @typedef {object} Deck
 * @property {object} raw
 * @property {'presenter'|'student'} target
 * @property {string} id
 * @property {string[]} langs
 * @property {string} defaultLang
 * @property {Record<string, string>} title
 * @property {Record<string, string>|null} subtitle
 * @property {any} meta             the contract's `deck` object, untouched (version, offering, public_url, review, ...)
 * @property {any} chrome           the contract's `chrome` object, untouched
 * @property {import('./defaults.js').EngineValues} engine   WP-12c: the validated `engine` block (camelCase), or the built-in DEFAULTS when the deck has none
 * @property {any} identity         WP-12c: the contract's `identity` object (author, institution lines, `emblem` and `mark` asset ids), untouched; null in a JSON of an older build
 * @property {Array<{id: string, number: string, title: Record<string, string>, slides: string[]}>} sections
 * @property {Slide[]} slides
 * @property {Map<string, Slide>} byId
 * @property {Record<string, MathEntry>} math   rendered math by placeholder id ({} when the deck has none)
 * @property {any} notes            presenter build only, else null
 * @property {any[]} evidence
 * @property {any[]} assets
 * @typedef {{slideId: string, step: number}} State
 * @typedef {{id: string, path: string}} MathRef
 */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Text fields are HTML fragments written by the build (contract section 7): only `<span data-role="key|term|emph|pos|neg|ex">`
 * and its closing tag, the empty math placeholder `<span data-math="m-<12 hex>"></span>`, `&`, `<` and `>` escaped. Anything
 * else is a build bug and stops the load: the engine inserts these fragments with innerHTML, so this check is the last gate
 * in front of the DOM. Returns the math placeholder ids the fragment contains.
 * @param {unknown} html @param {string} path @returns {string[]}
 */
export function checkFragment(html, path = '$') {
  if (typeof html !== 'string') throw new DeckError('html_not_string', path, 'a text fragment must be a string');
  const open = /^<span data-role="(?:key|term|emph|pos|neg|ex)">/;
  const math = /^<span data-math="(m-[0-9a-f]{12})"><\/span>/;
  /** @type {string[]} */
  const ids = [];
  let depth = 0, i = 0;
  while (i < html.length) {
    const c = html[i];
    if (c === '<') {
      const rest = html.slice(i, i + 60);
      const mm = math.exec(rest);
      if (mm) { ids.push(mm[1]); i += mm[0].length; continue; }          // an empty placeholder, nothing else is a math span
      const m = open.exec(rest);
      if (m) { depth++; i += m[0].length; continue; }
      if (rest.startsWith('</span>')) {
        if (depth === 0) throw new DeckError('html_unbalanced', path, 'closing </span> without an opening tag');
        depth--; i += 7; continue;
      }
      throw new DeckError('html_tag_not_allowed', path, `only <span data-role="key|term|emph|pos|neg|ex"> and the empty <span data-math="m-…"></span> are allowed, found ${JSON.stringify(rest.slice(0, 24))}`);
    }
    if (c === '>') throw new DeckError('html_unescaped', path, 'a bare ">" must be written &gt;');
    if (c === '&') {
      const m = /^&(?:amp|lt|gt|quot|apos|nbsp|#\d{1,7}|#x[0-9a-fA-F]{1,6});/.exec(html.slice(i, i + 12));
      if (!m) throw new DeckError('html_unescaped', path, 'a bare "&" must be written &amp;');
      i += m[0].length; continue;
    }
    i++;
  }
  if (depth !== 0) throw new DeckError('html_unbalanced', path, 'unclosed <span>');
  return ids;
}

/**
 * `emptyOk` (the text of a step, D-097): a text that is the empty string in EVERY language is accepted, as the explicit "no caption from here on" of the layout widget-stage
 * (engine/layouts/widget-stage.js). A text that is empty in some languages only is `i18n_partial_empty`; whitespace is never empty (`i18n_missing`, as everywhere).
 * @param {unknown} v @param {string[]} langs @param {string} path @param {{nullable?: boolean, emptyOk?: boolean, refs: MathRef[]}} o
 */
function checkI18n(v, langs, path, { nullable = false, emptyOk = false, refs }) {
  if (v === null && nullable) return null;
  if (!isObj(v)) throw new DeckError('i18n_not_mapping', path, `expected {${langs.join(', ')}: text}, found ${JSON.stringify(v)}`);
  if (emptyOk) {
    const empty = langs.filter((l) => /** @type {any} */ (v)[l] === '');
    if (empty.length === langs.length) return /** @type {Record<string, string>} */ (v);
    if (empty.length > 0) throw new DeckError('i18n_partial_empty', path, `an empty text clears the caption in every language or in none: empty for ${empty.join(', ')}, not for ${langs.filter((l) => !empty.includes(l)).join(', ')}`);
  }
  for (const l of langs) {
    const t = /** @type {any} */ (v)[l];
    if (typeof t !== 'string' || t.trim() === '') throw new DeckError('i18n_missing', `${path}.${l}`, `no text for the language "${l}"`);
    for (const id of checkFragment(t, `${path}.${l}`)) refs.push({ id, path: `${path}.${l}` });
  }
  return /** @type {Record<string, string>} */ (v);
}

/** @param {unknown} v @param {string} path @param {string} what */
function needSlug(v, path, what) {
  if (typeof v !== 'string' || !SLUG.test(v)) throw new DeckError('invalid_slug', path, `${what} must be a lowercase slug, found ${JSON.stringify(v)}`);
  return v;
}

/**
 * The rendered math of the deck. Every entry needs `tex`, `display` and a KaTeX `html` whose root is a `katex` or
 * `katex-display` span. That html is trusted build output and is NOT passed through the text gate, so it gets a small
 * conservative lint instead (KaTeX never emits any of this).
 * @param {unknown} m @returns {Record<string, MathEntry>}
 */
function checkMath(m) {
  if (m === undefined || m === null) return {};                          // the key is always written by the build; tolerated when no placeholder needs it
  if (!isObj(m)) throw new DeckError('math_invalid', '$.math', 'expected an object {id: {tex, display, html}}');
  for (const [id, e] of Object.entries(m)) {
    const p = `$.math.${id}`;
    if (!MATH_ID.test(id)) throw new DeckError('math_invalid', p, `a math id is "m-" and twelve lowercase hex digits, found ${JSON.stringify(id)}`);
    const o = /** @type {any} */ (e);
    if (!isObj(o) || typeof o.tex !== 'string' || typeof o.display !== 'boolean' || typeof o.html !== 'string' || o.html === '') {
      throw new DeckError('math_invalid', p, 'expected {tex: string, display: boolean, html: non-empty string}');
    }
    if (!/^<span class="katex(?:-display)?"/.test(o.html)) throw new DeckError('math_html_invalid', `${p}.html`, `the KaTeX html must start with <span class="katex…">, found ${JSON.stringify(o.html.slice(0, 40))}`);
    if (/<script|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:/i.test(o.html)) throw new DeckError('math_html_invalid', `${p}.html`, 'the KaTeX html contains a script, a frame or an event handler');
  }
  return /** @type {Record<string, MathEntry>} */ (m);
}

/**
 * Validate a deck JSON and build the engine's view of it. Throws DeckError on the first problem.
 * @param {unknown} raw
 * @returns {Deck}
 */
export function loadDeck(raw) {
  if (!isObj(raw)) throw new DeckError('deck_not_object', '$', 'the deck JSON is not an object');
  const r = /** @type {any} */ (raw);
  if (r.format !== FORMAT) throw new DeckError('format_unknown', '$.format', `expected ${JSON.stringify(FORMAT)}, found ${JSON.stringify(r.format)}; the engine renders no deck it does not understand`);
  if (r.format_version !== FORMAT_VERSION) throw new DeckError('format_version_unknown', '$.format_version', `expected ${FORMAT_VERSION}, found ${JSON.stringify(r.format_version)}; the engine renders no deck it does not understand`);
  if (!TARGETS.includes(r.target)) throw new DeckError('target_invalid', '$.target', `expected "presenter" or "student", found ${JSON.stringify(r.target)}`);

  /** @type {MathRef[]} */
  const refs = [];
  const meta = r.deck;
  if (!isObj(meta)) throw new DeckError('missing', '$.deck', 'the deck metadata object is missing');
  needSlug(meta.id, '$.deck.id', 'the deck id');
  if (!Array.isArray(meta.langs) || meta.langs.length === 0 || new Set(meta.langs).size !== meta.langs.length || !meta.langs.every((l) => typeof l === 'string' && LANG.test(l))) {
    throw new DeckError('langs_invalid', '$.deck.langs', `expected a non-empty list of distinct language codes, found ${JSON.stringify(meta.langs)}`);
  }
  /** @type {string[]} */
  const langs = meta.langs;
  if (!langs.includes(meta.default_lang)) throw new DeckError('default_lang_invalid', '$.deck.default_lang', `${JSON.stringify(meta.default_lang)} is not one of ${JSON.stringify(langs)}`);
  const title = /** @type {Record<string, string>} */ (checkI18n(meta.title, langs, '$.deck.title', { refs }));
  const subtitle = checkI18n(meta.subtitle ?? null, langs, '$.deck.subtitle', { nullable: true, refs });

  const chrome = r.chrome;
  if (!isObj(chrome)) throw new DeckError('missing', '$.chrome', 'the chrome object is missing');
  if (!THEMES.includes(chrome.theme_default)) throw new DeckError('theme_invalid', '$.chrome.theme_default', `expected "light" or "dark", found ${JSON.stringify(chrome.theme_default)}`);
  const eng = resolveEngine(r.engine);                                       // WP-12c: absent = the built-in numbers; present = valid or the deck is refused
  if (eng.values === null) throw new DeckError('engine_invalid', `$.engine${eng.problems[0].path}`, eng.problems[0].detail);
  const keyStyle = keyStyleProblem(chrome.key_style);                       // WP-12c: the gold marker is a deck choice (root.js); a value the engine does not know is refused
  if (keyStyle) throw new DeckError('key_style_invalid', '$.chrome.key_style', keyStyle);

  if (!Array.isArray(r.sections)) throw new DeckError('missing', '$.sections', 'the section list is missing');
  const sections = r.sections.map((/** @type {any} */ s, /** @type {number} */ i) => {
    const p = `$.sections[${i}]`;
    if (!isObj(s)) throw new DeckError('missing', p, 'a section must be an object');
    needSlug(s.id, `${p}.id`, 'a section id');
    if (!Array.isArray(s.slides)) throw new DeckError('missing', `${p}.slides`, 'a section lists its slide ids');
    return { id: s.id, number: String(s.number ?? ''), title: /** @type {Record<string, string>} */ (checkI18n(s.title, langs, `${p}.title`, { refs })), slides: s.slides };
  });
  const sectionIds = new Set(sections.map((s) => s.id));
  if (sectionIds.size !== sections.length) throw new DeckError('duplicate_id', '$.sections', 'section ids must be unique');

  if (!Array.isArray(r.slides) || r.slides.length === 0) throw new DeckError('deck_empty', '$.slides', 'a deck needs at least one slide');
  /** @type {Slide[]} */
  const slides = r.slides.map((/** @type {any} */ s, /** @type {number} */ index) => normalizeSlide(s, index, langs, sectionIds, refs, chrome));
  /** @type {Map<string, Slide>} */
  const byId = new Map();
  for (const s of slides) {
    if (byId.has(s.id)) throw new DeckError('duplicate_id', `$.slides[${s.index}].id`, `slide id "${s.id}" repeats`);
    byId.set(s.id, s);
  }
  for (const [i, sec] of sections.entries()) {
    for (const id of sec.slides) if (!byId.has(id) || byId.get(id)?.kind !== 'content') throw new DeckError('unknown_slide', `$.sections[${i}].slides`, `section "${sec.id}" lists "${id}", which is not a content slide`);
  }

  const math = checkMath(r.math);
  for (const { id, path } of refs) {
    if (!Object.prototype.hasOwnProperty.call(math, id)) throw new DeckError('math_missing', path, `the text has a math placeholder "${id}" but $.math has no entry (with html) for it`);
  }

  return {
    raw: r, target: r.target, id: meta.id, langs, defaultLang: meta.default_lang, title, subtitle, meta, chrome, engine: eng.values, identity: isObj(r.identity) ? r.identity : null, sections, slides, byId, math,
    notes: isObj(r.notes) ? r.notes : null,                // presenter build only: the key is absent in the student JSON
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    assets: Array.isArray(r.assets) ? r.assets : [],
  };
}

/** @param {any} s @param {number} index @param {string[]} langs @param {Set<string>} sectionIds @param {MathRef[]} refs @param {any} chrome @returns {Slide} */
function normalizeSlide(s, index, langs, sectionIds, refs, chrome) {
  const p = `$.slides[${index}]`;
  if (!isObj(s)) throw new DeckError('missing', p, 'a slide must be an object');
  needSlug(s.id, `${p}.id`, 'a slide id');
  if (typeof s.kind !== 'string') throw new DeckError('missing', `${p}.kind`, 'a slide has a kind');
  if (s.kind !== 'content') {
    if (!PAGE_KINDS.includes(s.kind)) throw new DeckError('unknown_kind', `${p}.kind`, `${JSON.stringify(s.kind)} is neither "content" nor one of ${PAGE_KINDS.join(', ')}`);
    if (s.id !== s.kind) throw new DeckError('reserved_id', `${p}.id`, `a generated page has the id of its kind: expected "${s.kind}", found "${s.id}"`);
    if (PAGINATED.includes(s.kind) && s.pages !== undefined) checkPages(s.pages, `${p}.pages`);     // WP-15/17: the build's split is read as it is written, and refused when it is not a split
    const n = pageSteps(s, chrome);
    return { id: s.id, kind: s.kind, index, generated: true, stepCount: n, maxStep: n, section: null, layout: null, widget: null, title: null, hook: null, steps: [], evidence: [], inClass: null, budgetS: null, entry: s };
  }
  if (PAGE_KINDS.includes(s.id)) throw new DeckError('reserved_id', `${p}.id`, `"${s.id}" is reserved for the generated page`);
  if (typeof s.layout !== 'string' || s.layout === '') throw new DeckError('missing', `${p}.layout`, 'a content slide names its layout');
  if (typeof s.section !== 'string' || !sectionIds.has(s.section)) throw new DeckError('unknown_section', `${p}.section`, `${JSON.stringify(s.section)} is not a section id`);
  const widget = s.widget === null || s.widget === undefined ? null : s.widget;
  if (widget !== null && (!isObj(widget) || typeof widget.use !== 'string' || !isObj(widget.params ?? {}))) throw new DeckError('widget_invalid', `${p}.widget`, 'expected null or {use, params}');
  if (!Array.isArray(s.steps)) throw new DeckError('missing', `${p}.steps`, 'a content slide lists its steps (possibly none)');
  /** @type {Step[]} */
  const steps = s.steps.map((/** @type {any} */ st, /** @type {number} */ i) => {
    const sp = `${p}.steps[${i}]`;
    if (!isObj(st)) throw new DeckError('missing', sp, 'a step must be an object');
    if (st.k !== i + 1) throw new DeckError('step_k_invalid', `${sp}.k`, `steps count from 1 in reading order: expected ${i + 1}, found ${JSON.stringify(st.k)}`);
    return { k: st.k, beat: String(st.beat ?? ''), html: checkI18n(st.html ?? null, langs, `${sp}.html`, { nullable: true, emptyOk: true, refs }), evidence: Array.isArray(st.evidence) ? st.evidence : [] };
  });
  return {
    id: s.id, kind: 'content', index, generated: false, stepCount: steps.length, maxStep: steps.length,
    section: s.section, layout: s.layout, widget: widget === null ? null : { use: widget.use, params: widget.params ?? {} },
    title: checkI18n(s.title, langs, `${p}.title`, { refs }), hook: checkI18n(s.hook ?? null, langs, `${p}.hook`, { nullable: true, refs }), steps,
    evidence: Array.isArray(s.evidence) ? s.evidence : [],
    inClass: typeof s.in_class === 'string' ? s.in_class : null, budgetS: typeof s.budget_s === 'number' ? s.budget_s : null,   // absent in the student JSON
    entry: null,
  };
}

/**
 * The `pages` of a paginated entry (DECK_SCHEMA 7.1): a list of at least one page, each a non-empty list of record ids (non-empty strings), and every id on exactly one page.
 * The build guarantees it; the engine only refuses what is not a split, loudly, with the path, so a wrong deck stops at load and not on the second press of the references.
 * @param {unknown} pages @param {string} path
 */
function checkPages(pages, path) {
  if (!Array.isArray(pages) || pages.length === 0) throw new DeckError('pages_invalid', path, `expected a list of at least one page, found ${JSON.stringify(pages)}`);
  /** @type {Set<string>} */ const seen = new Set();
  pages.forEach((page, i) => {
    if (!Array.isArray(page) || page.length === 0) throw new DeckError('pages_invalid', `${path}[${i}]`, `a page is a non-empty list of record ids, found ${JSON.stringify(page)}`);
    page.forEach((id, j) => {
      if (typeof id !== 'string' || id === '') throw new DeckError('pages_invalid', `${path}[${i}][${j}]`, `a record id is a non-empty string, found ${JSON.stringify(id)}`);
      if (seen.has(id)) throw new DeckError('pages_invalid', `${path}[${i}][${j}]`, `the record "${id}" is on two pages`);
      seen.add(id);
    });
  });
}

// ---------- states and navigation (pure) ----------

/** @param {Deck} deck @param {string} id @returns {Slide} */
export function slideAt(deck, id) {
  const s = deck.byId.get(id);
  if (!s) throw new DeckError('unknown_slide', '$.slides', `no slide with the id "${id}"`);
  return s;
}
/** @param {Deck} deck @returns {State} */
export const firstState = (deck) => ({ slideId: deck.slides[0].id, step: 0 });
/** @param {Deck} deck @returns {State} */
export const lastState = (deck) => { const s = deck.slides[deck.slides.length - 1]; return { slideId: s.id, step: s.maxStep }; };

/**
 * The state one "next" press leads to. `entering` is true when it crosses into the following slide: that slide is then
 * ENTERED (its state 0 animates in) instead of continuing a step. null at the end of the deck.
 * @param {Deck} deck @param {State} st @returns {(State & {entering: boolean})|null}
 */
export function nextState(deck, st) {
  const s = slideAt(deck, st.slideId);
  if (st.step < s.maxStep) return { slideId: s.id, step: st.step + 1, entering: false };
  const n = deck.slides[s.index + 1];
  return n ? { slideId: n.id, step: 0, entering: true } : null;
}
/**
 * The state one "back" press leads to: the previous step, or the LAST state of the previous slide. Back is always drawn
 * instantly. null at the start of the deck.
 * @param {Deck} deck @param {State} st @returns {State|null}
 */
export function prevState(deck, st) {
  const s = slideAt(deck, st.slideId);
  if (st.step > 0) return { slideId: s.id, step: st.step - 1 };
  const p = deck.slides[s.index - 1];
  return p ? { slideId: p.id, step: p.maxStep } : null;
}
/**
 * Make an arbitrary (slideId, step) request valid: an unknown or missing slide leads to the first slide, a step beyond the
 * last is clamped. Every correction is reported, never silent.
 * @param {Deck} deck @param {{slideId: string|null, step?: number}} req
 * @returns {{state: State, problems: Array<{code: string, value: string}>}}
 */
export function clampState(deck, { slideId, step = 0 }) {
  /** @type {Array<{code: string, value: string}>} */
  const problems = [];
  let slide = slideId ? deck.byId.get(slideId) : undefined;
  if (!slide) {
    if (slideId) problems.push({ code: 'unknown-slide', value: slideId });
    return { state: firstState(deck), problems };
  }
  let k = Number.isInteger(step) ? step : 0;
  if (k < 0) { problems.push({ code: 'step-negative', value: String(step) }); k = 0; }
  if (k > slide.maxStep) { problems.push({ code: 'step-clamped', value: `${k}>${slide.maxStep}` }); k = slide.maxStep; }
  return { state: { slideId: slide.id, step: k }, problems };
}

// ---------- language, theme, notes, assets ----------

/** The text of an i18n value in `lang`, falling back to the deck's default language. @param {Deck} deck @param {Record<string, string>|null|undefined} v @param {string} lang */
export const text = (deck, v, lang) => (v ? (v[lang] ?? v[deck.defaultLang] ?? '') : '');
/** @param {Deck} deck @param {string|null|undefined} requested */
export const resolveLang = (deck, requested) => (requested && deck.langs.includes(requested) ? requested : deck.defaultLang);
/** @param {Deck} deck @param {string|null|undefined} requested */
export const resolveTheme = (deck, requested) => (requested && THEMES.includes(requested) ? requested : deck.chrome.theme_default);
/** Speaker note of (slide, lang, step), or null: always null in a student deck. @param {Deck} deck @param {string} slideId @param {string} lang @param {number} step @returns {string|null} */
export const notesFor = (deck, slideId, lang, step) => (deck.notes?.[slideId]?.[lang]?.[String(step)] ?? null);
/** Absolute URL of an asset (its `url` is relative to the deck). @param {Deck} deck @param {string} id @param {string} base */
export function assetUrl(deck, id, base) {
  const a = deck.assets.find((x) => x.id === id);
  if (!a) throw new DeckError('unknown_asset', '$.assets', `no asset with the id "${id}"`);
  return new URL(a.url, base).href;
}
