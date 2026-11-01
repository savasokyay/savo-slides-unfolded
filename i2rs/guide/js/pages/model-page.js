// @ts-check
// WP-121 (beta): Model-based CF overview - memory-based vs model-based, what a factorization is (two fixed worked examples), how the factors
// are found (the formula cards the Matrix factorization and Neural models pages trace), the factorization family, the neural "black box",
// and a "which approach when" table. A static page like the Memory-based CF overview (pages/memory-page.js, the pattern it follows): its
// text is `model_cf.*` in config/i18n/*.yaml and nothing on it depends on the selected data set (`usesDataset: false`: the header's selector
// is hidden). The comparison table (§ 1) has cells that say `model_cf.tbd` until a sourced statement replaces them; the page counts them.
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { makeColumnsResizable } from "../components/col-resizer.js"; // WP-121
import { createZoomControl } from "../components/zoom-control.js"; // WP-121: the - / + text-size group of the uCF / iCF panels, here for the whole page text
import { loadVendorCss, loadVendorScript } from "../vendor-loader.js"; // WP-121: KaTeX, the same loader as the Formula panel
import { sharesKey } from "../util/col-widths.js";
import { appendEmphasis } from "../util/emphasis.js";
import { decompose, formatValue, normalizeExamples } from "../util/model-examples.js"; // WP-121: § 2
import { cardFormulas } from "../util/model-formulas.js";
import { cmpCellKeys, countTbd } from "../util/model-tbd.js";
import { createPanel } from "../util/panel.js";
import { showsBetaNote } from "../util/publication.js"; // WP-237b: the students' edition carries no beta pill and note
import { browserStorage } from "../util/safe-storage.js";

/** The sections of the page, in display order (texts: `model_cf.<id>_title`, `model_cf.<id>_intro`, `model_cf.toc_<id>`). */
const SECTION_IDS = ["cmp", "decomp", "train", "family", "blackbox", "when"];
/** Rows of the § 1 comparison table, in display order (labels and cells: `model_cf.cmp.row.<id>.*`). */
const CMP_ROWS = ["unit", "phases", "entries", "space", "overfit", "support", "explanation", "accuracy", "rule"];
/** Rows of § 1 that say one thing for both columns (one cell spanning them: `model_cf.cmp.row.<id>.both`). */
const CMP_SPAN_ROWS = ["entries", "overfit", "accuracy"];
/** Default column shares of the three tables, in percent (the reader's drag overrides them, kept per table). § 1: criterion, memory, model, source. */
const COLUMN_SHARES = {
  cmp: [14, 31, 31, 24],
  family: [10, 9, 12, 22, 17, 20, 10], // method, constraint, objective, pros, cons, in this lab, source
  when: [12, 17, 14, 22, 25, 10], // approach, learns, needs, reach for it when, watch out for, source
};
const STORAGE_PAGE = "model_cf";
/** The five matrices of a worked example, in reading order: R, U, Vt, then the two this page computes (`model_cf.decomp.cap.<id>`). */
const DECOMP_MATRICES = ["r", "u", "vt", "product", "residual"];
/** Rows of the § 4 family table (the lecture's Table 3.3), in the lecture's order: `model_cf.family.row.<id>.{label,constraint,objective,pro,con,lab,src}`. */
const FAMILY_ROWS = ["unconstrained", "svd", "max_margin", "nmf", "plsa"];
/** The cells of a § 4 row between the method's name and the source column. */
const FAMILY_COLS = ["constraint", "objective", "pro", "con", "lab"];
/** The three notes under the § 4 table, in reading order; each has a source line (`<id>_src`). */
const FAMILY_NOTES = ["svd_note", "also_note", "note"];
/** The § 5 cards that open the black box, in reading order (`model_cf.box.card.<id>.{title,text,src,note}`). */
const BOX_CARDS = ["framing", "embedding", "gmf", "mlp", "neumf", "hybrid", "task", "optimizer"];
/** § 5 cards that are the lecture's own picture (the others are this lab's network). */
const BOX_LECTURE_CARDS = ["framing", "hybrid"];
/** The formula templates a § 5 card shows (config/formulas.yaml), main formula only, each under its own label. */
const BOX_FORMULAS = {
  embedding: ["dnn_embed"],
  gmf: ["dnn_gmf"],
  mlp: ["dnn_concat", "dnn_dense"],
  neumf: ["dnn_concat"],
};
/** Rows of the § 6 table (`model_cf.when.row.<id>.{label,learns,needs,when,watch,src}`). */
const WHEN_ROWS = ["neighbourhood", "factorization", "implicit", "neural"];
/** The cells of a § 6 row between the approach's name and the source column. */
const WHEN_COLS = ["learns", "needs", "when", "watch"];
/** The § 3 formula cards, in reading order: the lecture's low-rank model, how a prediction is made, what the factors minimise, then the ways this lab finds them. */
const TRAIN_CARDS = [
  "mf_lowrank",
  "mf_predict",
  "mf_objective",
  "mf_sgd_update",
  "als_solve",
  "bpr_gradient",
  "ease_closed_form",
  "dnn_output",
];
/** Cards whose statement is on the lecture slides (the others are this lab's). */
const TRAIN_LECTURE_CARDS = ["mf_lowrank"];
/** Cards traced on the Neural models page (the others on the Matrix factorization page). */
const TRAIN_NEURAL_CARDS = ["dnn_output"];
/** Cards that also show the `no_bias` variant of their template (the Biases setting off). */
const TRAIN_BIAS_CARDS = ["mf_predict", "mf_objective"];
/** The algorithm's own label (an existing i18n text of the Parameters panel) on the card of the formula that algorithm runs. */
const TRAIN_ALGORITHM = {
  mf_sgd_update: "params.alg_funk_svd",
  als_solve: "params.alg_als",
  bpr_gradient: "params.alg_bpr",
  ease_closed_form: "params.alg_ease",
};
/** Rows of the notation bridge (lecture letters vs this lab's): `model_cf.train.bridge.row.<id>.{label,deck,lab}`. */
const BRIDGE_ROWS = ["user_matrix", "item_matrix", "user_vector", "item_vector", "rating", "latent"];

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

