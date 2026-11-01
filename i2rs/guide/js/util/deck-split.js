// @ts-check
// WP-111: the arithmetic of the divider between the board and the narration card on the deck pages (pages/slides-page.js measures the
// row and draws, this decides; components/splitter.js + util/split-ratio.js do the dragging and the share). Plain logic, no DOM.
//   total   = the pair's combined width in px (the row minus the gap between the two panels)
//   natural = the width the board's HEIGHT allows (the deck's viewBox ratio), px, already held to what leaves the card its minimum -
//             0 when the row is not laid out
// A share is the board's part of the pair in percent. The default is the natural width ("today's ratio": the drawing fills its panel's
// height); the limits are the instructor's: the board keeps at least 55 % of the pair, the card at least 280 px.

/** the board never goes below this share of the pair (percent) ... */
export const MIN_BOARD_PCT = 55;
/** ... and the card never below this width (px) */
export const MIN_CARD_WIDTH = 280;
/** the range when the row is not laid out (a hidden tab): any sane one, redrawn as soon as it is measured */
export const FALLBACK_RANGE = { min: MIN_BOARD_PCT, max: 80, def: 60 };

/**
 * @param {number} total the pair's combined width, px
 * @param {number} natural the width the board's height allows, px (0 = unknown)
 * @returns {import("./split-ratio.js").SplitRange} min / max / default share of the board, percent. The default stays reachable: when the
 *   natural width is below 55 % of the pair (a tall, narrow board) the lower limit gives way to it instead of widening the board.
 */
export function deckSplitRange(total, natural) {
  if (!(total > 0)) return FALLBACK_RANGE;
  const def = natural > 0 ? (natural / total) * 100 : FALLBACK_RANGE.def;
  const min = Math.min(MIN_BOARD_PCT, def);
  const max = Math.max(min, (1 - MIN_CARD_WIDTH / total) * 100);
  return { min, max, def: Math.min(max, Math.max(min, def)) };
}

/**
 * @param {string} deckId the deck file stem
 * @returns {string} the localStorage key of the reader's share for this deck
 */
export function deckSplitKey(deckId) {
  return `i2rs.split.deck.${deckId}`;
}
