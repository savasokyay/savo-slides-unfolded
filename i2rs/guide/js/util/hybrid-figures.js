// @ts-check
// WP-221: the geometry of the Hybrid & ensemble overview's figures (pages/hybrid-page.js), as pure functions so tests/app/js/hybrid_figures_check.mjs can pin them under node: the taxonomy
// tree (boxes, org-chart connectors, the dotted line of feature augmentation) and the dartboard's hits. The page only draws what these functions say; nothing here touches the DOM.
// Units are the figures' viewBox units (the svg scales with its box).

/** Padding around the taxonomy figure, the leaf box's width and the gap between two leaf columns. */
export const TAX = { pad: 12, leafW: 122, gap: 14, branchH: 38, leafH: 92, rowRoot: 12, rowOne: 84, rowTwo: 156, rowLeaf: 236 }; // leafH 92: a two-line name keeps 10 px above its pill (measured in the browser at 84: 1 px)

/**
 * The tree as the textbook draws it: three branches under the root; the leaves left to right are the seven hybrid types, in the order of the leaf columns. `level` is the row a box sits in
 * (0 root, 1 first branches, 2 sequential / parallel, 3 leaves); the mixed branch is itself a leaf (no children) and stays in row 1. `w` is a branch's width (a leaf takes TAX.leafW).
 * @type {{id: string, parent: string | null, level: number, leaf: boolean, w: number, col?: number}[]}
 */
export const TREE = [
  { id: "root", parent: null, level: 0, leaf: false, w: 190 },
  { id: "monolithic", parent: "root", level: 1, leaf: false, w: 150 },
  { id: "ensembles", parent: "root", level: 1, leaf: false, w: 150 },
  { id: "mixed", parent: "root", level: 1, leaf: true, w: TAX.leafW, col: 6 },
  { id: "sequential", parent: "ensembles", level: 2, leaf: false, w: 120 },
  { id: "parallel", parent: "ensembles", level: 2, leaf: false, w: 120 },
  { id: "combination", parent: "monolithic", level: 3, leaf: true, w: TAX.leafW, col: 0 },
  { id: "meta", parent: "monolithic", level: 3, leaf: true, w: TAX.leafW, col: 1 },
  { id: "augmentation", parent: "sequential", level: 3, leaf: true, w: TAX.leafW, col: 2 },
  { id: "cascade", parent: "sequential", level: 3, leaf: true, w: TAX.leafW, col: 3 },
  { id: "weighted", parent: "parallel", level: 3, leaf: true, w: TAX.leafW, col: 4 },
  { id: "switching", parent: "parallel", level: 3, leaf: true, w: TAX.leafW, col: 5 },
];

/** The row's top edge, by level. @param {number} level */
function rowTop(level) {
  return [TAX.rowRoot, TAX.rowOne, TAX.rowTwo, TAX.rowLeaf][level];
}

/**
 * The taxonomy figure's boxes and connectors. A leaf sits in its column; a branch is centred over its children (the root over the span of its three branches); every parent joins its
 * children with an org-chart connector (down from the parent's bottom to a bus half way to the nearest child, along the bus, down into each child's top). The dotted line of the textbook
 * runs from the monolithic box's right side to the top of the feature-augmentation leaf, a little left of its centre so it never lies on the solid connector of the sequential branch.
 * @returns {{width: number, height: number, nodes: {id: string, level: number, leaf: boolean, x: number, y: number, w: number, h: number, cx: number, parent: string | null}[], edges: {from: string, to: string, d: string}[], dotted: {d: string, x: number, yEnd: number}}}
 */
