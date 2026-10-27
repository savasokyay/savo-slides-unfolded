// @ts-check
// WP-32: a trace table (e.g. the candidate leaderboard). Rows are emitted in candidate order by
// the engine; the player frame says how many are revealed so far, which rows are in focus and
// whether to sort (`sort_by`), and the sort is animated with FLIP.

import { fmt } from "../util/format.js";
import { flagPill } from "../util/flags.js";
import { fillClampedTitle } from "../util/title-clamp.js"; // WP-135
import { entityLabel } from "../util/user-link.js"; // WP-96 / WP-99
import { cellPhase, phaseReached, rankMove } from "../util/column-phase.js"; // WP-108
import { colTipText } from "../util/col-tip.js"; // WP-115 (9b)
import { colourOf, signed } from "../util/heat-centred.js"; // WP-176 (stage 2)

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, tableId: string, flagColumn?: string, headExtra?: HTMLElement | null, showAll?: boolean, signed?: string[], headLead?: HTMLElement | null, focusLink?: {from: string, key: string}, follow?: boolean, showOnReference?: boolean, tipKeys?: Record<string, string>, columnOrder?: string[], clampKeys?: string[], alias?: Record<string, string>, decorate?: (col: any, row: any, td: HTMLElement) => void, keepCase?: string[], keepCaseParams?: boolean}} ctx `flagColumn` (WP-91 stage 2): the
 *   key of the text column naming an item - `setFlags` puts the data-quality pills under its label; `headExtra` (WP-107 g2): an
 *   element put at the right end of the title row, again at every redraw (the zoom group of the uCF / iCF candidate panel)
 *   WP-176 (stage 2): `showAll` - every row is shown while the table is on screen (a table the walk does not reveal row by row: the TF-IDF table, the taste profile's explanation
 *   table); `signed` - the keys of the number columns that are drawn with a sign and the centred diverging tint (strength: the figure over the largest in its column)
 *   WP-176 (stage 3): the content page's lower-right panel shows one of three tables behind a tab strip. `headLead` - an element (the strip) that takes the place of the title text at the
 *   start of the head row (put again at every redraw, like `headExtra`); `setTable(id, frame)` - show another table of the trace (the strip's click and the player's choice); `focusLink`
 *   - the rows of this table are focused by the focused row of another: the rows whose `key` equals that row's (the field parts of the candidate the walk is on); `follow` - the wrap
 *   scrolls to keep the focused rows in view (the walk reveals a row per step: without it the row the narration is about falls under the fold of a five-row panel), and goes back to the
 *   top when the table is sorted (the ranking shows the best first); `showOnReference` - a table whose steps carry no `reveal_upto` (the prediction shares: the step names the table, the
 *   engine sends no count) shows every row from the first step that references it on (the player's state cannot tell "referenced with no count" from "not yet referenced");
 *   `tipKeys` (stage 4) - the i18n key of a column's hover sentence by the column's KEY, ahead of the lookup by its label (the MMR table's film column carries the label `item`, whose
 *   sentence says "an item the active user has rated": here it is a film the user has NOT rated); `columnOrder` (stage 4) - the keys of the columns to put first, in this order (the
 *   rest follow in the engine's order: the narrow panel shows what the lesson is about before the scroll begins); `clampKeys` - text columns whose cell is cut with an ellipsis (the
 *   full text is the cell's hover text), so one long film title does not push the numbers out of the panel
 *   WP-233: `alias` - display names: a text cell, or a value of a column's label parameters, that equals a key is drawn as its value (the hybrid page says CBF where the engine's tables say CB);
 *   `decorate(col, row, td)` - called for every plain cell once its text is set, so a page can dress one column (the bases table's name cell: badge, link, settings tip) without a table of its own
 *   WP-235: `keepCase` - the keys of the columns whose head is not upper-cased (a Greek letter would turn into its capital: "α" -> "Α", "β₀" -> "Β₀"); `keepCaseParams` - in every head the value of
 *   a label parameter (the base's name in "weight · uCF") keeps its own case while the rest of the head is upper-cased as the others
 */
export function createDataTable(root, ctx) {
  /** WP-176 (stage 3): the table on screen; `ctx.tableId` is where it starts @type {string} */
  let tableId = ctx.tableId;
  /** the trace and the last frame, so a table switch can draw the new table and bring it to the step on screen @type {any} */
  let lastTrace = null;
  /** @type {any} */
  let lastFrame = null;
  /** the index of the first step that references the table on screen (-1: none) @type {number} */
  let firstRef = -1;
  /** the columns in the order they are drawn (`ctx.columnOrder` first) @type {any[]} */
  let columns = [];
  /** the sort the wrap was last scrolled for (a sort change brings it back to the top) @type {string | null} */
  let followedSort = null;
  /** @type {any} */
  let table = null;
  /** @type {HTMLTableRowElement[]} */
  let rowEls = [];
  /** @type {HTMLTableSectionElement | null} */
  let tbody = null;
  /** @type {string | null} */
  let currentSort = null;
  /** WP-108 (c): the cells of the columns that belong to a phase (masked "?" until the player reaches it); `tip` (WP-115 11): the hover sentence of a status cell, shown
   *  only once the status is (it would give the answer away behind the "?") @type {{td: HTMLElement, phase: string, tip?: string}[]} */
  let phasedCells = [];
  /** WP-108 (c): the rank-move markers (an arrow beside the rank when significance weighting moved it) @type {{el: HTMLElement, moved: boolean}[]} */
  let moveMarks = [];

  /**
   * @param {any} col
   * @param {unknown} value
   */
  function cellText(col, value) {
    if (value === null || value === undefined) return "—";
    if (col.key === "field" && col.kind === "text") {
      // WP-176 (stage 2): the name of a content field as the Parameters panel writes it (`params.field_<name>`), the raw name when there is none
      const key = `params.field_${value}`;
      const named = ctx.i18n.t(key);
      return named === key ? String(value) : named;
    }
    switch (col.kind) {
      case "int":
        return String(Math.trunc(Number(value)));
      case "pct":
        return `${(Number(value) * 100).toFixed(1)}%`;
      case "bool":
        return value ? "✓" : "—";
      case "text":
        // WP-176 (stage 4): the MMR table's `moved` says what the re-ranking did to the film (status.moved_up ... moved_left)
        // WP-233: `alias` - a name the page writes in its own words (the engine's `CB` is `CBF` on the hybrid page)
        return col.key === "status" ? ctx.i18n.t(`status.${value}`) : col.key === "moved" ? ctx.i18n.t(`status.moved_${value}`) : (ctx.alias?.[String(value)] ?? String(value));
      default:
        return fmt(Number(value), col.decimals ?? 4);
    }
  }

  /**
   * WP-233: a column's label parameters with the page's display names put in (`alias`: the value `CB` of `{base: "CB"}` reads `CBF` in the head and its tip); the parameters themselves are the trace's.
   * @param {Record<string, unknown> | undefined} params
   */
  function aliased(params) {
    if (!ctx.alias || !params) return params ?? {};
    return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === "string" && ctx.alias?.[v] !== undefined ? ctx.alias[v] : v]));
  }

  /**
   * WP-235: the value of a label parameter that stands in a head keeps its own case: the head's text is cut around the first such value and the value goes into a `.keep-case` span (app.css),
   * so "weight · uCF" is drawn "WEIGHT · uCF". The text a reader copies is unchanged.
   * @param {HTMLElement} th
   * @param {Record<string, unknown>} params
   */
  function keepParamCase(th, params) {
    const text = th.textContent ?? "";
    for (const value of Object.values(params)) {
      if (typeof value !== "string" || value === "") continue;
      const at = text.indexOf(value);
      if (at < 0) continue;
      const span = document.createElement("span");
      span.className = "keep-case";
      span.textContent = value;
      th.replaceChildren(text.slice(0, at), span, text.slice(at + value.length));
      return;
    }
  }

  /**
   * WP-115 (11): the hover sentence of a status cell (`status_tip.<status>`: the cell itself says only "w ≤ 0"); "" for any other column or a status without one.
   * @param {any} col
   * @param {unknown} value
   */
  function statusTip(col, value) {
    if (col.key !== "status") return "";
    const text = ctx.i18n.t(`status_tip.${value}`);
    return text === `status_tip.${value}` ? "" : text;
  }

  function build() {
    root.innerHTML = "";
    rowEls = [];
    tbody = null;
    currentSort = null;
    phasedCells = [];
    moveMarks = [];
    followedSort = null;
    firstRef = (lastTrace?.steps || []).findIndex((/** @type {{tables?: {table_id?: string}[]}} */ st) => (st.tables || []).some((t) => t.table_id === tableId));
    if (!table) return;
    const first = (ctx.columnOrder ?? []).map((key) => table.columns.find((/** @type {any} */ c) => c.key === key)).filter(Boolean);
    columns = [...first, ...table.columns.filter((/** @type {any} */ c) => !first.includes(c))];
    const head = document.createElement("div");
    head.className = "table-head";
    if (ctx.headLead) head.appendChild(ctx.headLead); // WP-176 (stage 3): the tab strip names the table; its title is the tab's hover sentence
    else head.textContent = ctx.i18n.t(table.title_key, table.title_params || {}); // WP-48: title params
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = String(table.total_rows);
    head.appendChild(pill);
    if (ctx.headExtra) head.appendChild(ctx.headExtra);
    root.appendChild(head);

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const el = document.createElement("table");
    el.className = "data-table";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const col of columns) {
      const th = document.createElement("th");
      th.textContent = ctx.i18n.t(col.label_key, aliased(col.label_params || {})); // WP-48: "P@{K}"; WP-233: aliased
      if (ctx.keepCaseParams) keepParamCase(th, aliased(col.label_params || {})); // WP-235
      // WP-108 (d): what the column is, as the head's tooltip - a column without an entry in `col_tip` has none (the other tables).
      // WP-115 (9b): looked up by the column's LABEL first (`col.c_raters` -> `col_tip.c_raters`), by its key second: the item-based table keeps the
      // user-based data fields under item-based labels, and its "common raters" head carried the user-based "co-rated" sentence
      // WP-208 (the ui half of WP-206): the column's `label_params` fill its tip as they fill its label - the g(t) column's tip said "a = {a}" verbatim
      const tip = ctx.tipKeys?.[col.key] ? ctx.i18n.t(ctx.tipKeys[col.key], aliased(col.label_params || {})) : colTipText((/** @type {string} */ k, /** @type {Record<string, unknown> | undefined} */ p) => ctx.i18n.t(k, aliased(p)), col); // WP-233: aliased
      if (tip) th.title = tip;
      if (col.kind === "number" || col.kind === "int" || col.kind === "pct") th.className = "num";
      if (ctx.keepCase?.includes(col.key)) th.classList.add("keep-case"); // WP-235: after the class above (it assigns `className`)
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    el.appendChild(thead);
    tbody = document.createElement("tbody");
    const hasRankRaw = columns.some((/** @type {any} */ c) => c.key === "rank_raw");
    /** WP-176 (stage 2): the largest figure of each signed column, the unit of its tint @type {Record<string, number>} */
    const signedMax = {};
    for (const key of ctx.signed ?? []) signedMax[key] = Math.max(0, ...table.rows.map((/** @type {any} */ r) => Math.abs(Number(r[key]) || 0)));
    table.rows.forEach((row, i) => {
      const trEl = document.createElement("tr");
      trEl.dataset.index = String(i);
      for (const col of columns) {
        const td = document.createElement("td");
        // WP-96: a user table (the candidates, the per-user metrics) links the user when the server
        // tagged the row (handles mode); otherwise the cell is the plain label as before
        if (table.entity === "user" && col.key === "user" && row.profile_url) {
          td.appendChild(entityLabel({ label: row.user, profile_url: row.profile_url }, { t: (k, p) => ctx.i18n.t(k, p) }));
        } else if (table.entity === "item" && (col.key === "item" || col.key === "cand" || col.key === "title")) {
          // WP-135: a film title that does not fit gives up its NAME, never its year; the cell is a row (`title-row`: the title, then the
          // data-quality flags `setFlags` adds), so a flag keeps its place beside a long title instead of being clipped with it
          const titleRow = document.createElement("span");
          titleRow.className = "title-row";
          if (row.film_url) {
            // WP-99: an item table (the candidate films) links each film; the server tags the row (every mode)
            titleRow.appendChild(entityLabel({ label: row[col.key], film_url: row.film_url }, { t: (k, p) => ctx.i18n.t(k, p), clamp: true })); // WP-176 (stage 3): `cand` names a film as `item` does
          } else {
            const name = document.createElement("span"); // the same clamp for a film without an address
            fillClampedTitle(name, cellText(col, row[col.key]));
            name.title = name.textContent ?? "";
            titleRow.appendChild(name);
          }
          td.appendChild(titleRow);
        } else if (cellPhase(col, row[col.key])) {
          // WP-108 (c): the number stays in the cell (hidden while masked), so the column never changes width when it appears
          // (e-ii: the phase may belong to this cell's VALUE - the status column masks `selected` / `cut_by_k` until the selection and shows
          // `non_positive` / `undefined` / `few_corated` with their row)
          const value = document.createElement("span");
          value.className = "cv";
          value.textContent = cellText(col, row[col.key]);
          td.appendChild(value);
          td.classList.add("phase-cell");
          phasedCells.push({ td, phase: /** @type {string} */ (cellPhase(col, row[col.key])), tip: statusTip(col, row[col.key]) });
        } else if ((ctx.signed ?? []).includes(col.key) && typeof row[col.key] === "number") {
          // WP-176 (stage 2): a sign on the figure and the centred diverging tint (the hue says the side, the strength the size; the figure carries the sign, so the colour is not the only cue)
          const v = /** @type {number} */ (row[col.key]);
          td.textContent = signed(v, col.decimals ?? 4);
          td.classList.add("sign-cell");
          const { arm, strength } = colourOf(v, signedMax[col.key] || 1);
          td.classList.add(`is-${arm}`);
          if (arm !== "zero") td.style.setProperty("--t", strength.toFixed(3));
        } else {
          td.textContent = cellText(col, row[col.key]);
          const tip = statusTip(col, row[col.key]);
          if (tip) td.title = tip; // WP-115 (11): a status that is shown with its row says what it means in full
          ctx.decorate?.(col, row, td); // WP-233
        }
        if (col.key === "rank" && hasRankRaw) {
          // the arrow is always in the cell (hidden when there is nothing to show): the rank column keeps one width
          const move = rankMove(row.rank_raw, row.rank);
          const mark = document.createElement("span");
          mark.className = `rank-move ${move ? move.dir : "none"} off`;
          mark.textContent = move && move.dir === "down" ? "▼" : "▲";
          if (move) mark.title = ctx.i18n.t(move.dir === "up" ? "table.rank_up" : "table.rank_down", { from: move.from, to: move.to });
          td.appendChild(mark);
          moveMarks.push({ el: mark, moved: move !== null });
        }
        // (classList, not className: the phase-cell class above must survive)
        if (col.kind === "number" || col.kind === "int" || col.kind === "pct") td.classList.add("num");
        if (col.key === "status") td.classList.add("status-cell", `status-${row[col.key]}`); // WP-115 (7): `status-cell` is the compact table's small text cell
        if (ctx.clampKeys?.includes(col.key)) {
          td.classList.add("clamp-cell"); // WP-176 (stage 4)
          td.title = td.textContent ?? "";
        }
        trEl.appendChild(td);
      }
      tbody.appendChild(trEl);
      rowEls.push(trEl);
    });
    el.appendChild(tbody);
    wrap.appendChild(el);
    root.appendChild(wrap);
    if (table.truncated) {
      const note = document.createElement("div");
      note.className = "heat-note";
      note.textContent = ctx.i18n.t("trace.truncated_rows", { n: table.total_rows - table.rows.length });
      root.appendChild(note);
    }
  }

  /** @param {string | null} sortBy */
  function sortRows(sortBy) {
    if (!tbody || sortBy === currentSort) return;
    const order = rowEls.map((_, i) => i);
    if (sortBy) {
      order.sort((a, b) => {
        const va = table.rows[a][sortBy];
        const vb = table.rows[b][sortBy];
        if (va === vb) return a - b;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return va < vb ? -1 : 1;
      });
    }
    const before = new Map(rowEls.map((el) => [el, el.getBoundingClientRect().top]));
    for (const i of order) tbody.appendChild(rowEls[i]);
    for (const el of rowEls) {
      const delta = (before.get(el) ?? 0) - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .35s ease";
        el.style.transform = "";
      });
    }
    currentSort = sortBy;
  }

  /**
   * WP-176 (stage 3): scroll the wrap so the focused rows are in view - only the wrap, never the page (`scrollIntoView` would move both).
   * @param {HTMLElement[]} rows
   */
  function followRows(rows) {
    const wrap = /** @type {HTMLElement | null} */ (root.querySelector(".table-wrap"));
    if (!wrap || !rows.length) return;
    const head = wrap.querySelector("thead");
    const stick = head ? head.getBoundingClientRect().height : 0; // the head row sticks over the first rows
    const box = wrap.getBoundingClientRect();
    const first = rows[0].getBoundingClientRect();
    const last = rows[rows.length - 1].getBoundingClientRect();
    if (first.top < box.top + stick) wrap.scrollTop -= box.top + stick - first.top;
    else if (last.bottom > box.bottom) wrap.scrollTop += Math.min(last.bottom - box.bottom, first.top - (box.top + stick));
  }

  /**
   * The rows this table focuses at a frame: its own `focus_rows`, else (`focusLink`) the rows that share the linked column's value with the other table's focused rows.
   * @param {any} frame
   * @param {number[]} own
   * @returns {number[]}
   */
  function focusedRows(frame, own) {
    if (own.length || !ctx.focusLink) return own;
    const { from, key } = ctx.focusLink;
    const source = lastTrace?.tables?.[from]?.rows;
    const keys = new Set((frame.tables?.[from]?.focus_rows || []).map((/** @type {number} */ i) => source?.[i]?.[key]).filter((/** @type {unknown} */ v) => v !== undefined));
    if (!keys.size) return own;
    return table.rows.flatMap((/** @type {any} */ r, /** @type {number} */ i) => (keys.has(r[key]) ? [i] : []));
  }

  function applyFrame(/** @type {any} */ frame) {
    if (!table) return;
    const state = frame.tables[tableId] || { reveal_upto: null, sort_by: null, focus_rows: [] };
    // WP-108 (c): a column that belongs to a phase shows its numbers from that phase on, "?" before it
    const phaseIds = (frame.trace?.phases || []).map((/** @type {{id: string}} */ p) => p.id);
    const now = frame.phase ? frame.phase.id : null;
    for (const cell of phasedCells) {
      const masked = !phaseReached(phaseIds, now, cell.phase);
      cell.td.classList.toggle("masked", masked);
      if (cell.tip) cell.td.title = masked ? "" : cell.tip; // WP-115 (11): no hover sentence behind a "?"
    }
    const rankReached = phaseReached(phaseIds, now, table.columns.find((/** @type {any} */ c) => c.key === "rank")?.phase) && phaseReached(phaseIds, now, table.columns.find((/** @type {any} */ c) => c.key === "rank_raw")?.phase);
    for (const mark of moveMarks) mark.el.classList.toggle("off", !(mark.moved && rankReached));
    const referenced = Boolean(ctx.showOnReference) && firstRef >= 0 && frame.index >= firstRef;
    const revealed = ctx.showAll ? rowEls.length : state.reveal_upto === null ? (state.sort_by || referenced ? rowEls.length : 0) : state.reveal_upto;
    const focus = focusedRows(frame, state.focus_rows);
    rowEls.forEach((el, i) => {
      el.classList.toggle("hidden-row", i >= revealed && !state.sort_by);
      el.classList.toggle("focus", focus.includes(i));
    });
    sortRows(state.sort_by);
    if (ctx.follow) {
      // a sorted table is reordered under the FLIP (its rows are not where they will be): the ranking starts at its best row instead, once per sort
      if (state.sort_by) {
        if (followedSort !== state.sort_by) {
          const wrap = /** @type {HTMLElement | null} */ (root.querySelector(".table-wrap"));
          if (wrap) wrap.scrollTop = 0;
        }
      } else followRows(focus.filter((i) => i < revealed).map((i) => rowEls[i]).filter(Boolean));
      followedSort = state.sort_by;
    }
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      lastTrace = trace;
      lastFrame = null;
      table = trace.tables?.[tableId] || null;
      build();
    },
    /**
     * WP-176 (stage 3): show another table of the trace; `frame` (the step on screen) brings it to the step's state at once.
     * @param {string} id
     * @param {any} [frame]
     */
    setTable(id, frame) {
      if (id === tableId && table) return;
      tableId = id;
      table = lastTrace?.tables?.[id] || null;
      build();
      const at = frame ?? lastFrame;
      if (at) applyFrame(at);
    },
    /** @returns {string} the table on screen */
    currentTable() {
      return tableId;
    },
    /**
     * WP-91 stage 2: data-quality flag pills (`unreleased` / `no_metadata` / `tv`) under the item
     * label of each row. `byCol` maps a dense item index (a row's `col`, as a string) to its flags;
     * rows without an entry have none. Idempotent - previous pills are replaced.
     * @param {Record<string, string[]>} byCol
     */
    setFlags(byCol) {
      if (!table || !tbody || !ctx.flagColumn) return;
      const at = columns.findIndex((/** @type {any} */ c) => c.key === ctx.flagColumn);
      if (at < 0) return;
      const t = (/** @type {string} */ key) => ctx.i18n.t(key);
      rowEls.forEach((trEl, i) => {
        const cell = trEl.children[at];
        if (!cell) return;
        cell.querySelector(".pf-flags")?.remove();
        const flags = byCol[String(table.rows[i].col)] || [];
        if (!flags.length) return;
        const box = document.createElement("span");
        box.className = "pf-flags";
        for (const f of flags) box.appendChild(flagPill(t, f));
        (cell.querySelector(".title-row") ?? cell).appendChild(box); // WP-135: beside the title, in its row
      });
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      lastFrame = frame;
      applyFrame(frame);
    },
  };
}
