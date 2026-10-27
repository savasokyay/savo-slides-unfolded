// @ts-check
// WP-66: the lecture board - a deck's `board` (config/slides/<id>.yaml) drawn as one SVG. Every
// element starts as a faint "ghost" (pencil under-drawing: the whole map is visible from the first
// second, students always see where a node sits in the tree); a step INKS its elements - strokes
// draw themselves (stroke-dashoffset), text fades in, the role colour replaces the ghost grey -
// and puts a halo on the focused one. Frames are pure functions of (trace, index): inked =
// union of `ink` of steps 0..index, so a deep link / a jump backwards shows exactly the state
// stepping there would have shown (TracePlayer contract, WP-32). Only the CURRENT step's elements
// animate on a forward step; a far jump inks the rest instantly.
//
// Panel contract: `{ reset(trace), apply(frame) }` + `setDeck(deck, {clickable})` + `dispose()`
// (no `destroy`: the player is recreated per narration route, the board is not).
//
// Two ways to un-ink: the deck's `unink` (authored: the iCF step ghosts the row ellipses so the
// column ellipses stand alone) and the live eraser (right-click / Shift+click flips one element
// without moving the player; the next authored ink/un-ink of that element wins).
// Clicking an element calls `onElementClick(id)`; the page maps ids to steps (route independent,
// since every route visits every step once - enforced by i2rs.slides.decks).
// WP-67 (system board): edges may run through `via` waypoints (orthogonal loops), a node may be a
// data `store` (flowchart cylinder), and `style: dashed` on a node dashes its box (no lab module).

import { drawGlyph } from "./board-glyphs.js";
import { ROLES, arrowLine, arrowPath, svgEl, textEl } from "./board-svg.js";

const FONT = { sm: 11, md: 14, lg: 20 };
const NOTE_FONT = 13;
const DRAW_MS = 700;
const STAGGER_MS = 110;
const EDGE_GAP = 4;

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, onElementClick?: (id: string) => void}} ctx
 */
