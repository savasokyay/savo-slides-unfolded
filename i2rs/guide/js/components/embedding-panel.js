// @ts-check
// WP-46: the latent space as a hand-rolled SVG scatter, one frame per training epoch (frame 0 =
// the seeded initialisation). Reads `trace.views.embedding` (EmbeddingView): every frame is
// projected with ONE basis on the server, so a point moves because the model learned. The frame
// shown is the max row index over the frame's `embedding` highlights (they persist, so the player
// can jump anywhere and land on the right epoch); `cols` of an embedding highlight mark points
// (the active user / the target item). Users and items share the plane - a dot product is what
// the model scores - users are dots, items are diamonds; motion is a CSS transition on transform.
//
// WP-160: the scene is as big as the stage. The viewBox used to be a fixed 440 x 300, which kept its aspect ratio in whatever box the tab had: a wide, low box
// (416 x 209 px at 1536 x 864) drew the plot 265 px wide inside it, with empty bands left and right. Now the viewBox is the stage's own size in pixels (1 unit = 1
// px at the panel's size step; the Formula panel's - / + still enlarge the whole picture through the svg's CSS size, mf.css), and a ResizeObserver lays the scene out
// again when the box changes (a window resize, the presenting view, the tab opening: a closed tab has no size). The axes' bounds stay GLOBAL over every frame, so the
// picture does not rescale mid-walk: the cluster that starts small (std 0.1) grows into the room - that is the story of the walk. The line the viewer read above the
// plot ("epoch 6 · raw factor axes · axes carry 51 % + 49 % ...") is split: the epoch is a bubble inside the scene, at its top left, the note about the axes joins the
// legend row under it - the plot gains the height of that line.

import { LABEL_GAP, PAD_BOTTOM, PAD_TOP, PAD_X, fitLabel, labelRoom, labelSide, sceneBounds, sceneScales } from "../util/scatter-scene.js"; // WP-160; WP-170: fitLabel, labelRoom

const NS = "http://www.w3.org/2000/svg";

/**
 * @param {HTMLElement} root
 * @param {{i18n: any}} ctx
 */
