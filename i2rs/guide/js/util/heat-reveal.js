// @ts-check
// WP-102: the co-rated sub-matrix is wider than its box (40 columns need 1712 px, the box is 630-1000 px), so the box
// scrolls sideways. These two pure functions decide WHAT the heat grid scrolls to when a step highlights columns: the
// first highlighted column, and the scrollLeft that brings it into the visible part of the box while the sticky label
// column keeps the left edge. Plain numbers in, plain numbers out, so they are checked under node
// (tests/app/js/heat_reveal_check.mjs); heat-grid.js reads the element positions (offsetLeft, which a FLIP transform
// does not move) and calls them.

/**
 * The smallest index on one axis the step's highlights touch in the sub-matrix: a COLUMN (`cols`, or the column of a `cells` pair) or, WP-131,
 * a ROW (`rows`, or the row of a pair - the item-based page draws a film per row, so a step about a film is a row to scroll to); null when no
 * highlight names one (a step about the other axis must not move the scroll position).
 * @param {any[] | undefined | null} highlights Frame.highlights (view undefined / "submatrix" apply here), already in the grid's orientation
 * @param {"col" | "row"} axis
 * @returns {number | null}
 */
export function firstHighlightedLine(highlights, axis) {
  const key = axis === "row" ? "rows" : "cols";
  const at = axis === "row" ? 0 : 1;
  /** @type {number | null} */
  let best = null;
  /** @param {unknown} c */
  const take = (c) => {
    if (typeof c === "number" && Number.isInteger(c) && c >= 0 && (best === null || c < best)) best = c;
  };
  for (const h of highlights || []) {
    if (!h || (h.view && h.view !== "submatrix")) continue;
    for (const c of h[key] || []) take(c);
    for (const cell of h.cells || []) take(Array.isArray(cell) ? cell[at] : undefined);
  }
  return best;
}

/**
 * The smallest column index the step's highlights touch (see `firstHighlightedLine`); null when no highlight names a column (a row-only step
 * must not move the scroll position).
 * @param {any[] | undefined | null} highlights
 * @returns {number | null}
 */
export function firstHighlightedColumn(highlights) {
  return firstHighlightedLine(highlights, "col");
}

/**
 * The scrollLeft that makes a column fully visible, or null when it already is. Positions are in the scroll box's
 * CONTENT coordinates (offsetLeft), so they do not change while it scrolls. The visible part is
 * [scrollLeft + stickyWidth, scrollLeft + clientWidth - margin]: the sticky label column covers the first
 * `stickyWidth` px, and `margin` keeps the column off the very edge. A column wider than the visible part is aligned
 * to its left edge.
 * @param {{scrollLeft: number, clientWidth: number, stickyWidth: number, margin: number, colLeft: number, colRight: number}} p
 * @returns {number | null}
 */
export function scrollLeftToReveal({ scrollLeft, clientWidth, stickyWidth, margin, colLeft, colRight }) {
  const visibleLeft = scrollLeft + stickyWidth;
  const visibleRight = scrollLeft + clientWidth - margin;
  if (colLeft < visibleLeft) return Math.max(0, colLeft - stickyWidth);
  if (colRight > visibleRight) {
    const next = colRight + margin - clientWidth;
    return Math.max(0, Math.min(next, colLeft - stickyWidth)); // never push the column's own left edge under the labels
  }
  return null;
}

/**
 * WP-138: how much of the box's left edge the sticky part covers - what `scrollLeftToReveal` keeps clear: the name column, the grid's gap after it, the statistic group (its three
 * columns and the gap after each; 0 when it scrolls away with the films - `.stats-loose` - or there is none) and, on a grid that pins its target column (the user-based and the model
 * grids: the target film's column stays beside the group while the others scroll), that column and the gap after it. The CSS `left` of the pinned column is the first three
 * (trace.css), so a column that scrolls into view stops at its right edge instead of ending up under it.
 * @param {{labelWidth: number, gap: number, groupWidth: number, pinnedWidth?: number}} p `pinnedWidth`: the pinned column's width (px), 0 / absent when no column is pinned
 * @returns {number}
 */
export function stickyLeftWidth({ labelWidth, gap, groupWidth, pinnedWidth = 0 }) {
  return labelWidth + gap + groupWidth + (pinnedWidth > 0 ? pinnedWidth + gap : 0);
}

/**
 * WP-131: the same arithmetic down the page - the scrollTop that makes a ROW fully visible below the sticky part (the header row, and the pinned
 * target film's row), or null when it already is. Positions are CONTENT coordinates (offsetTop). The numbers are axis-neutral, so this is
 * `scrollLeftToReveal` with the vertical names.
 * @param {{scrollTop: number, clientHeight: number, stickyHeight: number, margin: number, rowTop: number, rowBottom: number}} p
 * @returns {number | null}
 */
export function scrollTopToReveal({ scrollTop, clientHeight, stickyHeight, margin, rowTop, rowBottom }) {
  return scrollLeftToReveal({
    scrollLeft: scrollTop,
    clientWidth: clientHeight,
    stickyWidth: stickyHeight,
    margin,
    colLeft: rowTop,
    colRight: rowBottom,
  });
}
