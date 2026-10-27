// @ts-check
// WP-177: Content-based overview - what content-based filtering is, its three-stage pipeline (a figure, every box with a tip), content-based versus collaborative (a table), the cold-start
// grid, where the field went (with the references) and the week's links. A static page like the Memory-based and Model-based CF overviews (pages/memory-page.js, pages/model-page.js, the
// pattern it follows): its text is `cbf.*` in config/i18n/*.yaml and nothing on it depends on the selected data set (`usesDataset: false`: the header's selector is hidden). The sections
// are the app's collapsible panels; five of them carry an (i) with the instructor's guide sentence and the answers to the questions students are likely to ask (the rich bubble of
// components/rich-tip.js), and three rows of the comparison table carry the answer to their own question.
// WP-200: and a section "Memory-based or model-based?" between the pipeline and the comparison - the textbook's split read over the week's three pages (a five-column table; the row names are the navigation labels).
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { richInfoTip } from "../components/rich-tip.js";
import { createZoomControl } from "../components/zoom-control.js";
import { placeBubble } from "../util/bubble-place.js";
import { appendEmphasis } from "../util/emphasis.js";
import { createPanel } from "../util/panel.js";
import { editionHas, pageOfHash } from "../util/publication.js"; // WP-237a: a lab link is drawn only for a page the students' edition holds
import { browserStorage } from "../util/safe-storage.js";
import { wrapWords } from "../util/wrap-lines.js";

/** The sections of the page, in display order (texts: `cbf.<id>.title`, `cbf.toc.<id>`). WP-200: `families` (memory-based or model-based?) sits between the pipeline and the comparison. */
const SECTION_IDS = ["what", "pipeline", "families", "vs", "cold", "field", "links"];
/** Sections with an (i): how many question / answer pairs `cbf.tip.<id>` holds (`guide`, `q1` / `a1` ...). */
const TIP_QUESTIONS = { what: 4, pipeline: 7, families: 3, vs: 5, field: 3 };
/** WP-200: rows of the families table, in display order (`cbf.families.row.<id>.{family,kept,train,book}`); the row's name is the page's own navigation label (`nav` key), read at draw time so the name lives in one place. */
const FAMILY_ROWS = [
  { id: "knn", nav: "nav.content_item" },
  { id: "profile", nav: "nav.content_profile" },
  { id: "model", nav: "nav.content_model" },
];
/** WP-200: the cells of a families row after its name, left to right (`cbf.families.col_<part>` heads them). */
const FAMILY_PARTS = ["family", "kept", "train", "book"];
/** Rows of the comparison table, in display order (`cbf.vs.row.<id>.{label,cb,cf}`). */
const VS_ROWS = ["new_item", "new_user", "explain", "effort", "overspec", "other_data", "combo"];
/** The rows that carry the answer to their own question: row -> the number of the question in `cbf.tip.vs`. */
const VS_ROW_QUESTION = { new_user: 2, explain: 3, overspec: 4 };
/** The pipeline's stages, left to right, with the side of the system they run on (the first two offline, the third online). */
const STAGES = [
  { id: "s1", mode: "offline" },
  { id: "s2", mode: "offline" },
  { id: "s3", mode: "online" },
];
/** The cold-start grid: rows are the user (known / new), columns the item (known / new); `ok` says whether [content-based, collaborative] can start. */
const COLD_ROWS = [
  { user: "known", cells: [{ id: "known_known", ok: [true, true] }, { id: "known_new", ok: [true, false] }] },
  { user: "new", cells: [{ id: "new_known", ok: [false, false] }, { id: "new_new", ok: [false, false] }] },
];
/** The week's links: key (`cbf.links.<key>.{label,text}`) and the route. The class pair's indices are the dense ones of the class set (docs: u / i are positions, not ids). */
const LINKS = [
  { key: "toy", href: "#/content?ds=toy-5x6&u=0&i=4" },
  { key: "class", href: "#/content?ds=sRSd26&u=1&i=2068" },
  { key: "profile", href: "#/content?ds=sRSd26&u=1&i=2068&m=profile" }, // WP-177b: the same pair as a taste profile (the user-profile method)
  { key: "page", href: "#/content" },
];
const REFERENCES = 12; // WP-177f: Breese, Heckerman and Kadie (1998), named in the paragraph before the comparison table; WP-200: + Manning, Raghavan and Schütze (2008), the Rocchio method named in the families table
const STORAGE_PAGE = "cbf";

