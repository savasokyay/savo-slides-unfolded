// @ts-check
// WP-83: the sortable, selectable table of the Users / Items pages. It knows nothing about users or
// items: a page hands it columns (header text, optional sort key, a cell renderer) and rows, and
// gets `onSort(key, dir)` / `onSelect(row)` back. Layout is FIXED (`<colgroup>` widths) so a sort
// change - which swaps which rows are on screen - never makes a column jump; the sort indicator
// has a reserved width for the same reason.
//
// Also exported: the client-side filter + sort the static export falls back to (a bundle has no
// server to ask). It applies the SAME rules as `services.cohort_order` on the server: a missing
// value sorts last in BOTH directions, ties break by the dense index, text columns sort by a
// natural, case- and accent-insensitive key ("User2" before "User10").

/**
 * @typedef {Object} CohortColumn
 * @property {string} key stable id (`th[data-key]` falls back to it when there is no sort key)
 * @property {string} label header text
 * @property {string} [sortKey] API sort key; absent = not sortable
 * @property {boolean} [textual] sorts ascending on the first click (names), else descending
 * @property {boolean} [num] right-aligned tabular numerals
 * @property {boolean} [muted] WP-95 (22): a secondary column - header and cells in the muted ink
 * @property {boolean} [optional] WP-95 (25): left out while the table box is too narrow for every column's width
 *   (instead of a horizontal scrollbar); the table decides by its own width, not by a fixed breakpoint
 * @property {number} [narrowWidth] WP-95 (25): px this column shrinks to (its cell cuts the text, the tooltip keeps
 *   it) when the box is still too narrow after the optional columns are gone
 * @property {number} [width] px; the one column without a width takes the remaining space
 * @property {number} [minWidth] px, for the flexible column
 * @property {string} [title] header tooltip
 * @property {(row: any) => Node | string} render
 */

/**
 * @param {string} tag
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** WP-95 (25): px kept free for the vertical scrollbar, so the decision to narrow the table does not flip with the
 *  number of rows on screen (a short list has no scrollbar, a long one does). */
const SCROLLBAR_ROOM = 18;

/**
 * @param {HTMLElement} root
 * @param {{
 *   columns: CohortColumn[],
 *   onSort: (key: string, dir: "asc" | "desc") => void,
 *   onSelect: (row: any) => void,
 * }} opts
 */
