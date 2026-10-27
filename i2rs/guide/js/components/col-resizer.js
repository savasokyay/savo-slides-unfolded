// @ts-check
// WP-116 (round 2): draggable column edges for a table - the reader sets the widths, the browser keeps them. The pattern of
// components/splitter.js (the panel dividers of the uCF / iCF pages): a handle with `role="separator"`, focusable, moved by a pointer drag or
// the arrow keys (two points per press, Home / End the limits), a double click returns to the defaults, the choice is kept in localStorage.
// The handle sits at the right edge of a heading cell, between that column and the next; the table gets a `<colgroup>` whose `<col>` widths
// are percentages of the table (fixed layout: the widths are authoritative, long text wraps inside its cell). The arithmetic is
// util/col-widths.js (hand-checked under node); this file is DOM and events only.

import { clearShares, deltaShare, moveBoundary, normalizeShares, readShares, saveShares, stepBoundary } from "../util/col-widths.js";
import { keyAction } from "../util/split-ratio.js";

/**
 * @param {HTMLTableElement} table with a `thead` whose first row has one heading cell per column
 * @param {{
 *   key: string, defaults: number[], storage?: Storage | null, label: string, hint: string,
 * }} ctx `key`: the localStorage key (util/col-widths.js `sharesKey`); `defaults`: the shares when the reader has chosen nothing (any
 *   positive numbers, scaled to 100); `label` / `hint`: the handle's accessible name and tooltip (already translated)
 * @returns {{readonly shares: number[], reset: () => void}}
 */
export function makeColumnsResizable(table, ctx) {
  const heads = /** @type {HTMLElement[]} */ ([...table.querySelectorAll("thead tr:first-child > th")]);
  const n = ctx.defaults.length;
  const defaults = normalizeShares(ctx.defaults);
  let shares = readShares(ctx.storage, ctx.key, n) ?? defaults.slice();

  const group = document.createElement("colgroup");
  const cols = defaults.map(() => document.createElement("col"));
  group.append(...cols);
  table.insertBefore(group, table.firstChild);
  table.classList.add("col-resizable");

  /** @type {HTMLElement[]} */
  const handles = [];

  /** draws the shares and tells assistive technology the edge's position (the left column's share) */
  function apply() {
    cols.forEach((col, i) => {
      col.style.width = `${shares[i]}%`;
    });
    handles.forEach((handle, i) => {
      handle.setAttribute("aria-valuenow", String(Math.round(shares[i])));
    });
  }

  /**
   * @param {number[]} next
   * @param {boolean} [choose] the reader chose it: it is kept from now on (what was read back at the start is not written again)
   */
  function set(next, choose = false) {
    shares = next;
    apply();
    if (choose) saveShares(ctx.storage, ctx.key, shares);
  }

  for (let i = 0; i < Math.min(n, heads.length) - 1; i += 1) {
    const handle = document.createElement("span");
    handle.className = "col-resizer";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", ctx.label);
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    handle.title = ctx.hint;
    handle.tabIndex = 0;
    heads[i].appendChild(handle);
    handles.push(handle);

    // a pointer drag: window-level listeners, so it follows the pointer outside the thin handle and needs no pointer capture
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const start = shares.slice();
      const tablePx = table.getBoundingClientRect().width; // constant for the whole drag
      const startX = event.clientX;
      handle.classList.add("dragging");
      const body = document.body;
      const previous = body.style.userSelect;
      body.style.userSelect = "none"; // no text gets selected while the pointer sweeps over the cells
      /** @param {PointerEvent} e */
      const move = (e) => set(moveBoundary(start, i, deltaShare(e.clientX - startX, tablePx)));
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        handle.classList.remove("dragging");
        body.style.userSelect = previous;
        set(shares, true); // the drag's end is the choice: write it once
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });

    handle.addEventListener("keydown", (event) => {
      event.stopPropagation(); // the arrows belong to the edge while it has the focus
      const action = keyAction(event.key, "x");
      if (!action) return;
      event.preventDefault();
      if (action.type === "step") set(stepBoundary(shares, i, action.direction), true);
      else set(moveBoundary(shares, i, action.type === "min" ? -Infinity : Infinity), true);
    });

    handle.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      clearShares(ctx.storage, ctx.key); // back to the defaults, and nothing left in the browser
      set(defaults.slice());
    });
  }
  apply();

  return {
    get shares() {
      return shares;
    },
    reset() {
      clearShares(ctx.storage, ctx.key);
      set(defaults.slice());
    },
  };
}