// the pipeline figure, in viewBox units (the svg scales with its box; css/cbf.css caps it)
const BOX_W = 252;
const BOX_H = 112;
const GAP = 46;
const PAD = 12;
const NAME_FONT_PX = 15;
const NAME_LINE_PX = 19;

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

/** WP-177f: the one-sentence callout of a section - the whole sentence in the page's key-word emphasis (`strong.key`, navy and bold). @param {string} text */
function callout(text) {
  const p = el("p", "cbf-text cbf-callout");
  p.appendChild(el("strong", "key", text));
  return p;
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** @param {string} tag @param {Record<string, string | number>} attrs */
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

export function createCbfPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {HTMLElement | null} */
  let tipEl = null;

  /** @param {string} key */
  const t = (key) => ctx.i18n.t(key);

  // ── the (i) bubbles ──────────────────────────────────────────────────────────────────────────

  /**
   * The text of a section's (i): the guide sentence, then every likely question in bold with its answer (the line format of util/rich-text.js).
   * @param {"what" | "pipeline" | "families" | "vs" | "field"} id
   */
  function sectionTipText(id) {
    const lines = [`## ${t("cbf.tip.head_guide")}`, t(`cbf.tip.${id}.guide`), `## ${t("cbf.tip.head_questions")}`];
    for (let n = 1; n <= TIP_QUESTIONS[id]; n++) lines.push(`- **${t(`cbf.tip.${id}.q${n}`)}** ${t(`cbf.tip.${id}.a${n}`)}`);
    return lines.join("\n");
  }

  // ── § pipeline: the three boxes ──────────────────────────────────────────────────────────────

  /** The width of a piece of text in the figure's label font (a canvas in the CSS font; an estimate where there is no canvas). @returns {(piece: string) => number} */
  function nameMeasure() {
    const family = root ? getComputedStyle(root).fontFamily : "sans-serif";
    const canvas = document.createElement("canvas").getContext("2d");
    if (!canvas) return (piece) => piece.length * NAME_FONT_PX * 0.56;
    canvas.font = `600 ${NAME_FONT_PX}px ${family}`;
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

  /** The figure: three boxes joined by arrows, each with its number, its name, a label saying offline or online, and its tip. */
  function pipelineFigure() {
    const width = PAD * 2 + 3 * BOX_W + 2 * GAP;
    const height = PAD * 2 + BOX_H;
    const measure = nameMeasure();
    const figure = el("figure", "cbf-figure");
    const svg = svgEl("svg", { class: "flowchart cbf-flow", viewBox: `0 0 ${width} ${height}`, role: "group", "aria-label": t("cbf.pipeline.figure_label") });
    STAGES.forEach((stage, i) => {
      const x = PAD + i * (BOX_W + GAP);
      const y = PAD;
      const name = t(`cbf.pipeline.${stage.id}.name`);
      const tip = t(`cbf.pipeline.${stage.id}.tip`);
      const mode = t(`cbf.pipeline.${stage.mode}`);
      const g = svgEl("g", { class: `flow-node cbf-stage ${stage.mode}`, tabindex: 0, role: "group", "aria-label": `${i + 1}. ${name} (${mode}). ${tip}` });
      g.dataset.stage = stage.id;
      g.append(svgEl("rect", { class: "flow-node-box", x, y, width: BOX_W, height: BOX_H, rx: 8 }));
      g.append(svgEl("circle", { class: "cbf-badge", cx: x + 24, cy: y + 24, r: 12 }));
      const badge = svgEl("text", { class: "cbf-badge-label", x: x + 24, y: y + 24, "text-anchor": "middle", "dominant-baseline": "central" });
      badge.textContent = String(i + 1);
      g.append(badge);
      // the name: wrapped to the box (an svg text does not wrap), centred, in the room between the top and the label
      const lines = wrapWords(name, BOX_W - 2 * 20, measure);
      const first = y + 46 - ((lines.length - 1) * NAME_LINE_PX) / 2;
      lines.forEach((line, k) => {
        const text = svgEl("text", { class: "flow-label cbf-name", x: x + BOX_W / 2, y: first + k * NAME_LINE_PX, "text-anchor": "middle" });
        text.textContent = line;
        g.append(text);
      });
      const pillW = Math.max(64, mode.length * 8 + 28);
      g.append(svgEl("rect", { class: `cbf-mode ${stage.mode}`, x: x + (BOX_W - pillW) / 2, y: y + BOX_H - 34, width: pillW, height: 22, rx: 11 }));
      const pill = svgEl("text", { class: `cbf-mode-label ${stage.mode}`, x: x + BOX_W / 2, y: y + BOX_H - 23, "text-anchor": "middle", "dominant-baseline": "central" });
      pill.textContent = mode;
      g.append(pill);
      g.addEventListener("pointerenter", () => showTip(g, tip));
      g.addEventListener("pointerleave", hideTip);
      g.addEventListener("focus", () => showTip(g, tip));
      g.addEventListener("blur", hideTip);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideTip();
      });
      svg.append(g);
      if (i < STAGES.length - 1) {
        const at = x + BOX_W;
        const mid = y + BOX_H / 2;
        svg.append(svgEl("line", { class: "flow-edge", x1: at + 4, y1: mid, x2: at + GAP - 9, y2: mid }));
        svg.append(svgEl("polygon", { class: "flow-arrowhead", points: `${at + GAP - 4},${mid} ${at + GAP - 14},${mid - 6} ${at + GAP - 14},${mid + 6}` }));
      }
    });
    figure.append(svg);
    return figure;
  }

  // ── § families: memory-based or model-based? ─────────────────────────────────────────────────

  /**
   * WP-200: the three pages of the week against the textbook's memory-based / model-based split - five columns: the page (a row head, its name read from the navigation label), its family,
   * what is kept between two predictions, training and prediction, the textbook's section. The cells are rich text (the key words of each cell in `strong.key`).
   */
  function familiesTable() {
    const scroller = el("div", "table-wrap");
    const table = el("table", "data-table cbf-table cbf-families");
    const head = el("tr");
    for (const key of ["cbf.families.col_page", ...FAMILY_PARTS.map((part) => `cbf.families.col_${part}`)]) head.appendChild(el("th", "", t(key)));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const row of FAMILY_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row.id;
      const label = /** @type {HTMLTableCellElement} */ (el("th", "cbf-crit", t(row.nav)));
      label.scope = "row";
      tr.appendChild(label);
      for (const part of FAMILY_PARTS) tr.appendChild(rich("td", `cbf-fam-${part}`, t(`cbf.families.row.${row.id}.${part}`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    return scroller;
  }

  // ── § vs: the comparison table ───────────────────────────────────────────────────────────────

  function comparisonTable() {
    const scroller = el("div", "table-wrap");
    const table = el("table", "data-table cbf-table cbf-vs");
    const head = el("tr");
    for (const key of ["cbf.vs.col_aspect", "cbf.vs.col_cb", "cbf.vs.col_cf"]) head.appendChild(el("th", "", t(key)));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const row of VS_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row;
      const label = /** @type {HTMLTableCellElement} */ (el("th", "cbf-crit", t(`cbf.vs.row.${row}.label`)));
      label.scope = "row";
      const question = Object.hasOwn(VS_ROW_QUESTION, row) ? VS_ROW_QUESTION[/** @type {keyof typeof VS_ROW_QUESTION} */ (row)] : 0;
      if (question) {
        // the answer to the question this row raises, in an (i) beside its name
        label.appendChild(richInfoTip(`## ${t(`cbf.tip.vs.q${question}`)}\n${t(`cbf.tip.vs.a${question}`)}`, t("cbf.tip.label")));
      }
      tr.appendChild(label);
      tr.appendChild(rich("td", "cbf-cb", t(`cbf.vs.row.${row}.cb`)));
      tr.appendChild(rich("td", "cbf-cf", t(`cbf.vs.row.${row}.cf`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    return scroller;
  }

  // ── § cold: the grid ─────────────────────────────────────────────────────────────────────────

  function coldGrid() {
    const scroller = el("div", "table-wrap");
    const table = el("table", "data-table cbf-table cbf-cold-grid");
    const head = el("tr");
    head.appendChild(el("th", "cbf-corner", t("cbf.cold.corner")));
    head.appendChild(el("th", "", t("cbf.cold.col_known")));
    head.appendChild(el("th", "", t("cbf.cold.col_new")));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const row of COLD_ROWS) {
      const tr = el("tr");
      tr.dataset.user = row.user;
      const label = /** @type {HTMLTableCellElement} */ (el("th", "cbf-crit", t(`cbf.cold.row_${row.user}`)));
      label.scope = "row";
      tr.appendChild(label);
      for (const cell of row.cells) {
        const td = el("td", "cbf-cold-cell");
        td.dataset.cell = cell.id;
        ["cb", "cf"].forEach((method, k) => {
          const line = rich("p", `cbf-cold-line ${method} ${cell.ok[k] ? "ok" : "bad"}`, t(`cbf.cold.cell.${cell.id}.${method}`));
          line.prepend(el("span", "cbf-method", `${t(method === "cb" ? "cbf.vs.col_cb" : "cbf.vs.col_cf")}`));
          td.appendChild(line);
        });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    return scroller;
  }

  // ── § field: three directions, what the lab builds, the references ──────────────────────────

  function fieldBody() {
    const box = el("div", "cbf-field");
    box.appendChild(el("p", "cbf-text", t("cbf.field.intro")));
    const list = el("ul", "cbf-list");
    for (const id of ["b1", "b2", "b3"]) list.appendChild(rich("li", "", t(`cbf.field.${id}`)));
    box.appendChild(list);
    box.appendChild(rich("p", "cbf-text cbf-lab", t("cbf.field.lab")));
    box.appendChild(rich("p", "cbf-text cbf-named", t("cbf.field.named")));
    const refs = /** @type {HTMLDetailsElement} */ (el("details", "cbf-refs"));
    refs.appendChild(el("summary", "", t("cbf.refs.title")));
    const ol = el("ul", "cbf-ref-list");
    for (let n = 1; n <= REFERENCES; n++) ol.appendChild(el("li", "", t(`cbf.refs.r${n}`)));
    refs.appendChild(ol);
    box.appendChild(refs);
    return box;
  }

  // ── § links ──────────────────────────────────────────────────────────────────────────────────

  function linksBody() {
    const box = el("div", "cbf-links-body");
    box.appendChild(el("p", "cbf-text", t("cbf.links.intro")));
    const list = el("ul", "cbf-links");
    for (const link of LINKS) {
      const li = el("li");
      const a = /** @type {HTMLAnchorElement} */ (el("a", "cbf-link", t(`cbf.links.${link.key}.label`)));
      a.href = link.href;
      li.append(a, el("span", "cbf-link-text", t(`cbf.links.${link.key}.text`)));
      list.appendChild(li);
    }
    box.appendChild(list);
    return box;
  }

  // ── page ─────────────────────────────────────────────────────────────────────────────────────

  /** @param {{box: HTMLElement}} panel @param {string} text */
  function addSectionTip(panel, text) {
    const head = panel.box.querySelector(".panel-head");
    const h3 = head?.querySelector("h3");
    if (head && h3) h3.after(richInfoTip(text, t("cbf.tip.label")));
  }

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    root.innerHTML = "";
    const page = el("div", "cbf-page");

    const titleRow = el("div", "cbf-title-row");
    titleRow.appendChild(el("h2", "", t("cbf.title")));
    // the page's text size, - / + at the right of the title row (the group of the Memory-based / Model-based overviews); the factor is the CSS variable `--cbf-zoom` on the page
    createZoomControl(titleRow, { i18n: ctx.i18n, panel: "text", page: STORAGE_PAGE, target: page, cssVar: "--cbf-zoom", storage: browserStorage() });

    // WP-237a: the students' edition carries no lab page, so a section of nothing but links to lab pages is not drawn (the lab shows every section)
    const sectionIds = SECTION_IDS.filter((id) => id !== "links" || LINKS.some((link) => editionHas(ctx.publication, pageOfHash(link.href))));
    /** @type {Record<string, {box: HTMLElement, body: HTMLElement}>} */
    const panels = {};
    for (const id of sectionIds) panels[id] = createPanel(`cbf-${id}`, "cbf-section", t(`cbf.${id}.title`), true); // WP-237a
    for (const id of /** @type {const} */ (["what", "pipeline", "families", "vs", "field"])) addSectionTip(panels[id], sectionTipText(id));

    // contents chips: a click opens the section if it is folded and scrolls to it
    const toc = el("nav", "cbf-toc");
    for (const id of sectionIds) { // WP-237a
      const chip = /** @type {HTMLButtonElement} */ (el("button", "chip", t(`cbf.toc.${id}`)));
      chip.type = "button";
      chip.addEventListener("click", () => {
        panels[id].box.classList.remove("collapsed");
        panels[id].box.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      toc.appendChild(chip);
    }

    panels.what.body.append(rich("p", "cbf-text", t("cbf.what.body")), el("p", "cbf-src", `${t("cbf.src_head")}: ${t("cbf.what.src")}`));

    tipEl = el("div", "cbf-tip");
    tipEl.hidden = true;
    tipEl.setAttribute("role", "tooltip");
    panels.pipeline.body.append(pipelineFigure(), rich("p", "cbf-text cbf-lab", t("cbf.pipeline.lab")), el("p", "cbf-src", `${t("cbf.src_head")}: ${t("cbf.pipeline.src")}`));

    // WP-200 (user, 2026-10-17): the memory-based / model-based split over the week's three pages - the introduction, the five-column table, the source line
    panels.families.body.append(rich("p", "cbf-text", t("cbf.families.intro")), familiesTable(), el("p", "cbf-src", `${t("cbf.src_head")}: ${t("cbf.families.src")}`));

    // WP-177f (user, 2026-10-17): a paragraph in front of the table (what the item-similarity method shares with item-based CF and where the two differ) and one highlighted sentence
    // under it, in the page's own emphasis (`strong.key`, as the key words of every paragraph) - the figure of speech the table's rows lead up to
    panels.vs.body.append(
      el("p", "cbf-text cbf-same-steps", t("cbf.vs.same_steps")),
      comparisonTable(),
      callout(t("cbf.vs.callout")),
      el("p", "cbf-src", `${t("cbf.src_head")}: ${t("cbf.vs.source")}`)
    );
    panels.cold.body.append(el("p", "cbf-text", t("cbf.cold.intro")), coldGrid(), el("p", "cbf-src", `${t("cbf.src_head")}: ${t("cbf.cold.src")}`));
    panels.field.body.appendChild(fieldBody());
    if (panels.links) panels.links.body.appendChild(linksBody()); // WP-237a

    page.append(titleRow, toc, ...sectionIds.map((id) => panels[id].box), tipEl); // WP-237a
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
