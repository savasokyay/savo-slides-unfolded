// @ts-check
// WP-32: flowchart rendered from config/flowcharts/<id>.yaml (served as JSON). Nodes sit on a
// small grid (`at: [col, row]`); edges are orthogonal polylines; a back-edge (target above the
// source, e.g. similarity -> loop) swings out around the side. The current step's node pulses
// (`.active`), already-visited nodes are `.done`; clicking a node jumps to its first step.
//
// WP-92: the chart is laid out at its NATURAL size, in screen pixels, instead of being scaled into a
// fixed viewBox. The old version drew 11 unit labels into a 602 x 490..626 viewBox with a 440 px cap,
// which shrank the text to 8-10 px (iCF: 7.7 px) and put the whole chart in a tall, narrow column.
//   * node boxes are sized from the MEASURED label width (canvas `measureText` with the CSS font), a
//     label wraps to at most as many lines as it needs, every box keeps padding all round;
//   * the grid in the YAML (`col` = branch, `row` = step along the flow) is laid out in one of two
//     orientations - vertical (flow downwards, the YAML as written) or horizontal (flow to the right:
//     the grid transposed). Both are laid out for the panel's width; the one that fits at natural
//     scale wins, a wide panel therefore reads left to right and a narrow one top to bottom;
//   * edges are routed in "flow space" (flow = down) and mapped back for a horizontal chart, the
//     viewBox is the bounding box of nodes, edges and edge labels (nothing is cut, nothing is
//     reserved empty); the chart is re-laid out when the panel is resized.
// Node ids, trace JSON, click-to-jump and the active / done classes are unchanged.
//
// WP-105: `compact` (the uCF / iCF pages, whose chart lives in a 460 px column): the VERTICAL drawing re-maps the YAML grid
// (util/flow-compact.js) - the leading chain folded into a two-column snake, the result box under "predict" - so the chart
// is two columns wide and about half the height. The horizontal drawing and every page that does not pass the option are
// unchanged.
//
// WP-248: `straightBack` (the Hybrid DNN page only): a back-edge whose target is the box in the ROW ABOVE the same column goes straight up, box to box, instead of swinging out round the left side. The swing
// leaves and enters by the left edges, which on the feature network's loop are where the "for each" arrow arrives and the "stop" arrow leaves - two arrows on one point. A straight arrow between
// neighbouring rows has no box between its ends by construction; every other back-edge, and every page that does not pass the option, is routed as before.

import { placeBubble } from "../util/bubble-place.js"; // WP-212: where a box's tip goes
import { compactGrid } from "../util/flow-compact.js";
import { flowTipText } from "../util/flow-tip.js"; // WP-212: which box has a tip
import { keepInView } from "../util/scroll-within.js"; // WP-107

const NS = "http://www.w3.org/2000/svg";

// All sizes are screen px at natural scale (the svg is never scaled up).
const FONT_PX = 13; // node labels; css .flow-label must say the same
const FONT_WEIGHT = 500;
const EDGE_FONT_PX = 11; // edge labels ("for each", "next", "done")
const LINE_H = 17;
const PAD_X = 12;
const PAD_Y = 9;
const MIN_NODE_W = 88;
const MIN_NODE_H = 36;
const MAX_NODE_W = 232; // a label that needs more wraps instead of growing the box
const GAP_FLOW = 36; // between cells ALONG the flow: room for an arrow and an edge label above it
const GAP_ACROSS = 28; // between cells across the flow (a gap that holds an edge label is widened to fit it)
const LOOP_OFFSET = 24; // how far a back-edge swings out of its column
const MARGIN = 10; // around everything
const LABEL_AIR = 6; // clear space between an edge label and the boxes beside it
const LABEL_ABOVE = 20; // room an edge label takes ABOVE its segment: 11 px text, descender, air
const ARROW = 8; // arrow head allowance in the bounding box
const SCALE_OK = 0.98; // an orientation "fits" when it needs at most 2 % shrinking
const HORIZONTAL_GAIN = 0.8; // a left-to-right chart must be at most this fraction of the top-to-bottom height
const MAX_COMFY_LINES = 3; // ... and may not wrap a label into more lines than this
const FALLBACK_W = 600; // panel not laid out yet (hidden): re-laid out once it has a width

