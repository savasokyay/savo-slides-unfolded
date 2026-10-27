// @ts-check
// WP-66: tiny SVG helpers shared by the lecture board (board.js) and its glyph library
// (board-glyphs.js). Kept apart from both so neither has to import the other.

export const NS = "http://www.w3.org/2000/svg";

/** Colour roles a board element or a nested group may carry (docs/SLIDES.md, slides.css). */
export const ROLES = /** @type {const} */ ([
  "ink",
  "user",
  "item",
  "model",
  "target",
  "rating",
  "kb",
  "muted",
  "example", // WP-80: dark pink, the instructor's slide colour for examples
]);

/**
 * @param {string} tag
 * @param {Record<string, string | number>} [attrs]
 */
export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * A (possibly multi-line, `\n`-separated) text block whose vertical CENTRE sits at `cy`
 * (`.bd-text` uses `dominant-baseline: central`, so one line is centred exactly on `cy`).
 * @param {number} x
 * @param {number} cy
 * @param {string} str
 * @param {{anchor?: "start" | "middle" | "end", cls?: string, size?: number, lineHeight?: number}} [opts]
 */
export function textEl(x, cy, str, opts = {}) {
  const { anchor = "middle", cls = "", size, lineHeight = 1.25 } = opts;
  const lines = String(str).split("\n");
  const fontSize = size || 12;
  const lh = fontSize * lineHeight;
  const y0 = cy - ((lines.length - 1) * lh) / 2;
  const t = svgEl("text", {
    x,
    y: y0,
    "text-anchor": anchor,
    class: `bd-text ${cls}`.trim(),
    "font-size": fontSize,
  });
  lines.forEach((line, i) => {
    const span = svgEl("tspan", { x, dy: i === 0 ? 0 : lh });
    span.textContent = line;
    t.appendChild(span);
  });
  return t;
}

/**
 * A straight line ending in an arrowhead. The marker starts as the ghost one; board.js swaps it
 * for the role's marker when the owning element is inked (markers cannot inherit CSS variables
 * from the line that references them, hence one marker per role in the board's `<defs>`).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} role
 * @param {string} [cls]
 */
export function arrowLine(x1, y1, x2, y2, role, cls = "") {
  const line = svgEl("line", {
    x1,
    y1,
    x2,
    y2,
    class: `bd-shape bd-arrow ${cls}`.trim(),
    "marker-end": "url(#bd-arrow-ghost)",
  });
  line.dataset.role = role;
  return line;
}

/**
 * WP-67: a polyline ending in an arrowhead - an edge routed through waypoints (the feedback loop
 * of the system board runs around the outside of the drawing). Marker handling as in arrowLine.
 * @param {{x: number, y: number}[]} points
 * @param {string} role
 * @param {string} [cls]
 */
export function arrowPath(points, role, cls = "") {
  const d = points.map((p, k) => `${k === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const path = svgEl("path", {
    d,
    class: `bd-shape bd-arrow ${cls}`.trim(),
    "marker-end": "url(#bd-arrow-ghost)",
  });
  path.dataset.role = role;
  return path;
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} [cls]
 */
export function line(x1, y1, x2, y2, cls = "") {
  return svgEl("line", { x1, y1, x2, y2, class: `bd-shape ${cls}`.trim() });
}

/**
 * A tick mark ("✓") centred on (x, y) with half-size `s`.
 * @param {number} x
 * @param {number} y
 * @param {number} s
 * @param {string} [cls]
 */
export function checkMark(x, y, s, cls = "") {
  return svgEl("path", {
    d: `M ${x - s} ${y} L ${x - s / 3} ${y + s * 0.65} L ${x + s} ${y - s * 0.7}`,
    class: `bd-shape bd-mark ${cls}`.trim(),
  });
}

/**
 * An "×" mark centred on (x, y) with half-size `s`.
 * @param {number} x
 * @param {number} y
 * @param {number} s
 * @param {string} [cls]
 */
export function crossMark(x, y, s, cls = "") {
  return svgEl("path", {
    d: `M ${x - s} ${y - s} L ${x + s} ${y + s} M ${x + s} ${y - s} L ${x - s} ${y + s}`,
    class: `bd-shape bd-mark ${cls}`.trim(),
  });
}

/**
 * A thumbs-up (or, mirrored, thumbs-down) outline centred on (x, y), `s` px tall. Drawn as a
 * path in a 10×10 box and scaled, with a non-scaling stroke so it takes the group's stroke colour
 * and width like every other mark (an emoji would ignore `fill` and the theme).
 * @param {number} x
 * @param {number} y
 * @param {boolean} up
 * @param {number} s
 */
export function thumb(x, y, up, s) {
  const k = s / 10;
  const g = svgEl("g", {
    transform: up ? `translate(${x - s / 2} ${y - s / 2}) scale(${k})` : `translate(${x - s / 2} ${y + s / 2}) scale(${k} ${-k})`,
  });
  const cuff = svgEl("path", { d: "M 0.8 4.6 h 2.2 v 5 h -2.2 z", class: "bd-shape bd-mark bd-thumb" });
  const hand = svgEl("path", {
    d: "M 3 4.8 L 5.2 1.5 q 0.8 -1.2 1.5 -0.3 q 0.3 0.6 -0.1 1.5 L 6.1 4.6 H 8.7 q 1.1 0 1.1 1.1 v 2.8 q 0 1.1 -1.1 1.1 H 3 Z",
    class: "bd-shape bd-mark bd-thumb",
  });
  g.append(cuff, hand);
  return g;
}
