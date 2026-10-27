// @ts-check
// WP-222b: the leaderboard of the switching hybrid (the Leaderboard tab of `#/combine?m=switching`): a bar per error measure (MAE, RMSE) for every base, drawn from the rows of the
// `leaderboard` table the engine sends (engines/hybrid/explain_switching.py; its contract has no view for it - "the page draws its bars"), revealed one base at a time with the score steps
// (the table's own `reveal_upto`), the winner marked once the walk has chosen (the choice phase) - with a pill and a bold name, never by a colour alone. The foil (the winner picked on the
// training ratings) marks the right way's best beside it when the two differ. The neighbour rule has no winner: its Leaderboard tab shows the rule's coverage instead - how many of the
// held-out ratings the collaborative base answered and how many went to the content base - and the rule's own two errors as a third row under the two bases (the rule helps only if it beats
// both). The bars' unit is the largest error of the whole run, so nothing rescales while the rows appear. The figures stand beside the bars in text tokens, and the leaderboard table under
// the bars holds the same numbers (the chart's table view).
// Colours: the two series wear the page's own navy and maroon mixed towards the card (css/hybrid.css `--hybrid-bar-mae` / `--hybrid-bar-rmse`: the plain tokens are too deep for a fill
// in the light theme and too pale in the dark one; the mixes were checked for colour-vision separation in both themes). The coverage bar's two segments are neutral greys with the base's
// name and count written on them: a segment is told by its label, not by a hue.

import { phaseReached } from "../util/column-phase.js";
import { fmt } from "../util/format.js";

/** the two error measures, in the order of the bars under each base and of the legend (the leaderboard table's own order) */
const MEASURES = /** @type {const} */ (["mae", "rmse"]);
/** the phase that decides: the bucket's winner is known, the rule has been applied to every held-out rating (engines/hybrid/explain_switching.py) */
const CHOICE_PHASE = "choice";

/**
 * @param {HTMLElement} root the host of the Leaderboard tab, above the leaderboard table
 * @param {{i18n: any}} ctx
 */
