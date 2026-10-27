// @ts-check
// WP-122: the MF page's factor panel - the matrices the model actually learns, next to the ratings they were learned from. One picture of
//
//        R^ = mu + b_u + b_i + P Q^T                       Q^T: k rows (one per latent factor), one column per watched film
//                                                          P:   one row per watched user, k columns
//          b_i .  .  .  .   (a row of film biases)         R^:  EVERY watched user x film cell, rated or not - the model's value
//   b_u  P     R^ R^ R^ R^                                 b_u: a column of user biases (FunkSVD; ALS and a model without biases have none)
//
// the same rows and columns, in the same order, as the sub-matrix tab beside it (the active user and the target film first; WP-152: this panel is that panel's second tab). Two frames, switchable by the reader and
// following the player by default: the initial weights, and the epoch the trainer kept (components/..: `frameIndexFor`). What a cell is - a rating the model was
// trained on (it carries the residual r - r^ under its value), a rating held out for validation (faded), an unrated cell (the model's value alone), the target
// (its value is the answer: "?" until the prediction phase) - is decided in util/factor-view.js and checked under node there.
// Reads `trace.views.factors` (trace/models.py `FactorView`); a trace without it (BPR, EASE, a refit-less trace) shows one sentence instead.
// WP-141: in the TOP-K task (`scores_row` in the view, no target film) the panel is a single row - the user's P row against every shown film's Q^T column, a score per
// film - with the kept epoch's frame only (no frame chips: a list is the trained model's), the scores "?" until the scoring phase and the columns the cut keeps outlined
// and numbered from the cut phase on (util/factor-view.js `isTopkView` / `topkStage` / `topRanks`).

import { fmt } from "../util/format.js";
import { clampHeadLabel } from "../util/heat-head.js";
import { infoTip } from "../util/info-tip.js";
import {
  basisDiffers,
  bestIndex,
  buildRoles,
  cellRole,
  formulaKey,
  fmtFactor,
  fmtResidual,
  fmtRhat,
  frameChipKey, // WP-146
  frameIndexFor,
  highlightSets,
  isFactorView,
  isTopkView,
  largestAbs,
  ratingTint,
  residualOf,
  shownFactors,
  signedTint,
  targetOpen,
  topRanks,
  topkStage,
} from "../util/factor-view.js";

/** the strongest share of a hue a cell takes (the text stays readable on it: measured, trace.css / mf.css) */
const MAX_TINT_PCT = 42;
/** WP-157: the strongest share of a SIGN colour (the diverging scale's poles, tokens.css `--div-pos` / `--div-neg`): the pole itself, as in the centred sub-matrix. The poles are
 *  light (dark theme: deep) enough for the ink to read on them (>= 4.8 : 1, tests/app/test_sign_palette.py), so the 42 % cap that the navy / maroon needed would only fade the cue
 *  (the strongest tint measured 1.45 : 1 against the card, 1.37 : 1 dark; the old navy / maroon at 42 % 2.5 : 1 / 2.3 : 1). */
const MAX_SIGNED_TINT_PCT = 100;

/**
 * @param {HTMLElement} root the panel's body
 * @param {{i18n: any, headSlot?: HTMLElement | null, scale?: {min?: number, max?: number} | null}} ctx `headSlot`: where the frame chips, the target readout
 *   and the (i) go (the panel's head, outside the scrolling body); `scale`: the dataset's rating scale (the tint of a rated value)
 */