export function createCohortTable(root, { columns, onSort, onSelect }) {
  const wrap = el("div", "table-wrap");
  const table = el("table", "data-table cohort-table");
  table.setAttribute("role", "grid");
  const colgroup = el("colgroup");
  const thead = el("thead");
  const headRow = el("tr");
  // WP-95 (25): the table's width needs at three levels - every column; without the optional ones; and with the
  // columns that can shrink at their narrow width
  let minTotal = 0;
  let coreTotal = 0;
  let tightTotal = 0;
  /** @type {Map<string, CohortColumn>} */
  const bySortKey = new Map();
  for (const col of columns) {
    const colEl = el("col");
    if (col.width) colEl.style.width = `${col.width}px`;
    if (col.optional) colEl.className = "col-optional"; // WP-95 (25)
    colgroup.appendChild(colEl);
    const need = col.width ?? col.minWidth ?? 0;
    minTotal += need;
    if (!col.optional) {
      coreTotal += need;
      tightTotal += col.narrowWidth ?? need;
    }

    const th = el("th");
    th.dataset.key = col.sortKey || col.key;
    th.setAttribute("role", "columnheader");
    if (col.num) th.classList.add("num");
    if (col.muted) th.classList.add("col-muted"); // WP-95 (22)
    if (col.optional) th.classList.add("col-optional"); // WP-95 (25)
    if (col.title) th.title = col.title;
    if (col.sortKey) {
      bySortKey.set(col.sortKey, col);
      th.setAttribute("aria-sort", "none");
      const btn = /** @type {HTMLButtonElement} */ (el("button", "sort-btn"));
      btn.type = "button";
      btn.dataset.key = col.sortKey;
      const text = el("span", "sort-label");
      text.textContent = col.label;
      const ind = el("span", "sort-ind");
      ind.setAttribute("aria-hidden", "true");
      btn.append(text, ind);
      btn.addEventListener("click", () => {
        const key = /** @type {string} */ (col.sortKey);
        const dir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : col.textual ? "asc" : "desc";
        onSort(key, dir);
      });
      th.appendChild(btn);
    } else {
      th.textContent = col.label;
    }
    headRow.appendChild(th);
  }
  table.style.minWidth = `${minTotal}px`;
  thead.appendChild(headRow);
  const tbody = el("tbody");
  table.append(colgroup, thead, tbody);
  wrap.appendChild(table);
  root.appendChild(wrap);

  // WP-95 (25): while the table box cannot hold every column at its width (the card open beside the table, a narrow
  // window) the table narrows itself instead of growing a horizontal scrollbar: level 1 leaves out the optional columns
  // (Min, Max), level 2 also shrinks the columns that can (Genres). The rule is the box's own width against the columns'
  // totals, not a fixed breakpoint, so it holds for the Users table (narrower) and the Items table (wider) alike, and a
  // wide screen keeps every column at its width.
  let level = 0;
  /** @returns {number} the columns on screen */
  function shownColumns() {
    return level >= 1 ? columns.filter((c) => !c.optional).length : columns.length;
  }
  function fit() {
    const room = wrap.getBoundingClientRect().width;
    if (!room) return; // not laid out yet
    let next = 0;
    if (coreTotal < minTotal && room < minTotal + SCROLLBAR_ROOM) next = 1;
    if (tightTotal < coreTotal && room < coreTotal + SCROLLBAR_ROOM) next = 2;
    if (next === level) return;
    level = next;
    table.classList.toggle("narrow", level >= 1);
    table.style.minWidth = `${[minTotal, coreTotal, tightTotal][level]}px`;
    columns.forEach((col, i) => {
      if (col.narrowWidth && col.width) /** @type {HTMLElement} */ (colgroup.children[i]).style.width = `${level >= 2 ? col.narrowWidth : col.width}px`;
    });
    const message = tbody.querySelector("tr.message-row td");
    if (message) /** @type {HTMLTableCellElement} */ (message).colSpan = shownColumns();
  }
  const watcher = typeof ResizeObserver === "function" ? new ResizeObserver(() => fit()) : null;
  watcher?.observe(wrap);
  fit();

  /** @type {{key: string, dir: "asc" | "desc"}} */
  let sort = { key: "", dir: "desc" };
  /** @type {any[]} */
  let rows = [];
  /** @type {number | null} */
  let selected = null;

  /** @param {EventTarget | null} target */
  function rowOf(target) {
    const tr = /** @type {HTMLElement | null} */ (target instanceof Element ? target.closest("tr[data-index]") : null);
    if (!tr) return null;
    return rows.find((r) => String(r.index) === tr.dataset.index) ?? null;
  }
  tbody.addEventListener("click", (e) => {
    const row = rowOf(e.target);
    if (row) onSelect(row);
  });
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = rowOf(e.target);
    if (!row) return;
    e.preventDefault();
    onSelect(row);
  });

  function paintSelection() {
    for (const tr of tbody.querySelectorAll("tr[data-index]")) {
      const on = selected !== null && /** @type {HTMLElement} */ (tr).dataset.index === String(selected);
      tr.classList.toggle("selected", on);
      tr.setAttribute("aria-selected", String(on));
    }
  }

  return {
    el: wrap,
    /** @param {string} key @param {"asc" | "desc"} dir */
    setSort(key, dir) {
      sort = { key, dir };
      for (const th of headRow.querySelectorAll("th")) {
        const active = bySortKey.has(th.dataset.key || "") && th.dataset.key === key;
        th.classList.toggle("sorted", active);
        if (bySortKey.has(th.dataset.key || "")) {
          th.setAttribute("aria-sort", active ? (dir === "asc" ? "ascending" : "descending") : "none");
          const ind = th.querySelector(".sort-ind");
          if (ind) ind.textContent = active ? (dir === "asc" ? "▲" : "▼") : "";
        }
      }
    },
    /** @param {any[]} next @param {number | null} [sel] */
    setRows(next, sel = null) {
      rows = next;
      selected = sel;
      tbody.innerHTML = "";
      for (const row of rows) {
        const tr = el("tr");
        tr.dataset.index = String(row.index);
        tr.tabIndex = 0;
        tr.setAttribute("role", "row");
        for (const col of columns) {
          const td = el("td");
          td.setAttribute("role", "gridcell");
          td.dataset.col = col.key;
          if (col.num) td.classList.add("num");
          if (col.muted) td.classList.add("col-muted"); // WP-95 (22)
          if (col.optional) td.classList.add("col-optional"); // WP-95 (25)
          const cell = col.render(row);
          if (typeof cell === "string") td.textContent = cell;
          else td.appendChild(cell);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      paintSelection();
    },
    /** @param {number | null} sel */
    setSelected(sel) {
      selected = sel;
      paintSelection();
    },
    /** One full-width message row (loading / empty / error) instead of data rows. @param {string} text */
    setMessage(text) {
      rows = [];
      tbody.innerHTML = "";
      const tr = el("tr", "message-row");
      const td = el("td");
      td.colSpan = shownColumns(); // WP-95 (25)
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    },
    destroy() {
      watcher?.disconnect(); // WP-95 (25)
      wrap.remove();
    },
  };
}

// ── client-side filter + sort (static export) ───────────────────────────────────────────────────

/**
 * Natural, case- and accent-insensitive key of a label: diacritics dropped, digit runs zero-padded
 * to 12 places (the JS twin of `profile_stats._sort_key`).
 * @param {unknown} label
 */
export function naturalKey(label) {
  return String(label)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\d+/g, (m) => m.padStart(12, "0"));
}

