// @ts-check
// WP-107 (h2) / (e2): a draggable divider between two panels of the uCF / iCF block - the Formula | Code columns (axis "x") and, in the
// right column, the flowchart over the candidate table (axis "y"). The handle is a child of the FIRST panel, sitting in the 12 px gap
// between the two (so no JavaScript positions it), 8 px wide, `role="separator"` with its value, focusable. The share of the first panel
// (percent of the pair's combined size) comes from the pointer (a drag) or the keyboard (two points per press, Home / End the ends);
// a double click returns to the default; the choice is kept per page in localStorage. The pair's combined size is constant during a
// drag, so the two panels always add up to the same. The arithmetic is util/split-ratio.js (hand-checked under node); this file is
// DOM and events only. The caller turns a share into layout (`apply`): a CSS variable on the grid.

// A divider the reader has not touched FOLLOWS its default (`range().def`), which may move with the window or the content (the
// flowchart / table divider: the chart's natural height) - `refresh()` redraws it; one the reader has moved keeps THEIR share (inside
// the limits of the moment).

import { clampRatio, clearRatio, keyAction, ratioFromDrag, readRatio, saveRatio, stepRatio } from "../util/split-ratio.js";

/**
 * @param {{
 *   axis: "x" | "y",
 *   before: HTMLElement, after: HTMLElement,
 *   range: () => import("../util/split-ratio.js").SplitRange,
 *   apply: (pct: number) => void,
 *   storage?: Storage | null, storageKey: string,
 *   label: string, hint: string,
 * }} ctx `before` / `after`: the two panels (the handle is appended to `before`); `range()` is asked afresh whenever it matters (the
 *   limits of a vertical split are in pixels, so in percent they depend on the window); `apply(pct)` draws a share
 */
export function createSplitter(ctx) {
  const { axis, before, after } = ctx;
  const handle = document.createElement("div");
  handle.className = `splitter splitter-${axis}`;
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", axis === "x" ? "vertical" : "horizontal");
  handle.setAttribute("aria-label", ctx.label);
  handle.title = ctx.hint;
  handle.tabIndex = 0;
  before.classList.add("has-splitter");
  before.appendChild(handle);

  /** the reader's share, kept by the browser: null = none, the divider follows the default */
  let chosen = readRatio(ctx.storage, ctx.storageKey, ctx.range());
  let pct = chosen ?? ctx.range().def;

  /** the size of a panel along the divider's axis @param {HTMLElement} el */
  const size = (el) => (axis === "x" ? el.getBoundingClientRect().width : el.getBoundingClientRect().height);

  /**
   * Draws a share and tells assistive technology about it.
   * @param {number} next
   * @param {boolean} [choose] the reader chose it: it is kept from now on (what was read back at the start is not written again)
   */
  function set(next, choose = false) {
    const range = ctx.range();
    pct = clampRatio(next, range);
    ctx.apply(pct);
    handle.setAttribute("aria-valuemin", String(Math.ceil(range.min)));
    handle.setAttribute("aria-valuemax", String(Math.floor(range.max)));
    handle.setAttribute("aria-valuenow", String(Math.round(pct)));
    if (choose) {
      chosen = pct;
      saveRatio(ctx.storage, ctx.storageKey, pct);
    }
  }

  /** a pointer drag: window-level listeners, so it follows the pointer outside the thin handle and needs no pointer capture */
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const startBefore = size(before);
    const total = startBefore + size(after); // constant for the whole drag: the pair's outer edges do not move
    const startPos = axis === "x" ? event.clientX : event.clientY;
    handle.classList.add("dragging");
    const body = document.body;
    const previous = body.style.userSelect;
    body.style.userSelect = "none"; // no text gets selected while the pointer sweeps over the panels
    /** @param {PointerEvent} e */
    const move = (e) => {
      const pos = axis === "x" ? e.clientX : e.clientY;
      set(ratioFromDrag(startBefore, pos - startPos, total, ctx.range()));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      handle.classList.remove("dragging");
      body.style.userSelect = previous;
      set(pct, true); // the drag's end is the choice: write it once
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });

  handle.addEventListener("keydown", (event) => {
    // the player listens on the window for the arrows and Space: a focused divider keeps its keys to itself
    event.stopPropagation();
    const action = keyAction(event.key, axis);
    if (!action) return;
    event.preventDefault();
    const range = ctx.range();
    if (action.type === "step") set(stepRatio(pct, action.direction, range), true);
    else set(action.type === "min" ? range.min : range.max, true);
  });

  handle.addEventListener("dblclick", () => {
    chosen = null; // back to the default - and the default is followed again
    clearRatio(ctx.storage, ctx.storageKey);
    set(ctx.range().def);
  });

  set(pct);

  return {
    /** the share now in force (percent of the first panel) */
    get pct() {
      return pct;
    },
    /** redraw with the range of the moment: the default moves with the window / content, a chosen share stays inside the limits */
    refresh() {
      set(chosen ?? ctx.range().def);
    },
    handle,
  };
}
