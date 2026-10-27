// @ts-check
// WP-41: EntityPicker - debounced substring search (150 ms) over users or items with the legacy
// demo_lecture.m guards as toggle chips ("≥ 23 ratings", "class user" / "≥ 5 raters", "rated by
// the user"). When the guarded search finds nothing the list falls back to an unguarded search and
// says so, instead of showing an empty box on a small dataset such as toy-5x6.

import { infoTip } from "../util/info-tip.js"; // WP-153
import { createOpenList } from "../util/open-list.js";
import { hasRating, itemQuery, marksRatings, ratingText } from "../util/picker-rating.js"; // WP-156

const DEBOUNCE_MS = 150;
const MAX_ROWS = 12;

// WP-104: at most one result list is open, on the whole page. The document listeners that close it (a pointer press or a
// focus move outside the picker that owns it, Escape) are installed once, at the first list that opens, not per picker.
const openList = createOpenList();
let documentWired = false;

function wireDocument() {
  if (documentWired) return;
  documentWired = true;
  document.addEventListener("pointerdown", (e) => openList.dismissOutside(e.target), true);
  document.addEventListener("focusin", (e) => openList.dismissOutside(e.target), true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") openList.dismiss();
  }, true);
}

/**
 * @typedef {Object} PickerGuards
 * @property {number} minRatings   users: minimum rating count (0 = off)
 * @property {boolean} requireClass users: class-cohort users only
 * @property {number} minRaters    items: minimum rater count (0 = off)
 * @property {boolean} ratedByUser items: only items the selected user rated
 */

/**
 * @param {HTMLElement} root
 * @param {{
 *   i18n: any, api: any, kind: "user" | "item", dataset: string,
 *   guards: PickerGuards, onSelect: (index: number, summary: any) => void,
 *   ratedBy?: number | null, exclude?: number | null, showSelected?: boolean, ratedTip?: {text: string, label: string} | null,
 * }} opts `exclude` (WP-91): a dense index the list never offers (the user a card compares against);
 *   `ratedTip` (WP-153): an (i) beside the item picker's "rated by the user" chip (the model pages: what the chip changes and why a rated film costs a training run);
 *   `showSelected: false` (WP-95): the chosen entity is not echoed under the search box (a page that
 *   shows the entity itself, like the Data page's profile, would say it twice)
 */