export function createModelPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** keeps the tables' sticky heads under their section heading; set up by `mount`, a no-op before the sections exist */
  let syncSticky = () => {};
  /** @type {ResizeObserver | null} */
  let headObserver = null;
  /** @type {(() => void) | null} */
  let onWindowResize = null;

  // ── small builders ───────────────────────────────────────────────────────────────────────────

  /** @param {string} key */
  const t = (key) => ctx.i18n.t(key);

  /**
   * A table's columns made resizable (draggable edges between the heading cells, widths kept per table).
   * @param {HTMLTableElement} table
   * @param {"cmp" | "family" | "when"} name
   */
  function resizable(table, name) {
    makeColumnsResizable(table, {
      key: sharesKey(STORAGE_PAGE, name),
      defaults: COLUMN_SHARES[name],
      storage: browserStorage(),
      label: t("model_cf.col_resize"),
      hint: t("model_cf.col_resize_hint"),
    });
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
    const box = el("div", "model-tex");
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

  // ── § 1: memory-based vs model-based ─────────────────────────────────────────────────────────

  function comparisonTable() {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table model-table model-cmp"));
    const head = el("tr");
    for (const key of ["model_cf.cmp.col_criterion", "model_cf.cmp.col_memory", "model_cf.cmp.col_model", "model_cf.src_head"]) {
      head.appendChild(el("th", "", t(key)));
    }
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    const tbd = t("model_cf.tbd");
    for (const row of CMP_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row;
      const label = el("th", "model-crit", t(`model_cf.cmp.row.${row}.label`));
      label.scope = "row";
      tr.appendChild(label);
      const sides = CMP_SPAN_ROWS.includes(row) ? ["both"] : ["memory", "model"];
      for (const side of sides) {
        const text = t(`model_cf.cmp.row.${row}.${side}`);
        const td = rich("td", text === tbd ? "model-tbd" : "", text);
        td.dataset.side = side;
        if (side === "both") /** @type {HTMLTableCellElement} */ (td).colSpan = 2;
        tr.appendChild(td);
      }
      tr.appendChild(el("td", "model-src", t(`model_cf.cmp.row.${row}.src`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    resizable(table, "cmp");
    scroller.appendChild(table);
    return scroller;
  }

  // ── § 2: what a factorization is (the lecture's two worked examples, static tables) ─────────

  /**
   * One matrix as a small table: a caption, column labels, row labels (with an optional second line), the numbers. A cell in `marks`
   * ("row,col") is shaded: R and U x Vt differ there; in the residual a non-zero number is also coloured.
   * @param {{
   *   id: string, rows: {label: string, sub?: string}[], cols: string[], values: number[][], marks: Set<string>, residual?: boolean,
   * }} spec
   */
  function matrixFigure(spec) {
    const fig = el("figure", `model-matrix-fig ${spec.id}`);
    fig.appendChild(el("figcaption", "", t(`model_cf.decomp.cap.${spec.id}`)));
    const table = el("table", "model-matrix");
    const head = el("tr");
    head.appendChild(el("th"));
    for (const col of spec.cols) head.appendChild(el("th", "model-matrix-col", col));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    spec.values.forEach((values, i) => {
      const tr = el("tr");
      const label = el("th", "model-matrix-row", spec.rows[i].label);
      label.scope = "row";
      if (spec.rows[i].sub) label.appendChild(el("span", "model-matrix-sub", spec.rows[i].sub));
      tr.appendChild(label);
      values.forEach((value, j) => {
        const marked = spec.marks.has(`${i},${j}`);
        const td = el("td", `model-cell${marked ? " diff" : ""}${spec.residual && value !== 0 ? " res" : ""}`, formatValue(value));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    fig.appendChild(table);
    return fig;
  }

  /** @param {HTMLElement} parent @param {string} glyph */
  function operator(parent, glyph) {
    const op = el("span", "model-op", glyph);
    op.setAttribute("aria-hidden", "true");
    parent.appendChild(op);
  }

  /**
   * One worked example: R, U and Vt as the lecture prints them, then U x Vt and R - U x Vt computed here from those numbers.
   * @param {import("../util/model-examples.js").Example} ex
   */
  function exampleCard(ex) {
    const { product, residual, diffs } = decompose(ex);
    const marks = new Set(diffs.map((d) => `${d.row},${d.col}`));
    const users = ex.users.map((label, i) => ({ label, sub: ex.userGroups[i] }));
    const plainUsers = ex.users.map((label) => ({ label }));
    const concepts = ex.concepts.map((label) => ({ label }));
    const box = el("article", "model-example");
    box.dataset.example = ex.id;
    const head = el("header", "model-card-head");
    head.appendChild(el("h4", "", t(ex.titleKey)));
    head.appendChild(el("span", "pill model-origin lecture", t(ex.residualShownInDeck ? "model_cf.decomp.residual_in_lecture" : "model_cf.decomp.residual_ours_pill")));
    box.appendChild(head);
    box.appendChild(rich("p", "model-what", t(`model_cf.example.${ex.id}.note`)));

    const first = el("div", "model-matrices");
    first.appendChild(matrixFigure({ id: "r", rows: users, cols: ex.items, values: ex.R, marks }));
    operator(first, "≈");
    first.appendChild(matrixFigure({ id: "u", rows: users, cols: ex.concepts, values: ex.U, marks: new Set() }));
    operator(first, "×");
    first.appendChild(matrixFigure({ id: "vt", rows: concepts, cols: ex.items, values: ex.Vt, marks: new Set() }));
    const second = el("div", "model-matrices");
    second.appendChild(matrixFigure({ id: "product", rows: plainUsers, cols: ex.items, values: product, marks }));
    second.appendChild(matrixFigure({ id: "residual", rows: plainUsers, cols: ex.items, values: residual, marks, residual: true }));
    box.append(first, second);

    const n = diffs.length;
    box.appendChild(el("p", "model-note", `${t("model_cf.decomp.how")} ${ctx.i18n.t(ex.residualShownInDeck ? "model_cf.decomp.residual_deck" : "model_cf.decomp.residual_ours", { n })}`));
    box.appendChild(el("p", "model-card-src", `${t("model_cf.src_head")}: ${t(`model_cf.example.${ex.id}.src`)}`));
    return box;
  }

  /**
   * @param {HTMLElement} body
   * @param {any} data `/api/config/model_examples`
   */
  function renderExamples(body, data) {
    body.innerHTML = "";
    for (const ex of normalizeExamples(data)) body.appendChild(exampleCard(ex));
  }

  // ── § 4: the matrix factorization family ─────────────────────────────────────────────────────

  /** The lecture's family table (constraints, objective, pros, cons) with this lab's column: which of the five it implements. */
  function familyTable() {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table model-table model-family"));
    const head = el("tr");
    for (const col of ["method", ...FAMILY_COLS]) head.appendChild(el("th", "", t(`model_cf.family.col.${col}`)));
    head.appendChild(el("th", "", t("model_cf.src_head")));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    const params = { lam: t("params.lam"), reg: t("params.reg") };
    for (const row of FAMILY_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row;
      const label = el("th", "model-crit", t(`model_cf.family.row.${row}.label`));
      label.scope = "row";
      tr.appendChild(label);
      for (const col of FAMILY_COLS) {
        tr.appendChild(appendEmphasis(el("td"), ctx.i18n.t(`model_cf.family.row.${row}.${col}`, params)));
      }
      tr.appendChild(el("td", "model-src", t(`model_cf.family.row.${row}.src`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    resizable(table, "family");
    scroller.appendChild(table);
    return scroller;
  }

  /** The notes under the family table: what the name "SVD" means, what else the lab factorizes, where the table comes from. Each with its source. */
  function familyNotes() {
    const box = el("div", "model-family-notes");
    for (const id of FAMILY_NOTES) {
      box.appendChild(rich("p", "model-note", t(`model_cf.family.${id}`)));
      box.appendChild(el("p", "model-note-src", `${t("model_cf.src_head")}: ${t(`model_cf.family.${id}_src`)}`));
    }
    return box;
  }

  // ── § 3: from a factorization to a trained model ─────────────────────────────────────────────

  /**
   * The notation bridge: the lecture's letters next to this lab's, row by row. Not just a change of letters - the lecture's index i is a
   * USER (u_i, r_ij), this lab's index i is an ITEM (q_i, r_ui) - so the table says it once, in words (`model_cf.train.bridge_note`).
   */
  function bridgeTable() {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table model-table model-bridge"));
    const head = el("tr");
    for (const key of ["what", "deck", "lab"]) head.appendChild(el("th", "", t(`model_cf.train.bridge_col.${key}`)));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const row of BRIDGE_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row;
      const label = el("th", "model-crit", t(`model_cf.train.bridge.row.${row}.label`));
      label.scope = "row";
      tr.appendChild(label);
      tr.appendChild(el("td", "model-bridge-deck", t(`model_cf.train.bridge.row.${row}.deck`)));
      tr.appendChild(el("td", "model-bridge-lab", t(`model_cf.train.bridge.row.${row}.lab`)));
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    return scroller;
  }

  /**
   * One card: the title row (name + where it comes from + where the lab traces it + the algorithm), the formulas, the text, the source line
   * and, where this lab differs from its source, one note. Shared by § 3 (formula cards) and § 5 (the black box opened).
   * @param {{
   *   id: string, base: string, lecture: boolean, page?: string, algorithm?: string,
   *   formulas: {caption?: string, tex: string}[], params?: Record<string, string>,
   * }} spec `base` is the i18n prefix of the card (`<base>.title`, `.text`, `.src`, `.note`); `page` the nav label key of the page that traces it (none for a card that is only the lecture's picture)
   */
  function formulaCard(spec) {
    const box = el("article", "model-card");
    box.dataset.card = spec.id;
    const head = el("header", "model-card-head");
    head.appendChild(el("h4", "", t(`${spec.base}.title`)));
    head.appendChild(el("span", `pill model-origin ${spec.lecture ? "lecture" : "lab"}`, t(spec.lecture ? "model_cf.train.origin_lecture" : "model_cf.train.origin_lab")));
    if (spec.page) head.appendChild(el("span", "pill model-where", ctx.i18n.t("model_cf.train.seen_on", { page: t(spec.page) })));
    if (spec.algorithm) head.appendChild(el("span", "pill model-alg", t(spec.algorithm)));

    const body = el("div", "model-card-body");
    const text = el("div", "model-card-text");
    const params = spec.params || {};
    text.appendChild(appendEmphasis(el("p", "model-what"), ctx.i18n.t(`${spec.base}.text`, params)));
    // the card's source (the literature or the slides) and, where this lab differs from the source, one note saying how
    const srcLine = el("p", "model-card-src");
    srcLine.append(el("strong", "", `${t("model_cf.src_head")}: `), t(`${spec.base}.src`));
    text.appendChild(srcLine);
    const noteKey = `${spec.base}.note`;
    if (t(noteKey) !== noteKey) text.appendChild(el("p", "model-card-note", ctx.i18n.t(noteKey, params)));
    body.appendChild(text);
    if (spec.formulas.length) {
      const col = el("div", "model-card-formulas");
      for (const f of spec.formulas) {
        const fig = el("figure", "model-formula");
        if (f.caption) fig.appendChild(el("figcaption", "", f.caption));
        fig.appendChild(texBox(f.tex));
        col.appendChild(fig);
      }
      body.appendChild(col);
    }
    box.append(head, body);
    return box;
  }

  /** The labels of the Parameters-panel settings a card's text names (an existing i18n text each: the card never repeats a label). */
  function settingLabels() {
    return { lam: t("params.lam"), reg: t("params.reg"), setting: t("params.biases"), optimizer: t("params.optimizer") };
  }

  /**
   * A § 3 card: the template's `symbolic` formula and, for a card with a `no_bias` variant, the same statement with the Biases setting off.
   * @param {string} id the template id
   * @param {Record<string, any>} formulas
   */
  function trainCard(id, formulas) {
    const params = settingLabels();
    const withVariant = TRAIN_BIAS_CARDS.includes(id);
    const shown = cardFormulas(id, formulas, withVariant ? "no_bias" : null).map((f) => ({
      tex: f.tex,
      caption: withVariant && !f.variant ? ctx.i18n.t("model_cf.train.cap_bias_on", params) : f.variant ? ctx.i18n.t("model_cf.train.cap_bias_off", params) : undefined,
    }));
    return formulaCard({
      id,
      base: `model_cf.train.card.${id}`,
      lecture: TRAIN_LECTURE_CARDS.includes(id),
      page: TRAIN_NEURAL_CARDS.includes(id) ? "nav.dnn" : "nav.mf",
      algorithm: Object.hasOwn(TRAIN_ALGORITHM, id) ? TRAIN_ALGORITHM[id] : undefined,
      formulas: shown,
      params,
    });
  }

  /**
   * @param {HTMLElement} body
   * @param {Record<string, any>} formulas
   */
  function renderTrain(body, formulas) {
    body.innerHTML = "";
    for (const id of TRAIN_CARDS) body.appendChild(trainCard(id, formulas));
  }

  // ── § 5: the black box, opened ───────────────────────────────────────────────────────────────

  /** The lecture's picture in three boxes: ids in, the network, a rating out (training rows above the arrow, the test row below). */
  function boxFlow() {
    const flow = el("div", "model-box-flow");
    /** @param {string} cls @param {string} main @param {string} sub */
    const part = (cls, main, sub) => {
      const box = el("div", `model-box-part ${cls}`);
      box.append(el("strong", "", t(main)), el("span", "model-box-sub", t(sub)));
      return box;
    };
    flow.appendChild(part("io", "model_cf.box.flow.in", "model_cf.box.flow.in_sub"));
    operator(flow, "→");
    flow.appendChild(part("core", "model_cf.box.flow.core", "model_cf.box.flow.core_sub"));
    operator(flow, "→");
    flow.appendChild(part("io", "model_cf.box.flow.out", "model_cf.box.flow.out_sub"));
    return flow;
  }

  /**
   * A § 5 card: the lecture's framing, or one stage of this lab's network with the formula templates it is built from.
   * @param {string} id
   * @param {Record<string, any>} formulas
   */
  function boxCard(id, formulas) {
    const shown = (Object.hasOwn(BOX_FORMULAS, id) ? BOX_FORMULAS[id] : []).flatMap((template) =>
      cardFormulas(template, formulas).slice(0, 1).map((f) => ({ tex: f.tex, caption: t(formulas[template]?.label_key || "") }))
    );
    return formulaCard({
      id,
      base: `model_cf.box.card.${id}`,
      lecture: BOX_LECTURE_CARDS.includes(id),
      page: BOX_LECTURE_CARDS.includes(id) ? undefined : "nav.dnn", // the lecture's own picture is not traced on a page
      formulas: shown,
      params: settingLabels(),
    });
  }

  /**
   * @param {HTMLElement} body
   * @param {Record<string, any>} formulas
   */
  function renderBox(body, formulas) {
    body.innerHTML = "";
    for (const id of BOX_CARDS) body.appendChild(boxCard(id, formulas));
  }

  // ── § 6: which approach when ─────────────────────────────────────────────────────────────────

  function whenTable() {
    const scroller = el("div", "table-wrap");
    const table = /** @type {HTMLTableElement} */ (el("table", "data-table model-table model-when"));
    const head = el("tr");
    head.appendChild(el("th", "", t("model_cf.when.col.approach")));
    for (const col of WHEN_COLS) head.appendChild(el("th", "", t(`model_cf.when.col.${col}`)));
    head.appendChild(el("th", "", t("model_cf.src_head")));
    const thead = el("thead");
    thead.appendChild(head);
    const tbody = el("tbody");
    for (const row of WHEN_ROWS) {
      const tr = el("tr");
      tr.dataset.row = row;
      const label = el("th", "model-crit", t(`model_cf.when.row.${row}.label`));
      label.scope = "row";
      tr.appendChild(label);
      for (const col of WHEN_COLS) tr.appendChild(rich("td", "", t(`model_cf.when.row.${row}.${col}`)));
      tr.appendChild(el("td", "model-src", t(`model_cf.when.row.${row}.src`)));
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
    const page = el("div", "model-page");

    // the beta note counts the comparison cells that still say TBD; once none does, it says every cell has a source
    const nTbd = countTbd(t, cmpCellKeys(CMP_ROWS, CMP_SPAN_ROWS));
    const betaText = nTbd > 0 ? ctx.i18n.t("model_cf.beta_note", { n: nTbd }) : t("model_cf.beta_note_sourced");
    const titleRow = el("div", "model-title-row");
    const beta = el("span", "pill tag-flag model-beta", t("model_cf.beta"));
    beta.title = betaText;
    beta.dataset.tbd = String(nTbd);
    const betaShown = showsBetaNote(ctx.publication); // WP-237b: live only
    titleRow.append(el("h2", "", t("model_cf.title")), ...(betaShown ? [beta] : []));
    // the page's text size, - / + at the right of the title row (the uCF / iCF panels' group); the factor is the CSS variable `--model-zoom`
    // on the page, which model.css turns into the page's base font size, so every text, table and formula follows it
    createZoomControl(titleRow, {
      i18n: ctx.i18n,
      panel: "text",
      page: STORAGE_PAGE,
      target: page,
      cssVar: "--model-zoom",
      storage: browserStorage(),
      onChange: () => syncSticky(), // a larger text size makes the section headings taller
    });

    const intro = rich("p", "model-intro", t("model_cf.intro"));
    const note = el("div", "warn-banner model-beta-note", betaText);

    /** @type {Record<string, {box: HTMLElement, body: HTMLElement}>} */
    const panels = {};
    for (const id of SECTION_IDS) {
      const panel = createPanel(`model-${id}`, "model-section", t(`model_cf.${id}_title`));
      panel.body.appendChild(rich("p", "model-section-intro", t(`model_cf.${id}_intro`)));
      panels[id] = panel;
    }

    // contents chips (the Matrix factorization and Neural models pages are one click away in the sidebar: no door buttons here)
    const toc = el("nav", "model-toc");
    for (const id of SECTION_IDS) {
      const chip = /** @type {HTMLButtonElement} */ (el("button", "chip", t(`model_cf.toc_${id}`)));
      chip.type = "button";
      chip.addEventListener("click", () => panels[id].box.scrollIntoView({ behavior: "smooth", block: "start" }));
      toc.appendChild(chip);
    }

    // a table's head hooks under its section heading, whose height changes with the text size, the language and the window.
    // `--mdl-head-h` on each section = that heading's real height (getBoundingClientRect, fractional: a 1 px gap would show the cells
    // scrolling between the two); kept current by a ResizeObserver on the headings, by the zoom group's onChange, by the window's resize
    // and once the fonts are in. (A hidden tab fires no ResizeObserver callback: the direct calls cover it.)
    syncSticky = () => {
      // a sticky box hooks to the scroller's content box, not its padding box: with the main area's 20 px padding it would stop 20 px below
      // the top edge and the page would scroll visibly above it. `--mdl-sticky-top` = minus that padding puts it at the very top.
      const scroller = page.closest(".main-content") ?? page.parentElement;
      const pad = scroller ? parseFloat(getComputedStyle(scroller).paddingTop) || 0 : 0;
      page.style.setProperty("--mdl-sticky-top", `${-pad}px`);
      for (const panel of Object.values(panels)) {
        const head = panel.box.querySelector(".panel-head");
        if (head) panel.box.style.setProperty("--mdl-head-h", `${head.getBoundingClientRect().height}px`);
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

    // § 2: the two worked examples are data (config/model_examples.yaml): the page draws R, U, Vt and computes U x Vt and the residual
    panels.decomp.body.appendChild(rich("p", "model-note model-zero-note", t("model_cf.decomp.zero_note")));
    const decompLoading = el("p", "model-loading", t("model_cf.decomp.loading"));
    const examplesBody = el("div", "model-examples");
    panels.decomp.body.append(decompLoading, examplesBody);

    panels.family.body.append(familyTable(), familyNotes());

    // § 3: what the lecture shows (one formula), the notation bridge, then the formula cards, which need the templates
    panels.train.body.appendChild(rich("p", "model-note model-deck-note", t("model_cf.train.deck_note")));
    panels.train.body.appendChild(bridgeTable());
    panels.train.body.appendChild(rich("p", "model-note", t("model_cf.train.bridge_note")));
    const loading = el("p", "model-loading", t("model_cf.train.loading"));
    const trainBody = el("div", "model-train model-cards");
    panels.train.body.append(loading, trainBody);

    // § 5: the lecture's picture, then the cards that say what is inside (they draw on the same templates as § 3)
    panels.blackbox.body.appendChild(boxFlow());
    const boxLoading = el("p", "model-loading", t("model_cf.train.loading"));
    const boxBody = el("div", "model-box model-cards");
    panels.blackbox.body.append(boxLoading, boxBody);

    // § 6: which approach when, with its note
    panels.when.body.appendChild(whenTable());
    panels.when.body.appendChild(rich("p", "model-note", t("model_cf.when.note")));
    panels.when.body.appendChild(el("p", "model-note-src", `${t("model_cf.src_head")}: ${t("model_cf.when.note_src")}`));

    // the literature's limit, once, at the bottom (an offline gain is not an online gain)
    const offline = el("p", "model-offline", t("model_cf.offline_note"));
    page.append(titleRow, intro, ...(betaShown ? [note] : []), toc, ...SECTION_IDS.map((id) => panels[id].box), offline); // WP-237b: no note in the edition
    root.appendChild(page);
    syncSticky();
    document.fonts?.ready.then(() => syncSticky());

    // WP-121: `modelExamples` is a method of both API clients (api.js); an older client without it gets a labelled error, not a blank section
    Promise.resolve()
      .then(() => ctx.api.modelExamples())
      .then((data) => {
        if (!root) return; // the page was left while the answer was on its way
        decompLoading.remove();
        renderExamples(examplesBody, data);
      })
      .catch((err) => {
        if (!root) return;
        decompLoading.className = "warn-banner";
        decompLoading.textContent = ctx.i18n.t("model_cf.decomp.failed", { message: err instanceof Error ? err.message : String(err) });
      });

    Promise.resolve(ctx.api.formulas())
      .then((formulas) => {
        if (!root) return; // the page was left while the answer was on its way
        loading.remove();
        boxLoading.remove();
        renderTrain(trainBody, formulas);
        renderBox(boxBody, formulas);
      })
      .catch((err) => {
        if (!root) return;
        for (const waiting of [loading, boxLoading]) {
          waiting.className = "warn-banner";
          waiting.textContent = ctx.i18n.t("model_cf.train.failed", { message: err instanceof Error ? err.message : String(err) });
        }
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