export function taxonomyLayout() {
  const column = TAX.leafW + TAX.gap;
  const leafCentre = (/** @type {number} */ col) => TAX.pad + col * column + TAX.leafW / 2;
  /** @type {Map<string, number>} */
  const centre = new Map();
  for (const n of TREE) if (n.leaf) centre.set(n.id, leafCentre(/** @type {number} */ (n.col)));
  /** @param {string} id @returns {number} */
  const centreOf = (id) => {
    const known = centre.get(id);
    if (known !== undefined) return known;
    const kids = TREE.filter((n) => n.parent === id).map((n) => centreOf(n.id));
    const mid = (Math.min(...kids) + Math.max(...kids)) / 2; // centred over the span of its children (for the root: the span of its three branches)
    centre.set(id, mid);
    return mid;
  };
  const nodes = TREE.map((n) => {
    const cx = centreOf(n.id);
    const h = n.leaf ? TAX.leafH : TAX.branchH;
    return { id: n.id, level: n.level, leaf: n.leaf, x: cx - n.w / 2, y: rowTop(n.level), w: n.w, h, cx, parent: n.parent };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  /** @type {{from: string, to: string, d: string}[]} */
  const edges = [];
  for (const parent of nodes) {
    const kids = nodes.filter((n) => n.parent === parent.id);
    if (!kids.length) continue;
    const bottom = parent.y + parent.h;
    const bus = Math.round((bottom + Math.min(...kids.map((k) => k.y))) / 2);
    for (const kid of kids) edges.push({ from: parent.id, to: kid.id, d: `M ${parent.cx} ${bottom} V ${bus} H ${kid.cx} V ${kid.y}` });
  }
  const mono = /** @type {NonNullable<ReturnType<typeof byId.get>>} */ (byId.get("monolithic"));
  const aug = /** @type {NonNullable<ReturnType<typeof byId.get>>} */ (byId.get("augmentation"));
  const dottedX = aug.cx - 30;
  const monoMid = mono.y + mono.h / 2;
  const width = TAX.pad * 2 + 7 * TAX.leafW + 6 * TAX.gap;
  const height = TAX.rowLeaf + TAX.leafH + TAX.pad;
  return { width, height, nodes, edges, dotted: { d: `M ${mono.x + mono.w} ${monoMid} H ${dottedX} V ${aug.y - 7}`, x: dottedX, yEnd: aug.y } };
}

/**
 * The dartboard's four targets: the bias of a model is how far the centre of its hits lies from the bullseye, its variance how widely they spread. Each cell holds nine hits in units of the
 * target's radius (the bullseye at 0, 0); the spread of a "high variance" cell is wide, a "low variance" cell's tight, and a "high bias" cell's whole cloud is shifted off the bullseye.
 * The numbers are fixed (no random draw): the figure looks the same on every load, and the node check can verify that the clouds say what their labels say.
 * @returns {{id: "ll" | "lh" | "hl" | "hh", bias: "low" | "high", variance: "low" | "high", hits: [number, number][]}[]}
 */
export function dartCells() {
  /** @type {[number, number][]} */
  const tight = [[0.02, -0.05], [-0.08, 0.04], [0.06, 0.09], [-0.03, -0.11], [0.11, -0.02], [-0.1, -0.06], [0, 0.13], [0.08, -0.1], [-0.05, 0.1]];
  /** @type {[number, number][]} */
  const wide = [[0.45, -0.3], [-0.55, 0.2], [0.2, 0.6], [-0.3, -0.55], [0.62, 0.18], [-0.12, 0.05], [0.35, -0.62], [-0.62, -0.25], [0.1, 0.28]];
  /** @param {[number, number][]} hits @param {number} scale @param {number} dx @param {number} dy @returns {[number, number][]} */
  const place = (hits, scale, dx, dy) => hits.map(([x, y]) => [Number((x * scale + dx).toFixed(3)), Number((y * scale + dy).toFixed(3))]);
  // the tight cloud is the base set stretched by 2.4 (RMS spread 0.26 of the radius: nine hits of 3 px stay countable on a 60 px target, measured in the browser); the wide one is 2.2 times that
  return [
    { id: "ll", bias: "low", variance: "low", hits: place(tight, 2.4, 0, 0) },
    { id: "lh", bias: "low", variance: "high", hits: place(wide, 1, 0, 0) },
    { id: "hl", bias: "high", variance: "low", hits: place(tight, 2.4, 0.5, 0.38) },
    { id: "hh", bias: "high", variance: "high", hits: place(wide, 0.85, 0.28, 0.2) },
  ];
}
