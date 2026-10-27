// @ts-check
// WP-105: a vertical flowchart that fits the narrow column of the uCF / iCF pages. The YAML places every box on a
// 3-column grid (`at: [col, row]`) as one tall trunk with the similarity loop beside it; drawn top to bottom in a 460 px
// panel that is 9 rows (iCF) of boxes squeezed into three columns of 119 px, whose labels wrap to four lines. This
// re-maps the grid for the VERTICAL drawing only (the YAML is not touched, the horizontal drawing never calls it):
//   (ii) the leading straight chain - from the start box while a box has one exit and the next one one entry, up to the box
//        that flows into a merge (the loop) - is laid out in two columns, read like a snake (boustrophedon): [1][2] left to
//        right, [4][3] right to left (3 under 2, 4 left of 3), [5][6] left to right again, and so on. The arrows are
//        1->2 right, 2->3 down, 3->4 left, 4->5 down, 5->6 right. Chains shorter than 4 stay as they are;
//   (i)  an END box that sits in the row of its predecessor goes under it (arrow down) instead of beside it, so the chart is
//        two columns wide.
// The loop block keeps its columns; its rows move up by the rows the chain no longer needs. Plain data in, plain data
// out, so it is checked under node against hand-derived positions of the real uCF and iCF charts
// (tests/app/js/flow_compact_check.mjs).

export const MIN_CHAIN = 4; // a chain of fewer boxes is not worth folding

/**
 * @typedef {{id: string, kind?: string, at: number[]}} FlowNode
 * @typedef {{from?: string, to?: string, src?: string, dst?: string}} FlowEdge
 */

/**
 * The leading chain of box ids: the start box (kind "start", else the first box nothing flows into), then each box that
 * is the only exit of the previous one AND has no other entry.
 * @param {FlowNode[]} nodes
 * @param {FlowEdge[]} edges
 * @returns {string[]}
 */
export function leadingChain(nodes, edges) {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  /** @type {Map<string, string[]>} */
  const into = new Map();
  for (const n of nodes) {
    out.set(n.id, []);
    into.set(n.id, []);
  }
  for (const e of edges) {
    const a = e.from ?? e.src;
    const b = e.to ?? e.dst;
    if (a === undefined || b === undefined || !out.has(a) || !into.has(b)) continue;
    /** @type {string[]} */ (out.get(a)).push(b);
    /** @type {string[]} */ (into.get(b)).push(a);
  }
  const start = nodes.find((n) => n.kind === "start") ?? nodes.find((n) => /** @type {string[]} */ (into.get(n.id)).length === 0);
  if (!start) return [];
  const chain = [start.id];
  for (;;) {
    const last = chain[chain.length - 1];
    const exits = /** @type {string[]} */ (out.get(last));
    if (exits.length !== 1) break;
    const next = exits[0];
    if (/** @type {string[]} */ (into.get(next)).length !== 1 || chain.includes(next)) break;
    chain.push(next);
  }
  return chain;
}

/**
 * The [col, row] of box number `i` (0-based) of a folded chain: two boxes per row, left to right on the even rows (0, 2, ...)
 * and right to left on the odd rows (1, 3, ...).
 * @param {number} i
 * @returns {[number, number]}
 */
export function snakeCell(i) {
  const row = Math.floor(i / 2);
  const second = i % 2 === 1;
  const leftToRight = row % 2 === 0;
  return [leftToRight ? (second ? 1 : 0) : second ? 0 : 1, row];
}

/**
 * New grid cells for the vertical drawing, or null when nothing changes.
 * @param {FlowNode[]} nodes
 * @param {FlowEdge[]} edges
 * @returns {Map<string, [number, number]> | null}
 */
export function compactGrid(nodes, edges) {
  /** @type {Map<string, [number, number]>} */
  const at = new Map(nodes.map((n) => [n.id, /** @type {[number, number]} */ ([n.at[0], n.at[1]])]));
  let changed = false;

  // (ii) fold the leading chain
  const chain = leadingChain(nodes, edges);
  if (chain.length >= MIN_CHAIN) {
    const inChain = new Set(chain);
    const rest = nodes.filter((n) => !inChain.has(n.id));
    // the others must all sit below the chain's rows, or moving them up would collide with something unforeseen
    if (rest.every((n) => n.at[1] >= chain.length)) {
      const rowsUsed = snakeCell(chain.length - 1)[1] + 1;
      const shift = chain.length - rowsUsed;
      chain.forEach((id, i) => at.set(id, snakeCell(i)));
      for (const n of rest) at.set(n.id, [n.at[0], n.at[1] - shift]);
      changed = shift > 0 || changed;
    }
  }

  // (i) an end box beside its predecessor goes under it
  for (const n of nodes) {
    if (n.kind !== "end") continue;
    const preds = edges.filter((e) => (e.to ?? e.dst) === n.id).map((e) => e.from ?? e.src);
    if (preds.length !== 1 || preds[0] === undefined) continue;
    const p = at.get(preds[0]);
    const mine = at.get(n.id);
    if (!p || !mine || p[1] !== mine[1] || p[0] === mine[0]) continue;
    const cell = /** @type {[number, number]} */ ([p[0], p[1] + 1]);
    if ([...at.entries()].some(([id, c]) => id !== n.id && c[0] === cell[0] && c[1] === cell[1])) continue;
    at.set(n.id, cell);
    changed = true;
  }

  if (!changed) return null;
  // two boxes in one cell would be drawn on top of each other: refuse the whole re-mapping
  const seen = new Set([...at.values()].map((c) => `${c[0]},${c[1]}`));
  return seen.size === at.size ? at : null;
}
