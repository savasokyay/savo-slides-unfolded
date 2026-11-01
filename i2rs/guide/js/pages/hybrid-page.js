// @ts-check
// WP-221: Hybrid & ensemble overview - the taxonomy of hybrid systems (a figure, every box with a tip, the leaves that have a lab page open it), parallel and sequential designs (a figure),
// the seven types (a table), ensembles seen through bias and variance (the dartboard, a figure), the weighted blend (three formulas read in words, a link to the walk), the ensemble
// families and where the lab stands on each, and the reference. A static page like the Content-based overview (pages/cbf-page.js, the pattern it follows): its text is `hybrid.*` in
// config/i18n/*.yaml and nothing on it depends on the selected data set (`usesDataset: false`: the header's selector is hidden). The sections are the app's collapsible panels; six of them
// carry an (i) with the instructor's guide sentence and the answers to the questions students are likely to ask (the rich bubble of components/rich-tip.js). The figures' geometry is
// util/hybrid-figures.js (pure, pinned under node); the three formulas are KaTeX (the loader of the Formula panel and the Model-based overview).
// Where the lab stands on each type is ONE list (`TYPES`, `FAMILY_ROWS`): `open` = a page exists (a link is drawn), `future` = future work (WP-231: no page, no link), `null` = no pill; flipping a value
// there is the whole change when a walk lands. WP-232: under the seven-type table, one collapsible block per type says what it combines and how it decides (`hybrid.types.detail.<id>`).
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { richInfoTip } from "../components/rich-tip.js";
import { createZoomControl } from "../components/zoom-control.js";
import { placeBubble } from "../util/bubble-place.js";
import { appendEmphasis } from "../util/emphasis.js";
import { dartCells, taxonomyLayout } from "../util/hybrid-figures.js";
import { createPanel } from "../util/panel.js";
import { editionHas } from "../util/publication.js"; // WP-237a: a lab link (and the pill that announces it) exists only for a page the students' edition holds
import { parseRichText } from "../util/rich-text.js"; // WP-232: the line format of the (i) guides, drawn as page content in the type blocks
import { browserStorage } from "../util/safe-storage.js";
import { wrapWords } from "../util/wrap-lines.js";
import { loadVendorCss, loadVendorScript } from "../vendor-loader.js";

/** The sections of the page, in display order (texts: `hybrid.<id>.title`, `hybrid.toc.<id>`). */
const SECTION_IDS = ["taxonomy", "designs", "types", "ensembles", "weighted", "families", "references"];
/** Sections with an (i): how many question / answer pairs `hybrid.tip.<id>` holds (`guide`, `q1` / `a1` ...). */
const TIP_QUESTIONS = { taxonomy: 4, designs: 3, types: 4, ensembles: 4, weighted: 5, families: 3 };
/**
 * The seven hybrid types, in the textbook's order (`hybrid.types.row.<id>.{combines,lab}`; the name is the taxonomy node's, `hybrid.taxonomy.node.<id>.name`). `design` is how the type is wired
 * (`hybrid.types.design.<design>`); `status` says where the lab stands (`open`: a page exists and is linked, `future`: future work - the sidebar's planned row says the same words, no page, no link;
 * `project`: the design of the term project (WP-232b) - its PILL is the project blue (the leaf's box stays like the others'), no page, no link; `null`: no pill at all - WP-231); `route` is the page that shows it and `nav` the sidebar's own
 * label for it (the link's text). A row's `route` is read only while its status is `open`.
 */
const TYPES = [
  { id: "weighted", design: "parallel", status: "open", route: { page: "combine", params: { m: "weighted" }, nav: "nav.combine_weighted" } },
  { id: "switching", design: "parallel", status: "open", route: { page: "combine", params: { m: "switching" }, nav: "nav.combine_switching" } }, // WP-222b: the walk exists (nav row combine.switching)
  { id: "cascade", design: "sequential", status: null, route: null }, // WP-231: no page, no pill
  { id: "augmentation", design: "sequential", status: null, route: null }, // WP-231
  { id: "combination", design: "monolithic", status: "open", route: { page: "dnn", params: { arch: "features" }, nav: "nav.combine_dnn" } }, // WP-231: its page exists (nav row combine.dnn)
  { id: "meta", design: "monolithic", status: "future", route: null }, // WP-231: future work (user decision 2026-10-24): the sidebar row is a placeholder, so no link here either
  { id: "mixed", design: "presentation", status: "project", route: null }, // WP-232b: the group projects of the second half of the term build a mixed hybrid (user, 2026-10-24): the term project's blue PILL, no page
];
/** The columns of the types table after the type's name (`hybrid.types.col_<part>` heads them). */
const TYPE_PARTS = ["combines", "design", "lab"];
/** The ensemble families (`hybrid.families.row.<id>.{name,how,lowers,lab}`) and where the lab stands on each (same values as TYPES). */
const FAMILY_ROWS = [
  { id: "bagging", status: null }, // WP-231: no page, no pill
  { id: "injection", status: null }, // WP-231
  { id: "bucket", status: "open" }, // WP-231: the switching walk is a bucket of models
  { id: "stacking", status: "open" },
  { id: "boosting", status: null }, // WP-231
];
/** The tips of the designs figure's boxes and rails (`hybrid.designs.tip.<id>`). */
const DESIGN_TIPS = ["input", "rec_parallel", "rec_sequential", "combine_parallel", "combine_sequential", "output", "rail_input", "rail_pred"];
/** The week's links: key (`hybrid.weighted.links.<key>.{label,text}`) and the route. */
const LINKS = [{ key: "weighted", page: "combine", params: { m: "weighted" } }];
/** The stacking row of the families table links to the weighted walk (the blend is the first layer of a stack); WP-231: the bucket row to the switching walk (a bucket of models). */
const STACKING_ROUTE = { page: "combine", params: { m: "weighted" }, nav: "nav.combine_weighted" };
const BUCKET_ROUTE = { page: "combine", params: { m: "switching" }, nav: "nav.combine_switching" }; // WP-231
// WP-232a: the textbook chapter and the eight works the type texts cite, as the Crossref check verified them (docs/plans/2610212358-hybrid-references-crossref.md: title, first author, venue and year match
// the record, and the record has a DOI) - r2 Burke 2002, r3 Pazzani 1999, r5 Jahrer et al. 2010, r6 Wolpert 1992, r7 Breiman 1996, r8 He et al. 2017, r9 Cheng et al. 2016; r4 Melville, Mooney and
// Nagarajan 2002 has NO DOI (no Crossref record): its page range 187-192 was verified outside Crossref, from secondary sources, and is still to be confirmed once by hand in the AAAI library or DBLP.
const REFERENCES = 9;
const STORAGE_PAGE = "hybrid";