export function createHybridBoard(root, ctx) {
  /** @type {any} */
  let table = null;
  /** @type {any} */
  let result = null;
  /** @type {string[]} */
  let phaseIds = [];
  /** one entry per row of the leaderboard table, in its order @type {{el: HTMLElement, id: string, pill: HTMLElement}[]} */
  let rows = [];
  /** the rule's own row and its coverage bar (the neighbour rule only), shown from the choice on @type {HTMLElement[]} */
  let ruleParts = [];
  /** @type {string | null} */
  let lastKey = null;

  /** @param {unknown} v @returns {v is number} */
  const finite = (v) => typeof v === "number" && Number.isFinite(v);

  /**
   * One row of bars: the name with its (hidden) pill, then a bar and its figure per measure.
   * @param {string} label the name beside the bars (a base's table name, or "the rule")
   * @param {Record<string, unknown>} values the row's `mae` and `rmse`
   * @param {number} unit the largest error of the run: the width of a full bar
   * @param {Record<string, number>} decimals the decimals of each measure's column (the bars write the same figure as the table)
   */
  function barRow(label, values, unit, decimals) {
    const { i18n } = ctx;
    const row = document.createElement("div");
    row.className = "hybrid-bar-row";
    const head = document.createElement("div");
    head.className = "hybrid-bar-label";
    const name = document.createElement("span");
    name.className = "hybrid-bar-name";
    name.textContent = label;
    const pill = document.createElement("span");
    pill.className = "pill hybrid-bar-pill";
    pill.hidden = true;
    head.append(name, pill);
    row.appendChild(head);
    for (const measure of MEASURES) {
      const value = values[measure];
      const written = finite(value) ? fmt(value, decimals[measure]) : "—";
      const line = document.createElement("div");
      line.className = `hybrid-bar-line ${measure}`;
      const track = document.createElement("div");
      track.className = "hybrid-bar-track";
      const bar = document.createElement("div");
      bar.className = `hybrid-bar ${measure}`;
      bar.style.width = finite(value) ? `${Math.max(0, Math.min(100, (100 * value) / unit))}%` : "0%";
      track.appendChild(bar);
      const figure = document.createElement("span");
      figure.className = "hybrid-bar-value";
      figure.textContent = written;
      line.append(track, figure);
      line.title = i18n.t("hybrid.walk.switch.bar_tip", { base: label, measure: measure.toUpperCase(), value: written, n: finite(result?.n_heldout) ? result.n_heldout : "—" });
      row.appendChild(line);
    }
    return { row, pill };
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      table = trace.tables?.leaderboard || null;
      result = trace.result || null;
      phaseIds = (trace.phases || []).map((/** @type {{id: string}} */ p) => p.id);
      rows = [];
      ruleParts = [];
      lastKey = null;
      root.innerHTML = "";
      const list = Array.isArray(table?.rows) ? table.rows : [];
      if (!list.length) {
        const p = document.createElement("p");
        p.className = "formula-idle";
        p.textContent = ctx.i18n.t("hybrid.walk.switch.no_board");
        root.appendChild(p);
        return;
      }
      const { i18n } = ctx;
      const rule = result?.rule === "neighbours";
      const criterion = result?.criterion === "mae" ? "mae" : "rmse";
      /** @type {Record<string, number>} */
      const decimals = { mae: 4, rmse: 4 };
      for (const col of table.columns || []) if (col.key === "mae" || col.key === "rmse") decimals[col.key] = col.decimals ?? 4;
      // the unit: the largest error anywhere in the run (the rule's own included), fixed before the first row shows
      const all = list.flatMap((/** @type {any} */ r) => MEASURES.map((m) => r[m])).filter(finite);
      if (rule) all.push(...[result?.rule_mae, result?.rule_rmse].filter(finite));
      const unit = Math.max(0, ...all) || 1;
      const board = document.createElement("div");
      board.className = "hybrid-board";
      // the legend: the two measures in their colours; the one that picks the winner says so (the rule has no winner: both read alike)
      const legend = document.createElement("div");
      legend.className = "hybrid-board-legend";
      for (const measure of MEASURES) {
        const item = document.createElement("span");
        item.className = `hybrid-legend-item ${measure}`;
        const swatch = document.createElement("span");
        swatch.className = `hybrid-legend-swatch ${measure}`;
        const word = document.createElement("span");
        word.textContent = i18n.t(`col.hybrid_${measure}`) + (!rule && measure === criterion ? ` ${i18n.t("hybrid.walk.switch.legend_decides")}` : "");
        item.append(swatch, word);
        item.title = i18n.t(`hybrid.walk.switch.legend_${measure}_tip`);
        legend.appendChild(item);
      }
      board.appendChild(legend);
      for (const r of list) {
        const label = String(r.base ?? r.id ?? "");
        const { row, pill } = barRow(label, r, unit, decimals);
        row.dataset.base = String(r.id ?? "");
        row.hidden = true;
        board.appendChild(row);
        rows.push({ el: row, id: String(r.id ?? ""), pill });
      }
      if (rule) {
        // the rule's own misses under the two bases, and its coverage: the collaborative base answers where it had enough neighbours, the content base elsewhere
        const cf = String(list[0]?.base ?? "");
        const cb = String(list[1]?.base ?? "");
        const { row } = barRow(i18n.t("hybrid.walk.switch.rule_row"), { mae: result?.rule_mae, rmse: result?.rule_rmse }, unit, decimals);
        row.classList.add("is-rule");
        row.title = i18n.t("hybrid.walk.switch.rule_row_tip", { cf, cb });
        row.hidden = true;
        board.appendChild(row);
        const n = finite(result?.n_heldout) ? result.n_heldout : 0;
        const nCf = finite(result?.n_cf_used) ? Math.min(n, result.n_cf_used) : 0;
        const nCb = Math.max(0, n - nCf);
        const cover = document.createElement("div");
        cover.className = "hybrid-coverage";
        const caption = document.createElement("div");
        caption.className = "hybrid-coverage-caption";
        caption.textContent = i18n.t("hybrid.walk.switch.coverage", { cf, n_cf: nCf, cb, n_cb: nCb, n, m: finite(result?.min_neighbours) ? result.min_neighbours : 1 });
        const track = document.createElement("div");
        track.className = "hybrid-coverage-track";
        for (const [key, name, count] of /** @type {const} */ ([["cf", cf, nCf], ["cb", cb, nCb]])) {
          const seg = document.createElement("div");
          seg.className = `hybrid-coverage-seg ${key}`;
          seg.style.width = n > 0 ? `${(100 * count) / n}%` : "0%";
          seg.textContent = count > 0 ? `${name} ${count}` : "";
          seg.title = i18n.t("hybrid.walk.switch.coverage_seg_tip", { base: name, count, n });
          seg.hidden = count === 0; // an empty segment would still take the 2 px gap
          track.appendChild(seg);
        }
        cover.append(caption, track);
        cover.title = i18n.t("hybrid.walk.switch.coverage_tip");
        cover.hidden = true;
        board.appendChild(cover);
        ruleParts = [row, cover];
      }
      root.appendChild(board);
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!rows.length) return;
      const state = frame.tables?.leaderboard;
      const revealed = Math.max(0, Math.min(rows.length, state?.reveal_upto ?? 0));
      const chosen = phaseReached(phaseIds, frame.phase?.id ?? null, CHOICE_PHASE);
      const focus = state?.focus_rows || [];
      const key = `${revealed}|${chosen ? 1 : 0}|${focus.join(",")}`;
      if (key === lastKey) return;
      lastKey = key;
      const { i18n } = ctx;
      rows.forEach((r, i) => {
        r.el.hidden = i >= revealed;
        r.el.classList.toggle("is-focus", focus.includes(i));
        r.el.classList.remove("is-winner", "is-right");
        r.pill.hidden = true;
      });
      const rule = result?.rule === "neighbours";
      if (chosen && !rule) {
        const list = /** @type {any[]} */ (table.rows);
        const criterion = result?.criterion === "mae" ? "MAE" : "RMSE";
        // the winner: rank 1 on the board the choice uses (the training board under the foil), the result's own id when the table carries no rank
        const byRank = list.findIndex((r) => r.rank === 1);
        const at = byRank >= 0 ? byRank : list.findIndex((r) => r.id === result?.winner);
        if (at >= 0 && rows[at]) {
          rows[at].el.classList.add("is-winner");
          rows[at].pill.textContent = i18n.t("hybrid.walk.switch.board_winner");
          rows[at].pill.title = i18n.t("hybrid.walk.switch.board_winner_tip", { criterion });
          rows[at].pill.hidden = false;
        }
        // the foil: picked on the training ratings - the best on the held-out ratings (what the right way picks) stands beside it when the two differ
        if (result?.select_on === "train") {
          const right = list.findIndex((r) => r.id === result?.winner_right);
          if (right >= 0 && right !== at && rows[right]) {
            rows[right].el.classList.add("is-right");
            rows[right].pill.textContent = i18n.t("hybrid.walk.switch.board_right");
            rows[right].pill.title = i18n.t("hybrid.walk.switch.board_right_tip");
            rows[right].pill.hidden = false;
          }
        }
      }
      for (const part of ruleParts) part.hidden = !chosen;
    },
    destroy() {
      root.innerHTML = "";
      rows = [];
      ruleParts = [];
    },
  };
}