/** @typedef {{x: number, y: number, hw: number, hh: number}} Geom  centre + half sizes in flow space */

/** @type {WeakMap<HTMLElement, ResizeObserver>} the one observer per panel body */
const observers = new WeakMap();
/** @type {WeakMap<HTMLElement, () => void>} WP-212: the one scroll listener per panel body (the pages make a new chart on the same body for every trace) */
const tipScrolls = new WeakMap();

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, onNodeClick?: (nodeId: string) => void, compact?: boolean, follow?: boolean, zoom?: () => number, straightBack?: boolean}} ctx
 *   `zoom` (WP-107 g2): the reader's size factor (0.7 - 1.4), asked at every drawing; `follow` (WP-107 e2): the panel
 *   may be shorter than the chart (the uCF / iCF flowchart sits over the candidate table): the active node is kept in view by scrolling
 *   the panel body ITSELF - never the page
 */
export function createFlowchart(root, ctx) {
  /** @type {Map<string, SVGGElement>} */
  let nodeEls = new Map();
  /** @type {any} */
  let flow = null;
  /** @type {any} */
  let lastFrame = null;
  let lastWidth = -1;
  /** @type {ResizeObserver | null} */
  let observer = null;
  /** WP-212: the bubble a hovered (or focused) box with a tip shows - one element per drawing @type {HTMLElement | null} */
  let tipEl = null;
  const canvas = document.createElement("canvas").getContext("2d");

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }
  // WP-212: a bubble over a box that has moved (the panel body scrolls to keep the active node in view) would be in the wrong place
  const lastScroll = tipScrolls.get(root);
  if (lastScroll) root.removeEventListener("scroll", lastScroll);
  tipScrolls.set(root, hideTip);
  root.addEventListener("scroll", hideTip);

  /**
   * WP-212: show the bubble over a box - the network diagram's (components/network-panel.js `showTip`): `position: fixed` (trace.css `.flow-tip`), centred over the box and put on the side
   * with the room for it (util/bubble-place.js); sized in rem, so presenting mode enlarges it with the page.
   * @param {Element} box
   * @param {string} text
   */
  function showTip(box, text) {
    if (!tipEl) return;
    tipEl.textContent = text;
    tipEl.hidden = false;
    tipEl.style.visibility = "hidden";
    tipEl.style.maxHeight = "none";
    const size = tipEl.getBoundingClientRect();
    const at = placeBubble({ anchor: box.getBoundingClientRect(), vw: window.innerWidth, vh: window.innerHeight, width: size.width, height: size.height, align: "center" });
    tipEl.style.left = `${at.left}px`;
    tipEl.style.top = `${at.top}px`;
    tipEl.style.maxHeight = `${at.maxHeight}px`;
    tipEl.style.visibility = "visible";
  }

  /**
   * @param {string} tag
   * @param {Record<string, string | number>} attrs
   */
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  /** Width the chart may use: the panel body's content box. */
  function availableWidth() {
    const cs = getComputedStyle(root);
    const w = root.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
    return w > 40 ? w : 0;
  }

  /**
   * @param {string} text
   * @param {number} weight
   * @param {number} px
   */
  function textWidth(text, weight, px) {
    if (!canvas) return text.length * px * 0.55;
    canvas.font = `${weight} ${px}px ${getComputedStyle(root).fontFamily}`;
    return canvas.measureText(text).width;
  }

  /**
   * Lines of a label for a text width budget: one line when it fits, else the two-line split with the
   * narrowest widest line, else greedy wrapping (a label with no space stays on one line).
   * @param {string} label
   * @param {number} maxTextW
   * @returns {string[]}
   */
  function wrapLabel(label, maxTextW) {
    const w = (/** @type {string} */ s) => textWidth(s, FONT_WEIGHT, FONT_PX);
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length <= 1 || w(label) <= maxTextW) return [label];
    /** @type {{lines: string[], widest: number} | null} */
    let best = null;
    for (let i = 1; i < words.length; i += 1) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const widest = Math.max(w(a), w(b));
      if (best === null || widest < best.widest) best = { lines: [a, b], widest };
    }
    if (best && best.widest <= maxTextW) return best.lines;
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && w(next) > maxTextW) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    lines.push(current);
    return lines;
  }

  /**
   * Orthogonal route between two nodes in FLOW space (flow = down). `outer` marks a back-edge that
   * swings out on the side away from the nodes - its label goes outside, never over a box.
   * @param {Geom} a
   * @param {Geom} b
   * @param {boolean} [straight] WP-248: a back-edge in the same column goes straight up (the caller says so only for neighbouring rows)
   * @returns {{pts: number[][], outer: boolean}}
   */
  function route(a, b, straight = false) {
    if (Math.abs(a.x - b.x) < 1) {
      if (b.y > a.y) return { pts: [[a.x, a.y + a.hh], [b.x, b.y - b.hh]], outer: false };
      if (straight) return { pts: [[a.x, a.y - a.hh], [b.x, b.y + b.hh]], outer: false }; // WP-248
      const x = a.x - a.hw - LOOP_OFFSET; // back-edge in the same column: loop around the side
      return { pts: [[a.x - a.hw, a.y], [x, a.y], [x, b.y], [b.x - b.hw, b.y]], outer: true };
    }
    if (b.y > a.y) {
      const y1 = a.y + a.hh;
      const y2 = b.y - b.hh;
      const midY = y1 + (y2 - y1) / 2;
      return { pts: [[a.x, y1], [a.x, midY], [b.x, midY], [b.x, y2]], outer: false };
    }
    const dir = b.x > a.x ? 1 : -1;
    if (Math.abs(a.y - b.y) < 1) {
      return { pts: [[a.x + dir * a.hw, a.y], [b.x - dir * b.hw, b.y]], outer: false };
    }
    // target above and in another column: leave to the side, go up through the gap, enter from the side
    const midX = a.x + dir * (a.hw + (Math.abs(b.x - a.x) - a.hw - b.hw) / 2);
    return { pts: [[a.x + dir * a.hw, a.y], [midX, a.y], [midX, b.y], [b.x - dir * b.hw, b.y]], outer: false };
  }

  /**
   * One placement of the chart in one orientation for a panel width.
   * @param {"v" | "h"} orient
   * @param {number} width the panel's content width
   * @param {{x: number[], y: number[]}} extra gap widths (index i = between cell i and i + 1) that a
   *   label needs beyond the base gap - measured by the first pass, applied by the second
   */
  function place(orient, width, extra) {
    const horizontal = orient === "h";
    const nodes = /** @type {any[]} */ (flow.nodes);
    // WP-105: a compact vertical chart re-maps the grid cells (null = nothing to re-map); the horizontal one never does
    const remapped = !horizontal && ctx.compact ? compactGrid(nodes, flow.edges) : null;
    const cell = (/** @type {any} */ n) => remapped?.get(n.id) ?? n.at;
    /** grid index along x / y on screen: the YAML grid as written, or transposed */
    const gx = (/** @type {any} */ n) => (horizontal ? cell(n)[1] : cell(n)[0]);
    const gy = (/** @type {any} */ n) => (horizontal ? cell(n)[0] : cell(n)[1]);
    const nx = Math.max(...nodes.map(gx)) + 1;
    const gapX = horizontal ? GAP_FLOW : GAP_ACROSS;
    const gapY = horizontal ? GAP_ACROSS : GAP_FLOW;
    // width budget per node: the panel shared by the columns, capped; wide enough for a short label
    const budget = (width - 2 * MARGIN - (nx - 1) * gapX) / nx;
    const maxNodeW = Math.max(MIN_NODE_W, Math.min(MAX_NODE_W, budget));

    const sized = nodes.map((n) => {
      const lines = wrapLabel(ctx.i18n.t(n.label_key), maxNodeW - 2 * PAD_X);
      const textW = Math.max(...lines.map((l) => textWidth(l, FONT_WEIGHT, FONT_PX)));
      return {
        node: n,
        lines,
        w: Math.max(MIN_NODE_W, Math.ceil(textW) + 2 * PAD_X),
        h: Math.max(MIN_NODE_H, lines.length * LINE_H + 2 * PAD_Y),
      };
    });
    // a column is as wide as its widest node, a row as tall as its tallest: boxes line up and edges stay straight
    const colW = /** @type {number[]} */ ([]);
    const rowH = /** @type {number[]} */ ([]);
    for (const s of sized) {
      colW[gx(s.node)] = Math.max(colW[gx(s.node)] || 0, s.w);
      rowH[gy(s.node)] = Math.max(rowH[gy(s.node)] || 0, s.h);
    }
    const x0 = /** @type {number[]} */ ([]);
    const y0 = /** @type {number[]} */ ([]);
    let cursor = 0;
    for (let i = 0; i < colW.length; i += 1) {
      x0[i] = cursor;
      cursor += (colW[i] || 0) + Math.max(gapX, extra.x[i] || 0);
    }
    cursor = 0;
    for (let i = 0; i < rowH.length; i += 1) {
      y0[i] = cursor;
      cursor += (rowH[i] || 0) + Math.max(gapY, extra.y[i] || 0);
    }

    /** @type {Map<string, {x: number, y: number, w: number, h: number, lines: string[], node: any}>} */
    const placed = new Map();
    for (const s of sized) {
      const w = colW[gx(s.node)];
      const h = rowH[gy(s.node)];
      placed.set(s.node.id, { x: x0[gx(s.node)], y: y0[gy(s.node)], w, h, lines: s.lines, node: s.node });
    }

    /** to / from flow space: a horizontal chart swaps the axes @param {number[]} p */
    const swap = (p) => (horizontal ? [p[1], p[0]] : p);
    /** @param {{x: number, y: number, w: number, h: number}} r @returns {Geom} */
    const geom = (r) => {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      return horizontal ? { x: cy, y: cx, hw: r.h / 2, hh: r.w / 2 } : { x: cx, y: cy, hw: r.w / 2, hh: r.h / 2 };
    };

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = [];
    for (const e of /** @type {any[]} */ (flow.edges)) {
      const src = placed.get(e.from ?? e.src);
      const dst = placed.get(e.to ?? e.dst);
      if (!src || !dst || !byId.has(src.node.id)) continue;
      const routed = route(geom(src), geom(dst), ctx.straightBack === true && gy(dst.node) === gy(src.node) - 1); // WP-248: only a neighbouring row can be reached straight
      const pts = routed.pts.map(swap);
      edges.push({ pts, outer: routed.outer, label: e.label_key ? String(ctx.i18n.t(e.label_key)) : "" });
    }

    // edge labels: above a horizontal segment, beside a vertical one (the outer side for a swing-out);
    // a label above a segment that runs between two columns / through a row gap needs that gap to be
    // wider / taller than the label, which the next pass gives it
    const labels = [];
    const need = { x: /** @type {number[]} */ ([]), y: /** @type {number[]} */ ([]) };
    for (const e of edges) {
      if (!e.label) continue;
      let at = 0;
      let longest = -1;
      for (let i = 0; i < e.pts.length - 1; i += 1) {
        const len = Math.abs(e.pts[i][0] - e.pts[i + 1][0]) + Math.abs(e.pts[i][1] - e.pts[i + 1][1]);
        if (len > longest) {
          longest = len;
          at = i;
        }
      }
      const p = e.pts[at];
      const q = e.pts[at + 1];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      const lw = textWidth(e.label, 400, EDGE_FONT_PX);
      if (Math.abs(p[1] - q[1]) < 1) {
        labels.push({ text: e.label, x: mx, y: my - 4, anchor: "middle", box: [mx - lw / 2, my - 4 - EDGE_FONT_PX, mx + lw / 2, my - 1] });
        const lo = Math.min(p[0], q[0]);
        const hi = Math.max(p[0], q[0]);
        const col = colW.findIndex((w, i) => x0[i] + w <= lo + 1 && hi <= (x0[i + 1] ?? Infinity) + 1);
        if (col >= 0 && col < colW.length - 1) {
          need.x[col] = Math.max(need.x[col] || 0, Math.ceil(lw) + 2 * LABEL_AIR); // between two columns
        } else {
          const row = rowH.findIndex((h, i) => y0[i] + h <= my + 1 && my <= (y0[i + 1] ?? Infinity) + 1);
          if (row >= 0 && row < rowH.length - 1) need.y[row] = Math.max(need.y[row] || 0, 2 * LABEL_ABOVE); // the segment runs mid-gap
        }
      } else if (e.outer) {
        labels.push({ text: e.label, x: p[0] - 7, y: my + 4, anchor: "end", box: [p[0] - 7 - lw, my - 7, p[0] - 7, my + 6] });
      } else {
        labels.push({ text: e.label, x: p[0] + 7, y: my + 4, anchor: "start", box: [p[0] + 7, my - 7, p[0] + 7 + lw, my + 6] });
      }
    }

    // bounding box of everything drawn: it is the viewBox, so nothing is cut and no space is reserved
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grow = (/** @type {number} */ x0_, /** @type {number} */ y0_, /** @type {number} */ x1, /** @type {number} */ y1) => {
      minX = Math.min(minX, x0_);
      minY = Math.min(minY, y0_);
      maxX = Math.max(maxX, x1);
      maxY = Math.max(maxY, y1);
    };
    for (const r of placed.values()) grow(r.x - 2, r.y - 2, r.x + r.w + 2, r.y + r.h + 2);
    for (const e of edges) for (const p of e.pts) grow(p[0] - ARROW, p[1] - ARROW, p[0] + ARROW, p[1] + ARROW);
    for (const l of labels) grow(l.box[0], l.box[1], l.box[2], l.box[3]);
    const vb = { x: minX - MARGIN, y: minY - MARGIN, w: maxX - minX + 2 * MARGIN, h: maxY - minY + 2 * MARGIN };
    const maxLines = Math.max(...sized.map((s) => s.lines.length));
    return { orient, placed, edges, labels, vb, scale: Math.min(1, width / vb.w), need, maxLines };
  }

  /**
   * Two passes: the first finds which gaps an edge label does not fit in, the second widens exactly
   * those (positions, routes and the viewBox follow), so a label never touches a box.
   * @param {"v" | "h"} orient
   * @param {number} width
   */
  function layout(orient, width) {
    const first = place(orient, width, { x: [], y: [] });
    const anyNeed = first.need.x.some(Boolean) || first.need.y.some(Boolean);
    return anyNeed ? place(orient, width, first.need) : first;
  }

  /**
   * The orientation that fits the panel at natural scale. The YAML's vertical flow is the default;
   * the horizontal one wins only when it fits too AND is clearly more compact (at most HORIZONTAL_GAIN
   * of the height) without squeezing labels into more than MAX_COMFY_LINES lines. When neither fits,
   * the one that needs the least shrinking.
   * @param {number} width
   */
  function chooseLayout(width) {
    const vertical = layout("v", width);
    const horizontal = layout("h", width);
    const fits = (/** @type {{scale: number}} */ l) => l.scale >= SCALE_OK;
    const compact = horizontal.vb.h <= vertical.vb.h * HORIZONTAL_GAIN && horizontal.maxLines <= MAX_COMFY_LINES;
    if (fits(vertical) && fits(horizontal)) return compact ? horizontal : vertical;
    if (fits(horizontal)) return horizontal;
    if (fits(vertical)) return vertical;
    return horizontal.scale > vertical.scale + 0.02 ? horizontal : vertical;
  }

  function build() {
    root.innerHTML = "";
    nodeEls = new Map();
    if (!flow) return;
    const measured = availableWidth();
    lastWidth = measured;
    const lay = chooseLayout(measured || FALLBACK_W);
    const { vb } = lay;
    // natural size in px; `max-width: 100%` (css) shrinks it with the panel, never enlarges it. WP-107 (g2): the reader's factor sizes it
    // explicitly instead - the size the panel would have given it (the fit scale) times the factor, no css cap: a chart zoomed above
    // 1.0x is wider than its panel and the panel body scrolls (the active node is kept in view, both ways)
    const zoom = ctx.zoom ? ctx.zoom() : 1;
    const k = zoom === 1 ? 1 : lay.scale * zoom;
    const svg = svgEl("svg", {
      class: `flowchart orient-${lay.orient}`,
      viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
      width: Math.round(vb.w * k),
      height: Math.round(vb.h * k),
    });
    if (zoom !== 1) svg.style.maxWidth = "none";
    const defs = svgEl("defs", {});
    const marker = svgEl("marker", {
      id: "flow-arrow",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: "auto-start-reverse",
    });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "flow-arrowhead" }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    for (const e of lay.edges) {
      svg.appendChild(
        svgEl("polyline", {
          points: e.pts.map((p) => p.join(",")).join(" "),
          class: "flow-edge",
          "marker-end": "url(#flow-arrow)",
        })
      );
    }
    for (const l of lay.labels) {
      const text = svgEl("text", { x: l.x, y: l.y, class: "flow-edge-label", "text-anchor": l.anchor });
      text.textContent = l.text;
      svg.appendChild(text);
    }

    for (const r of lay.placed.values()) {
      const node = r.node;
      const g = /** @type {SVGGElement} */ (svgEl("g", { class: `flow-node kind-${node.kind}`, "data-node": node.id }));
      const rx = node.kind === "start" || node.kind === "end" ? r.h / 2 : node.kind === "decision" ? 14 : 6;
      const rect = svgEl("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx, class: "flow-node-box" });
      if (node.kind === "loop") rect.setAttribute("stroke-dasharray", "5 3");
      const cx = r.x + r.w / 2;
      const top = r.y + r.h / 2 - (r.lines.length * LINE_H) / 2;
      const text = svgEl("text", { x: cx, y: top, class: "flow-label", "text-anchor": "middle" });
      r.lines.forEach((line, i) => {
        const tspan = svgEl("tspan", { x: cx, y: top + LINE_H * i + LINE_H - 4 });
        tspan.textContent = line;
        text.appendChild(tspan);
      });
      g.append(rect, text);
      g.addEventListener("click", () => ctx.onNodeClick && ctx.onNodeClick(node.id));
      // WP-212: a box with a tip (`flow_tip.*` in the language files, util/flow-tip.js) says it on hover and on keyboard focus; only such a box takes the tab stop
      const tip = flowTipText((key) => ctx.i18n.t(key), node.label_key);
      if (tip) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("aria-label", `${r.lines.join(" ")}. ${tip}`);
        g.addEventListener("pointerenter", () => showTip(g, tip));
        g.addEventListener("pointerleave", hideTip);
        g.addEventListener("focus", () => showTip(g, tip));
        g.addEventListener("blur", hideTip);
        g.addEventListener("keydown", (e) => {
          if (e.key === "Escape") hideTip();
        });
      }
      svg.appendChild(g);
      nodeEls.set(node.id, g);
    }
    root.appendChild(svg);
    tipEl = document.createElement("div"); // WP-212: one bubble per drawing (the root was emptied above); hidden until a box with a tip is hovered
    tipEl.className = "flow-tip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.hidden = true;
    root.appendChild(tipEl);
    if (lastFrame) applyFrame(lastFrame);
  }

  /** @param {import("./trace-player.js").Frame} frame */
  function applyFrame(frame) {
    for (const [id, g] of nodeEls) {
      g.classList.toggle("active", id === frame.step.node_id);
      g.classList.toggle("done", id !== frame.step.node_id && frame.visitedNodes.has(id));
    }
    if (ctx.follow) followActive();
  }

  /**
   * WP-107 (e2): the panel body (root) scrolls just far enough that the active node lies inside it; a node in view moves nothing. Only
   * the body scrolls - `scrollIntoView` would also scroll the page, and stepping never scrolls the page.
   */
  function followActive() {
    const g = root.querySelector("g.active");
    if (g) keepInView(root, g);
  }

  /**
   * Re-lay out when the panel width really changed (a resize, a collapsing sidebar, presenting mode).
   * The pages create a new chart on the same panel for every trace: the previous one stops watching.
   */
  function watch() {
    if (observer || typeof ResizeObserver === "undefined") return;
    observers.get(root)?.disconnect();
    observer = new ResizeObserver(() => {
      if (!flow || !root.isConnected) return;
      const w = availableWidth();
      if (Math.abs(w - lastWidth) >= 4) build();
    });
    observers.set(root, observer);
    observer.observe(root);
  }

  return {
    /** @param {any} flowchart */
    setFlowchart(flowchart) {
      flow = flowchart;
      lastFrame = null;
      build();
      watch();
    },
    /** WP-107 (g2): draw again at the reader's new size factor (the active node stays marked and in view) */
    relayout() {
      if (flow) build();
    },
    reset() {
      lastFrame = null;
      for (const g of nodeEls.values()) g.classList.remove("active", "done");
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      lastFrame = frame;
      applyFrame(frame);
    },
  };
}