// the figures, in viewBox units (the svgs scale with their boxes; css/hybrid.css caps them)
const NAME_FONT_PX = 15;
const NAME_LINE_PX = 19;
const PILL_FONT_PX = 12;
const PILL_H = 20;
// the designs figure: two diagrams one above the other
const DES_W = 960;
const DES_H = 392;
// the dartboard: a 2 x 2 grid of targets with the axis labels on the left and on top
const DART = { cellW: 230, cellH: 140, radius: 60, left: 110, top: 38, hit: 3.1 };

const SVG_NS = "http://www.w3.org/2000/svg";
/** @param {string} tag @param {Record<string, string | number>} attrs */
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** @param {string} tag @param {string} [className] @param {string} [text] */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** An element whose text may mark key words with `**…**` (drawn as `strong.key`). @param {string} tag @param {string} className @param {string} text */
function rich(tag, className, text) {
  return appendEmphasis(el(tag, className), text);
}

/** The one-sentence callout of a section - the whole sentence in the page's key-word emphasis (`strong.key`). @param {string} text */
function callout(text) {
  const p = el("p", "hybrid-text hybrid-callout");
  p.appendChild(el("strong", "key", text));
  return p;
}

/** @param {{page: string, params: Record<string, string>}} route the sidebar's own deep-link form (`#/page?key=value`) */
function hashOf(route) {
  const qs = new URLSearchParams(route.params).toString();
  return `#/${route.page}${qs ? `?${qs}` : ""}`;
}

