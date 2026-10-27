// @ts-check
// WP-168c: the plain text format of a rich help bubble (components/rich-tip.js): an i18n string with a few line types, so a long explanation can have bold headings and lists without
// markup in the translation files. One line is one block:
//   "## Heading"        a bold heading
//   "- item"            a bullet (consecutive bullets form one list)
//   "1. item"           a numbered item (consecutive numbered lines form one list; the number is the list's own)
//   anything else       a paragraph
// An empty line is nothing. Inside a paragraph or an item, "**text**" is bold (a lead-in the reader can scan). Checked under node (tests/app/js/rich_text_check.mjs); the DOM shell is
// components/rich-tip.js.

/**
 * @typedef {{text: string, strong: boolean}} Part
 * @typedef {{type: "h", parts: Part[]} | {type: "p", parts: Part[]} | {type: "ul" | "ol", items: Part[][]}} Block
 */

/**
 * "**bold** and plain" -> [{bold}, {plain}]; an unclosed "**" is plain text.
 * @param {string} text
 * @returns {Part[]}
 */
export function inlineParts(text) {
  /** @type {Part[]} */
  const parts = [];
  let rest = String(text);
  while (rest.length) {
    const open = rest.indexOf("**");
    const close = open < 0 ? -1 : rest.indexOf("**", open + 2);
    if (open < 0 || close < 0) {
      parts.push({ text: rest, strong: false });
      break;
    }
    if (open > 0) parts.push({ text: rest.slice(0, open), strong: false });
    if (close > open + 2) parts.push({ text: rest.slice(open + 2, close), strong: true });
    rest = rest.slice(close + 2);
  }
  return parts;
}

/**
 * @param {string} text
 * @returns {Block[]}
 */
export function parseRichText(text) {
  /** @type {Block[]} */
  const blocks = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^##\s+(.*)$/.exec(line);
    const bullet = /^-\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (heading) blocks.push({ type: "h", parts: inlineParts(heading[1]) });
    else if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      const item = inlineParts((bullet ?? /** @type {RegExpExecArray} */ (numbered))[1]);
      if (last && last.type === type) last.items.push(item);
      else blocks.push({ type, items: [item] });
    } else blocks.push({ type: "p", parts: inlineParts(line) });
  }
  return blocks;
}
