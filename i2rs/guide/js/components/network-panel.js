// @ts-check
// WP-47: the architecture diagram of a neural trace (`trace.views.network`, NetworkView). Stages are
// boxes laid out left to right by their depth in the wiring (topological levels), edges are straight
// lines between box centres, and each box shows its size plus the first activations of the traced
// pair as small bars. The frame's `network` highlights (rows = stage indices) mark the stage the
// current step talks about (`hl-active`) or the final output (`hl-result`). Hand-rolled SVG, like
// the flowchart, so the classroom needs no extra library.
// WP-154: the diagram is the second tab of the sub-matrix panel (pages/trace-page.js). By default the WHOLE diagram fits the tab (the svg's viewBox is scaled to the tab's width and
// height, mf.css; nothing scrolls); the size group's `--network-zoom` enlarges it from there (1.1x ... 1.4x), and only then it scrolls inside `.network-scroll` and the stage the step
// talks about is kept in view. WP-165: "in view" is the CENTRE: the active stage is put at the centre of the scroll box, when the size group changes the drawing and at every
// step (instantly - the walk is key by key), on the axes along which the box scrolls; a diagram that fits does not scroll at all.
// WP-168a: the two `input` stages (the user's and the film's index: the first column, no bars, no |θ|) show the NAME the engine puts in `detail` and the index ("#3"); an id is drawn as
// ONE box with an edge to each embedding table it indexes (NeuMF has a GMF and an MLP table per entity). A step that lights an id and the table it indexes puts the frame on both, and
// the diagram is centred on the two together. The grid, the text fitting and the bar scale are plain logic in util/network-layout.js (checked by hand under node).

import { centreRectInView, scrollDelta } from "../util/scroll-within.js"; // WP-154; WP-165: centred, not merely in view; WP-168a: on the boxes a step lights, together; WP-222: the fit-width drawing only moves when it must
import { BOX_H, BOX_W, DEFAULT_GEO, LINE_H, TEXT_W, barExtent, edgeEnds, fitText, inputCaption, inputRole, isCbStage, layoutNetwork, layoutTwoSided, layoutVertical, unionRect, wrapLines } from "../util/network-layout.js"; // WP-168a; WP-168b; WP-199; WP-222; WP-245: the vertical drawing, a slim box's name cut to its room
import { layerTipKeys } from "../util/layer-tip.js"; // WP-168c: what a hovered box says
import { placeBubble } from "../util/bubble-place.js"; // WP-168c: where the bubble goes
import { joinParts, nonzeroOf } from "../util/dnn-features.js"; // WP-243: what the feature network's join is made of; WP-244: and how much of a box's width is non-zero for this pair