/**
 * Rows ordered like the server orders them (`services.cohort_order`).
 * @param {any[]} rows
 * @param {string} key a field of the row; `label` / `title` sort by the natural key
 * @param {"asc" | "desc"} dir
 * @returns {any[]}
 */
export function sortRows(rows, key, dir) {
  const text = key === "label" || key === "title";
  /** @param {any} r */
  const value = (r) => (text ? naturalKey(r[key]) : r[key]);
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const missingA = va === null || va === undefined || Number.isNaN(va);
    const missingB = vb === null || vb === undefined || Number.isNaN(vb);
    if (missingA || missingB) return missingA === missingB ? a.index - b.index : missingA ? 1 : -1;
    if (va === vb) return a.index - b.index;
    return (va < vb ? -1 : 1) * sign;
  });
}

/**
 * Substring search on the display label (casefold) + the cohort / origin filter + (WP-95) the threshold.
 * @param {any[]} rows
 * @param {{q?: string, labelKey: string, filterKey: string, filterValue?: string, minKey?: string, minValue?: number}} spec
 *   `labelKey` is `label` / `title`; `filterKey` is `cohort` (users) / `origin` (items); `minKey` is the row's count
 *   field (`n_ratings` / `n_raters`), kept when it is at least `minValue`
 * @returns {any[]}
 */
export function filterRows(rows, { q = "", labelKey, filterKey, filterValue = "", minKey, minValue = 0 }) {
  const needle = q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!needle || String(r[labelKey]).toLowerCase().includes(needle)) &&
      (!filterValue || r[filterKey] === filterValue) &&
      (!minKey || Number(r[minKey]) >= minValue) // WP-95 (21): "Raters >= n" / "Ratings >= n"
  );
}
