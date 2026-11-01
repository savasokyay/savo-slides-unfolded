// @ts-check
// WP-177: greedy word wrap for text drawn in an SVG (a <text> element does not wrap). Pure - the width of a piece of text is the caller's `measure` (the Content-based overview's
// pipeline figure measures with a canvas in the CSS font) - so tests/app/js/wrap_lines_check.mjs can pin it under node with a fixed width per character.

/**
 * Cut `text` at its spaces into lines no wider than `maxWidth`. A word wider than `maxWidth` stands alone on its own line (it is never split). An empty text is no line.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(piece: string) => number} measure the width of a piece of text
 * @returns {string[]}
 */
export function wrapWords(text, maxWidth, measure) {
  const words = String(text).split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