export function createBoard(root, ctx) {
  /** @type {Map<string, {g: SVGGElement, type: string, role: string}>} */
  let els = new Map();
  /** @type {any} */
  let deck = null;
  /** @type {Set<string>} */
  let clickable = new Set();
  let prevIndex = -1;
  let prevSub = -1;
  /** @type {Set<string>} */
  let shownPrev = new Set();
  /** @type {import("./trace-player.js").Frame | null} */
  let lastFrame = null;
  /**
   * The instructor's live "eraser": right-click / Shift+click on an element flips it between
   * inked and ghost WITHOUT moving the player (true = force inked, false = force ghost). An
   * override is dropped as soon as a deck click inks or un-inks that element (the authored
   * sequence wins), and on every route change / re-mount. Not part of the URL: it is
   * performance state, not content.
   * @type {Map<string, boolean>}
   */
  let overrides = new Map();

  /**
   * The clicks (step, then its sub-steps) up to and including the position, in order. Each
   * click is `{ink, unink}`; `subs` is the deck's sub-step list (the numeric `substeps` field is
   * TracePlayer's count).
   * @param {any} trace
   * @param {number} index
   * @param {number} sub
   * @returns {{ink: string[], unink: string[]}[]}
   */
  function clicksUpTo(trace, index, sub) {
    /** @type {{ink: string[], unink: string[]}[]} */
    const out = [];
    for (let k = 0; k <= index; k += 1) {
      const step = trace.steps[k];
      out.push({ ink: step.ink || [], unink: step.unink || [] });
      const subs = step.subs || [];
      const upto = k < index ? subs.length : Math.min(sub, subs.length);
      for (let s = 0; s < upto; s += 1) out.push({ ink: subs[s].ink || [], unink: subs[s].unink || [] });
    }
    return out;
  }

  /**
   * Inked set = fold of every click's ink then unink (pure in the position).
   * @param {{ink: string[], unink: string[]}[]} clicks
   */
  function foldInked(clicks) {
    /** @type {Set<string>} */
    const inked = new Set();
    for (const c of clicks) {
      for (const id of c.ink) inked.add(id);
      for (const id of c.unink) inked.delete(id);
    }
    return inked;
  }

  /**
   * The eraser toggle: a second flip RESTORES the authored state (drops the override) rather than
   * forcing the opposite - otherwise a "restored" element would stay force-inked at every later
   * position, e.g. still showing on the cover (caught in Chrome).
   * @param {string} id
   */
  function toggleOverride(id) {
    if (!lastFrame || !els.has(id)) return;
    if (overrides.has(id)) {
      overrides.delete(id);
    } else {
      const shownNow = /** @type {SVGGElement} */ (els.get(id)?.g).classList.contains("inked");
      overrides.set(id, !shownNow);
    }
    render(lastFrame, false);
  }
  const reducedMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Bounding box of a non-edge element (nodes are centre-anchored, figures/notes top-left). */
  function boxOf(el) {
    if (el.type === "node") {
      return { x0: el.x - el.w / 2, y0: el.y - el.h / 2, x1: el.x + el.w / 2, y1: el.y + el.h / 2 };
    }
    const w = el.w ?? 140;
    const h = el.h ?? (el.lines_key ? el.lines_key.length * noteFont(el) * 1.35 : 20);
    const x0 = el.type === "note" && el.align === "center" ? el.x - w / 2 : el.x; // WP-82
    return { x0, y0: el.y, x1: x0 + w, y1: el.y + h };
  }

  /**
   * WP-80: a note's font - `size: sm` matches the glyph captions (11 px), default 13 px.
   * @param {any} el
   */
  function noteFont(el) {
    return el.size === "sm" ? 11 : NOTE_FONT;
  }

  /**
   * Where the ray from box `a`'s centre towards point (tx, ty) leaves `a` (plus a small gap).
   * @param {{x0: number, y0: number, x1: number, y1: number}} a
   * @param {number} tx
   * @param {number} ty
   */
  /**
   * WP-80: the middle of one side of a box, pushed EDGE_GAP outwards (edge anchor).
   * WP-82: `d` shifts the anchor along that side (x on top / bottom, y on left / right), so two
   * edges leaving the same side hang from their own stems instead of one shared line.
   * @param {{x0: number, y0: number, x1: number, y1: number}} b
   * @param {"top" | "bottom" | "left" | "right"} side
   * @param {number} [d]
   */
  function sidePoint(b, side, d = 0) {
    const mx = (b.x0 + b.x1) / 2;
    const my = (b.y0 + b.y1) / 2;
    if (side === "top") return { x: mx + d, y: b.y0 - EDGE_GAP };
    if (side === "bottom") return { x: mx + d, y: b.y1 + EDGE_GAP };
    if (side === "left") return { x: b.x0 - EDGE_GAP, y: my + d };
    return { x: b.x1 + EDGE_GAP, y: my + d };
  }

  function exitPoint(a, tx, ty) {
    const cx = (a.x0 + a.x1) / 2;
    const cy = (a.y0 + a.y1) / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    const tX = dx > 0 ? (a.x1 - cx) / dx : dx < 0 ? (a.x0 - cx) / dx : Infinity;
    const tY = dy > 0 ? (a.y1 - cy) / dy : dy < 0 ? (a.y0 - cy) / dy : Infinity;
    const t = Math.min(tX, tY);
    const len = Math.hypot(dx, dy) || 1;
    const gap = EDGE_GAP / len;
    return { x: cx + dx * (t + gap), y: cy + dy * (t + gap) };
  }

  /**
   * @param {string} id
   * @param {SVGGElement} g
   * @param {string} type
   * @param {string} role
   */
  function register(id, g, type, role) {
    g.dataset.el = id;
    g.classList.add("bd-el", `bd-${type}`, `role-${role}`);
    g.addEventListener("click", (e) => {
      if (e.shiftKey) {
        toggleOverride(id); // Shift+click = the eraser, same as right-click
        return;
      }
      if (ctx.onElementClick && clickable.has(id)) ctx.onElementClick(id);
    });
    g.addEventListener("contextmenu", (e) => {
      e.preventDefault(); // no browser menu on the board: right-click erases / restores
      toggleOverride(id);
    });
    els.set(id, { g, type, role });
  }

  function build() {
    root.innerHTML = "";
    els = new Map();
    if (!deck) return;
    const board = deck.board;
    // sized by CSS (slides.css): the board fills the height the page offers and keeps its aspect
    // ratio, so the drawing is centred whenever the box is wider or taller than the viewBox
    const svg = svgEl("svg", {
      class: "board-svg",
      viewBox: `0 0 ${board.width} ${board.height}`,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
    });
    const defs = svgEl("defs", {});
    for (const role of [...ROLES, "ghost"]) {
      const marker = svgEl("marker", {
        id: `bd-arrow-${role}`,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: "auto-start-reverse",
      });
      marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", class: `bd-head bd-head-${role}` }));
      defs.appendChild(marker);
    }
    svg.appendChild(defs);
    // WP-82: a faint image behind everything (the instructor's logo as a trademark); the deck sets
    // size, centre and opacity, the engine only places it under the layers
    const wm = board.watermark;
    if (wm && wm.src) {
      const cx = wm.x ?? board.width / 2;
      const cy = wm.y ?? board.height / 2;
      svg.appendChild(
        svgEl("image", {
          href: wm.src,
          x: cx - wm.w / 2,
          y: cy - wm.h / 2,
          width: wm.w,
          height: wm.h,
          opacity: wm.opacity ?? 0.06,
          preserveAspectRatio: "xMidYMid meet",
          class: "bd-watermark",
        })
      );
    }

    const byId = new Map(board.elements.map((e) => [e.id, e]));
    const edgeLayer = svgEl("g", { class: "bd-layer-edges" });
    const nodeLayer = svgEl("g", { class: "bd-layer-nodes" });
    svg.append(edgeLayer, nodeLayer);

    for (const el of board.elements) {
      const role = el.role || "ink";
      if (el.type === "edge") {
        const src = byId.get(el.from ?? el.src);
        const dst = byId.get(el.to ?? el.dst);
        if (!src || !dst) continue;
        const a = boxOf(src);
        const b = boxOf(dst);
        // WP-67: with waypoints each box is left towards its nearest waypoint (an orthogonal loop
        // around the board); without, the straight centre-to-centre line as before
        const via = Array.isArray(el.via) ? el.via.map((/** @type {number[]} */ [x, y]) => ({ x, y })) : [];
        const towardsA = via[0] || { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
        const towardsB = via[via.length - 1] || { x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 };
        // WP-80: `from_side` / `to_side` anchor an end at the middle of that side (a tree fans out
        // of the root's bottom into each child's top) instead of the centre-to-centre crossing
        const p1 = el.from_side ? sidePoint(a, el.from_side, el.from_dx || 0) : exitPoint(a, towardsA.x, towardsA.y);
        const p2 = el.to_side ? sidePoint(b, el.to_side, el.to_dx || 0) : exitPoint(b, towardsB.x, towardsB.y);
        const g = /** @type {SVGGElement} */ (svgEl("g", { class: el.style === "dashed" ? "bd-dashed" : "" }));
        g.appendChild(via.length ? arrowPath([p1, ...via, p2], role) : arrowLine(p1.x, p1.y, p2.x, p2.y, role));
        register(el.id, g, "edge", role);
        edgeLayer.appendChild(g);
      } else if (el.type === "node") {
        const g = /** @type {SVGGElement} */ (svgEl("g", { class: `shape-${el.shape || "rect"} size-${el.size || "md"}` }));
        const size = FONT[/** @type {keyof typeof FONT} */ (el.size || "md")];
        const { x0, y0, x1, y1 } = boxOf(el);
        if (el.style === "dashed") g.classList.add("bd-dashed"); // WP-67: a dashed box = no lab module
        if (el.shape === "store") {
          // WP-67: a data store (the flowchart cylinder): body with elliptical top and bottom, the
          // front rim of the top ellipse drawn thin; the label sits a little below the rim
          const ry = Math.min(7, el.h * 0.16);
          const rx = el.w / 2;
          g.appendChild(
            svgEl("path", {
              d: `M ${x0} ${y0 + ry} A ${rx} ${ry} 0 0 1 ${x1} ${y0 + ry} L ${x1} ${y1 - ry} A ${rx} ${ry} 0 0 1 ${x0} ${y1 - ry} Z`,
              class: "bd-shape bd-fill bd-box",
            })
          );
          g.appendChild(svgEl("path", { d: `M ${x0} ${y0 + ry} A ${rx} ${ry} 0 0 0 ${x1} ${y0 + ry}`, class: "bd-shape bd-thin" }));
          g.appendChild(textEl(el.x, el.y + ry / 2, ctx.i18n.t(el.label_key), { size, cls: "bd-label" }));
        } else if (el.shape === "text") {
          // no box: a list item ("→ rule-based"); an invisible hit area keeps it clickable
          g.appendChild(svgEl("rect", { x: x0 - 20, y: y0, width: el.w + 20, height: el.h, class: "bd-hit" }));
          if (el.arrow_in) g.appendChild(arrowLine(x0 - 20, el.y, x0 - 4, el.y, role));
          g.appendChild(textEl(x0, el.y, ctx.i18n.t(el.label_key), { anchor: "start", size, cls: "bd-label" }));
        } else {
          const rx = el.shape === "pill" ? el.h / 2 : 6;
          g.appendChild(svgEl("rect", { x: x0, y: y0, width: el.w, height: el.h, rx, class: "bd-shape bd-fill bd-box" }));
          g.appendChild(textEl(el.x, el.y, ctx.i18n.t(el.label_key), { size, cls: "bd-label" }));
        }
        register(el.id, g, "node", role);
        nodeLayer.appendChild(g);
      } else if (el.type === "note") {
        const g = /** @type {SVGGElement} */ (svgEl("g", {}));
        const fs = noteFont(el);
        const lh = fs * 1.35;
        // WP-82: `align: center` = the lines' middles sit on x (a caption centred under a sketch)
        const anchor = el.align === "center" ? "middle" : "start";
        (el.lines_key || []).forEach((key, i) => {
          g.appendChild(textEl(el.x, el.y + (i + 0.5) * lh, ctx.i18n.t(key), { anchor, size: fs, cls: "bd-note-line" }));
        });
        register(el.id, g, "note", role);
        nodeLayer.appendChild(g);
      } else if (el.type === "figure") {
        const container = svgEl("g", { class: "bd-figure", transform: `translate(${el.x} ${el.y})` });
        drawGlyph(el.glyph, el, {
          t: (key) => ctx.i18n.t(key),
          part: (name, partRole) => {
            const g = /** @type {SVGGElement} */ (svgEl("g", {}));
            register(`${el.id}.${name}`, g, "part", partRole);
            container.appendChild(g);
            return g;
          },
        });
        nodeLayer.appendChild(container);
      }
    }
    for (const [id, e] of els) e.g.classList.toggle("clickable", clickable.has(id));
    root.appendChild(svg);
  }

  /**
   * Draw a frame: state = fold of the deck clicks up to the position, then the live overrides.
   * @param {import("./trace-player.js").Frame} frame
   * @param {boolean} fromPlayer  true when the player moved (may animate, may drop overrides)
   */
  function render(frame, fromPlayer) {
    const sub = frame.sub || 0;
    const clicks = clicksUpTo(frame.trace, frame.index, sub);
    const current = clicks[clicks.length - 1] || { ink: [], unink: [] };
    const moved = frame.index !== prevIndex || sub !== prevSub;
    if (fromPlayer && moved) {
      // an authored ink / un-ink of an element replaces the instructor's manual override of it
      for (const id of [...current.ink, ...current.unink]) overrides.delete(id);
    }
    const inked = foldInked(clicks);
    for (const [id, forced] of overrides) {
      if (forced) inked.add(id);
      else inked.delete(id);
    }
    // the current click: the step itself at sub 0, otherwise its (sub-1)-th sub-step
    const currentClick = sub > 0 && frame.step.subs && frame.step.subs[sub - 1] ? frame.step.subs[sub - 1] : frame.step;
    const stepInk = new Set(current.ink);
    const focus = currentClick.focus || null;
    const forward = frame.index > prevIndex || (frame.index === prevIndex && sub > prevSub);
    let order = 0;
    for (const [id, e] of els) {
      const on = inked.has(id);
      e.g.classList.toggle("inked", on);
      e.g.classList.toggle("focus", on && id === focus);
      e.g.classList.toggle("erased", !on && overrides.get(id) === false);
      for (const arrow of e.g.querySelectorAll(".bd-arrow")) {
        const role = on ? /** @type {HTMLElement} */ (arrow).dataset.role || e.role : "ghost";
        arrow.setAttribute("marker-end", `url(#bd-arrow-${role})`);
      }
      const newlyOn = on && !shownPrev.has(id);
      const animate = fromPlayer ? forward && stepInk.has(id) : true; // a manual restore draws too
      if (newlyOn && animate && !reducedMotion) {
        animateDraw(e.g, order * STAGGER_MS);
        order += 1;
      }
    }
    prevIndex = frame.index;
    prevSub = sub;
    shownPrev = inked;
    lastFrame = frame;
  }

  /**
   * Stroke-draw animation for one element (all its geometry at once, text fades in).
   * @param {SVGGElement} g
   * @param {number} delay ms
   */
  function animateDraw(g, delay) {
    const shapes = /** @type {SVGGeometryElement[]} */ (
      [...g.querySelectorAll("path, line, polyline, rect, circle, ellipse")].filter(
        (s) => s instanceof SVGGeometryElement && !s.classList.contains("bd-hit")
      )
    );
    const lengths = shapes.map((s) => {
      try {
        return s.getTotalLength();
      } catch {
        return 0;
      }
    });
    shapes.forEach((s, k) => {
      if (!lengths[k]) return;
      s.style.strokeDasharray = `${lengths[k]}`;
      s.style.strokeDashoffset = `${lengths[k]}`;
      s.style.transitionDelay = `${delay}ms`;
    });
    g.classList.add("drawing");
    g.style.setProperty("--bd-delay", `${delay}ms`);
    void g.getBoundingClientRect(); // flush: the transition must start from the full offset
    shapes.forEach((s, k) => {
      if (lengths[k]) s.style.strokeDashoffset = "0";
    });
    window.setTimeout(() => {
      shapes.forEach((s) => {
        s.style.strokeDasharray = "";
        s.style.strokeDashoffset = "";
        s.style.transitionDelay = "";
      });
      g.classList.remove("drawing");
      g.style.removeProperty("--bd-delay");
    }, DRAW_MS + delay + 120);
  }

  return {
    /**
     * @param {any} nextDeck
     * @param {{clickable?: Iterable<string>}} [opts]
     */
    setDeck(nextDeck, opts = {}) {
      deck = nextDeck;
      clickable = new Set(opts.clickable || []);
      prevIndex = -1;
      prevSub = -1;
      shownPrev = new Set();
      overrides = new Map();
      lastFrame = null;
      build();
    },
    reset() {
      prevIndex = -1;
      prevSub = -1;
      shownPrev = new Set();
      overrides = new Map();
      lastFrame = null;
      for (const e of els.values()) e.g.classList.remove("inked", "focus", "drawing");
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      render(frame, true);
    },
    /**
     * Remove the SVG. Deliberately NOT named `destroy`: TracePlayer.destroy() calls every panel's
     * `destroy`, and the page restarts the player on every route change while the board must
     * survive (caught in Chrome: the board vanished after switching the narration order).
     */
    dispose() {
      root.innerHTML = "";
      els = new Map();
    },
  };
}
