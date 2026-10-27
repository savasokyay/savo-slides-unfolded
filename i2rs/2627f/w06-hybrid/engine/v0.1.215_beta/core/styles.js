// @ts-check
// WP-12c: the stylesheets of a page that draws slides, loaded by the engine itself (the pattern of the console, which loads console.css the same way).
// The build writes <style id="savo-theme"> (tokens) and may link `build.engine_css`; this list is what the ENGINE needs, so a page works without any
// per-page CSS from the build and a stylesheet the build already linked is not loaded twice. Paths are relative to this file, so the copy of the engine
// under <target>/engine/<version>/ finds its own files. The page waits for them before anything is drawn: no flash of an unstyled slide.
// No timer here (D-039): a stylesheet that neither loads nor fails would hold the page like any render-blocking <link> in a <head> does.
// WP-12c (lead decision, 2026-10-25): the engine's own stylesheets are loaded from THIS list and from no other place; config build.engine_css stays empty.
// A build that did link one of them is harmless: the loader compares absolute addresses and skips a sheet the page already has (tests/js/styles.test.mjs).

/** Fonts first (the geometry of the chrome is measured against the real faces), then the stage and the chrome, the semantic roles, the content layouts and the card (cover and closing). */
export const STAGE_STYLES = Object.freeze(['../css/fonts.css', '../css/chrome.css', '../css/roles.css', '../css/content.css', '../css/widgets.css', '../css/cover.css', '../css/pages.css']);   // WP-12c: cover.css, so the cover is drawn by the engine with no config line to forget; WP-20: content.css, the look of the layouts
/** The student page adds the look of its display controls (D-073). The audience window and the preview have none (zero UI, plan 3.3). */
export const STUDENT_STYLES = Object.freeze([...STAGE_STYLES, '../css/controls.css']);

/**
 * Absolute URLs of the stylesheets a role needs. The console has its own (presenter/console.css, loaded by console.js).
 * @param {'student'|'audience'|'console'} role @returns {string[]}
 */
export function styleUrls(role) {
  const list = role === 'student' ? STUDENT_STYLES : role === 'audience' ? STAGE_STYLES : [];
  return list.map((p) => new URL(p, import.meta.url).href);
}

/**
 * Add the stylesheets to <head> (in this order, so the cascade is the list's) and wait until each has loaded or failed. A sheet the page already links
 * (same resolved address) is not added again. A failure is returned, not thrown: an unstyled slide on a screen beats a blank one.
 * @param {Document} doc @param {string[]} urls
 * @returns {Promise<string[]>} one sentence per stylesheet that could not be loaded
 */
export function loadStylesheets(doc, urls) {
  const have = new Set([...doc.querySelectorAll('link[rel~="stylesheet"]')].map((l) => /** @type {HTMLLinkElement} */ (l).href));
  /** @type {Array<Promise<string|null>>} */
  const waits = urls.filter((u) => !have.has(u)).map((href) => new Promise((resolve) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(null);
    link.onerror = () => resolve(`${href.split('/').pop()} could not be loaded`);
    doc.head.appendChild(link);
  }));
  return Promise.all(waits).then((r) => /** @type {string[]} */ (r.filter((x) => x !== null)));
}
