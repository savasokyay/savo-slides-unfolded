// @ts-check
// WP-12c: the attributes of the document root that the stylesheets read (DECK_SCHEMA section 11.3: the build does not write them, the engine does):
//   data-theme       "light" | "dark": the token set (the dark one is written under :root[data-theme="dark"])
//   data-cues        "on" | "off": the non-colour cues of the semantic roles (D-017, D-068; off by default)
//   data-key-style   "marker": gold text as a band behind the text instead of bold ink (D-074); absent otherwise. It is a choice of the deck, per theme, and
//                    the engine writes it only when the deck's JSON carries it: `chrome.key_style` (proposed field; the build has to write it from config
//                    semantics.key) is "ink" | "marker" for both themes, or {light, dark}. No field, no attribute.
//   lang             written by the player (core/player.js) and by the console
// Every window that shows a deck sets these through here, so the console, the audience, the preview and the student page cannot disagree on how a
// theme change or a cues change is applied (the key style follows the theme).

export const KEY_STYLES = Object.freeze(['ink', 'marker']);

/**
 * Why a deck's `chrome.key_style` is refused, or null when it is fine (absent, "ink" or "marker", or an object whose light and dark entries are those).
 * @param {unknown} v @returns {string|null}
 */
export function keyStyleProblem(v) {
  if (v === undefined) return null;
  if (typeof v === 'string') return KEY_STYLES.includes(v) ? null : `expected "ink" or "marker", found ${JSON.stringify(v)}`;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return `expected "ink", "marker" or {light, dark}, found ${JSON.stringify(v)}`;
  for (const theme of ['light', 'dark']) {
    const s = /** @type {any} */ (v)[theme];
    if (s !== undefined && !KEY_STYLES.includes(s)) return `${theme}: expected "ink" or "marker", found ${JSON.stringify(s)}`;
  }
  return null;
}

/**
 * The key style of a theme: "marker", or null (no attribute: the default look, bold gold ink).
 * @param {{chrome?: any}} deck @param {string} theme @returns {'marker'|null}
 */
export function keyStyleFor(deck, theme) {
  const k = deck.chrome?.key_style;
  const style = typeof k === 'string' ? k : (k && typeof k === 'object' ? k[theme] : undefined);
  return style === 'marker' ? 'marker' : null;
}

/** Set the theme and the key style that goes with it. @param {Document} doc @param {{chrome?: any}} deck @param {string} theme */
export function setTheme(doc, deck, theme) {
  const root = doc.documentElement;
  root.dataset.theme = theme;
  const key = keyStyleFor(deck, theme);
  if (key) root.dataset.keyStyle = key; else delete root.dataset.keyStyle;
}

/** Set the non-colour cues. @param {Document} doc @param {boolean} on */
export function setCues(doc, on) {
  doc.documentElement.dataset.cues = on ? 'on' : 'off';
}
