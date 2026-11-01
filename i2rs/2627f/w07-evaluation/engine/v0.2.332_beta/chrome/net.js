// @ts-check
// WP-14 / D-021, D-063: the faint original network of the cover and (WP-19) the closing page. Pure geometry, no DOM: the same seed gives the
// same network on every machine, so the pattern the user approved does not move. The algorithm is the prototype's (prototypes/directions/index.html,
// netSVG and mulberry32); the numbers below are its numbers. The text zones (`clear`) keep nodes out of the lines of text, because a node where three
// lines meet lightens the card enough to cost the small texts their contrast (runs/2610221919-ui-cover-v4/note.md, "Findings worth keeping").

/** The drawing box and the rules of the network (stage pixels). */
export const NET = Object.freeze({
  width: 1920, height: 1080,
  x0: 40, y0: 40, w: 1840, h: 1000,     // nodes lie in [40, 1880] x [40, 1040]
  neighbours: 2,                         // each node reaches its two nearest others
  dotRadius: 3.5, lineWidth: 1.5,
});

/**
 * The cover's text zones, as the prototype measured them in EN and TR (padded 14 px): course block, title block, the emblem lock-up and the
 * first line of the institution text; the last rectangle used to hold the small S of the old cover (D-071). It STAYS: the nodes come from one
 * seeded stream, so dropping a rectangle would move every later node and with it the network the user approved.
 * @type {ReadonlyArray<readonly [number, number, number, number]>}
 */
export const COVER_CLEAR = Object.freeze([[98, 278, 679, 376], [90, 366, 1540, 558], [97, 540, 889, 635], [46, 20, 566, 140], [1761, 23, 1874, 135]]);

/** The closing page's zone (the identity lock-up), for WP-19. @type {ReadonlyArray<readonly [number, number, number, number]>} */
export const CLOSING_CLEAR = Object.freeze([[690, 880, 1230, 1030]]);

/**
 * The prototype's seeded generator (mulberry32): a function that returns numbers in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * For every node its `k` nearest other nodes (squared distance, ties by index); an edge [i, j] is kept only when j > i, so an edge is drawn once, from its
 * lower end. (A node that is near a lower-numbered one is not drawn back to it: the prototype's rule, kept so the picture is the same.)
 * @param {ReadonlyArray<readonly [number, number]>} points
 * @param {number} k
 * @returns {Array<[number, number]>}
 */
export function nearestEdges(points, k) {
  /** @type {Array<[number, number]>} */ const edges = [];
  for (let i = 0; i < points.length; i++) {
    const near = points.map((q, j) => [j, (q[0] - points[i][0]) ** 2 + (q[1] - points[i][1]) ** 2]).filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1]).slice(0, k);
    for (const [j] of near) if (j > i) edges.push([i, j]);
  }
  return edges;
}

/**
 * The network of a seed: `nodes` points, each re-drawn until it lies outside every `clear` rectangle, and the edges between near points.
 * @param {{seed: number, nodes: number, clear?: ReadonlyArray<readonly [number, number, number, number]>}} spec
 * @returns {{points: Array<[number, number]>, edges: Array<[number, number]>}}
 */
export function netGeometry({ seed, nodes, clear = [] }) {
  const r = mulberry32(seed);
  const inside = (/** @type {number} */ x, /** @type {number} */ y) => clear.some((a) => x >= a[0] && x <= a[2] && y >= a[1] && y <= a[3]);
  /** @type {Array<[number, number]>} */ const points = [];
  for (let i = 0; i < nodes; i++) {
    /** @type {[number, number]} */ let p;
    do { p = [NET.x0 + r() * NET.w, NET.y0 + r() * NET.h]; } while (inside(p[0], p[1]));
    points.push(p);
  }
  return { points, edges: nearestEdges(points, NET.neighbours) };
}
