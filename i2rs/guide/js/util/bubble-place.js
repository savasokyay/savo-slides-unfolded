// @ts-check
// WP-168c: where a help bubble goes next to its anchor, inside the window. Used by the network diagram's box tips (centred over the box) and the rich (i) bubble (its left edge at the button
// when it fits). A bubble opens on the side with the room for it - below by default - and where neither side has room for all of it, it takes the larger one and is as tall as that room
// (its own content scrolls). Plain arithmetic, checked under node against values worked out by hand (tests/app/js/bubble_place_check.mjs).

/**
 * @param {{anchor: {left: number, right: number, top: number, bottom: number}, vw: number, vh: number, width: number, height: number, align?: "center" | "start", margin?: number, gap?: number}} opts
 *   `anchor`: the element's rectangle in the window; `vw` / `vh`: the window; `width` / `height`: the bubble's wanted size (its natural height, measured); `align`: centred over the
 *   anchor or its left edge at the anchor's left (flipped to its right edge when that does not fit); `margin`: the room kept to the window's edge; `gap`: the room kept to the anchor.
 * @returns {{left: number, top: number, width: number, maxHeight: number, side: "below" | "above"}} `maxHeight`: the room on the chosen side (the bubble's height is capped at it)
 */
export function placeBubble({ anchor, vw, vh, width, height, align = "center", margin = 8, gap = 6 }) {
  const w = Math.min(width, vw - 2 * margin);
  let left = align === "center" ? (anchor.left + anchor.right) / 2 - w / 2 : anchor.left;
  if (align === "start" && left + w > vw - margin) left = anchor.right - w; // does not fit to the right of the button's left edge: its right edge is the bubble's
  left = Math.max(margin, Math.min(left, vw - margin - w));
  const below = vh - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;
  /** @type {"below" | "above"} */
  let side;
  if (below >= height) side = "below";
  else if (above >= height) side = "above";
  else side = below >= above ? "below" : "above";
  const maxHeight = Math.max(0, side === "below" ? below : above);
  const shown = Math.min(height, maxHeight);
  const top = side === "below" ? anchor.bottom + gap : anchor.top - gap - shown;
  return { left, top, width: w, maxHeight, side };
}