export function createFactorPanel(root, ctx) {
  const { i18n } = ctx;
  /** @type {any} */
  let view = null;
  /** @type {ReturnType<typeof buildRoles> | null} */
  let roles = null;
  let m = 0;
  let n = 0;
  let k = 0;
  let shown = 0;
  let hasBias = false;
  let topk = false; // WP-141: the top-K task's view (no target, a score per film)
  /** WP-141: the rank of each column the cut keeps @type {Map<number, number>} */
  let ranks = new Map();
  let scoresOpen = true; // WP-141: the scoring phase has been reached
  /** @type {number | null} the frame the reader chose; it holds until the player moves to another step */
  let pinned = null;
  let pinnedAt = -1;
  let lastIndex = 0;
  let lastKey = "";
  /** @type {HTMLElement[][]} */
  let pCells = [];
  /** @type {HTMLElement[][]} */
  let qCells = [];
  /** @type {HTMLElement[]} */
  let buCells = [];
  /** @type {HTMLElement[]} */
  let biCells = [];
  /** @type {HTMLElement[][]} */
  let rCells = [];
  /** @type {HTMLElement[]} */
  let rowLabelEls = [];
  /** @type {HTMLElement[]} */
  let colHeadEls = [];
  /** @type {HTMLElement[]} */
  let chips = [];
  /** @type {HTMLElement | null} */
  let readout = null;
  /** @type {HTMLElement | null} */
  let frameNote = null;
  /** @type {HTMLElement | null} */
  let formulaEl = null;
  let frameShown = 0;
  let targetIsOpen = false;

  /** @param {string} tag @param {string} className @param {string} [text] @returns {HTMLElement} */
  function el(tag, className, text) {
    const e = document.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function clearHead() {
    if (ctx.headSlot) ctx.headSlot.replaceChildren();
  }

  // WP-152: the root is the body of the sub-matrix panel's second tab (`.factors-body`); the two states below are classes on it (mf.css)
  /** @param {boolean} on the panel holds one sentence (no factor view in this trace): it stands at the top of the tab, no grid to fill it */
  function setIdle(on) {
    root.classList.toggle("is-idle", on);
    if (on) setTopk(false);
  }

  /** @param {boolean} on WP-141: the top-K task's grid is one row: it is as tall as that, not stretched to the tab's height (the predict task's grid has rows to fill it) */
  function setTopk(on) {
    root.classList.toggle("is-topk", on);
  }

  /** @param {string} key */
  function idle(key) {
    root.replaceChildren(el("p", "formula-idle", i18n.t(key)));
    clearHead();
    setIdle(true);
    view = null;
  }

  /** @param {number} i the factor's number (0-based): f1, f2, ... with subscripts */
  const factorName = (i) => `f${String(i + 1).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])}`;

  /**
   * Paint a factor cell: its text and the sign tint.
   * @param {HTMLElement} cell @param {number} value @param {number} largest
   */
  function paintFactor(cell, value, largest) {
    cell.textContent = fmtFactor(value);
    const t = signedTint(value, largest);
    cell.classList.toggle("is-pos", t.sign > 0);
    cell.classList.toggle("is-neg", t.sign < 0);
    cell.style.setProperty("--t", String(Math.round(t.strength * MAX_SIGNED_TINT_PCT))); // WP-157: a sign colour (the rated value's tint, below, keeps MAX_TINT_PCT)
  }

  function build() {
    root.replaceChildren();
    clearHead();
    chips = [];
    readout = null;
    lastKey = "";
    pinned = null;
    setIdle(false);
    if (!isFactorView(view)) {
      idle("mf.factors_idle");
      return;
    }
    roles = buildRoles(view);
    topk = isTopkView(view); // WP-141
    setTopk(topk);
    ranks = topk ? topRanks(view) : new Map();
    scoresOpen = !topk;
    m = view.user_labels.length;
    n = view.item_labels.length;
    k = view.k;
    const caps = shownFactors(k);
    shown = caps.shown;
    hasBias = Array.isArray(view.frames[0].b_users);
    const frozen = hasBias ? shown + 1 : shown; // the columns between the user names and the predicted matrix
    const freezeP = frozen <= 3; // a wide P would leave no room for R^: it scrolls away with the rest
    const freezeQ = shown <= 2; // the factor rows of Q^T stay under the film names only while they leave room for the rows below them

    // -- the head: the two frames, the target's value, the (i) ---------------------------------------------------------------------------------------------
    if (ctx.headSlot && topk) {
      // WP-141: one frame, no target readout: just the (i)
      ctx.headSlot.append(infoTip(i18n.t("mf.factors_topk_info"), i18n.t("mf.factors_info_label")));
    } else if (ctx.headSlot) {
      const group = el("span", "factor-chips");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", i18n.t("panel.factors"));
      view.frames.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
        // WP-146: the frame says what it IS (the initial weights, or epoch n), not where it stands in the list: a pretrained model has one frame, the kept epoch
        const chip = /** @type {HTMLButtonElement} */ (el("button", "factor-chip", i18n.t(frameChipKey(f), { n: f.epoch })));
        chip.type = "button";
        chip.title = i18n.t(f.label_key);
        chip.addEventListener("click", () => {
          pinned = i;
          pinnedAt = lastIndex;
          lastKey = "";
          renderCurrent();
        });
        chips.push(chip);
        group.appendChild(chip);
      });
      readout = el("span", "factor-readout");
      ctx.headSlot.append(group, readout, infoTip(i18n.t("mf.factors_info"), i18n.t("mf.factors_info_label")));
    }

    // -- the caption: the formula with the model's numbers, the note about what is not shown --------------------------------------------------------------
    const caption = el("div", "factor-caption");
    formulaEl = el("span", "factor-formula");
    frameNote = el("span", "factor-frame-note");
    caption.append(formulaEl, frameNote);
    const notes = [];
    if (caps.hidden > 0) notes.push(i18n.t("mf.factors_hidden", { shown, k }));
    if (basisDiffers(view)) notes.push(i18n.t("mf.factors_basis", { k }));
    if (notes.length) caption.appendChild(el("span", "factor-note", notes.join(" ")));
    caption.appendChild(el("span", "factor-key", i18n.t(topk ? "mf.factors_topk_key" : "mf.factors_key")));

    // -- the grid ------------------------------------------------------------------------------------------------------------------------------------------
    const scroll = el("div", "factor-scroll");
    const grid = el("div", "factor-grid");
    grid.style.gridTemplateColumns = `var(--fl-w) ${frozen > 0 ? `repeat(${frozen}, var(--fp-w)) ` : ""}var(--fg-w) repeat(${n}, var(--fc-w))`;
    if (freezeP) grid.classList.add("freeze-p");
    if (freezeQ) grid.classList.add("freeze-q");
    scroll.appendChild(grid);

    /** an empty grid cell that only keeps its row/column (the corner, the gap) @param {string} [cls] */
    const blank = (cls = "") => el("div", `factor-blank ${cls}`.trim());

    // the header row: P's column names, the film names
    grid.appendChild(el("div", "factor-corner factor-head-cell"));
    if (hasBias) grid.appendChild(headCell("b_u", "factor-head-cell factor-ph", 0));
    for (let j = 0; j < shown; j += 1) grid.appendChild(headCell(`P ${factorName(j)}`, "factor-head-cell factor-ph", (hasBias ? 1 : 0) + j));
    grid.appendChild(blank("factor-head-cell"));
    colHeadEls = [];
    for (let c = 0; c < n; c += 1) {
      const head = el("div", `heat-head factor-head-cell factor-film${c === 0 && !topk ? " is-target" : ""}`);
      const text = el("span", "heat-head-text");
      const { lines } = clampHeadLabel(view.item_labels[c]);
      for (const line of lines) text.appendChild(el("span", "heat-head-line", line));
      head.appendChild(text);
      head.title = view.item_labels[c];
      grid.appendChild(head);
      colHeadEls.push(head);
    }

    // Q^T: one row per shown factor; the b_i row under it
    qCells = [];
    for (let j = 0; j < shown; j += 1) {
      const label = el("div", "factor-rowlabel factor-qrow", `Qᵀ ${factorName(j)}`);
      label.title = i18n.t("mf.factors_q");
      label.style.setProperty("--qi", String(j));
      grid.appendChild(label);
      for (let s = 0; s < frozen; s += 1) grid.appendChild(blank(`factor-qrow factor-qpad`)).style.setProperty("--qi", String(j));
      grid.appendChild(blank("factor-qrow")).style.setProperty("--qi", String(j));
      const row = [];
      for (let c = 0; c < n; c += 1) {
        const cell = el("div", `factor-cell factor-q${c === 0 && !topk ? " is-target-col" : ""}`);
        cell.style.setProperty("--qi", String(j));
        grid.appendChild(cell);
        row.push(cell);
      }
      qCells.push(row);
    }
    biCells = [];
    if (hasBias) {
      const qi = shown;
      const label = el("div", "factor-rowlabel factor-qrow", "b_i");
      label.style.setProperty("--qi", String(qi));
      grid.appendChild(label);
      for (let s = 0; s < frozen; s += 1) grid.appendChild(blank("factor-qrow factor-qpad")).style.setProperty("--qi", String(qi));
      grid.appendChild(blank("factor-qrow")).style.setProperty("--qi", String(qi));
      for (let c = 0; c < n; c += 1) {
        const cell = el("div", `factor-cell factor-q factor-bias${c === 0 && !topk ? " is-target-col" : ""}`);
        cell.style.setProperty("--qi", String(qi));
        grid.appendChild(cell);
        biCells.push(cell);
      }
    }

    // the users: name, b_u, P, then R^
    buCells = [];
    pCells = [];
    rCells = [];
    rowLabelEls = [];
    for (let r = 0; r < m; r += 1) {
      const label = el("div", `factor-rowlabel factor-user${r === 0 ? " is-first" : ""}`, view.user_labels[r]);
      label.title = view.user_labels[r];
      grid.appendChild(label);
      rowLabelEls.push(label);
      if (hasBias) {
        const cell = el("div", "factor-cell factor-p factor-bias");
        cell.style.setProperty("--pc", "0");
        grid.appendChild(cell);
        buCells.push(cell);
      }
      const prow = [];
      for (let j = 0; j < shown; j += 1) {
        const cell = el("div", "factor-cell factor-p");
        cell.style.setProperty("--pc", String((hasBias ? 1 : 0) + j));
        grid.appendChild(cell);
        prow.push(cell);
      }
      pCells.push(prow);
      grid.appendChild(blank("factor-gap"));
      const rrow = [];
      for (let c = 0; c < n; c += 1) {
        const cell = el("div", "factor-cell factor-r");
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        if (c === 0 && !topk) cell.classList.add("is-target-col");
        grid.appendChild(cell);
        rrow.push(cell);
      }
      rCells.push(rrow);
    }
    // the hover text of a cell is built when it is asked for (one handler, not a thousand strings)
    grid.addEventListener("mouseover", (e) => {
      const cell = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.(".factor-r"));
      if (cell) cell.title = cellTitle(Number(cell.dataset.r), Number(cell.dataset.c));
    });
    root.append(caption, scroll);
  }

  /** @param {string} text @param {string} cls @param {number} column @returns {HTMLElement} */
  function headCell(text, cls, column) {
    const cell = el("div", cls, text);
    cell.style.setProperty("--pc", String(column));
    if (text === "b_u") cell.title = i18n.t("mf.factors_bu");
    else cell.title = i18n.t("mf.factors_p");
    return cell;
  }

  /** @param {number} r @param {number} c @returns {string} */
  function cellTitle(r, c) {
    if (!view || !roles) return "";
    const f = view.frames[frameShown];
    const role = cellRole(roles, r, c);
    const head = `${view.user_labels[r]} × ${view.item_labels[c]}`;
    if (topk && !scoresOpen) return `${head}: ${i18n.t("mf.factors_topk_hidden")}`; // WP-141
    if (role === "target") {
      return targetIsOpen ? `${head}: ${i18n.t("col.pred_epoch")} = ${fmt(f.rhat[r][c])}` : `${head}: ${i18n.t("mf.factors_target_hidden")}`;
    }
    const rank = topk && ranks.has(c) ? `\n${i18n.t("mf.factors_topk_rank", { n: ranks.get(c) })}` : ""; // WP-141: a column the cut keeps names its rank
    const value = `${head}: r̂ = ${fmt(f.rhat[r][c])}${rank}`;
    if (role === "trained") {
      const res = residualOf(roles, r, c, f.rhat[r][c]);
      return `${value}\n${i18n.t("mf.factors_cell_trained", { r: roles.values.get(`${r}:${c}`)?.toFixed(1), res: res === null ? "—" : fmtResidual(res) })}`;
    }
    if (role === "valid") return `${value}\n${i18n.t("mf.factors_cell_valid", { r: roles.values.get(`${r}:${c}`)?.toFixed(1) })}`;
    return `${value}\n${i18n.t("mf.factors_cell_none")}`;
  }

  /**
   * Draw one frame: every number and tint of it, the roles' marks, the target's value or its "?", the head and the caption.
   * @param {number} index the frame
   * @param {boolean} open whether the target's value may be shown
   * @param {ReturnType<typeof highlightSets>} marks
   * @param {{scores: boolean, cut: boolean}} stage WP-141: how far the top-K walk has come (the predict task: both true)
   */
  function paint(index, open, marks, stage) {
    if (!view || !roles) return;
    const f = view.frames[index];
    frameShown = index;
    targetIsOpen = open;
    scoresOpen = stage.scores;
    const largestPFrame = largestAbs(f.P);
    const largestQFrame = largestAbs(f.Q);
    const largestB = Math.max(largestAbs([f.b_users || []]), largestAbs([f.b_items || []]));
    for (let r = 0; r < m; r += 1) {
      if (hasBias) paintFactor(buCells[r], f.b_users[r], largestB);
      for (let j = 0; j < shown; j += 1) paintFactor(pCells[r][j], f.P[r][j], largestPFrame);
    }
    for (let j = 0; j < shown; j += 1) for (let c = 0; c < n; c += 1) paintFactor(qCells[j][c], f.Q[c][j], largestQFrame);
    if (hasBias) for (let c = 0; c < n; c += 1) paintFactor(biCells[c], f.b_items[c], largestB);
    for (let r = 0; r < m; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const cell = rCells[r][c];
        const role = cellRole(roles, r, c);
        const rhat = f.rhat[r][c];
        cell.className = `factor-cell factor-r${c === 0 && !topk ? " is-target-col" : ""}`;
        cell.replaceChildren();
        delete cell.dataset.rank;
        if (topk && !stage.scores) {
          // WP-141: the scores are written at the scoring step; the cell keeps its place (and its size) with a question mark
          cell.classList.add("is-pending");
          cell.textContent = "?";
          continue;
        }
        if (topk && stage.cut && ranks.has(c)) {
          cell.classList.add("is-top"); // WP-141: a film the cut keeps; its rank is the corner mark (`data-rank`)
          cell.dataset.rank = String(ranks.get(c));
        }
        if (role === "target" && !open) {
          cell.classList.add("is-hidden-target");
          cell.textContent = "?";
          continue;
        }
        const value = el("span", "factor-value", fmtRhat(rhat));
        cell.appendChild(value);
        cell.style.setProperty("--t", String(Math.round(ratingTint(rhat, ctx.scale) * MAX_TINT_PCT)));
        if (role === "trained") {
          cell.classList.add("is-trained");
          const res = residualOf(roles, r, c, rhat);
          if (res !== null) cell.appendChild(el("span", `factor-residual${res < 0 ? " is-neg" : ""}`, fmtResidual(res)));
        } else if (role === "valid") {
          cell.classList.add("is-valid");
        } else if (role === "target") {
          cell.classList.add("is-target");
        }
        if (marks.cells.has(`${r}:${c}`)) cell.classList.add("is-result");
      }
    }
    // the rows and columns the step marks (the active user; the vectors that make the marked cell)
    const rows = new Set(marks.rows);
    const cols = new Set(marks.cols);
    for (const key of marks.cells.keys()) {
      const [r, c] = key.split(":").map(Number);
      rows.add(r);
      cols.add(c);
    }
    for (let r = 0; r < m; r += 1) {
      const on = rows.has(r);
      rowLabelEls[r].classList.toggle("is-marked", on);
      for (const cell of rCells[r]) cell.classList.toggle("in-row", on);
      for (const cell of pCells[r]) cell.classList.toggle("in-row", on);
      if (hasBias) buCells[r].classList.toggle("in-row", on);
    }
    for (let c = 0; c < n; c += 1) {
      const on = cols.has(c);
      // WP-141: the films a `dim` highlight names (the top-K task's rated films, at the step that drops them) fade, head and cells
      const faded = marks.dim.has(c);
      colHeadEls[c].classList.toggle("is-dim", faded);
      for (let r = 0; r < m; r += 1) rCells[r][c].classList.toggle("is-dim", faded);
      for (let j = 0; j < shown; j += 1) qCells[j][c].classList.toggle("is-dim", faded);
      if (hasBias) biCells[c].classList.toggle("is-dim", faded);
      colHeadEls[c].classList.toggle("is-marked", on);
      colHeadEls[c].classList.toggle("is-top", topk && stage.cut && ranks.has(c)); // WP-141
      for (let r = 0; r < m; r += 1) rCells[r][c].classList.toggle("in-col", on);
      for (let j = 0; j < shown; j += 1) qCells[j][c].classList.toggle("in-col", on);
      if (hasBias) biCells[c].classList.toggle("in-col", on);
    }
    // the head: which frame, the target's value (the same number as the Prediction chip), and the caption
    chips.forEach((chip, i) => {
      chip.classList.toggle("active", i === index);
      chip.setAttribute("aria-pressed", String(i === index));
    });
    if (readout && !topk) {
      const value = Array.isArray(view.target) ? f.rhat[view.target[0]][view.target[1]] : null;
      readout.textContent = open && value !== null ? `${i18n.t("col.pred_epoch")}: ${fmt(value)}` : "";
      readout.classList.toggle("is-empty", !(open && value !== null));
    }
    if (formulaEl) {
      formulaEl.textContent = topk
        ? i18n.t(`mf.factors_topk_formula_${formulaKey(f)}`, { mu: fmtFactor(f.mu), k: ranks.size }) // WP-141
        : i18n.t(`mf.factors_formula_${formulaKey(f)}`, { mu: fmtFactor(f.mu) });
    }
    if (frameNote) frameNote.textContent = `${i18n.t(f.label_key)}${f.epoch > 0 ? ` · ${i18n.t("mf.frame_epoch", { n: f.epoch })}` : ""}`;
  }

  /** @type {any} */
  let lastFrame = null;

  function renderCurrent() {
    if (!view || !lastFrame) return;
    const frame = lastFrame;
    // WP-141: the top-K task shows the kept epoch's frame whatever the step (a list is the trained model's), and how far the walk has come
    const index = topk ? bestIndex(view.frames) : pinned !== null ? pinned : frameIndexFor(frame, view.frames);
    const open = targetOpen(frame);
    const stage = topk ? topkStage(frame) : { scores: true, cut: true };
    const marks = highlightSets(frame.highlights);
    const key = `${index}|${open}|${stage.scores}|${stage.cut}|${[...marks.rows]}|${[...marks.cols]}|${[...marks.dim]}|${[...marks.cells.entries()]}`;
    if (key === lastKey) return;
    lastKey = key;
    paint(index, open, marks, stage);
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      view = trace.views?.factors || null;
      lastFrame = null;
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!view) return;
      // a chosen frame holds while the player stays on the step; the next step goes back to following it
      if (pinned !== null && frame.index !== pinnedAt) pinned = null;
      lastIndex = frame.index;
      lastFrame = frame;
      renderCurrent();
    },
  };
}
