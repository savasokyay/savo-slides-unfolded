// @ts-check
// WP-116 (round 2): key words in running text. A text of config/i18n may mark a few words with `**…**`; the page draws them as
// `<strong class="key">` (coloured and bold, memory.css). Only this marker is read - the text is built from text nodes and `strong`
// elements through the DOM, never through innerHTML, so nothing in a translation can inject markup. No nesting; an unmatched `**`
// stays as the two characters it is. Plain logic: hand-checked under node (tests/app/js/memory_text_check.mjs).

/** one `**…**` span (the shortest: two spans in a text never merge) */
const MARK = /\*\*(.+?)\*\*/g;

/**
 * @param {string} text
 * @returns {{text: string, key: boolean}[]} the text cut at its marks, in order; the marks themselves are gone
 */
export function emphasisParts(text) {
  /** @type {{text: string, key: boolean}[]} */
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(MARK)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), key: false });
    parts.push({ text: match[1], key: true });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), key: false });
  return parts;
}

/**
 * The text without its marks (a tooltip or an accessible name must not show `**`).
 * @param {string} text
 * @returns {string}
 */
export function stripEmphasis(text) {
  return text.replace(MARK, "$1");
}

/**
 * Appends a text to `parent`: plain parts as text nodes, marked parts as `<strong class="key">`.
 * @param {HTMLElement} parent
 * @param {string} text
 * @param {Document} [doc] the document that makes the nodes (a stand-in under node)
 * @returns {HTMLElement} `parent`
 */
export function appendEmphasis(parent, text, doc = document) {
  for (const part of emphasisParts(text)) {
    if (part.key) {
      const strong = doc.createElement("strong");
      strong.className = "key";
      strong.textContent = part.text;
      parent.appendChild(strong);
    } else {
      parent.appendChild(doc.createTextNode(part.text));
    }
  }
  return parent;
}
