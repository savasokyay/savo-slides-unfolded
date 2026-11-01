// @ts-check
// WP-248: the Hybrid DNN page's "Values" tab (the sub-matrix panel's third) - the vectors the network passes on for the pair on screen, one row per stage, in the order the walk visits them:
// the stage's name, how many numbers it holds ("32", or "19 of 32" where only some are non-zero), its first six numbers (a wide input its six largest, tagged) with "+26" for the rest, and the same six as small bars (the diagram's bars: one
// scale for the whole view, up = positive, down = negative, flat = zero). The step lights the row of the stage it is on and tints the rows that feed it (the join's six parts feed the join, the join
// feeds the first MLP layer), so the tab reads "these went in, this came out". The join's row says what it is made of instead of repeating the user embedding's first values. Only what the trace
// carries is shown (the first values and the counts), never a statistic of six numbers. The user's stages wear the users' colour at the left edge, the film's the films', the joined ones none
// (the Side inputs tab's cards do the same). Which tab is open is util/side-tab.js's rule and the page's; this module only draws.

import { barExtent } from "../util/network-layout.js";
import { keepInView } from "../util/scroll-within.js";
import { feederRows, litRows, valueText, valuesRows } from "../util/values-rows.js";

const NS = "http://www.w3.org/2000/svg";
const BAR_W = 7; // px per bar (the diagram's slim box uses the same)
const HALF = 8; // px above and below the baseline: the tallest bar

/**
 * @param {HTMLElement} root the tab's body
 * @param {{i18n: any}} ctx
 */
export function createValuesPanel(root, ctx) {
  /** the rows by their index in the network view @type {Map<number, HTMLElement>} */
  let rows = new Map();
  /** @type {string | null} */
  let lastKey = null;
  /** @type {any} */
  let view = null;

  /** @param {string} tag @param {string} [className] @param {string} [text] */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** The bars of a row: the first values on the view's one scale, up for a positive number, down for a negative one. @param {number[]} values @param {number} absMax */
  function bars(values, absMax) {
    const svg = document.createElementNS(NS, "svg");
    const width = Math.max(values.length, 1) * BAR_W + 2;
    svg.setAttribute("class", "values-bars-svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${2 * HALF}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(2 * HALF));
    svg.setAttribute("aria-hidden", "true");
    values.forEach((v, k) => {
      const h = Math.max((Math.abs(v) / absMax) * HALF, 0.5);
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(1 + k * BAR_W));
      rect.setAttribute("y", String(v >= 0 ? HALF - h : HALF));
      rect.setAttribute("width", String(BAR_W - 2));
      rect.setAttribute("height", String(h));
      rect.setAttribute("class", `net-bar ${v >= 0 ? "pos" : "neg"}`);
      svg.appendChild(rect);
    });
    const base = document.createElementNS(NS, "line");
    base.setAttribute("x1", "0");
    base.setAttribute("x2", String(width));
    base.setAttribute("y1", String(HALF));
    base.setAttribute("y2", String(HALF));
    base.setAttribute("class", "net-baseline");
    svg.appendChild(base);
    return svg;
  }

  /** @param {import("../util/values-rows.js").ValuesRow} entry @param {number} absMax @returns {HTMLElement} */
  function rowEl(entry, absMax) {
    const { i18n } = ctx;
    const tr = el("tr", `values-row side-${entry.side}`);
    tr.dataset.row = String(entry.row);
    const name = el("th", "values-name");
    name.scope = "row";
    const label = i18n.t(entry.labelKey);
    name.appendChild(el("span", "values-name-text", label));
    if (entry.activation === "relu" || entry.activation === "linear") {
      const act = i18n.t(`mf.values_act_${entry.activation}`);
      if (!label.toLowerCase().includes(act.toLowerCase())) name.appendChild(el("span", "values-act", act)); // "dense + ReLU" already says it
    }
    if (entry.largest) {
      const tag = el("span", "values-act", i18n.t("mf.values_largest")); // a wide input shows its six largest numbers, not its first six
      tag.title = i18n.t("mf.values_largest_tip");
      name.appendChild(tag);
    }
    tr.appendChild(name);
    tr.appendChild(el("td", "values-n", entry.nonzero !== null ? i18n.t("mf.net_nonzero", { nz: entry.nonzero, n: entry.size }) : String(entry.size)));
    const nums = el("td", "values-nums");
    if (entry.composition) {
      nums.classList.add("values-composition");
      nums.textContent = i18n.t("mf.values_join_of", { parts: entry.composition.join(" + ") });
    } else {
      for (const v of entry.values) nums.appendChild(el("span", `values-v${v === 0 ? " zero" : v < 0 ? " neg" : ""}`, valueText(v)));
      if (entry.more > 0) nums.appendChild(el("span", "values-more", `+${entry.more}`));
      if (entry.kind === "output") nums.appendChild(el("span", "values-note", i18n.t("mf.values_is_prediction")));
    }
    tr.appendChild(nums);
    const barCell = el("td", "values-bars");
    if (!entry.composition) barCell.appendChild(bars(entry.values, absMax));
    tr.appendChild(barCell);
    return tr;
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      root.replaceChildren();
      rows = new Map();
      lastKey = null;
      view = trace?.views?.network ?? null;
      const list = valuesRows(view);
      if (!list.length) {
        root.appendChild(el("p", "formula-idle", ctx.i18n.t("mf.values_none")));
        return;
      }
      const { i18n } = ctx;
      const absMax = barExtent(view.layers);
      root.appendChild(el("p", "values-note-line", i18n.t("mf.values_note")));
      const table = el("table", "values-table");
      const head = el("tr");
      for (const [cls, key] of /** @type {const} */ ([["values-name", "mf.values_col_stage"], ["values-n", "mf.values_col_n"], ["values-nums", "mf.values_col_first"], ["values-bars", ""]])) {
        const th = el("th", cls, key ? i18n.t(key) : "");
        th.scope = "col";
        head.appendChild(th);
      }
      const thead = el("thead");
      thead.appendChild(head);
      const body = el("tbody");
      for (const entry of list) {
        const tr = rowEl(entry, absMax);
        rows.set(entry.row, tr);
        body.appendChild(tr);
      }
      table.append(thead, body);
      root.appendChild(table);
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!rows.size) return;
      const lit = litRows(frame.highlights);
      const fed = feederRows(view, lit);
      const key = `${[...lit].sort().join(",")}|${[...fed].sort().join(",")}`;
      if (key === lastKey) return;
      lastKey = key;
      for (const [row, node] of rows) {
        node.classList.toggle("hl-active", lit.has(row));
        node.classList.toggle("hl-in", fed.has(row));
      }
      const first = [...lit].map((row) => rows.get(row)).find(Boolean);
      if (first && !root.hidden) keepInView(root, first); // a short window: the body scrolls inside, never the page
    },
    /** the tab has just come on screen: the lit row may be out of the body's view @returns {void} */
    shown() {
      const first = root.querySelector(".values-row.hl-active");
      if (first) keepInView(root, first);
    },
  };
}
