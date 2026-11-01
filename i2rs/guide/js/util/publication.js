// @ts-check
// WP-237a: the front end of the students' static publication (the package `i2rs export --profile` renders: the weekly-topics pages, no data set, a sidebar of its own). The package says what it
// is in `manifest.json` (`mode: "static"`, `profile`) and holds `publication.json` beside it: which pages it carries (`pages`), which rows are shown but locked (`locked_pages`), when it was
// rendered and from which tree. Everything here is pure and import-free so tests/app/js/publication_check.mjs can pin it under node; `null` is the lab (no publication): then every page is open
// and nothing is stamped.

/**
 * @typedef {{
 *   profile: string, term?: string, title?: Record<string, string>, rendered_at: string, version_major_minor: string,
 *   tree_dirty: boolean, pages: string[], locked_pages?: string[], languages?: string[]
 * }} Publication the fields of `publication.json` the front end reads
 */

/**
 * Whether a package is the publication (and not a plain frozen export): the manifest names a profile.
 * @param {{mode?: string, profile?: unknown} | null | undefined} manifest
 * @returns {boolean}
 */
export function isPublicationManifest(manifest) {
  return Boolean(manifest) && manifest?.mode === "static" && typeof manifest?.profile === "string" && manifest.profile !== "";
}

/**
 * The parsed `publication.json`, or null when it is not one (a missing `pages` list would make the whole edition look closed).
 * @param {unknown} raw
 * @returns {Publication | null}
 */
export function readPublication(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = /** @type {Record<string, any>} */ (raw);
  if (!Array.isArray(data.pages) || data.pages.some((p) => typeof p !== "string")) return null;
  if (typeof data.rendered_at !== "string" || typeof data.version_major_minor !== "string") return null;
  return /** @type {Publication} */ (data);
}

/**
 * Whether a page is in the edition: always in the lab (no publication), else only a page the publication lists. A locked page is not in it: its row is drawn, its page is not.
 * @param {Publication | null | undefined} publication
 * @param {string} page
 * @returns {boolean}
 */
export function editionHas(publication, page) {
  return !publication || publication.pages.includes(page);
}

/**
 * The page a link's `#/page?...` hash names ("" for no page).
 * @param {string} hash
 * @returns {string}
 */
export function pageOfHash(hash) {
  const raw = hash.replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

/**
 * Whether a page draws its "beta" pill and the note under the title (WP-237b): the lab's overview pages say they are still being signed off page by page; the students' edition is the
 * finished text and carries neither (the note is the instructor's working language, not a statement to a reader).
 * @param {Publication | null | undefined} publication
 * @returns {boolean}
 */
export function showsBetaNote(publication) {
  return !publication;
}

/**
 * Whether a lecture board draws its "SVG" download button (WP-248): the lab's - it is the instructor's way of taking a board into his own slides; the students' edition is for reading and
 * studying and has no such button (it stays in the live app).
 * @param {Publication | null | undefined} publication
 * @returns {boolean}
 */
export function showsSvgExport(publication) {
  return !publication;
}

/**
 * The page the edition opens on when a route names a page it does not hold: the manifest's default when that is open, else the first page of the edition.
 * @param {Publication} publication
 * @param {string | null | undefined} preferred `meta.defaults.page`
 * @returns {string}
 */
export function editionStart(publication, preferred) {
  return preferred && publication.pages.includes(preferred) ? preferred : (publication.pages[0] ?? "");
}

/**
 * The stamp the edition carries: "v0.6 · rendered 2026-10-24 17:05" (the major.minor and the render time; the revision is not shown - it is in the page's generator tag), and whether the
 * tree it was rendered from had uncommitted changes (a "preview build").
 * @param {Publication} publication
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @returns {{text: string, preview: boolean}}
 */
export function publicationStamp(publication, t) {
  return {
    text: t("shell.publication_stamp", { version: publication.version_major_minor, at: publication.rendered_at }),
    preview: publication.tree_dirty === true,
  };
}