export function createHybridPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {HTMLElement | null} */
  let tipEl = null;

  /** @param {string} key @param {Record<string, string | number>} [params] */
  const t = (key, params) => ctx.i18n.t(key, params);

  // ── the (i) bubbles ──────────────────────────────────────────────────────────────────────────

  /**
   * The text of a section's (i): the guide sentence, then every likely question in bold with its answer (the line format of util/rich-text.js).
   * @param {keyof typeof TIP_QUESTIONS} id
   */
  function sectionTipText(id) {
    const lines = [`## ${t("hybrid.tip.head_guide")}`, t(`hybrid.tip.${id}.guide`), `## ${t("hybrid.tip.head_questions")}`];
    for (let n = 1; n <= TIP_QUESTIONS[id]; n++) lines.push(`- **${t(`hybrid.tip.${id}.q${n}`)}** ${t(`hybrid.tip.${id}.a${n}`)}`);
    return lines.join("\n");
  }

  // ── the hover bubble of the figures ──────────────────────────────────────────────────────────

  /** The width of a piece of text in the figures' label font (a canvas in the CSS font; an estimate where there is no canvas). @param {number} px @param {number} weight @returns {(piece: string) => number} */
  function measureIn(px, weight) {
    const family = root ? getComputedStyle(root).fontFamily : "sans-serif";
    const canvas = document.createElement("canvas").getContext("2d");
    if (!canvas) return (piece) => piece.length * px * 0.56;
    canvas.font = `${weight} ${px}px ${family}`;
    return (piece) => canvas.measureText(piece).width;
  }

  /** What a hovered or focused box says: its tip, in a bubble over the box (fixed, so the page's scroll box never clips it; its size is rem, so the presenting view enlarges it). @param {Element} box @param {string} text */
  function showTip(box, text) {
    if (!tipEl) return;
    tipEl.textContent = text;
    tipEl.hidden = false;
    tipEl.style.visibility = "hidden";
    tipEl.style.maxHeight = "none";
    const size = tipEl.getBoundingClientRect();
    const at = placeBubble({ anchor: box.getBoundingClientRect(), vw: window.innerWidth, vh: window.innerHeight, width: size.width, height: size.height });
    tipEl.style.left = `${at.left}px`;
    tipEl.style.top = `${at.top}px`;
    tipEl.style.maxHeight = `${at.maxHeight}px`;
    tipEl.style.visibility = "visible";
  }

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  /** Give a figure element its tip on hover and on focus (a keyboard reader gets it too); Escape closes it. @param {Element} node @param {string} text */
  function bindTip(node, text) {
    node.addEventListener("pointerenter", () => showTip(node, text));
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("focus", () => showTip(node, text));
    node.addEventListener("blur", hideTip);
    node.addEventListener("keydown", (e) => {
      if (/** @type {KeyboardEvent} */ (e).key === "Escape") hideTip();
    });
  }

  /** Open a lab page (the same call as a click on the sidebar's row). @param {{page: string, params: Record<string, string>}} route */
  function goTo(route) {
    hideTip();
    ctx.router.navigate(route.page, route.params);
  }

  // ── KaTeX ────────────────────────────────────────────────────────────────────────────────────

  function ensureKatex() {
    return Promise.all([loadVendorCss("katex", "katex.min.css"), loadVendorScript("katex", "katex.min.js")]);
  }

  /**
   * A block that shows `tex` as display math (the raw LaTeX until KaTeX has loaded, and when it cannot).
   * @param {string} tex
   * @returns {HTMLElement}
   */
  function texBox(tex) {
    const box = el("div", "hybrid-tex");
    box.textContent = tex;
    box.dataset.tex = tex;
    ensureKatex()
      .then(() => {
        const katex = /** @type {any} */ (window).katex;
        if (!root || !box.isConnected || !katex) return;
        katex.render(tex, box, { displayMode: true, throwOnError: false, strict: "ignore" });
      })
      .catch(() => {
        /* the raw LaTeX stays - readable, never blank */
      });
    return box;
  }

  /** A formula with its caption (`figure > div.hybrid-tex + figcaption`). @param {string} tex @param {string} caption @param {string} id */
  function formula(tex, caption, id) {
    const fig = el("figure", "hybrid-formula");
    fig.dataset.formula = id;
    fig.append(texBox(tex), el("figcaption", "", caption));
    return fig;
  }

  // ── the status pill ──────────────────────────────────────────────────────────────────────────

  /** The pill that says where the lab stands (HTML). @param {"open" | "future" | "project"} status WP-232b: + project */
  function pill(status) { // WP-231: `week` and `later` are gone, `future` joined; a row with no status gets no pill at all (labCell)
    const span = el("span", `hybrid-pill ${status}`, t(`hybrid.status.${status}`));
    span.dataset.status = status;
    return span;
  }

  // ── § taxonomy: the tree ─────────────────────────────────────────────────────────────────────

  /** Where a row's lab page is, once it exists: the type's own route while its status is `open`, nothing while it is planned or left for later. @param {{status: string, route: {page: string, params: Record<string, string>, nav: string} | null}} row */
  function routeIfOpen(row) {
    return row.status === "open" && row.route && editionHas(ctx.publication, row.route.page) ? row.route : null; // WP-237a: and only while the edition holds that page (the lab holds every one)
  }

  /**
   * WP-237a: the status a row shows. An `open` row announces its lab page with a pill ("lab page"); in the students' edition, which carries no lab page, the pill goes with the link: no pill at all.
   * Every other status (future work, the term project) is about the course, not about a page, and stays.
   * @param {{status: string | null, route: {page: string} | null}} row
   * @returns {string | null}
   */
  function statusOf(row) {
    return row.status === "open" && row.route && !editionHas(ctx.publication, row.route.page) ? null : row.status;
  }

  /** The figure: the textbook's taxonomy, redrawn - every box with its tip, every leaf with a pill saying where the lab stands, an open leaf a link to its page. */
  function taxonomyFigure() {
    const layout = taxonomyLayout();
    const measureName = measureIn(NAME_FONT_PX, 600);
    const measurePill = measureIn(PILL_FONT_PX, 600);
    const figure = el("figure", "hybrid-figure");
    const svg = svgEl("svg", { class: "flowchart hybrid-flow hybrid-tax", viewBox: `0 0 ${layout.width} ${layout.height}`, role: "group", "aria-label": t("hybrid.taxonomy.figure_label") });
    for (const edge of layout.edges) svg.append(svgEl("path", { class: "flow-edge hybrid-edge", d: edge.d, "data-from": edge.from, "data-to": edge.to }));
    // the dotted line: feature augmentation, an ensemble that is sometimes monolithic in practice (the textbook draws it dotted)
    const dotted = svgEl("g", { class: "hybrid-dotted", tabindex: 0, role: "group", "aria-label": t("hybrid.taxonomy.dotted.tip") });
    dotted.append(svgEl("path", { class: "hybrid-dotted-line", d: layout.dotted.d }));
    const tipY = layout.dotted.yEnd;
    dotted.append(svgEl("polygon", { class: "flow-arrowhead", points: `${layout.dotted.x},${tipY - 1} ${layout.dotted.x - 6},${tipY - 11} ${layout.dotted.x + 6},${tipY - 11}` }));
    dotted.append(svgEl("path", { class: "hybrid-hit", d: layout.dotted.d }));
    bindTip(dotted, t("hybrid.taxonomy.dotted.tip"));
    svg.append(dotted);
    for (const node of layout.nodes) {
      const name = t(`hybrid.taxonomy.node.${node.id}.name`);
      const tip = t(`hybrid.taxonomy.node.${node.id}.tip`);
      const type = node.leaf ? TYPES.find((x) => x.id === node.id) : undefined;
      const status = type ? statusOf(type) : null; // WP-237a: no pill for a lab page the edition does not carry
      const route = type ? routeIfOpen(type) : null;
      const g = svgEl("g", { class: `flow-node hybrid-node ${node.leaf ? "leaf" : "branch"}${status ? ` ${status}` : ""}`, tabindex: 0, role: route ? "link" : "group" });
      g.dataset.node = node.id;
      if (status) g.dataset.status = status;
      const tipText = route ? `${tip} ${t("hybrid.taxonomy.open_hint")}` : tip;
      g.setAttribute("aria-label", `${name}${status ? ` (${t(`hybrid.status.${status}`)})` : ""}. ${tip}`);
      g.append(svgEl("rect", { class: "flow-node-box", x: node.x, y: node.y, width: node.w, height: node.h, rx: 8 }));
      const lines = wrapWords(name, node.w - 16, measureName);
      const block = (lines.length - 1) * NAME_LINE_PX;
      const first = node.leaf ? node.y + 24 : node.y + node.h / 2 - block / 2;
      lines.forEach((line, k) => {
        const text = svgEl("text", { class: "flow-label hybrid-name", x: node.cx, y: first + k * NAME_LINE_PX, "text-anchor": "middle", "dominant-baseline": "central" });
        text.textContent = line;
        g.append(text);
      });
      if (node.leaf && status) {
        const word = t(`hybrid.status.${status}`);
        const pillW = Math.max(54, Math.ceil(measurePill(word)) + 22);
        const py = node.y + node.h - PILL_H - 10;
        g.append(svgEl("rect", { class: `hybrid-pill-box ${status}`, x: node.cx - pillW / 2, y: py, width: pillW, height: PILL_H, rx: PILL_H / 2 }));
        const label = svgEl("text", { class: `hybrid-pill-label ${status}`, x: node.cx, y: py + PILL_H / 2, "text-anchor": "middle", "dominant-baseline": "central" });
        label.textContent = word;
        g.append(label);
      }
      bindTip(g, tipText);
      if (route) {
        g.addEventListener("click", () => goTo(route));
        g.addEventListener("keydown", (e) => {
          const key = /** @type {KeyboardEvent} */ (e).key;
          if (key === "Enter" || key === " ") {
            e.preventDefault();
            goTo(route);
          }
        });
      }
      svg.append(g);
    }
    figure.append(svg);
    return figure;
  }

  // ── § designs: parallel and sequential ───────────────────────────────────────────────────────

  /** An arrow head at (x, y) pointing right ("r"), down ("d") or up ("u"). @param {number} x @param {number} y @param {"r" | "d" | "u"} dir */
  function arrowHead(x, y, dir) {
    const points = dir === "r" ? `${x},${y} ${x - 10},${y - 5.5} ${x - 10},${y + 5.5}` : dir === "d" ? `${x},${y} ${x - 5.5},${y - 10} ${x + 5.5},${y - 10}` : `${x},${y} ${x - 5.5},${y + 10} ${x + 5.5},${y + 10}`;
    return svgEl("polygon", { class: "flow-arrowhead", points });
  }

  /** A solid or dashed connector (no head). @param {string} d @param {boolean} [dashed] */
  function line(d, dashed = false) {
    return svgEl("path", { class: `flow-edge hybrid-edge${dashed ? " dashed" : ""}`, d });
  }

  /** The figure: (a) the parallel design - the recommenders side by side, their predictions meeting at the combiner - and (b) the sequential one - the output of one feeding the next. */
  function designsFigure() {
    const measure = measureIn(NAME_FONT_PX, 600);
    const figure = el("figure", "hybrid-figure");
    const svg = svgEl("svg", { class: "flowchart hybrid-flow hybrid-designs", viewBox: `0 0 ${DES_W} ${DES_H}`, role: "group", "aria-label": t("hybrid.designs.figure_label") });
    /** @param {string} cls @param {number} x @param {number} y @param {string} text @param {string} [anchor] */
    const label = (cls, x, y, text, anchor = "start") => {
      const node = svgEl("text", { class: cls, x, y, "text-anchor": anchor, "dominant-baseline": "central" });
      node.textContent = text;
      return node;
    };
    /** A labelled box with a tip. @param {{x: number, y: number, w: number, h: number, name: string, tip: string, kind: string}} b */
    const box = (b) => {
      const g = svgEl("g", { class: `flow-node hybrid-node box ${b.kind}`, tabindex: 0, role: "group", "aria-label": `${b.name}. ${b.tip}` });
      g.append(svgEl("rect", { class: "flow-node-box", x: b.x, y: b.y, width: b.w, height: b.h, rx: 8 }));
      const lines = wrapWords(b.name, b.w - 12, measure);
      lines.forEach((l, k) => g.append(label("flow-label hybrid-name", b.x + b.w / 2, b.y + b.h / 2 + (k - (lines.length - 1) / 2) * NAME_LINE_PX, l, "middle")));
      bindTip(g, b.tip);
      return g;
    };
    /** A dashed rail with a wide invisible hit path, so a hover on the thin line finds its tip. @param {string[]} paths @param {string} tip @param {string} id */
    const rail = (paths, tip, id) => {
      const g = svgEl("g", { class: "hybrid-rail", tabindex: 0, role: "group", "aria-label": tip });
      g.dataset.rail = id;
      for (const d of paths) g.append(line(d, true));
      for (const d of paths) g.append(svgEl("path", { class: "hybrid-hit", d }));
      bindTip(g, tip);
      return g;
    };
    const input = t("hybrid.designs.fig.input");
    const output = t("hybrid.designs.fig.output");
    const combine = t("hybrid.designs.fig.combine");
    const rec = (/** @type {string} */ n) => t("hybrid.designs.fig.rec", { n });

    // (a) parallel: one input, q recommenders side by side, their predictions P1 ... Pq meet at the combiner
    svg.append(label("hybrid-fig-title", 12, 14, t("hybrid.designs.fig.parallel")));
    const recA = [
      { n: "1", y: 34 },
      { n: "2", y: 82 },
      { n: "q", y: 150 },
    ];
    const midA = 112;
    for (const r of recA) {
      const c = r.y + 18;
      svg.append(line(`M 108 ${midA} H 149 V ${c} H 190`), arrowHead(190, c, "r"));
      svg.append(line(`M 360 ${c} H 440 V ${midA} H 520`));
      svg.append(label("hybrid-pred", 400, c - 9, `P${r.n}`, "middle"));
    }
    svg.append(arrowHead(520, midA, "r"));
    svg.append(label("hybrid-dots", 275, 134, "⋮", "middle"));
    for (const r of recA) svg.append(box({ x: 190, y: r.y, w: 170, h: 36, name: rec(r.n), tip: t("hybrid.designs.tip.rec_parallel"), kind: "rec" }));
    svg.append(box({ x: 12, y: midA - 22, w: 96, h: 44, name: input, tip: t("hybrid.designs.tip.input"), kind: "io" }));
    svg.append(box({ x: 520, y: midA - 22, w: 150, h: 44, name: combine, tip: t("hybrid.designs.tip.combine_parallel"), kind: "combine" }));
    svg.append(line(`M 670 ${midA} H 760`), arrowHead(760, midA, "r"));
    svg.append(box({ x: 760, y: midA - 22, w: 96, h: 44, name: output, tip: t("hybrid.designs.tip.output"), kind: "io" }));

    // (b) sequential: the output of one recommender is the input of the next; dashed rails carry the original input forward and every output to the combiner
    const top = 208;
    svg.append(label("hybrid-fig-title", 12, top + 14, t("hybrid.designs.fig.sequential")));
    const row = 300;
    const rh = 44;
    const y0 = row - rh / 2;
    const chain = [
      { name: input, x: 12, w: 96, kind: "io", tip: "input" },
      { name: rec("1"), x: 160, w: 130, kind: "rec", tip: "rec_sequential" },
      { name: rec("2"), x: 330, w: 130, kind: "rec", tip: "rec_sequential" },
      { name: rec("q"), x: 520, w: 130, kind: "rec", tip: "rec_sequential" },
      { name: combine, x: 700, w: 130, kind: "combine", tip: "combine_sequential" },
      { name: output, x: 864, w: 84, kind: "io", tip: "output" },
    ];
    chain.forEach((b, i) => {
      if (i === chain.length - 1) return;
      const next = chain[i + 1];
      // between the second and the q-th recommender the chain is elided: two short pieces with the dots between them
      if (i === 2) {
        svg.append(line(`M ${b.x + b.w} ${row} H ${b.x + b.w + 18}`), line(`M ${next.x - 18} ${row} H ${next.x}`), arrowHead(next.x, row, "r"));
        svg.append(label("hybrid-dots", (b.x + b.w + next.x) / 2, row - 3, "…", "middle"));
      } else {
        svg.append(line(`M ${b.x + b.w} ${row} H ${next.x}`), arrowHead(next.x, row, "r"));
      }
    });
    svg.append(rail([`M 60 ${y0} V ${y0 - 26} H 585 V ${y0}`, `M 395 ${y0 - 26} V ${y0}`], t("hybrid.designs.tip.rail_input"), "input"));
    svg.append(arrowHead(395, y0, "d"), arrowHead(585, y0, "d"));
    svg.append(rail([`M 225 ${y0 + rh} V ${y0 + rh + 28} H 765 V ${y0 + rh}`, `M 395 ${y0 + rh} V ${y0 + rh + 28}`], t("hybrid.designs.tip.rail_pred"), "pred"));
    svg.append(arrowHead(765, y0 + rh, "u"));
    for (const b of chain) svg.append(box({ x: b.x, y: y0, w: b.w, h: rh, name: b.name, tip: t(`hybrid.designs.tip.${b.tip}`), kind: b.kind }));
    figure.append(svg);
    return figure;
  }

  // ── § types: the seven rows ──────────────────────────────────────────────────────────────────

  /**
   * The cell that says where the lab stands for a type or a family: the pill, a link to the page when it exists (its text is the sidebar's own label of the page), then the sentence.
   * @param {"open" | "future" | "project" | null} status WP-231: null = no pill; WP-232b: + project
   * @param {{page: string, params: Record<string, string>, nav: string} | null} route the page, drawn as a link only when it is given (the caller passes it for an `open` row)
   * @param {string} text
   */
  function labCell(status, route, text) {
    const td = el("td", "hybrid-lab-cell");
    if (status) {
      td.dataset.status = status; // WP-231
      td.append(pill(status), " ");
    }
    if (route) {
      const a = /** @type {HTMLAnchorElement} */ (el("a", "hybrid-link", t(route.nav)));
      a.href = hashOf(route);
      a.addEventListener("click", (e) => {
        e.preventDefault();
        goTo(route);
      });
      td.append(a, " ");
    }
    return appendEmphasis(td, text);
  }

  /** The table of the seven types: what it combines, how it is wired, where the lab stands. The name of a row is the taxonomy node's own name. */
  function typesTable() {
    const scroller = el("div", "table-wrap");
    const table = el("table", "data-table hybrid-table hybrid-types");
    const head = el("tr");
    for (const key of ["hybrid.types.col_type", ...TYPE_PARTS.map((part) => `hybrid.types.col_${part}`)]) head.appendChild(el("th", "", t(key)));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const type of TYPES) {
      const tr = el("tr");
      tr.dataset.row = type.id;
      const name = /** @type {HTMLTableCellElement} */ (el("th", "hybrid-crit", t(`hybrid.taxonomy.node.${type.id}.name`)));
      name.scope = "row";
      tr.appendChild(name);
      tr.appendChild(rich("td", "hybrid-combines", t(`hybrid.types.row.${type.id}.combines`)));
      tr.appendChild(el("td", `hybrid-design ${type.design}`, t(`hybrid.types.design.${type.design}`)));
      tr.appendChild(labCell(/** @type {"open" | "future" | "project" | null} */ (statusOf(type)), routeIfOpen(type), t(`hybrid.types.row.${type.id}.lab`))); // WP-231; WP-232b: + project; WP-237a: statusOf
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    return scroller;
  }

  /**
   * WP-232: a text in the line format of util/rich-text.js (one line is one block: a paragraph, or a run of "- " bullets; `**x**` is the page's key-word emphasis), drawn as page content.
   * @param {string} text
   */
  function richBlocks(text) {
    const box = el("div", "hybrid-detail-text");
    /** @param {HTMLElement} into @param {{text: string, strong: boolean}[]} parts */
    const fill = (into, parts) => {
      for (const part of parts) into.append(part.strong ? el("strong", "key", part.text) : document.createTextNode(part.text));
    };
    for (const block of parseRichText(text)) {
      if (block.type === "p" || block.type === "h") {
        const p = el("p", "hybrid-text");
        fill(p, block.parts);
        box.appendChild(p);
      } else {
        const list = el(block.type);
        for (const item of block.items) {
          const li = el("li");
          fill(li, item);
          list.appendChild(li);
        }
        box.appendChild(list);
      }
    }
    return box;
  }

  /**
   * WP-232: under the table, one card per type in the table's order. A type with a lab page gets four short paragraphs (what it combines, how it decides, what is on its page, pitfalls and examples)
   * and a link to the page; the others get a few bullets (what it is, an example, why it is not a lab page). WP-232b: the cards are OPEN and sit two to a row (css/hybrid.css) - a closed accordion
   * read as nothing to open (user, 2026-10-24) - and the title is the type's name alone: the table above already says where the lab stands.
   */
  function typeDetails() {
    const wrap = el("div", "hybrid-type-details");
    for (const type of TYPES) {
      const panel = createPanel(`hybrid-type-${type.id}`, "hybrid-type-detail", t(`hybrid.taxonomy.node.${type.id}.name`)); // WP-232b: a plain panel - not collapsible, no status word
      panel.box.dataset.type = type.id;
      panel.body.appendChild(richBlocks(t(`hybrid.types.detail.${type.id}`)));
      const route = routeIfOpen(type);
      if (route) {
        const a = /** @type {HTMLAnchorElement} */ (el("a", "hybrid-link", t(route.nav)));
        a.href = hashOf(route);
        a.addEventListener("click", (e) => {
          e.preventDefault();
          goTo(route);
        });
        const p = el("p", "hybrid-text hybrid-detail-link");
        p.append(`${t("hybrid.types.detail_open")} `, a);
        panel.body.appendChild(p);
      }
      wrap.appendChild(panel.box);
    }
    return wrap;
  }

  // ── § ensembles: the dartboard ───────────────────────────────────────────────────────────────

  /** The figure: four targets - bias is how far the centre of the hits lies from the bullseye, variance how widely they spread; every cell with its tip. */
  function dartFigure() {
    const width = DART.left + 2 * DART.cellW + 12;
    const height = DART.top + 2 * DART.cellH + 8;
    const figure = el("figure", "hybrid-figure");
    const svg = svgEl("svg", { class: "flowchart hybrid-flow hybrid-dart", viewBox: `0 0 ${width} ${height}`, role: "group", "aria-label": t("hybrid.ensembles.figure_label") });
    /** @param {string} cls @param {number} x @param {number} y @param {string} text @param {string} anchor */
    const label = (cls, x, y, text, anchor) => {
      const node = svgEl("text", { class: cls, x, y, "text-anchor": anchor, "dominant-baseline": "central" });
      node.textContent = text;
      return node;
    };
    svg.append(label("hybrid-axis", DART.left + DART.cellW / 2, 16, t("hybrid.ensembles.axis.low_variance"), "middle"));
    svg.append(label("hybrid-axis", DART.left + DART.cellW * 1.5, 16, t("hybrid.ensembles.axis.high_variance"), "middle"));
    svg.append(label("hybrid-axis", 10, DART.top + DART.cellH / 2, t("hybrid.ensembles.axis.low_bias"), "start"));
    svg.append(label("hybrid-axis", 10, DART.top + DART.cellH * 1.5, t("hybrid.ensembles.axis.high_bias"), "start"));
    for (const cell of dartCells()) {
      const col = cell.variance === "high" ? 1 : 0;
      const row = cell.bias === "high" ? 1 : 0;
      const x = DART.left + col * DART.cellW;
      const y = DART.top + row * DART.cellH;
      const cx = x + DART.cellW / 2;
      const cy = y + DART.cellH / 2;
      const tip = t(`hybrid.ensembles.cell.${cell.id}`);
      const g = svgEl("g", { class: `flow-node hybrid-node dart ${cell.id}`, tabindex: 0, role: "group", "aria-label": tip });
      g.dataset.cell = cell.id;
      g.append(svgEl("rect", { class: "flow-node-box", x: x + 4, y: y + 4, width: DART.cellW - 8, height: DART.cellH - 8, rx: 8 }));
      for (const f of [1, 2 / 3, 1 / 3]) g.append(svgEl("circle", { class: "hybrid-ring", cx, cy, r: DART.radius * f }));
      g.append(svgEl("circle", { class: "hybrid-bull", cx, cy, r: 4 }));
      for (const [hx, hy] of cell.hits) g.append(svgEl("circle", { class: "hybrid-dart-hit", cx: cx + hx * DART.radius, cy: cy + hy * DART.radius, r: DART.hit }));
      bindTip(g, tip);
      svg.append(g);
    }
    figure.append(svg);
    return figure;
  }

  // ── § families ───────────────────────────────────────────────────────────────────────────────

  /** The table of the ensemble families: how each works, what it lowers (variance, bias or neither), where the lab stands. */
  function familiesTable() {
    const scroller = el("div", "table-wrap");
    const table = el("table", "data-table hybrid-table hybrid-families");
    const head = el("tr");
    for (const key of ["hybrid.families.col_family", "hybrid.families.col_how", "hybrid.families.col_lowers", "hybrid.families.col_lab"]) head.appendChild(el("th", "", t(key)));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const row of FAMILY_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row.id;
      const name = /** @type {HTMLTableCellElement} */ (el("th", "hybrid-crit", t(`hybrid.families.row.${row.id}.name`)));
      name.scope = "row";
      tr.appendChild(name);
      tr.appendChild(rich("td", "hybrid-how", t(`hybrid.families.row.${row.id}.how`)));
      tr.appendChild(rich("td", "hybrid-lowers", t(`hybrid.families.row.${row.id}.lowers`)));
      const lab = row.status === "open" ? (row.id === "stacking" ? STACKING_ROUTE : row.id === "bucket" ? BUCKET_ROUTE : null) : null; // WP-237a: the row's page, and whether the edition holds it
      const labOpen = lab !== null && editionHas(ctx.publication, lab.page);
      tr.appendChild(labCell(/** @type {"open" | "future" | "project" | null} */ (row.status === "open" && lab !== null && !labOpen ? null : row.status), labOpen ? lab : null, t(`hybrid.families.row.${row.id}.lab`))); // WP-231: bucket -> the switching walk; WP-232b: + project in the status type
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    return scroller;
  }

  // ── § weighted ───────────────────────────────────────────────────────────────────────────────

  function weightedBody() {
    const box = el("div", "hybrid-weighted");
    box.appendChild(rich("p", "hybrid-text", t("hybrid.weighted.intro")));
    box.append(
      formula(String.raw`\hat r_{ui} \;=\; \sum_{b=1}^{q} \alpha_b \,\hat r^{(b)}_{ui}, \qquad \alpha_b^{(0)} = \tfrac{1}{q}`, t("hybrid.weighted.blend_caption"), "blend"),
      formula(String.raw`L(\alpha) \;=\; \frac{1}{|H|}\sum_{(u,i)\in H}\Bigl(r_{ui} - \sum_{b=1}^{q}\alpha_b \hat r^{(b)}_{ui}\Bigr)^{2} \;+\; \lambda \,\lVert \alpha \rVert^{2}`, t("hybrid.weighted.loss_caption"), "loss"),
      formula(String.raw`\alpha^{*} \;=\; \bigl(P^{\top}P + \lambda\,|H|\,I\bigr)^{-1} P^{\top} r`, t("hybrid.weighted.closed_caption"), "closed")
    );
    const list = el("ul", "hybrid-list");
    for (const id of ["b1", "b2", "b3", "b4", "b5"]) list.appendChild(rich("li", "", t(`hybrid.weighted.${id}`)));
    box.appendChild(list);
    box.appendChild(rich("p", "hybrid-text", t("hybrid.weighted.kinds")));
    box.appendChild(rich("p", "hybrid-text hybrid-lab", t("hybrid.weighted.lab")));
    const links = el("ul", "hybrid-links");
    for (const link of LINKS.filter((l) => editionHas(ctx.publication, l.page))) { // WP-237a: the edition carries no walk to open
      const li = el("li");
      const a = /** @type {HTMLAnchorElement} */ (el("a", "hybrid-link", t(`hybrid.weighted.links.${link.key}.label`)));
      a.href = hashOf(link);
      a.addEventListener("click", (e) => {
        e.preventDefault();
        goTo(link);
      });
      li.append(a, el("span", "hybrid-link-text", t(`hybrid.weighted.links.${link.key}.text`)));
      links.appendChild(li);
    }
    if (links.children.length) box.appendChild(links); // WP-237a: no empty list
    return box;
  }

  // ── page ─────────────────────────────────────────────────────────────────────────────────────

  /** @param {{box: HTMLElement}} panel @param {string} text */
  function addSectionTip(panel, text) {
    const head = panel.box.querySelector(".panel-head");
    const h3 = head?.querySelector("h3");
    if (head && h3) h3.after(richInfoTip(text, t("hybrid.tip.label")));
  }

  /** The source line under a section's content. @param {string} id */
  const source = (id) => el("p", "hybrid-src", `${t("hybrid.src_head")}: ${t(`hybrid.${id}.src`)}`);

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    root.innerHTML = "";
    const page = el("div", "hybrid-page");

    const titleRow = el("div", "hybrid-title-row");
    titleRow.appendChild(el("h2", "", t("hybrid.title")));
    // the page's text size, - / + at the right of the title row (the group of the other overviews); the factor is the CSS variable `--hybrid-zoom` on the page
    createZoomControl(titleRow, { i18n: ctx.i18n, panel: "text", page: STORAGE_PAGE, target: page, cssVar: "--hybrid-zoom", storage: browserStorage() });

    /** @type {Record<string, {box: HTMLElement, body: HTMLElement}>} */
    const panels = {};
    for (const id of SECTION_IDS) panels[id] = createPanel(`hybrid-${id}`, "hybrid-section", t(`hybrid.${id}.title`), true);
    for (const id of /** @type {const} */ (["taxonomy", "designs", "types", "ensembles", "weighted", "families"])) addSectionTip(panels[id], sectionTipText(id));

    // contents chips: a click opens the section if it is folded and scrolls to it
    const toc = el("nav", "hybrid-toc");
    for (const id of SECTION_IDS) {
      const chip = /** @type {HTMLButtonElement} */ (el("button", "chip", t(`hybrid.toc.${id}`)));
      chip.type = "button";
      chip.addEventListener("click", () => {
        panels[id].box.classList.remove("collapsed");
        panels[id].box.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      toc.appendChild(chip);
    }

    tipEl = el("div", "hybrid-tip");
    tipEl.hidden = true;
    tipEl.setAttribute("role", "tooltip");

    panels.taxonomy.body.append(rich("p", "hybrid-text", t("hybrid.taxonomy.intro")), taxonomyFigure(), rich("p", "hybrid-text hybrid-lab", t("hybrid.taxonomy.lab")), source("taxonomy"));
    panels.designs.body.append(rich("p", "hybrid-text", t("hybrid.designs.intro")), designsFigure(), rich("p", "hybrid-text hybrid-lab", t("hybrid.designs.lab")), source("designs"));
    panels.types.body.append(rich("p", "hybrid-text", t("hybrid.types.intro")), typesTable(), typeDetails(), source("types")); // WP-232: the seven blocks under the table
    panels.ensembles.body.append(
      rich("p", "hybrid-text", t("hybrid.ensembles.intro")),
      dartFigure(),
      formula(String.raw`\text{Error} \;=\; \text{Bias}^{2} + \text{Variance} + \text{Noise}`, t("hybrid.ensembles.equation_caption"), "error"),
      callout(t("hybrid.ensembles.callout")),
      rich("p", "hybrid-text", t("hybrid.ensembles.cf")),
      rich("p", "hybrid-text", t("hybrid.ensembles.netflix")),
      source("ensembles")
    );
    panels.weighted.body.append(weightedBody(), source("weighted"));
    panels.families.body.append(rich("p", "hybrid-text", t("hybrid.families.intro")), familiesTable(), source("families"));
    const refs = el("ul", "hybrid-ref-list");
    for (let n = 1; n <= REFERENCES; n++) refs.appendChild(el("li", "", t(`hybrid.refs.r${n}`)));
    panels.references.body.appendChild(refs);

    page.append(titleRow, toc, ...SECTION_IDS.map((id) => panels[id].box), tipEl);
    root.appendChild(page);
    // a bubble over a box that has moved would be in the wrong place (the page scrolls inside `.main-content`, an ancestor: the window hears every scroll in the capture phase)
    window.addEventListener("scroll", hideTip, true);
  }

  /** The page is static: a route or dataset change needs no re-render (a language change re-mounts the page). */
  function update() {}

  function unmount() {
    window.removeEventListener("scroll", hideTip, true);
    hideTip();
    tipEl = null;
    root = null;
    ctx = null;
  }

  return { mount, update, unmount, usesDataset: false };
}
