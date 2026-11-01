// @ts-check
// WP-107 (e2): keep an element in view by scrolling ITS CONTAINER only (both axes: a chart zoomed above 1.0x is wider than its panel). `element.scrollIntoView()` scrolls every scrollable ancestor,
// the page included, and stepping through a trace must never move the page (WP-105). The flowchart panel (a chart taller than its panel)
// and the code panel (the highlighted line) use this instead. The arithmetic is plain and checked under node
// (tests/app/js/scroll_within_check.mjs); `keepInView` is the DOM shell around it.

/**
 * How far the container has to scroll (positive = down) for the element to lie inside it, with `room` px around it.
 * All four numbers are in the same coordinate space (viewport rectangles). An element already inside moves nothing; one taller than the
 * container (less the room) is aligned at its TOP edge - the beginning of a long line is what matters.
 * @param {number} containerTop
 * @param {number} containerBottom
 * @param {number} elTop
 * @param {number} elBottom
 * @param {number} [room]
 * @returns {number}
 */
export function scrollDelta(containerTop, containerBottom, elTop, elBottom, room = 10) {
  const top = containerTop + room;
  const bottom = containerBottom - room;
  if (elBottom - elTop > bottom - top) return elTop - top; // taller than the window it must fit in: its top edge
  if (elTop < top) return elTop - top;
  if (elBottom > bottom) return elBottom - bottom;
  return 0;
}

/**
 * @param {HTMLElement} container the scrolling element (overflow: auto)
 * @param {Element} el an element inside it
 * @param {number} [room]
 */
export function keepInView(container, el, room = 10) {
  const box = container.getBoundingClientRect();
  const node = el.getBoundingClientRect();
  if (container.scrollHeight > container.clientHeight + 1) {
    const dy = scrollDelta(box.top, box.bottom, node.top, node.bottom, room);
    if (dy !== 0) container.scrollTop += dy;
  }
  if (container.scrollWidth > container.clientWidth + 1) {
    const dx = scrollDelta(box.left, box.right, node.left, node.right, room); // the same arithmetic along the other axis
    if (dx !== 0) container.scrollLeft += dx;
  }
}

/**
 * WP-165: how far the container scrolls (positive = down / right) to put the element's CENTRE at the centre of the container's visible area. Plain arithmetic along one axis (use
 * it for both): the container's visible area is `containerStart .. containerEnd` (its client box: a scroll bar is not part of it), the element `elStart .. elEnd`, all in one
 * coordinate space. An element taller than the window is centred on its middle like any other; the browser clamps the scroll position, so a stage at the edge of the drawing
 * cannot be centred - it comes as close as the scroll range allows.
 * @param {number} containerStart
 * @param {number} containerEnd
 * @param {number} elStart
 * @param {number} elEnd
 * @returns {number}
 */
export function centreDelta(containerStart, containerEnd, elStart, elEnd) {
  return (elStart + elEnd) / 2 - (containerStart + containerEnd) / 2;
}

/**
 * WP-165: scroll the container (and only it: the page never moves) so that the element is at its centre, on the axes along which it scrolls; instantly (an assignment, the
 * stage follows the walk key by key). Used by the network diagram, where a stage that is merely "in view" (`keepInView`) sat at the edge of an enlarged drawing.
 * @param {HTMLElement} container the scrolling element (overflow: auto)
 * @param {Element} el an element inside it
 */
export function centreInView(container, el) {
  centreRectInView(container, el.getBoundingClientRect());
}

/**
 * WP-168a: the same for a RECTANGLE (viewport coordinates): the union of several elements - a step that lights an id and the table it indexes is centred on the two together.
 * @param {HTMLElement} container the scrolling element (overflow: auto)
 * @param {{top: number, bottom: number, left: number, right: number}} node
 */
export function centreRectInView(container, node) {
  const box = container.getBoundingClientRect();
  if (container.scrollHeight > container.clientHeight + 1) {
    const dy = centreDelta(box.top, box.top + container.clientHeight, node.top, node.bottom);
    if (Math.abs(dy) >= 0.5) container.scrollTop += dy;
  }
  if (container.scrollWidth > container.clientWidth + 1) {
    const dx = centreDelta(box.left, box.left + container.clientWidth, node.left, node.right);
    if (Math.abs(dx) >= 0.5) container.scrollLeft += dx;
  }
}