export function createEntityPicker(root, opts) {
  const { i18n, api, kind } = opts;
  let dataset = opts.dataset;
  let guards = { ...opts.guards };
  /** @type {number | null} */
  let ratedBy = opts.ratedBy ?? null;
  /** @type {number | null} */
  let exclude = opts.exclude ?? null; // WP-91
  /** @type {any} */
  let selected = null;
  /** @type {number | null} */
  let timer = null;
  let activeRow = -1;
  /** @type {any[]} */
  let results = [];
  // WP-97: every search takes a ticket and only the newest one may draw: an answer that arrives after a newer search
  // (typing outruns the server), after a choice closed the list, or after the dataset / "rated by" user changed is dropped
  let searchSeq = 0;

  root.innerHTML = "";
  root.classList.add("picker");
  const label = document.createElement("div");
  label.className = "picker-label";
  label.textContent = i18n.t(kind === "user" ? "picker.user" : "picker.item");
  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = i18n.t(kind === "user" ? "picker.search_user" : "picker.search_item");
  const chips = document.createElement("div");
  chips.className = "picker-chips";
  const list = document.createElement("div");
  list.className = "picker-list";
  list.hidden = true;
  const current = document.createElement("div");
  current.className = "picker-current";
  root.append(label, input, chips, list, current);

  /** WP-104: the focus is somewhere inside this picker (its input or one of its chips) - the only time its list may show */
  function engaged() {
    return root.contains(document.activeElement);
  }

  /**
   * WP-104: show or hide the result list. Showing it makes this the one open list (any other closes) and wires the
   * document-level dismissal; hiding it lets go of that claim.
   * @param {boolean} open
   */
  function setOpen(open) {
    list.hidden = !open;
    if (open) {
      wireDocument();
      openList.claim(root, () => setOpen(false));
    } else {
      openList.release(root);
    }
  }

  /**
   * A filter chip: a toggle (aria-pressed) that is repainted in place. WP-104: it used to be rebuilt on every click,
   * which threw the focus to <body> - the list it had just opened then belonged to nothing that could close it.
   * @param {string} text
   * @param {() => boolean} isOn
   * @param {() => void} onToggle
   */
  function chip(text, isOn, onToggle) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "chip";
    el.textContent = text;
    const paint = () => {
      el.classList.toggle("on", isOn());
      el.setAttribute("aria-pressed", String(isOn()));
    };
    paint();
    el.addEventListener("click", () => {
      onToggle();
      paint();
      el.focus(); // a mouse click focuses a button in Chrome / Edge, not in every browser: the list needs the focus inside
      search(input.value, true);
    });
    return el;
  }

  function renderChips() {
    chips.innerHTML = "";
    if (kind === "user") {
      const n = opts.guards.minRatings;
      if (n > 0) {
        chips.appendChild(
          chip(i18n.t("picker.guard_min_ratings", { n }), () => guards.minRatings > 0, () => {
            guards.minRatings = guards.minRatings > 0 ? 0 : n;
          })
        );
      }
      chips.appendChild(
        chip(i18n.t("picker.guard_class"), () => guards.requireClass, () => {
          guards.requireClass = !guards.requireClass;
        })
      );
    } else {
      const n = opts.guards.minRaters;
      if (n > 0) {
        chips.appendChild(
          chip(i18n.t("picker.guard_min_raters", { n }), () => guards.minRaters > 0, () => {
            guards.minRaters = guards.minRaters > 0 ? 0 : n;
          })
        );
      }
      chips.appendChild(
        chip(i18n.t("picker.rated_by_user"), () => guards.ratedByUser, () => {
          guards.ratedByUser = !guards.ratedByUser;
        })
      );
      if (opts.ratedTip) {
        // WP-153: the (i) stands in the chip row, after the chip (the list below the row is the chip's effect); an empty title keeps a native tooltip from opening beside the bubble
        const info = infoTip(opts.ratedTip.text, opts.ratedTip.label, i18n.t("picker.rated_by_user"));
        info.title = "";
        // WP-153: the (i) is the LAST thing of the row, at the picker's right edge: a bubble opening to its right is hidden by opacity only (it keeps its 260 px in the layout) and widened the
        // main area by 226 px - a sideways scroll bar on the MF and neural pages (measured on `main`, not on the document, which hid it). It opens to the LEFT, on hover too (as the
        // Parameters form's last (i) does: `opensLeft`); the listener is added after `infoTip`'s, so it runs after `place()`.
        info.classList.remove("tip-right");
        for (const type of ["mouseenter", "focus"]) info.addEventListener(type, () => info.classList.remove("tip-right"));
        chips.appendChild(info);
      }
    }
  }

  /**
   * @param {string} q
   * @param {boolean} guarded
   */
  async function fetchRows(q, guarded) {
    if (kind === "user") {
      const page = await api.users(dataset, {
        q,
        min_ratings: guarded ? guards.minRatings : 0,
        cohort: guarded && guards.requireClass ? "class" : undefined,
        limit: MAX_ROWS,
      });
      return page;
    }
    // WP-156: the chip on filters the list to the user's films (`rated_by`), off the list shows every film and marks the user's (`mark_rated_by`); either way the rows carry `user_rating`
    const page = await api.items(
      dataset,
      itemQuery({ q, minRaters: guards.minRaters, guarded, chipOn: guards.ratedByUser, ratedBy, mode: api.mode, limit: MAX_ROWS })
    );
    return page;
  }

  /**
   * @param {string} q
   * @param {boolean} [open]
   */
  async function search(q, open = true) {
    const mine = (searchSeq += 1); // WP-97
    let relaxed = false;
    let page;
    try {
      page = await fetchRows(q, true);
      if (mine !== searchSeq) return;
      if (page.total === 0) {
        page = await fetchRows(q, false);
        if (mine !== searchSeq) return;
        relaxed = page.total > 0;
      }
    } catch {
      if (mine !== searchSeq) return;
      page = { items: [], total: 0 };
    }
    results = exclude === null ? page.items : page.items.filter((/** @type {any} */ r) => r.index !== exclude); // WP-91
    activeRow = -1;
    renderList(page.total - (page.items.length - results.length), relaxed); // WP-91: the "+N more" row ignores `exclude`
    // WP-104: an answer that arrives after the focus has left the picker (a slow server) must not reopen a list nobody
    // is working in
    setOpen(open && engaged());
  }

  /**
   * @param {number} total
   * @param {boolean} relaxed
   */
  function renderList(total, relaxed) {
    list.innerHTML = "";
    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "picker-row muted";
      empty.textContent = i18n.t("picker.no_match");
      list.appendChild(empty);
      return;
    }
    if (relaxed) {
      const note = document.createElement("div");
      note.className = "picker-row muted";
      note.textContent = i18n.t("pick.note.min_ratings_relaxed");
      list.appendChild(note);
    }
    // WP-156: with a user chosen (live server) the film rows are laid out in three columns - title | raters | the user's rating - the rating column reserved whether or not a row has one, so
    // rows do not shift as the search changes; a film the user rated has a tinted row and "★ 4.0" in that column
    const marks = marksRatings({ kind, ratedBy, mode: api.mode });
    results.forEach((row, i) => {
      const el = document.createElement("div");
      el.className = marks ? "picker-row has-rating" : "picker-row";
      if (marks && hasRating(row)) el.classList.add("is-rated");
      el.dataset.index = String(i);
      const name = document.createElement("span");
      name.className = "picker-name";
      name.textContent = kind === "user" ? row.label : row.title;
      const meta = document.createElement("span");
      meta.className = "picker-meta num";
      meta.textContent =
        kind === "user"
          ? `${i18n.t("picker.n_ratings", { n: row.n_ratings })} · ${row.cohort}`
          : i18n.t("picker.n_raters", { n: row.n_raters });
      el.append(name, meta);
      if (marks) {
        const rating = document.createElement("span");
        rating.className = "picker-rating num";
        if (hasRating(row)) {
          const shown = ratingText(row.user_rating, i18n.lang?.() ?? "en");
          rating.textContent = `\u2605 ${shown}`;
          rating.title = i18n.t("picker.user_rating_tip", { rating: shown });
        }
        el.appendChild(rating);
      }
      el.addEventListener("mousedown", (e) => e.preventDefault()); // keep input focus
      el.addEventListener("click", () => choose(row));
      list.appendChild(el);
    });
    if (total > results.length) {
      const more = document.createElement("div");
      more.className = "picker-row muted";
      more.textContent = `+${total - results.length}`;
      list.appendChild(more);
    }
  }

  /** @param {any} row */
  function choose(row) {
    searchSeq += 1; // WP-97: a search still in flight must not open the list again
    selected = row;
    setOpen(false);
    input.value = "";
    renderCurrent();
    opts.onSelect(row.index, row);
  }

  function renderCurrent() {
    current.innerHTML = "";
    if (!selected || opts.showSelected === false) return;
    const chipEl = document.createElement("span");
    chipEl.className = "chip on";
    chipEl.textContent = kind === "user" ? selected.label : selected.title;
    current.appendChild(chipEl);
    const count = kind === "user" ? selected.n_ratings : selected.n_raters;
    if (count !== undefined && count !== null) {
      const meta = document.createElement("span");
      meta.className = "sub";
      meta.textContent = i18n.t(kind === "user" ? "picker.n_ratings" : "picker.n_raters", { n: count });
      current.appendChild(meta);
    }
  }

  input.addEventListener("input", () => {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => search(input.value, true), DEBOUNCE_MS);
  });
  let focusedAt = -Infinity;
  input.addEventListener("focus", () => {
    focusedAt = performance.now();
    search(input.value, true);
  });
  // WP-104: a click on an input that already had the focus (after a choice closed the list) opens it again; the click
  // that GAVE it the focus has just searched
  input.addEventListener("click", () => {
    if (list.hidden && performance.now() - focusedAt > 500) search(input.value, true);
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (!engaged()) setOpen(false); // the focus went to one of this picker's chips: the list stays
    }, 120);
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    const rows = [...list.querySelectorAll(".picker-row:not(.muted)")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeRow = Math.max(0, Math.min(rows.length - 1, activeRow + (e.key === "ArrowDown" ? 1 : -1)));
      rows.forEach((r, i) => r.classList.toggle("active", i === activeRow));
    } else if (e.key === "Enter" && activeRow >= 0 && results[activeRow]) {
      e.preventDefault();
      choose(results[activeRow]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  });

  renderChips();

  return {
    /** Current search text (used for the seeded random pick). */
    query() {
      return input.value;
    },
    guards() {
      return { ...guards };
    },
    /**
     * @param {{dataset?: string, selected?: any, ratedBy?: number | null, exclude?: number | null}} next
     */
    update(next) {
      if (next.dataset && next.dataset !== dataset) searchSeq += 1; // WP-97: the old dataset's answer is of no use
      if (next.dataset) dataset = next.dataset;
      if ("ratedBy" in next) {
        if ((next.ratedBy ?? null) !== ratedBy) searchSeq += 1; // WP-97: (the "rated by" guard changed under it)
        ratedBy = next.ratedBy ?? null;
      }
      if ("exclude" in next) exclude = next.exclude ?? null; // WP-91
      if ("selected" in next) {
        selected = next.selected;
        renderCurrent();
      }
    },
  };
}
