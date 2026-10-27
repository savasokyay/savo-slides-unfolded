// @ts-check
// WP-116 (beta): Memory-based CF overview - user-based vs item-based, the similarity measures with their formulas, the prediction
// rules, and a "when to use which" table. A static page: its text is `memory_cf.*` in config/i18n/*.yaml, its formulas are the
// `symbolic` layer of config/formulas.yaml (KaTeX, the same loader as the Formula panel), its measure list is the catalogue of
// /api/config/similarities. Nothing on it depends on the selected data set (`usesDataset: false`: the header's selector is hidden).
// The comparison table (§ 1) has cells that say `memory_cf.tbd` until a sourced statement replaces them; the page counts them.
// WP-116 round 2: the measures (§ 2) are a TABLE, one row per catalogue measure; the three tables (§ 1, § 2, § 4) have draggable column
// edges (components/col-resizer.js, widths kept in localStorage as `i2rs.cols.memory_cf.<table>`); a text may mark key words with
// `**…**` (util/emphasis.js), drawn as `<strong class="key">`.
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { makeColumnsResizable } from "../components/col-resizer.js"; // WP-116 round 2
import { createZoomControl } from "../components/zoom-control.js"; // WP-116: the uCF / iCF panels' - / + group, here for the whole page text
import { loadVendorCss, loadVendorScript } from "../vendor-loader.js";
import { sharesKey } from "../util/col-widths.js";
import { appendEmphasis } from "../util/emphasis.js";
import { countTbd, groupMeasures, measureFormulas } from "../util/memory-measures.js";
import { createPanel } from "../util/panel.js";
import { showsBetaNote } from "../util/publication.js"; // WP-237b: the students' edition carries no beta pill and note
import { browserStorage } from "../util/safe-storage.js";

/** Rows of the § 1 comparison table, in display order (labels and cells: `memory_cf.cmp.row.<id>.*`). */
const CMP_ROWS = [
  "unit",
  "support",
  "scale",
  "stability",
  "cold_start",
  "explanation",
  "serendipity",
  "measure",
  "accuracy",
  "rule",
];
/** Rows of § 1 that say one thing for both columns (one cell spanning them: `memory_cf.cmp.row.<id>.both`). */
const CMP_SPAN_ROWS = ["accuracy"];
/** Rows of the § 4 table: the six measures most often compared (cells: `memory_cf.when.<id>.*`). */
const WHEN_ROWS = ["pearson", "cosine", "adjusted_cosine", "jaccard", "euclidean_inv", "manhattan_inv"];
/** The prediction templates of § 3 (config/formulas.yaml). */
const PREDICT_RULES = ["predict_user_deviation", "predict_item_weighted_average", "predict_item_mean_baseline"];
const WHEN_COLS = ["idea", "bias", "data", "pro", "con"];
const MAX_BULLETS = 4; // `pro_1..pro_N` / `con_1..con_N` of a measure row: the first gap ends the list
/**
 * Default column shares of the three tables, in percent of the table (the reader's drag overrides them, kept per table). § 1: criterion,
 * user-based, item-based, source. § 2: measure, formula, what it measures, pros, cons. § 4: measure, idea, bias, data, pros, cons.
 */
const COLUMN_SHARES = {
  cmp: [14, 31, 31, 24],
  measures: [9, 34, 18, 19, 20],
  when: [11, 22, 14, 15, 16, 22],
};
const STORAGE_PAGE = "memory_cf";

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