export function createEmbeddingPanel(root, ctx) {
  /** @type {any} */
  let view = null;
  /** @type {SVGGElement[]} */
  let pointEls = [];
  /** @type {HTMLElement | null} */
  let frameEl = null;
  /** @type {HTMLElement | null} */
  let stageEl = null;
  /** @type {SVGSVGElement | null} */
  let svgNode = null;
  /** @type {{xAxis: Element, yAxis: Element, xLabel: Element, yLabel: Element} | null} */
  let axes = null;
  /** @type {ResizeObserver | null} */
  let observer = null;
  /** @type {((x: number) => number) | null} */
  let sx = null;
  /** @type {((y: number) => number) | null} */
  let sy = null;
  /** the bounds over EVERY frame (origin included), and each point's x range over them: both fixed for the whole walk */
  /** @type {{xmin: number, xmax: number, ymin: number, ymax: number}} */
  let bounds = { xmin: 0, xmax: 0, ymin: 0, ymax: 0 };
  /** @type {Array<[number, number]>} */
  let reach = [];
  let sceneW = 0;
  let sceneH = 0;
  /** @type {string | null} */
  let lastKey = null;
  /** what the player asked for last: the scene is laid out again from it when the box changes */
  let shownFrame = 0;
  /** @type {Map<number, string>} */
  let shownMarks = new Map();

  /**
   * @param {string} tag
   * @param {Record<string, string | number>} attrs
   */
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  function idle() {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t("mf.no_embedding");
    root.appendChild(p);
  }

  function build() {
    observer?.disconnect();
    observer = null;
    root.innerHTML = "";
    pointEls = [];
    lastKey = null;
    sx = null;
    sy = null;
    sceneW = 0;
    sceneH = 0;
    stageEl = null;
    svgNode = null;
    axes = null;
    if (!view || !view.frames?.length) {
      idle();
      return;
    }
    const { i18n } = ctx;
    // global bounds over EVERY frame (origin included) so the axes never rescale mid-animation; each point's reach in x over the frames decides its label's side
    ({ bounds, reach } = sceneBounds(view.frames, view.labels.length));

    // WP-158: the scatter is a tab of the Formula panel: it fits the room under the tab head and above its legend (the svg is as wide and as tall as `.embedding-stage`), and the panel's
    // size group (- / +, `--formula-zoom`) enlarges it from there - an enlarged scatter scrolls inside the stage (mf.css)
    const stage = document.createElement("div");
    stage.className = "embedding-stage";
    stageEl = stage;
    // WP-160: the epoch bubble: a zero-height slot that sticks to the stage's top left (an enlarged scatter scrolls under it), so it never takes the plot's room
    const slot = document.createElement("div");
    slot.className = "embedding-badge";
    frameEl = document.createElement("span");
    frameEl.className = "embedding-frame";
    slot.appendChild(frameEl);
    const svg = /** @type {SVGSVGElement} */ (svgEl("svg", { class: "embedding-svg" }));
    svgNode = svg;
    // axes through the origin (dot products are read against it); their ends are set by `layout()`
    const xAxis = svgEl("line", { class: "embed-axis" });
    const yAxis = svgEl("line", { class: "embed-axis" });
    svg.append(xAxis, yAxis);
    const xl = svgEl("text", { class: "embed-axis-label", "text-anchor": "end" });
    xl.textContent = view.basis === "svd" ? "PC1" : "f₁";
    const yl = svgEl("text", { class: "embed-axis-label" });
    yl.textContent = view.basis === "svd" ? "PC2" : "f₂";
    svg.append(xl, yl);
    axes = { xAxis, yAxis, xLabel: xl, yLabel: yl };

    view.labels.forEach((label, p) => {
      const kind = view.kinds[p];
      const role = view.roles[p];
      const g = /** @type {SVGGElement} */ (svgEl("g", { class: `embed-point kind-${kind} role-${role}` }));
      const shape =
        kind === "user"
          ? svgEl("circle", { cx: 0, cy: 0, r: 6, class: "dot" })
          : svgEl("rect", { x: -5.5, y: -5.5, width: 11, height: 11, transform: "rotate(45)", class: "dot" });
      const text = svgEl("text", { x: LABEL_GAP, y: 4, class: "lbl" });
      text.textContent = label;
      g.append(shape, text);
      g.setAttribute("data-point", String(p));
      svg.appendChild(g);
      pointEls.push(g);
    });
    stage.append(slot, svg);
    root.appendChild(stage);

    // WP-160: the legend row carries the note about the axes the line above the plot used to carry ("raw factor axes · axes carry 51 % + 49 % of the factor energy")
    const legend = document.createElement("div");
    legend.className = "embed-legend";
    const lu = document.createElement("span");
    lu.innerHTML = `<span class="sw"></span>${i18n.t("mf.legend_users")}`;
    const li = document.createElement("span");
    li.innerHTML = `<span class="sw item"></span>${i18n.t("mf.legend_items")}`;
    const note = document.createElement("span");
    note.className = "embedding-note";
    const [a, b] = view.explained || [];
    const basis = i18n.t(view.basis === "svd" ? "mf.svd_axes" : "mf.raw_axes");
    note.textContent =
      a !== undefined && b !== undefined
        ? `${basis} · ${i18n.t("mf.explained", { a: `${(a * 100).toFixed(0)}%`, b: `${(b * 100).toFixed(0)}%` })}`
        : basis;
    legend.append(lu, li, note);
    root.appendChild(legend);

    paintFrameName(shownFrame);
    observer = new ResizeObserver(() => layout());
    observer.observe(stage);
    layout();
  }

  /**
   * The scene is the stage's own size: the viewBox, the scales, the axes and each label's side are taken from it again whenever it changes.
   */
  function layout() {
    if (!view || !stageEl || !svgNode || !axes) return;
    const w = Math.round(stageEl.clientWidth);
    const h = Math.round(stageEl.clientHeight);
    if (w < 40 || h < 40) return; // a closed tab has no size (`display: none`): the observer calls this again when it opens
    if (w === sceneW && h === sceneH && sx && sy) return;
    sceneW = w;
    sceneH = h;
    const scales = sceneScales(bounds, w, h);
    const px = scales.x;
    const py = scales.y;
    sx = px;
    sy = py;
    svgNode.setAttribute("viewBox", `0 0 ${w} ${h}`);
    for (const [k, v] of Object.entries({ x1: PAD_X, x2: w - PAD_X, y1: py(0), y2: py(0) })) axes.xAxis.setAttribute(k, String(v));
    for (const [k, v] of Object.entries({ x1: px(0), x2: px(0), y1: PAD_TOP, y2: h - PAD_BOTTOM })) axes.yAxis.setAttribute(k, String(v));
    for (const [k, v] of Object.entries({ x: w - PAD_X, y: py(0) - 4 })) axes.xLabel.setAttribute(k, String(v));
    for (const [k, v] of Object.entries({ x: px(0) + 4, y: PAD_TOP + 8 })) axes.yLabel.setAttribute(k, String(v));
    // a label goes to the side of its dot that has room for it over the WHOLE walk (the dot's reach over every frame), so it never flips while it plays and never leaves the stage:
    // right when it fits there, else left when it fits there, else the side with more room
    const fontPx = Number.parseFloat(getComputedStyle(pointEls[0]?.querySelector(".lbl") ?? svgNode).fontSize) || 10;
    pointEls.forEach((g, p) => {
      const text = g.querySelector(".lbl");
      if (!text) return;
      const [lo, hi] = reach[p] ?? [0, 0];
      const full = String(view.labels[p] ?? ""); // WP-170: the side is judged on the FULL label (the text below may be a shortened one from an earlier layout)
      const reachPx = /** @type {[number, number]} */ ([px(lo), px(hi)]);
      const toLeft = labelSide(full, fontPx, reachPx, w) === "left";
      text.setAttribute("x", String(toLeft ? -LABEL_GAP : LABEL_GAP));
      text.setAttribute("text-anchor", toLeft ? "end" : "start");
      // WP-170: a label wider than the room on its side (a 61-character title: 52 px past the scene's edge at 1536 x 864) is shortened by its NAME with an ellipsis, the "(Year)" stays, the
      // full title is the dot's hover title - the same rule as every film title (WP-135); measured on the drawn text, so it holds for any font size (the presenting view)
      const shown = fitLabel(full, labelRoom(toLeft ? "left" : "right", reachPx, w), (s) => {
        text.textContent = s;
        return /** @type {SVGTextContentElement} */ (text).getComputedTextLength();
      });
      text.textContent = shown;
      g.querySelector("title")?.remove();
      if (shown !== full) {
        const hover = svgEl("title", {});
        hover.textContent = full;
        g.prepend(hover);
      }
    });
    // no glide while the geometry itself changes: only a frame change moves a point with a transition
    svgNode.classList.add("is-laying-out");
    showFrame(shownFrame, shownMarks);
    const node = svgNode;
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove("is-laying-out")));
  }

  /** @param {number} f */
  function paintFrameName(f) {
    if (!frameEl || !view) return;
    frameEl.textContent = f === 0 ? ctx.i18n.t("mf.frame_init") : ctx.i18n.t("mf.frame_epoch", { n: view.frame_labels?.[f] ?? f });
  }

  /**
   * @param {number} f
   * @param {Map<number, string>} marks
   */
  function showFrame(f, marks) {
    if (!view || !sx || !sy) return;
    const frame = view.frames[f];
    frame.forEach(([x, y], p) => {
      const g = pointEls[p];
      if (!g) return;
      g.style.transform = `translate(${sx ? sx(x) : 0}px, ${sy ? sy(y) : 0}px)`;
      for (const cls of [...g.classList]) if (cls.startsWith("hl-")) g.classList.remove(cls);
      const style = marks.get(p);
      if (style) g.classList.add(`hl-${style}`);
    });
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      view = trace.views?.embedding || null;
      shownFrame = 0;
      shownMarks = new Map();
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!view || !view.frames?.length) return;
      let f = 0;
      /** @type {Map<number, string>} */
      const marks = new Map();
      for (const h of frame.highlights) {
        if (h.view !== "embedding") continue;
        for (const r of h.rows || []) f = Math.max(f, r);
        for (const c of h.cols || []) marks.set(c, h.style);
      }
      f = Math.min(f, view.frames.length - 1);
      const key = `${f}|${[...marks.entries()].map(([p, s]) => `${p}:${s}`).join(",")}`;
      if (key === lastKey) return;
      lastKey = key;
      shownFrame = f;
      shownMarks = marks;
      paintFrameName(f);
      showFrame(f, marks); // (before the first layout - a closed tab - there is no scale yet: `layout()` shows it)
    },
  };
}