const NS = "http://www.w3.org/2000/svg";
/** WP-199: the longest list of term names a box's bubble quotes (characters) */
const TERMS_TIP_CHARS = 240;

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, footnote?: string}} ctx `footnote` (WP-216): a sentence under the architecture line (the content page's network says what its input is)
 */
export function createNetworkPanel(root, ctx) {
  /** @type {any} */
  let view = null;
  /** @type {SVGGElement[]} */
  let boxEls = [];
  /** WP-154: the box the diagram scrolls in @type {HTMLElement | null} */
  let scrollEl = null;
  /** WP-154: the stages the step talks about (kept in view; WP-168a: an id and the table it indexes are two) @type {SVGGElement[]} */
  let activeBoxes = [];
  /** @type {ResizeObserver | null} */
  let sizeObserver = null;
  /** WP-168c: the bubble a hovered (or focused) box shows - what the stage does - one element per drawing @type {HTMLElement | null} */
  let tipEl = null;
  /** WP-244: what the trace says about the side inputs (`result.side_inputs`): the tips quote it (the count per field, the profile's films and signs) @type {any} */
  let sideInputs = null;

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  /**
   * WP-168c: show the bubble over a box. It is `position: fixed` (mf.css `.net-tip`: the tab's body clips what is inside it, not what is fixed), centred over the box and put on the side
   * with the room for it (util/bubble-place.js); its size is rem, so it follows presenting mode. The native `<title>` tip it replaces is browser-sized and slow.
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

  /** WP-154: bring the active stage into view inside the scroll box (the container only: the page never moves); nothing to do while the tab is not on screen (no size).
   *  WP-165: and to its centre - the stage is where the reader looks when the size group enlarges the drawing. WP-168a: the centre of all the stages the step lights */
  function follow() {
    if (!activeBoxes.length || !scrollEl || scrollEl.clientWidth <= 0) return;
    const around = unionRect(activeBoxes.map((g) => g.getBoundingClientRect()));
    if (!around) return;
    if (scrollEl.classList.contains("fit-width")) {
      // WP-222: the feature network's drawing is taller than its tab and scrolls vertically only: a step whose stage is already in view moves nothing (centring at every step - the plain
      // drawing's rule - would swing a 400-unit drawing up and down with the walk); one that is not comes in with a little room (a union taller than the tab is aligned at its top)
      const box = scrollEl.getBoundingClientRect();
      const dy = scrollDelta(box.top, box.top + scrollEl.clientHeight, around.top, around.bottom, 12);
      if (dy !== 0) scrollEl.scrollTop += dy;
      return;
    }
    centreRectInView(scrollEl, around);
  }
  /** @type {string | null} */
  let lastKey = null;

  /**
   * @param {string} tag
   * @param {Record<string, string | number>} attrs
   */
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  /**
   * WP-168a: the width of a string in the diagram's font, so a title or a name is cut to the room a box has. A canvas measures it with the tab hidden too (an svg text has no width
   * then); without one the width is estimated from the character count.
   * @param {number} weight
   * @param {number} size font size in the diagram's own units (= CSS px: mf.css `.net-title` 10.5px / `.net-value` 10px)
   * @returns {(s: string) => number}
   */
  function measurer(weight, size) {
    try {
      const canvas = document.createElement("canvas").getContext("2d");
      if (canvas) {
        canvas.font = `${weight} ${size}px ${getComputedStyle(root).fontFamily || "sans-serif"}`;
        return (s) => canvas.measureText(s).width;
      }
    } catch {
      /* no canvas: the estimate below */
    }
    return (s) => s.length * size * 0.6;
  }

  function idle() {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t("mf.no_network");
    root.appendChild(p);
  }

  function build() {
    root.innerHTML = "";
    boxEls = [];
    scrollEl = null;
    activeBoxes = [];
    sizeObserver?.disconnect();
    sizeObserver = null;
    tipEl = null;
    lastKey = null;
    if (!view || !view.layers?.length) {
      idle();
      return;
    }
    const { i18n } = ctx;
    // WP-243: the feature network's join - how many numbers it receives and from which stages (the tips of the join and of the MLP, and the caption under the diagram, say it)
    const featureNet = view.architecture === "features";
    const parts = featureNet ? joinParts(view) : [];
    const joinSum = parts.reduce((total, part) => total + part.size, 0);
    const joinText = parts.map((part) => `${i18n.t(part.label_key)} ${part.size}`).join(" + ");
    // WP-222: the feature network (sixteen stages: the user's side, the film's side, the join) is drawn two-sided and compact - the user's stages flow right, the film's flow left, the layers after
    // the join run along a row of their own - at the tab's WIDTH, scrolling vertically (mf.css `.fit-width`); every other architecture keeps the plain grid and its fit-both rule. `geo` is the
    // drawing's box size: the three names below shadow the plain grid's constants inside this function, so the box code under them reads as it always did
    // WP-245: and it is drawn from the top down now (util/network-layout.js `layoutVertical`: one column per tower, the join below them, the layers after it a narrow stack, right-angled arrows),
    // as wide as the flowchart column it lives in; the two-sided drawing stays as the fallback for a wiring the vertical one does not take
    const vertical = featureNet ? layoutVertical(view.layers, view.edges || []) : null;
    const twoSided = featureNet && !vertical ? layoutTwoSided(view.layers, view.edges || []) : null;
    const { width, height, pos } = /** @type {{width: number, height: number, pos: Map<string, any>}} */ (vertical ?? twoSided ?? layoutNetwork(view.layers, view.edges || []));
    const geo = /** @type {import("../util/network-layout.js").VerticalGeo} */ (vertical ? vertical.geo : twoSided ? twoSided.geo : DEFAULT_GEO);
    const BOX_W = geo.boxW; // eslint-disable-line no-shadow
    const BOX_H = geo.boxH; // eslint-disable-line no-shadow
    const TEXT_W = geo.textW; // eslint-disable-line no-shadow
    const LINE_H = geo.lineH; // eslint-disable-line no-shadow
    // WP-244: the numbers a tip quotes besides the box's own - the film's non-zero terms per field, the user's profile (films it was built from, terms pushed up and down)
    const fieldsText = Object.entries(sideInputs?.item_content?.fields ?? {}).map(([name, count]) => `${name} ${count}`).join(", ");
    const tipFacts = { fields: fieldsText, films: sideInputs?.user_profile?.n_films ?? "", pos: sideInputs?.user_profile?.n_positive ?? "", neg: sideInputs?.user_profile?.n_negative ?? "" };
    const measureTitle = measurer(700, 10.5);
    const measureValue = measurer(600, 10);
    const measureMore = measurer(400, 9); // WP-199: the "+k" label (mf.css `.net-more`: 9px)
    const svg = svgEl("svg", { class: vertical ? "network-svg net-vertical" : "network-svg", viewBox: `0 0 ${width} ${height}` }); // WP-245
    svg.style.setProperty("--net-ratio", String(width / height)); // WP-165a: the drawing's shape: mf.css sizes the svg to the drawing, not to the box
    svg.style.setProperty("--net-units", String(width)); // WP-245: and its width in units: a drawing with few columns (the ids-only network) is not enlarged past 1.25x (mf.css `.net-vertical`)
    const defs = svgEl("defs", {});
    const marker = svgEl("marker", {
      id: "net-arrow",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: "auto-start-reverse",
    });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "net-arrowhead" }));
    defs.appendChild(marker);
    svg.appendChild(defs);
    for (const [from, to] of view.edges || []) {
      const a = pos.get(from);
      const b = pos.get(to);
      if (!a || !b) continue;
      const route = vertical?.routes.get(`${from}>${to}`); // WP-245: down, across, down - never a diagonal
      if (route) {
        svg.appendChild(svgEl("path", { d: route.map((point, k) => `${k ? "L" : "M"} ${point.x} ${point.y}`).join(" "), class: "net-edge net-edge-path", "marker-end": "url(#net-arrow)" }));
        continue;
      }
      svg.appendChild(svgEl("line", { ...edgeEnds(a, b, geo), class: "net-edge", "marker-end": "url(#net-arrow)" }));
    }
    const absMax = barExtent(view.layers);
    view.layers.forEach((layer, index) => {
      const p = pos.get(layer.id) || { x: 0, y: 0 };
      // WP-245: the vertical drawing gives each box its own size (a column box, the wider side input, a slim box of the stack); every other drawing's boxes are the geometry's
      const boxW = p.w ?? geo.boxW;
      const boxH = p.h ?? geo.boxH;
      const textW = p.w ? boxW - 12 : geo.textW;
      const slim = p.mode === "slim";
      // WP-168b: an id is an entity: the user's box wears the users' colour, the film's the films' (mf.css `.role-user` / `.role-item`)
      const role = inputRole(layer);
      const g = /** @type {SVGGElement} */ (svgEl("g", { class: `net-box kind-${layer.kind}${role ? ` role-${role}` : ""}`, "data-layer": String(index) }));
      g.appendChild(svgEl("rect", { x: p.x, y: p.y, width: boxW, height: boxH, rx: 6, class: "net-rect" })); // WP-245
      // WP-168b: the ring a LIT id box keeps its role in: the pulsing navy frame is the same on every stage, so the role stays as a second, inner frame (mf.css `.net-ring`)
      if (role) g.appendChild(svgEl("rect", { x: p.x + 4, y: p.y + 4, width: boxW - 8, height: boxH - 8, rx: 3, class: "net-ring" })); // WP-245
      // WP-168a: a long title (an embedding table names its branch: "user embedding (GMF)") takes two lines; the lines below it follow
      // WP-245: a slim box keeps its name on ONE line at the left, cut to the room the parameter count leaves it; a column box's title takes up to `geo.titleLines` lines (two on every other drawing)
      const paramsText = layer.n_params ? `|θ| ${layer.n_params}` : null;
      const slimParamsW = slim && paramsText ? measureMore(paramsText) + 6 : 0;
      const titleLines = slim ? [fitText(i18n.t(layer.label_key), boxW - 16 - slimParamsW, measureTitle)] : wrapLines(i18n.t(layer.label_key), textW, measureTitle, p.mode === "flank" ? 2 : (geo.titleLines ?? 2));
      titleLines.forEach((line, k) => {
        const title = svgEl("text", slim ? { x: p.x + 8, y: p.y + 15, class: "net-title" } : { x: p.x + boxW / 2, y: p.y + 15 + k * LINE_H, class: "net-title", "text-anchor": "middle" }); // WP-245
        title.textContent = line;
        g.appendChild(title);
      });
      const lastTitleY = p.y + 15 + (titleLines.length - 1) * LINE_H;
      // WP-199: the content page's network has an `input` stage too, but it is the film's TERMS (their values are bars, like every other stage's), not an id
      if (slim) {
        // WP-245: a slim box of the stack from the join down (the join, the MLP's layers, the output): the name and `|θ|` on the first line, the details under the name and the bars at the right of the
        // second line (the first values of this pair, on the same scale as every other box's)
        if (paramsText) {
          const total = svgEl("text", { x: p.x + boxW - 8, y: p.y + 15, class: "net-meta", "text-anchor": "end" });
          total.textContent = paramsText;
          g.appendChild(total);
        }
        const meta = svgEl("text", { x: p.x + 8, y: p.y + 29, class: "net-meta" });
        // WP-245: the feature network's join says what it is made of where its bars would be (they are the first values of the user's embedding again): n = 53 = 8+8+16+16+3+2
        const composition = featureNet && layer.kind === "concat" && parts.length ? `n = ${layer.size} = ${parts.map((part) => part.size).join("+")}` : null;
        const slimSized = featureNet ? nonzeroOf(layer) : null; // WP-244
        meta.textContent = composition ?? [slimSized ? i18n.t("mf.net_nonzero", { nz: slimSized.nonzero, n: slimSized.size }) : `n = ${layer.size}`, layer.activation].filter(Boolean).join(" · ");
        g.appendChild(meta);
        const values = composition ? [] : layer.values || [];
        const moreW = layer.truncated && !composition ? measureMore(`+${layer.truncated}`) + 4 : 0;
        const barW = 7;
        const right = p.x + boxW - 8;
        const first = right - values.length * barW - moreW;
        const baseY = p.y + boxH - 5;
        values.forEach((v, k) => {
          const h = (Math.abs(v) / absMax) * 10;
          g.appendChild(svgEl("rect", { x: first + k * barW, y: v >= 0 ? baseY - h : baseY, width: barW - 2, height: Math.max(h, 0.5), class: `net-bar ${v >= 0 ? "pos" : "neg"}` }));
        });
        if (layer.truncated && !composition) {
          const more = svgEl("text", { x: first + values.length * barW + 2, y: baseY - 2, class: "net-more" });
          more.textContent = `+${layer.truncated}`;
          g.appendChild(more);
        }
        if (!composition) g.appendChild(svgEl("line", { x1: first - 2, x2: right, y1: baseY, y2: baseY, class: "net-baseline" }));
      } else if (layer.kind === "input" && !isCbStage(layer)) {
        // WP-168a: an id, not a layer: the name behind it and the row number it looks up - no n, no |θ|, no bars
        const caption = inputCaption(layer, measureValue, textW); // WP-245
        let y = lastTitleY + 17;
        for (const line of caption.value) {
          const value = svgEl("text", { x: p.x + boxW / 2, y, class: "net-value", "text-anchor": "middle" }); // WP-245
          value.textContent = line;
          g.appendChild(value);
          y += 13;
        }
        if (caption.index) {
          const row = svgEl("text", { x: p.x + boxW / 2, y: y + 1, class: "net-meta", "text-anchor": "middle" }); // WP-245
          row.textContent = caption.index;
          g.appendChild(row);
        }
      } else {
        const meta = svgEl("text", { x: p.x + boxW / 2, y: lastTitleY + 13, class: "net-meta", "text-anchor": "middle" }); // WP-245
        const sized = featureNet ? nonzeroOf(layer) : null; // WP-244: "16 of 2000" where only some of the box's numbers are non-zero for this pair
        const parts = [sized ? i18n.t("mf.net_nonzero", { nz: sized.nonzero, n: sized.size }) : `n = ${layer.size}`];
        if (layer.activation) parts.push(layer.activation);
        // WP-222: a compact box (96 wide) puts the parameter count on a second line of the details instead of cutting it
        const paramsLine = layer.n_params ? `|θ| ${layer.n_params}` : null;
        if (paramsLine && geo.metaLines < 2) parts.push(paramsLine);
        meta.textContent = parts.join(" · ");
        g.appendChild(meta);
        if (paramsLine && geo.metaLines >= 2) {
          const meta2 = svgEl("text", { x: p.x + boxW / 2, y: lastTitleY + 13 + geo.metaH, class: "net-meta", "text-anchor": "middle" }); // WP-245
          meta2.textContent = paramsLine;
          g.appendChild(meta2);
        }
        // activation bars: signed, scaled to the largest magnitude in the view
        const values = layer.values || [];
        // WP-199: a stage of the content page's network can hold thousands of terms ("+1994"): its bars leave the label the room its own width needs, so it never leaves the box; the neural
        // page's stages are small and keep their rule
        // WP-222: so does a stage of the compact (96-wide) feature network: its "+1994" would leave the box
        const reserveMore = isCbStage(layer) || geo.metaLines > 1;
        const moreW = reserveMore && layer.truncated ? measureMore(`+${layer.truncated}`) + 4 : 0;
        const barW = reserveMore
          ? Math.min(14, (boxW - 16 - moreW) / Math.max(values.length, 1))
          : Math.min(14, (boxW - 16) / Math.max(values.length + (layer.truncated ? 1 : 0), 1));
        const baseY = p.y + boxH - (geo.baseGap ?? 12); // WP-245: the vertical drawing's bars are lower and shorter (its boxes are 80 high)
        const barMax = geo.barMax ?? 28;
        values.forEach((v, k) => {
          const h = (Math.abs(v) / absMax) * barMax;
          const x = p.x + 8 + k * barW;
          g.appendChild(
            svgEl("rect", {
              x,
              y: v >= 0 ? baseY - h : baseY,
              width: Math.max(barW - 2, 1),
              height: Math.max(h, 0.5),
              class: `net-bar ${v >= 0 ? "pos" : "neg"}`,
            })
          );
        });
        if (layer.truncated) {
          const more = svgEl("text", { x: p.x + 8 + values.length * barW + 2, y: baseY - 2, class: "net-more" });
          more.textContent = `+${layer.truncated}`;
          g.appendChild(more);
        }
        g.appendChild(svgEl("line", { x1: p.x + 6, x2: p.x + boxW - 6, y1: baseY, y2: baseY, class: "net-baseline" })); // WP-245
      }
      // WP-168c: what the stage does, on hover and on keyboard focus (the sentences are `mf.layer_tip_*`, picked by util/layer-tip.js from the stage's kind, label key and activation; the
      // genre names of the features stage are its `detail`). It replaces the native `<title>` tip, which every stage with a `detail` had.
      // WP-199: `{terms}` - the names behind the content network's input stage (a long list is cut: the bubble is a sentence, not a table); `{detail}` - what the output stage writes out (the
      // mean + the deviation = the prediction); `{n}` - the stage's width
      const detail = String(layer.detail ?? "");
      const terms = detail.length > TERMS_TIP_CHARS ? `${detail.slice(0, TERMS_TIP_CHARS - 1).trimEnd()}…` : detail;
      const tipText = layerTipKeys(layer, view)
        .map((key) => i18n.t(key, { genres: detail, terms, detail, n: layer.size, ...(featureNet ? { parts: joinText, sum: joinSum, nz: layer.nonzero ?? "", z: typeof layer.nonzero === "number" ? layer.size - layer.nonzero : "", ...tipFacts } : {}) })) // WP-243: + the join's parts on the feature network; WP-244: + the non-zero count and the side inputs' facts
        .join(" ");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "img");
      g.setAttribute("aria-label", `${titleLines.join(" ")}. ${tipText}`);
      g.addEventListener("pointerenter", () => showTip(g, tipText));
      g.addEventListener("pointerleave", hideTip);
      g.addEventListener("focus", () => showTip(g, tipText));
      g.addEventListener("blur", hideTip);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideTip();
      });
      svg.appendChild(g);
      boxEls.push(g);
    });
    scrollEl = document.createElement("div");
    scrollEl.className = "network-scroll";
    if (twoSided) scrollEl.classList.add("fit-width"); // WP-222: as wide as the tab, scrolling vertically (the plain drawing is fitted on both axes)
    scrollEl.appendChild(svg);
    root.appendChild(scrollEl);
    scrollEl.addEventListener("scroll", hideTip); // WP-168c: a bubble over a box that has moved would be in the wrong place
    tipEl = document.createElement("div");
    tipEl.className = "net-tip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.hidden = true;
    root.appendChild(tipEl);
    if (typeof ResizeObserver !== "undefined") {
      // the tab shows (the box gets a size) or the size group changes the drawing: the active stage must not be left outside the view
      sizeObserver = new ResizeObserver(() => follow());
      sizeObserver.observe(scrollEl);
      sizeObserver.observe(svg);
    }
    const note = document.createElement("div");
    note.className = "heat-note";
    note.textContent = `${featureNet ? i18n.t("params.arch_features") : view.architecture} · ${i18n.t("mf.params", { n: view.n_params })}`; // WP-243: the feature network's name, not its key
    root.appendChild(note);
    if (featureNet) {
      // WP-243: what is on screen, in a line of its own: the join's composition and where the interaction is (the reader asked: "where do I see the embeddings and the interactions?")
      const reading = document.createElement("div");
      reading.className = "heat-note network-reading";
      reading.textContent = i18n.t("mf.network_features_reading", { sum: joinSum, parts: joinText });
      root.appendChild(reading);
    }
    if (ctx.footnote) { const more = document.createElement("div"); more.className = "heat-note"; more.textContent = ctx.footnote; root.appendChild(more); } // WP-216: what the network's input is (the content page)
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      view = trace.views?.network || null;
      sideInputs = trace.result?.side_inputs ?? null; // WP-244
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!view || !boxEls.length) return;
      /** @type {Map<number, string>} */
      const marks = new Map();
      for (const h of frame.highlights) {
        if (h.view !== "network") continue;
        for (const r of h.rows || []) marks.set(r, h.style);
      }
      const key = [...marks.entries()].map(([r, s]) => `${r}:${s}`).join(",");
      if (key === lastKey) return;
      lastKey = key;
      boxEls.forEach((g, index) => {
        for (const cls of [...g.classList]) if (cls.startsWith("hl-")) g.classList.remove(cls);
        const style = marks.get(index);
        if (style) g.classList.add(`hl-${style}`);
      });
      // WP-154: a diagram larger than its tab scrolls inside it; the stage the step talks about stays in view (`follow`, also when the tab shows or the size changes)
      // WP-168a: every stage the step marks active (a lookup lights the id and the table it indexes), centred together
      activeBoxes = [...marks.entries()].filter(([, style]) => style === "active").flatMap(([r]) => (boxEls[r] ? [boxEls[r]] : []));
      follow();
    },
  };
}