export function createMemoryPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** round 3: keeps the tables' sticky heads under their section heading; set up by `mount`, a no-op before the sections exist */
  let syncSticky = () => {};
  /** @type {ResizeObserver | null} */
  let headObserver = null;
  /** @type {(() => void) | null} */
  let onWindowResize = null;

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
    const box = el("div", "memory-tex");
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

  // ── small builders ───────────────────────────────────────────────────────────────────────────

  /** @param {string} key */
  const t = (key) => ctx.i18n.t(key);

  /** An i18n key that has no entry comes back as itself: this tells whether a text exists. @param {string} key */
  const has = (key) => ctx.i18n.t(key) !== key;

  /**
   * A table's columns made resizable (draggable edges between the heading cells, widths kept per table).
   * @param {HTMLTableElement} table
   * @param {"cmp" | "measures" | "when"} name
   */
  function resizable(table, name) {
    makeColumnsResizable(table, {
      key: sharesKey(STORAGE_PAGE, name),
      defaults: COLUMN_SHARES[name],
      storage: browserStorage(),
      label: t("memory_cf.col_resize"),
      hint: t("memory_cf.col_resize_hint"),
    });
  }

  /**
   * One card (the prediction rules of § 3): a title row (name + pills), the formulas, then the text.
   * @param {{title: string, pills?: HTMLElement[], text: HTMLElement[], formulas?: {caption?: string, tex: string, note?: string}[], id?: string}} spec
   */
  function card(spec) {
    const box = el("article", "memory-card");
    if (spec.id) box.dataset.card = spec.id;
    const head = el("header", "memory-card-head");
    head.append(el("h4", "", spec.title), ...(spec.pills || []));
    const body = el("div", "memory-card-body");
    const text = el("div", "memory-card-text");
    text.append(...spec.text);
    body.appendChild(text);
    if (spec.formulas && spec.formulas.length) {
      body.appendChild(formulaColumn(spec.formulas, "memory-card-formulas"));
    }
    box.append(head, body);
    return box;
  }

  /**
   * The formulas of one card or one table cell, each with its caption.
   * @param {{caption?: string, tex: string, note?: string}[]} formulas
   * @param {string} className
   */
  function formulaColumn(formulas, className) {
    const col = el("div", className);
    for (const f of formulas) {
      const fig = el("figure", "memory-formula");
      if (f.caption) fig.appendChild(el("figcaption", "", f.caption));
      fig.appendChild(texBox(f.tex));
      if (f.note) fig.appendChild(el("p", "memory-formula-note", f.note));
      col.appendChild(fig);
    }
    return col;
  }

  /**
   * The bullets of one measure (`pro_1..`, `con_1..`) as a list.
   * @param {string} name catalogue name
   * @param {"pro" | "con"} kind
   */
  function bullets(name, kind) {
    const ul = el("ul", "memory-bullets");
    for (let i = 1; i <= MAX_BULLETS; i += 1) {
      const key = `memory_cf.measure.${name}.${kind}_${i}`;
      if (!has(key)) break;
      ul.appendChild(rich("li", "", t(key)));
    }
    return ul;
  }

  // ── § 1: user-based vs item-based ────────────────────────────────────────────────────────────

  function comparisonTable() {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table memory-table memory-cmp"));
    const head = el("tr");
    for (const key of ["memory_cf.cmp.col_criterion", "memory_cf.cmp.col_ucf", "memory_cf.cmp.col_icf", "memory_cf.src_head"]) {
      head.appendChild(el("th", "", t(key)));
    }
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    const tbd = t("memory_cf.tbd");
    for (const row of CMP_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row;
      const label = el("th", "memory-crit", t(`memory_cf.cmp.row.${row}.label`));
      label.scope = "row";
      tr.appendChild(label);
      // WP-116: a spanning row (head-to-head accuracy) is one cell over both columns
      const sides = CMP_SPAN_ROWS.includes(row) ? ["both"] : ["ucf", "icf"];
      for (const side of sides) {
        const text = t(`memory_cf.cmp.row.${row}.${side}`);
        const td = rich("td", text === tbd ? "memory-tbd" : "", text);
        td.dataset.side = side;
        if (side === "both") /** @type {HTMLTableCellElement} */ (td).colSpan = 2;
        tr.appendChild(td);
      }
      tr.appendChild(el("td", "memory-src", t(`memory_cf.cmp.row.${row}.src`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    resizable(table, "cmp");
    scroller.appendChild(table);
    return scroller;
  }

  /**
   * WP-118 (1c): the course's rule for item-based CF, once, right under the comparison table - the same words as the student reading copy
   * of this page, which this page is the source of (the two must not drift apart). A quiet note like the others: the lead-in in the label
   * weight, the source line muted.
   */
  function courseRuleNote() {
    const p = el("p", "memory-note memory-rule");
    p.append(
      el("strong", "", t("memory_cf.cmp.rule_head")),
      " ",
      t("memory_cf.cmp.rule"),
      " ",
      el("span", "memory-rule-src", t("memory_cf.cmp.rule_src"))
    );
    return p;
  }

  // ── § 2: similarity measures (a table, one row per catalogue measure) ────────────────────────

  /**
   * The name cell: the measure's name and, for a foil or a fault, its badge (a core measure has none).
   * @param {{name: string, tags: string[]}} info
   */
  function nameCell(info) {
    const th = el("th", "memory-crit memory-name");
    th.scope = "row";
    th.appendChild(el("strong", "memory-measure-name", t(`similarity.${info.name}`)));
    const badges = el("div", "memory-badges");
    const tag = info.tags.includes("fault") ? "fault" : info.tags.includes("foil") ? "foil" : "core";
    if (tag !== "core") {
      const pill = el("span", `pill tag-${tag}`, t(`tag.${tag}`));
      pill.title = t(`memory_cf.tag_tip.${tag}`);
      badges.appendChild(pill);
    }
    if (badges.children.length) th.appendChild(badges);
    return th;
  }

  /**
   * The formula cell: the user-based and the item-based formula (a measure with no template - Kendall - carries its LaTeX in i18n).
   * @param {{name: string, formula_id: string}} info
   * @param {Record<string, any>} formulas
   */
  function formulaCell(info, formulas) {
    const f = measureFormulas(info, formulas);
    /** @type {{caption?: string, tex: string, note?: string}[]} */
    const tex = [];
    if (f.user) tex.push({ caption: t("memory_cf.formula_user"), tex: f.user });
    if (f.item) tex.push({ caption: t("memory_cf.formula_item"), tex: f.item });
    const ownKey = `memory_cf.measure.${info.name}.tex`;
    if (!f.user && !f.item && has(ownKey)) {
      const noteOwn = `memory_cf.measure.${info.name}.tex_note`;
      tex.push({ tex: t(ownKey), note: has(noteOwn) ? t(noteOwn) : undefined });
    }
    const td = el("td", "memory-formulas");
    td.appendChild(formulaColumn(tex, "memory-formula-cell"));
    return td;
  }

  /**
   * What it measures: the page's own text for the measure when it has one (the item-centred variant), else the catalogue's `measure_info`;
   * a measure's note (the scope of a claim, a convention) follows in a second, quieter paragraph.
   * @param {{name: string}} info
   */
  function whatCell(info) {
    const td = el("td");
    const ownKey = `memory_cf.measure.${info.name}.what`;
    td.appendChild(rich("p", "memory-what", t(has(ownKey) ? ownKey : `measure_info.${info.name}`)));
    const noteKey = `memory_cf.measure.${info.name}.note`;
    if (has(noteKey)) td.appendChild(rich("p", "memory-note", t(noteKey)));
    return td;
  }

  /**
   * @param {any[]} catalogue
   * @param {Record<string, any>} formulas
   * @returns {HTMLElement}
   */
  function measuresTable(catalogue, formulas) {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table memory-table memory-measures-table"));
    const head = el("tr");
    for (const key of [
      "memory_cf.measures_col.measure",
      "memory_cf.measures_col.formula",
      "memory_cf.measures_col.what",
      "memory_cf.pros",
      "memory_cf.cons",
    ]) {
      head.appendChild(el("th", "", t(key)));
    }
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    const groups = groupMeasures(catalogue);
    for (const info of [...groups.core, ...groups.foil, ...groups.fault]) {
      const measure = /** @type {{name: string, formula_id: string, tags: string[]}} */ (info);
      const tr = el("tr");
      tr.dataset.measure = measure.name;
      tr.append(nameCell(measure), formulaCell(measure, formulas), whatCell(measure));
      const pros = el("td");
      pros.appendChild(bullets(measure.name, "pro"));
      const cons = el("td");
      cons.appendChild(bullets(measure.name, "con"));
      tr.append(pros, cons);
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    resizable(table, "measures");
    scroller.appendChild(table);
    return scroller;
  }

  /**
   * @param {HTMLElement} body
   * @param {any[]} catalogue
   * @param {Record<string, any>} formulas
   */
  function renderMeasures(body, catalogue, formulas) {
    body.innerHTML = "";
    body.appendChild(measuresTable(catalogue, formulas));
  }

  // ── § 3: prediction rules (cards) ────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} body
   * @param {Record<string, any>} formulas
   */
  function renderPredict(body, formulas) {
    body.innerHTML = "";
    for (const id of PREDICT_RULES) {
      const tex = formulas[id]?.symbolic;
      const where = el("span", "pill memory-where", t(`memory_cf.predict.${id}.where`));
      body.appendChild(
        card({
          title: t(`memory_cf.predict.${id}.title`), // own titles: formula.predict_item_weighted_average names an author the sources list has not verified yet
          pills: [where],
          text: [rich("p", "memory-what", t(`memory_cf.predict.${id}.text`))],
          formulas: tex ? [{ tex }] : [],
          id,
        })
      );
    }
    const signed = formulas.predict_user_deviation?.variants?.signed?.symbolic;
    body.appendChild(
      card({
        title: t("memory_cf.predict.signed.label"),
        text: [rich("p", "memory-what", t("memory_cf.predict.signed.text"))],
        formulas: signed ? [{ tex: signed }] : [],
        id: "signed",
      })
    );
    body.appendChild(
      card({
        title: t("memory_cf.predict.clip.label"),
        text: [rich("p", "memory-what", t("memory_cf.predict.clip.text"))],
        formulas: formulas.clip?.symbolic ? [{ tex: formulas.clip.symbolic }] : [],
        id: "clip",
      })
    );
    body.appendChild(
      card({
        title: t("memory_cf.predict.neighbours.label"),
        text: [rich("p", "memory-what", t("memory_cf.predict.neighbours.text"))],
        id: "neighbours",
      })
    );
  }

  // ── § 4: when to use which ───────────────────────────────────────────────────────────────────

  function whenTable() {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table memory-table memory-when"));
    const head = el("tr");
    head.appendChild(el("th", "", t("memory_cf.when_col.measure")));
    for (const col of WHEN_COLS) head.appendChild(el("th", "", t(`memory_cf.when_col.${col}`)));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const name of WHEN_ROWS) {
      const tr = el("tr");
      tr.dataset.row = name;
      const label = el("th", "memory-crit", t(`similarity.${name}`));
      label.scope = "row";
      tr.appendChild(label);
      for (const col of WHEN_COLS) tr.appendChild(rich("td", "", t(`memory_cf.when.${name}.${col}`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    resizable(table, "when");
    scroller.appendChild(table);
    return scroller;
  }

  // ── page ─────────────────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    root.innerHTML = "";
    const page = el("div", "memory-page");

    // WP-116: the beta note counts the comparison cells that still say TBD; once none does, it says every cell has a source
    const nTbd = countTbd(t, CMP_ROWS, CMP_SPAN_ROWS);
    const betaText = nTbd > 0 ? ctx.i18n.t("memory_cf.beta_note", { n: nTbd }) : t("memory_cf.beta_note_sourced");
    const titleRow = el("div", "memory-title-row");
    const beta = el("span", "pill tag-flag memory-beta", t("memory_cf.beta"));
    beta.title = betaText;
    beta.dataset.tbd = String(nTbd);
    const betaShown = showsBetaNote(ctx.publication); // WP-237b: live only
    titleRow.append(el("h2", "", t("memory_cf.title")), ...(betaShown ? [beta] : []));
    // WP-116: the page's text size, - / + at the right of the title row (the uCF / iCF panels' group); the factor is the CSS variable
    // `--memory-zoom` on the page, which memory.css turns into the page's base font size, so every text, table and formula follows it
    createZoomControl(titleRow, {
      i18n: ctx.i18n,
      panel: "text",
      page: "memory_cf",
      target: page,
      cssVar: "--memory-zoom",
      storage: browserStorage(),
      onChange: () => syncSticky(), // a larger text size makes the section headings taller
    });

    const intro = rich("p", "memory-intro", t("memory_cf.intro"));
    const note = el("div", "warn-banner memory-beta-note", betaText);

    const sections = [
      ["cmp", "memory_cf.cmp_title", "memory_cf.cmp_intro"],
      ["measures", "memory_cf.measures_title", "memory_cf.measures_intro"],
      ["predict", "memory_cf.predict_title", "memory_cf.predict_intro"],
      ["when", "memory_cf.when_title", "memory_cf.when_intro"],
    ];
    /** @type {Record<string, {box: HTMLElement, body: HTMLElement}>} */
    const panels = {};
    for (const [id, titleKey, introKey] of sections) {
      const panel = createPanel(`memory-${id}`, "memory-section", t(titleKey));
      panel.body.appendChild(rich("p", "memory-section-intro", t(introKey)));
      panels[id] = panel;
    }

    // contents chips (the uCF / iCF pages are one click away in the sidebar: no door buttons here)
    const toc = el("nav", "memory-toc");
    for (const [id, labelKey] of [
      ["cmp", "memory_cf.toc_cmp"],
      ["measures", "memory_cf.toc_measures"],
      ["predict", "memory_cf.toc_predict"],
      ["when", "memory_cf.toc_when"],
    ]) {
      const chip = /** @type {HTMLButtonElement} */ (el("button", "chip", t(labelKey)));
      chip.type = "button";
      chip.addEventListener("click", () => panels[id].box.scrollIntoView({ behavior: "smooth", block: "start" }));
      toc.appendChild(chip);
    }

    // WP-116 round 3: a table's head hooks under its section heading, whose height changes with the text size, the language and the window.
    // `--mcf-head-h` on each section = that heading's real height (getBoundingClientRect, fractional: a 1 px gap would show the cells
    // scrolling between the two); kept current by a ResizeObserver on the headings, by the zoom group's onChange, by the window's resize
    // and once the fonts are in. (A hidden tab fires no ResizeObserver callback: the direct calls cover it.)
    syncSticky = () => {
      // a sticky box hooks to the scroller's content box, not its padding box: with the main area's 20 px padding it would stop 20 px below
      // the top edge and the page would scroll visibly above it. `--mcf-sticky-top` = minus that padding puts it at the very top.
      const scroller = page.closest(".main-content") ?? page.parentElement;
      const pad = scroller ? parseFloat(getComputedStyle(scroller).paddingTop) || 0 : 0;
      page.style.setProperty("--mcf-sticky-top", `${-pad}px`);
      for (const panel of Object.values(panels)) {
        const head = panel.box.querySelector(".panel-head");
        if (head) panel.box.style.setProperty("--mcf-head-h", `${head.getBoundingClientRect().height}px`);
      }
    };
    if (typeof ResizeObserver !== "undefined") {
      headObserver = new ResizeObserver(() => syncSticky());
      for (const panel of Object.values(panels)) {
        const head = panel.box.querySelector(".panel-head");
        if (head) headObserver.observe(head);
      }
    }
    onWindowResize = () => syncSticky();
    window.addEventListener("resize", onWindowResize);

    panels.cmp.body.appendChild(comparisonTable());
    panels.cmp.body.appendChild(courseRuleNote()); // WP-118 (1c)
    panels.when.body.appendChild(whenTable());
    panels.when.body.appendChild(rich("p", "memory-note", t("memory_cf.when_note_distance")));

    // the measures table and the prediction formulas need the catalogue and the templates
    const loading = el("p", "memory-loading", t("memory_cf.loading"));
    panels.measures.body.appendChild(loading);
    const measuresBody = el("div", "memory-measures");
    panels.measures.body.appendChild(measuresBody);
    const predictBody = el("div", "memory-predict memory-cards");
    panels.predict.body.appendChild(predictBody);

    // the literature's limit, once, at the bottom (org rule: an offline gain is not an online gain)
    const offline = el("p", "memory-offline", t("memory_cf.offline_note"));
    page.append(titleRow, intro, ...(betaShown ? [note] : []), toc, panels.cmp.box, panels.measures.box, panels.predict.box, panels.when.box, offline); // WP-237b: no note in the edition
    root.appendChild(page);
    syncSticky();
    document.fonts?.ready.then(() => syncSticky());

    Promise.all([ctx.api.similarities(), ctx.api.formulas()])
      .then(([catalogue, formulas]) => {
        if (!root) return; // the page was left while the answer was on its way
        loading.remove();
        renderMeasures(measuresBody, catalogue, formulas);
        renderPredict(predictBody, formulas);
      })
      .catch((err) => {
        if (!root) return;
        loading.className = "warn-banner";
        loading.textContent = ctx.i18n.t("memory_cf.failed", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }

  /** The page is static: a route or dataset change needs no re-render (a language change re-mounts the page). */
  function update() {}

  function unmount() {
    headObserver?.disconnect();
    headObserver = null;
    if (onWindowResize) window.removeEventListener("resize", onWindowResize);
    onWindowResize = null;
    syncSticky = () => {};
    root = null;
    ctx = null;
  }

  return { mount, update, unmount, usesDataset: false };
}
