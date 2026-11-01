// @ts-check
// WP-83: the Users / Items pages - every user (item) of the dataset in one sortable, searchable,
// paged table: ratings count, mean, population std, median, min, max, an inline half-star
// histogram, the first / last logged rating date and (users) the export's watched-but-unrated and
// diary counts. One factory serves both pages (`createCohortPage("user" | "item")`, registered
// under the page ids `users` / `items` in main.js), like `content` reuses the trace page.
//
// The route is the single source of truth (deep links): `ds`, `q`, `cohort` (users) / `origin`
// (items), `kind` (items: movie | tv | unknown, WP-95), `flag` (items: unreleased,no_metadata,tv - a film must carry ALL
// the listed flags; one comma-separated value because the router's params hold one value per key), `minr` / `minn`
// (items / users: "Raters >= n" / "Ratings >= n", default 1 = absent), `sort`, `dir`, `page`, `size` (25 | 50 | 100)
// and `sel` (the dense index of the selected row). Every table interaction is `router.replace` (no history entry per keystroke or sort
// click); a change of the header's dataset selector rewrites `ds` (documented deviation from the
// atlas page, which ignores the selector). A dataset with at most `all_rows_max` rows in the
// filtered view is listed in full - the class set always is - and the pager disappears.
// Live mode asks the server for each view; a static bundle has no server, so the whole list is
// loaded once and filtered / sorted here with the server's rules (`sortRows`, `filterRows`).
// Beside the table sits the detail card (cohort-card.js): the dataset summary while nothing is
// selected, the selected user's / item's profile otherwise, with a door into the uCF / iCF page.
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { createCohortCard } from "../components/cohort-card.js";
import { createTraitCompare } from "../components/trait-radar.js"; // WP-98
import { createCohortTable, filterRows, sortRows } from "../components/cohort-table.js";
import { createEntityPicker } from "../components/entity-picker.js";
import { createPairFilms } from "../components/pair-films.js";
import { sparklineHist } from "../components/sparkline-hist.js";
import { flagPill } from "../util/flags.js";
import { fmtDate } from "../util/format.js";
import { infoTip } from "../util/info-tip.js"; // WP-95
import { createPanel } from "../util/panel.js";
import { entityLabel, userLabel } from "../util/user-link.js"; // WP-96 / WP-99

// The columns the server can sort by - mirrors services.USER_SORT_KEYS / ITEM_SORT_KEYS.
const USER_SORTS = ["n_ratings", "mean", "std", "median", "min", "max", "first_ts", "last_ts", "n_watched", "n_diary", "label"];
const ITEM_SORTS = ["n_raters", "n_class_raters", "mean", "std", "median", "min", "max", "year", "title"];
// WP-95: the Items list's Kind filter values - mirrors services.ITEM_KINDS (TMDB kind; unknown = no kind)
const ITEM_KINDS = ["movie", "tv", "unknown"];
// WP-95 (20): the Items list's flag filters - mirrors services.PAIR_FILM_FLAGS (the pair explorer's rule, the Flags column's)
const ITEM_FLAGS = ["unreleased", "no_metadata", "tv"];
// WP-95 (21): these sorts rank a mean / spread of the ratings, which one rating alone can make extreme
const STAT_SORTS = ["mean", "median", "std", "min", "max"];
const MIN_NOTE_BELOW = 3; // the note and its "make it 3" shortcut show while the threshold is below this
const MIN_DEBOUNCE_MS = 400;
const SEARCH_DEBOUNCE_MS = 250;
const SERVER_LIMIT_MAX = 500; // the list endpoints' `limit` ceiling
// Only for a manifest exported before WP-83 (no `cohort_tables` block); config/app.yaml
// `ui.cohort_tables` is the source of truth and always wins.
const FALLBACK_CONFIG = {
  page_sizes: [25, 50, 100],
  default_size: 50,
  all_rows_max: 100,
  card_width_px: 320,
  card_lists: 5,
  hist_markers: "card",
};
const FALLBACK_SCALE = { min: 0.5, max: 5, step: 0.5 }; // a manifest without the dataset entry

/** @param {number | null | undefined} v @param {number} decimals */
function num(v, decimals) {
  return v === null || v === undefined ? "—" : v.toFixed(decimals);
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {"user" | "item"} kind
 */
export function createCohortPage(kind) {
  const isUser = kind === "user";
  const pageId = isUser ? "users" : "items";
  const filterName = isUser ? "cohort" : "origin";
  const labelKey = isUser ? "label" : "title";
  const minName = isUser ? "minn" : "minr"; // WP-95 (21): the route param of "Ratings >= n" / "Raters >= n"
  const minApi = isUser ? "min_ratings" : "min_raters"; // ... and the API's
  const countKey = isUser ? "n_ratings" : "n_raters"; // ... and the row field a static bundle filters on
  const sortKeys = isUser ? USER_SORTS : ITEM_SORTS;
  const defaultSort = isUser ? "n_ratings" : "n_raters";

  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let els = null;
  let dataset = "";
  /** @type {string | null} */
  let storeDataset = null; // the header selector's value as of the last update (null = not yet seen)
  /** @type {Record<string, string>} */
  let params = {};
  let loadedKey = "";
  let requestId = 0;
  let columnsKey = "";
  /** @type {ReturnType<typeof createCohortTable> | null} */
  let table = null;
  /** @type {number | undefined} */
  let searchTimer;
  /** @type {number | undefined} */
  let minTimer; // WP-95 (21): the threshold box commits after a pause, not on every digit
  /** @type {{dataset: string, rows: any[]} | null} */
  let staticCache = null;
  /** @type {ReturnType<typeof createCohortCard> | null} */
  let card = null;
  let cardKey = "";
  let cardRequestId = 0;
  let ratingsRequestId = 0; // WP-100: the newest re-ordering of the class-ratings table wins
  /** @type {{dataset: string, value: any} | null} */
  let statsCache = null;
  // WP-95 (items): which data-quality flags the dataset can judge, as the Items list last said (live server
  // only - a static bundle has no flags): the flag column and the Kind filter exist only for what it names
  /** @type {{dataset: string, list: string[]} | null} */
  let flagsInfo = null;
  // WP-95 (25): how many cohorts the dataset has (its /stats names one entry per cohort). With a single cohort the
  // Cohort / Origin column is the same in every row and, in a class-only dataset, "Class raters" equals "Raters": those
  // columns carry nothing and are not drawn. Unknown (not asked yet / the request failed) keeps every column.
  /** @type {{dataset: string, count: number} | null} */
  let cohortInfo = null;
  /** @type {{dataset: string, promise: Promise<any>} | null} the /stats request in flight, shared by the card and the table */
  let statsFlight = null;
  // WP-91: "Compare with..." on a user card - the slot the card reserved, what was built into it
  // and the (dataset, sel, cmp) it last showed
  /** @type {HTMLElement | null} */
  let compareSlotNode = null;
  /** @type {ReturnType<typeof createEntityPicker> | null} */
  let comparePicker = null;
  /** @type {ReturnType<typeof createPairFilms> | null} */
  let compareFilms = null;
  /** @type {HTMLElement | null} */
  let compareHint = null;
  /** @type {ReturnType<typeof createTraitCompare> | null} WP-98: the two users' radars on one hexagon */
  let compareTraits = null;
  let compareKey = "";

  // ── mount ──────────────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    dataset = "";
    storeDataset = null;
    loadedKey = "";
    columnsKey = "";
    table = null;
    staticCache = null;
    card = null;
    cardKey = "";
    statsCache = null;
    flagsInfo = null; // WP-95
    cohortInfo = null; // WP-95 (25)
    statsFlight = null;
    compareSlotNode = null; // WP-91
    comparePicker = null;
    compareFilms = null;
    compareHint = null;
    compareTraits = null; // WP-98
    compareKey = "";
    root.innerHTML = "";
    const { i18n } = context;

    const page = el("div", "cohort-page");
    const head = el("div", "cohort-head");
    const title = el("h2", "cohort-title");
    const notes = [el("span", "pill cohort-note", i18n.t("cohort.std_note"))];
    if (isUser) notes.push(el("span", "pill cohort-note", i18n.t("cohort.date_note")));
    head.append(title, ...notes);

    // controls: search · cohort / origin filter · page size · count (all with reserved widths)
    const controls = el("div", "trace-form cohort-controls");
    const searchField = el("label", "param-field");
    searchField.append(el("span", "", i18n.t("cohort.search")));
    const search = /** @type {HTMLInputElement} */ (el("input", "cohort-search"));
    search.type = "search";
    search.placeholder = i18n.t(isUser ? "cohort.search_users" : "cohort.search_items");
    search.autocomplete = "off";
    search.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => patch({ q: search.value.trim() || undefined, page: undefined }), SEARCH_DEBOUNCE_MS);
    });
    searchField.appendChild(search);

    const filterField = el("div", "param-field cohort-filter");
    filterField.append(el("span", "", i18n.t(isUser ? "cohort.filter_cohort" : "cohort.filter_origin")));
    const filterSeg = el("div", "miniseg");
    for (const [value, key] of /** @type {[string, string][]} */ ([
      ["", "cohort.all"],
      ["class", "cohort.class"],
      ["ml", "cohort.ml"],
    ])) {
      const btn = /** @type {HTMLButtonElement} */ (el("button", "", i18n.t(key)));
      btn.type = "button";
      btn.dataset.value = value;
      btn.addEventListener("click", () => patch({ [filterName]: value || undefined, page: undefined }));
      filterSeg.appendChild(btn);
    }
    filterField.appendChild(filterSeg);

    // WP-95 (items only): Kind - the TMDB kind of the film; it shows once the dataset has `tmdb_kind`
    const kindField = el("div", "param-field cohort-kind unavailable");
    kindField.title = i18n.t("cohort.kind_tip");
    kindField.append(el("span", "", i18n.t("cohort.filter_kind")));
    const kindSeg = el("div", "miniseg");
    for (const [value, key] of /** @type {[string, string][]} */ ([
      ["", "cohort.all"],
      ["movie", "cohort.kind_movie"],
      ["tv", "cohort.kind_tv"],
      ["unknown", "cohort.kind_unknown"],
    ])) {
      const btn = /** @type {HTMLButtonElement} */ (el("button", "", i18n.t(key)));
      btn.type = "button";
      btn.dataset.value = value;
      btn.addEventListener("click", () => patch({ kind: value || undefined, page: undefined }));
      kindSeg.appendChild(btn);
    }
    kindField.appendChild(kindSeg);

    // WP-95 (20, items only): the Flags column's pills as a multi-select - an item must carry ALL the chosen flags
    // (the same rule as the column, computed by the server). Chips keep their place while the dataset cannot judge a
    // flag (visibility, not display), so the controls to the right never move.
    const flagsField = el("div", "param-field cohort-flagsel unavailable");
    flagsField.append(el("span", "", i18n.t("cohort.filter_flags")));
    const flagsRow = el("div", "cohort-flagchips");
    for (const flag of ITEM_FLAGS) {
      const pill = flagPill((k, p) => i18n.t(k, p), flag);
      const btn = /** @type {HTMLButtonElement} */ (el("button", `${pill.className} flag-chip`, pill.textContent ?? ""));
      btn.type = "button";
      btn.dataset.value = flag;
      btn.title = pill.title;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        const now = derive().flags;
        const next = ITEM_FLAGS.filter((f) => (f === flag ? !now.includes(f) : now.includes(f)));
        patch({ flag: next.join(",") || undefined, page: undefined });
      });
      flagsRow.appendChild(btn);
    }
    flagsField.appendChild(flagsRow);

    // WP-95 (21): "Raters >= n" (items) / "Ratings >= n" (users): one rating alone gives a 5.0 mean that means nothing,
    // so the threshold is applied before the sort (default 1 = everything; no negative)
    const minLabel = i18n.t(isUser ? "cohort.filter_minn" : "cohort.filter_minr");
    const minField = el("div", "param-field cohort-min");
    const minHead = el("div", "cohort-min-head");
    minHead.append(el("span", "", minLabel), infoTip(i18n.t(isUser ? "cohort.minn_tip" : "cohort.minr_tip"), minLabel));
    const minInput = /** @type {HTMLInputElement} */ (el("input", "cohort-min-input"));
    minInput.type = "number";
    minInput.min = "1";
    minInput.step = "1";
    minInput.setAttribute("aria-label", minLabel);
    /** @param {boolean} final Enter / leaving the box: also write the clamped value back into it */
    const commitMin = (final) => {
      window.clearTimeout(minTimer);
      const v = Math.max(1, Math.floor(Number(minInput.value)) || 1);
      if (final) minInput.value = String(v);
      patch({ [minName]: v > 1 ? String(v) : undefined, page: undefined });
    };
    minInput.addEventListener("input", () => {
      window.clearTimeout(minTimer);
      minTimer = window.setTimeout(() => commitMin(false), MIN_DEBOUNCE_MS);
    });
    minInput.addEventListener("change", () => commitMin(true));
    minField.append(minHead, minInput);

    // WP-95 (21): sorting by a mean / spread with a threshold below 3 - a short note and a shortcut that makes the
    // threshold 3. WP-95 (23): it lives at the right end of the filter bar, in the room the controls leave, and exists
    // only while it applies (`hidden`); no line above the table is reserved for it any more, and nothing moves when it
    // comes and goes because it is the last item of the bar
    const minNote = el("div", "cohort-minnote");
    minNote.hidden = true;
    const minNoteText = el("span", "cohort-minnote-text");
    const minNoteBtn = /** @type {HTMLButtonElement} */ (el("button", "btn btn-sm cohort-minnote-btn", i18n.t("cohort.min_make3")));
    minNoteBtn.type = "button";
    minNoteBtn.addEventListener("click", () => patch({ [minName]: String(MIN_NOTE_BELOW), page: undefined }));
    minNote.append(minNoteText, minNoteBtn);

    const sizeField = el("label", "param-field");
    sizeField.append(el("span", "", i18n.t("cohort.page_size")));
    const sizeSel = /** @type {HTMLSelectElement} */ (el("select", "cohort-size"));
    sizeSel.addEventListener("change", () => patch({ size: sizeSel.value, page: undefined }));
    sizeField.appendChild(sizeSel);

    const count = el("span", "pill cohort-count");
    controls.append(searchField, filterField, ...(isUser ? [] : [kindField, flagsField]), minField, sizeField, count, minNote);

    // table panel + pager
    const panel = createPanel("cohort-table", "cohort-table-panel");
    const pager = el("div", "cohort-pager");
    const prev = /** @type {HTMLButtonElement} */ (el("button", "btn btn-sm cohort-prev", "‹"));
    prev.type = "button";
    prev.title = i18n.t("cohort.prev");
    prev.setAttribute("aria-label", i18n.t("cohort.prev"));
    const pageInfo = el("span", "pill cohort-page-info");
    const next = /** @type {HTMLButtonElement} */ (el("button", "btn btn-sm cohort-next", "›"));
    next.type = "button";
    next.title = i18n.t("cohort.next");
    next.setAttribute("aria-label", i18n.t("cohort.next"));
    prev.addEventListener("click", () => patch({ page: String(derive().pageNo - 1) }));
    next.addEventListener("click", () => patch({ page: String(derive().pageNo + 1) }));
    pager.append(prev, pageInfo, next);

    const main = el("div", "cohort-main");
    main.appendChild(panel.box);
    page.append(head, controls, main);
    root.appendChild(page);
    const cfg = tableConfig();
    card = createCohortCard(main, {
      i18n,
      router: context.router,
      kind,
      width: Number(cfg.card_width_px),
      lists: Number(cfg.card_lists),
      markerMode: markerMode(),
      onClear: () => patch({ sel: undefined, cmp: undefined }),
      onItemOrder: (order) => reorderItemRatings(order), // WP-100
      traitsMeta, // WP-98 (A2)
    });
    els = {
      title, search, filterField, filterSeg, kindField, kindSeg, flagsField, flagsRow, minInput, minNote, minNoteText,
      sizeSel, count, panel, pager, prev, next, pageInfo,
    };
  }

  function unmount() {
    window.clearTimeout(searchTimer);
    window.clearTimeout(minTimer);
    requestId += 1; // a response arriving after unmount is dropped
    cardRequestId += 1;
    ratingsRequestId += 1; // WP-100
    card = null;
    table = null;
    root = null;
    ctx = null;
    els = null;
  }

  // ── route <-> state ────────────────────────────────────────────────────────────────────────

  /** @param {Record<string, string | undefined>} changes */
  function patch(changes) {
    if (!ctx) return;
    ctx.router.replace(pageId, { ...params, ...changes, ds: dataset });
  }

  function tableConfig() {
    const meta = ctx.store.get().meta || {};
    return { ...FALLBACK_CONFIG, ...(meta.cohort_tables || {}) };
  }

  /** Everything the route says about the table, with the defaults filled in. */
  function derive() {
    const cfg = tableConfig();
    const sort = sortKeys.includes(params.sort) ? params.sort : defaultSort;
    const textual = sort === "label" || sort === "title";
    const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : textual ? "asc" : "desc";
    const sizes = /** @type {number[]} */ (cfg.page_sizes);
    const size = sizes.includes(Number(params.size)) ? Number(params.size) : Number(cfg.default_size);
    const filter = params[filterName] === "class" || params[filterName] === "ml" ? params[filterName] : "";
    return {
      cfg,
      sizes,
      size,
      sort,
      dir: /** @type {"asc" | "desc"} */ (dir),
      pageNo: Math.max(1, Number.parseInt(params.page || "1", 10) || 1),
      q: params.q || "",
      filter,
      // WP-95: the Items list's Kind filter ("" = all kinds)
      kind: !isUser && ITEM_KINDS.includes(params.kind) ? params.kind : "",
      // WP-95 (20): the chosen flags in their fixed order; (21) the threshold, 1 = no filter
      flags: isUser ? [] : ITEM_FLAGS.filter((f) => (params.flag || "").split(",").includes(f)),
      min: Math.max(1, Number.parseInt(params[minName] || "1", 10) || 1),
      sel: params.sel !== undefined && /^\d+$/.test(params.sel) ? Number(params.sel) : null,
      // WP-91: the second user of "Compare with..." (dense index; users page only, needs `sel`)
      cmp: isUser && params.cmp !== undefined && /^\d+$/.test(params.cmp) ? Number(params.cmp) : null,
    };
  }

  /** @param {any} state */
  function update(state) {
    if (!root || !ctx) return;
    params = state.route.params || {};
    // A deep link names a dataset the header's selector does not show: the selector follows the URL
    // once, at mount, so what the header says is what the page shows (the store change re-enters
    // update() through main.js's render, which is why we return here).
    const known = (/** @type {string} */ name) => (state.meta?.datasets || []).some((x) => x.name === name);
    if (storeDataset === null && params.ds && params.ds !== state.dataset && known(params.ds)) {
      storeDataset = params.ds;
      ctx.store.set({ dataset: params.ds });
      return;
    }
    // The header's dataset selector changed after this page mounted: the URL follows it (and drops
    // the page / selection, which belong to the previous dataset). Deviation from the atlas page,
    // which ignores the selector once the URL names a dataset.
    if (storeDataset !== null && state.dataset !== storeDataset) {
      storeDataset = state.dataset;
      if (state.dataset && state.dataset !== params.ds) {
        ctx.router.replace(pageId, { ds: state.dataset, sort: params.sort, dir: params.dir, size: params.size });
        return;
      }
    }
    storeDataset = state.dataset;
    dataset = params.ds || state.dataset || "";
    if (!dataset) return;
    const d = derive();
    syncControls(d);
    const key = JSON.stringify([dataset, d.q, d.filter, d.kind, d.flags, d.min, d.sort, d.dir, d.pageNo, d.size]);
    if (key !== loadedKey) {
      loadedKey = key;
      load(d);
    } else if (table) {
      table.setSelected(d.sel);
    }
    syncCard(d);
    renderCompare(d); // WP-91
  }

  /**
   * WP-91: "Compare with..." on the selected user's card - a small user picker and, once a partner
   * is chosen (route `cmp`), the pair-films block. The card reserves an empty section
   * (`compareSlot()`; null while the profile loads and on a static bundle, which has no
   * pair-films endpoint); the page builds the picker and the block into it once per card build and
   * later calls only re-show them when (dataset, sel, cmp) change. `syncCard` calls this again when
   * the card has finished loading.
   * @param {ReturnType<typeof derive>} d
   */
  function renderCompare(d) {
    if (!isUser || !card || d.sel === null || ctx.api.mode === "static") return;
    const slot = card.compareSlot();
    if (!slot) return;
    const { i18n } = ctx;
    if (compareSlotNode !== slot) {
      compareSlotNode = slot;
      const pickerBox = el("div");
      compareHint = el("p", "card-note", i18n.t("pairfilms.compare_hint"));
      const traitsBox = el("div", "trait-compare"); // WP-98: hidden until both users have a profile
      const filmsBox = el("div");
      filmsBox.hidden = true;
      slot.append(pickerBox, compareHint, traitsBox, filmsBox);
      compareTraits = createTraitCompare(traitsBox, { i18n, api: ctx.api, width: card.innerWidth(), traitsMeta });
      comparePicker = createEntityPicker(pickerBox, {
        i18n,
        api: ctx.api,
        kind: "user",
        dataset,
        // the class cohort is what the lecture compares; the chip widens it to every user
        guards: { minRatings: 0, requireClass: true, minRaters: 0, ratedByUser: false },
        exclude: d.sel, // a user compared with themself is no comparison
        onSelect: (index) => patch({ cmp: String(index) }),
      });
      compareFilms = createPairFilms(filmsBox, {
        i18n,
        api: ctx.api,
        onClear: () => patch({ cmp: undefined }),
        // the chosen partner appears in the picker even when the URL carried `cmp`
        onLoad: (data) =>
          comparePicker?.update({
            selected: { index: data.other.index, label: data.other.label, n_ratings: data.counts.b },
          }),
      });
      compareKey = "";
    }
    const key = `${dataset}|${d.sel}|${d.cmp}`;
    if (key === compareKey) return;
    compareKey = key;
    const active = d.cmp !== null && d.cmp !== d.sel;
    if (compareHint) compareHint.hidden = active;
    if (!active) {
      compareFilms?.clear();
      compareTraits?.clear(); // WP-98
      comparePicker?.update({ dataset, selected: null });
      return;
    }
    comparePicker?.update({ dataset });
    compareFilms?.show({ dataset, a: d.sel, b: /** @type {number} */ (d.cmp) });
    compareTraits?.show({ dataset, a: d.sel, b: /** @type {number} */ (d.cmp) }); // WP-98
  }

  /** @param {ReturnType<typeof derive>} d */
  function syncControls(d) {
    const { i18n } = ctx;
    els.title.textContent = i18n.t(isUser ? "cohort.title_users" : "cohort.title_items", { dataset });
    if (document.activeElement !== els.search) els.search.value = d.q;
    for (const btn of els.filterSeg.querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.value === d.filter);
    }
    els.filterField.hidden = !datasetMeta()?.has_class_users; // no class cohort = nothing to filter
    // WP-95 (25): one cohort = nothing to filter either, but the filter keeps its place (invisible, like Kind and the flag
    // chips) so the controls to its right never move; until /stats says so the filter stays as it was
    els.filterField.classList.toggle("unavailable", singleCohort());
    if (!isUser) {
      // WP-95: the Kind filter needs `tmdb_kind` ("tv" is judgeable); it keeps its place while unknown
      els.kindField.classList.toggle("unavailable", !flagsAvailable().includes("tv"));
      for (const btn of els.kindSeg.querySelectorAll("button")) btn.classList.toggle("active", btn.dataset.value === d.kind);
      // WP-95 (20): the flag chips - only what the dataset can judge is offered; the chosen ones are filled
      const judged = flagsAvailable();
      els.flagsField.classList.toggle("unavailable", judged.length === 0);
      for (const btn of els.flagsRow.querySelectorAll("button")) {
        const on = d.flags.includes(btn.dataset.value);
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", String(on));
        btn.style.visibility = judged.includes(btn.dataset.value) ? "" : "hidden";
      }
    }
    // WP-95 (21): the threshold box (not while it is being typed in) and the note about sorting by a statistic
    if (document.activeElement !== els.minInput) els.minInput.value = String(d.min);
    const warn = STAT_SORTS.includes(d.sort) && d.min < MIN_NOTE_BELOW;
    els.minNote.hidden = !warn; // WP-95 (23): absent, not blank, while it does not apply
    if (warn) {
      // the visible text is short (the bar's leftover room is small); the full sentence is its tooltip
      els.minNoteText.textContent = i18n.t(isUser ? "cohort.minn_short" : "cohort.minr_short");
      els.minNote.title = i18n.t(isUser ? "cohort.minn_note" : "cohort.minr_note", { col: i18n.t(`cohort.col.${d.sort}`), n: d.min });
    }
    if (els.sizeSel.options.length !== d.sizes.length) {
      els.sizeSel.innerHTML = "";
      for (const n of d.sizes) {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = i18n.t("cohort.size_n", { n });
        els.sizeSel.appendChild(opt);
      }
    }
    els.sizeSel.value = String(d.size);
  }

  /** Where the mean / median / ± std lines go (config `ui.cohort_tables.hist_markers`): none | card | all. */
  function markerMode() {
    const mode = tableConfig().hist_markers;
    return mode === "none" || mode === "all" ? mode : "card";
  }

  /** WP-95: the flags the Items list said this dataset can judge (none until its first answer / on a static bundle). */
  function flagsAvailable() {
    return flagsInfo && flagsInfo.dataset === dataset ? flagsInfo.list : [];
  }

  /** The dataset's /api/meta entry (scale, has_class_users). */
  function datasetMeta() {
    const meta = ctx.store.get().meta;
    return (meta?.datasets || []).find(/** @param {any} x */ (x) => x.name === dataset) || null;
  }

  /** WP-98 (A2): the `traits` block of /api/meta - the cut-offs the profile tooltips print (null on an older server). */
  function traitsMeta() {
    return ctx?.store.get().meta?.traits ?? null;
  }

  // ── columns ────────────────────────────────────────────────────────────────────────────────

  /** @param {string} cohort */
  function tagPill(cohort) {
    const pill = el("span", `pill tag-${cohort === "class" ? "class" : "ml"}`);
    pill.textContent = ctx.i18n.t(cohort === "class" ? "cohort.class" : "cohort.ml");
    return pill;
  }

  /**
   * @param {string} text
   * @param {string | null} [url] WP-96: the user's Letterboxd profile (server-filled, handles mode only)
   */
  function labelCell(text, url) {
    if (url) {
      return userLabel({ label: text, profile_url: url }, { className: "cohort-label", t: (k, p) => ctx.i18n.t(k, p) }); // WP-96
    }
    const span = el("span", "cohort-label", text);
    span.title = text;
    return span;
  }

  /**
   * WP-99: an Items row's title - a link to the film's Letterboxd / TMDB page when the server gives `film_url`
   * (every mode), else the plain label. The link does not bubble its click, so the row still selects.
   * @param {any} r an ItemSummary row
   */
  function itemTitleCell(r) {
    // WP-135: a title that does not fit gives up its NAME, never its year ("The Extraordinarily Lo… (2003)")
    return entityLabel(
      { label: r.title, film_url: r.film_url },
      { className: "cohort-label", clamp: true, t: (k, p) => ctx.i18n.t(k, p) }
    );
  }

  /** @param {number | null | undefined} v @param {string} tipKey */
  function optionalCount(v, tipKey) {
    if (v === null || v === undefined) {
      const span = el("span", "muted", "—");
      span.title = ctx.i18n.t(tipKey);
      return span;
    }
    return String(v);
  }

  /** @param {any} row */
  function histCell(row) {
    const scale = datasetMeta()?.scale || FALLBACK_SCALE;
    // `hist_markers: all` also draws lines on every row's histogram - the mean and the median only: four
    // lines (± std too) would drown the bars of a 100 x 24 px sparkline (a row without ratings has none)
    const markers =
      markerMode() === "all"
        ? {
            mean: row.mean,
            median: row.median,
            std: null,
            labels: {
              mean: ctx.i18n.t("cohort.card.marker.mean"),
              median: ctx.i18n.t("cohort.card.marker.median"),
              std: ctx.i18n.t("cohort.card.marker.std"),
            },
          }
        : undefined;
    return sparklineHist(row.hist || [], { scale, width: 100, height: 24, markers, i18n: ctx.i18n });
  }

  /** WP-95 (25): the dataset has exactly one cohort (known from /stats; unknown counts as "no"). */
  function singleCohort() {
    return cohortInfo !== null && cohortInfo.dataset === dataset && cohortInfo.count === 1;
  }

  function buildColumns() {
    const { i18n } = ctx;
    const single = singleCohort(); // WP-95 (25)
    const c = (/** @type {string} */ k) => i18n.t(`cohort.col.${k}`);
    const tip = (/** @type {string} */ k) => i18n.t(`cohort.tip.${k}`);
    const stats = [
      { key: "mean", num: true, width: 66, label: c("mean"), title: tip("mean"), render: (/** @type {any} */ r) => num(r.mean, 3) },
      { key: "std", num: true, width: 68, label: c("std"), title: tip("std"), render: (/** @type {any} */ r) => num(r.std, 3) },
      { key: "median", num: true, width: 76, label: c("median"), title: tip("median"), render: (/** @type {any} */ r) => num(r.median, 1) },
      // WP-95 (25): Min and Max are the first to go when the table box is too narrow (card open on a 1536 px screen);
      // Mean, Std and Median stay
      { key: "min", num: true, optional: true, width: 56, label: c("min"), render: (/** @type {any} */ r) => num(r.min, 1) },
      { key: "max", num: true, optional: true, width: 58, label: c("max"), render: (/** @type {any} */ r) => num(r.max, 1) },
    ].map((col) => ({ ...col, sortKey: col.key }));
    const hist = { key: "hist", label: c("hist"), title: tip("hist"), width: 120, render: histCell };
    if (isUser) {
      return [
        { key: "label", sortKey: "label", textual: true, label: c("user_label"), width: 150, render: (/** @type {any} */ r) => labelCell(r.label, r.profile_url) },
        ...(single ? [] : [{ key: "cohort", label: c("cohort"), width: 84, render: (/** @type {any} */ r) => tagPill(r.cohort) }]), // WP-95 (25)
        { key: "n_ratings", sortKey: "n_ratings", num: true, width: 76, label: c("n_ratings"), render: (/** @type {any} */ r) => String(r.n_ratings) },
        // WP-95 (22): the export's watched-but-unrated and diary counts are secondary numbers - right after Ratings, in the
        // muted ink (header and cells), still sortable and of the same widths as before
        { key: "n_watched", sortKey: "n_watched", num: true, muted: true, width: 92, label: c("n_watched"), title: tip("n_watched"), render: (/** @type {any} */ r) => optionalCount(r.n_watched, "cohort.na_export") },
        { key: "n_diary", sortKey: "n_diary", num: true, muted: true, width: 72, label: c("n_diary"), title: tip("n_diary"), render: (/** @type {any} */ r) => optionalCount(r.n_diary, "cohort.na_export") },
        ...stats,
        hist,
        { key: "first_ts", sortKey: "first_ts", width: 96, label: c("first_ts"), title: tip("date"), render: (/** @type {any} */ r) => fmtDate(r.first_ts) },
        { key: "last_ts", sortKey: "last_ts", width: 96, label: c("last_ts"), title: tip("date"), render: (/** @type {any} */ r) => fmtDate(r.last_ts) },
        { key: "warn", label: c("warn"), width: 110, render: (/** @type {any} */ r) => warnCell(r.warnings || []) },
      ];
    }
    const hasClass = !!datasetMeta()?.has_class_users;
    return [
      { key: "title", sortKey: "title", textual: true, label: c("item_title"), width: 280, render: (/** @type {any} */ r) => itemTitleCell(r) },
      { key: "year", sortKey: "year", num: true, width: 60, label: c("year"), render: (/** @type {any} */ r) => (r.year === null || r.year === undefined ? "—" : String(r.year)) },
      // WP-95 (25): the last to give way when the table box is narrow - it shrinks and cuts its text (the cell's tooltip has
      // every genre)
      { key: "genres", label: c("genres"), width: 170, narrowWidth: 120, render: genresCell },
      { key: "n_raters", sortKey: "n_raters", num: true, width: 92, label: c("n_raters"), render: (/** @type {any} */ r) => String(r.n_raters) },
      ...(hasClass && !single // WP-95 (25): one cohort that has class users = only them, so the count equals Raters
        ? [{ key: "n_class_raters", sortKey: "n_class_raters", num: true, width: 92, label: c("n_class_raters"), title: tip("n_class_raters"), render: (/** @type {any} */ r) => String(r.n_class_raters) }]
        : []),
      ...stats,
      hist,
      ...(single ? [] : [{ key: "origin", label: c("origin"), width: 84, render: (/** @type {any} */ r) => tagPill(r.origin) }]), // WP-95 (25)
      // WP-95 (19): the flags are a data-quality aid for the lecture's walk through the catalogue (no metadata, TV
      // series, unreleased), not a reading column - they sit at the far right, after everything the table is for
      ...(flagsAvailable().length ? [{ key: "flags", label: c("flags"), title: tip("flags"), width: 170, render: flagsCell }] : []),
    ];
  }

  /** @param {string[]} keys */
  function warnCell(keys) {
    const wrap = el("span", "cohort-warns");
    for (const k of keys) wrap.appendChild(el("span", "pill tag-fault", ctx.i18n.t(k)));
    return wrap;
  }

  /** WP-95: an item row's data-quality chips - the pair explorer's pills (util/flags.js); no flag, no chip. @param {any} row */
  function flagsCell(row) {
    const wrap = el("span", "cohort-flags");
    for (const f of /** @type {string[]} */ (row.flags || [])) wrap.appendChild(flagPill((k, p) => ctx.i18n.t(k, p), f));
    return wrap;
  }

  /** @param {any} row */
  function genresCell(row) {
    const wrap = el("span", "cohort-genres");
    const genres = /** @type {string[]} */ (row.genres || []);
    wrap.title = genres.join(", ");
    wrap.append(genres.slice(0, 2).join(", ") || "—");
    if (genres.length > 2) wrap.appendChild(el("span", "pill", `+${genres.length - 2}`));
    return wrap;
  }

  /**
   * (Re)build the table when its columns change: the dataset (class-rater column), the flags it can judge, whether it has one
   * cohort (WP-95 25) or the language.
   * @returns {boolean} true when the table was built anew (it has no sort mark and no rows yet)
   */
  function ensureTable() {
    const key = [dataset, !!datasetMeta()?.has_class_users, flagsAvailable().join(","), singleCohort()].join("|");
    if (table && key === columnsKey) return false;
    columnsKey = key;
    if (table) table.destroy();
    els.panel.body.innerHTML = "";
    table = createCohortTable(els.panel.body, {
      columns: buildColumns(),
      onSort: (sortKey, dir) => patch({ sort: sortKey, dir, page: undefined }),
      // a second click on the selected row lets go of it (no selection = the dataset summary card)
      // WP-91: another row (or none) ends the comparison - the partner was chosen for the old user
      onSelect: (row) =>
        patch({ sel: derive().sel === row.index ? undefined : String(row.index), cmp: undefined }),
    });
    els.panel.body.appendChild(els.pager);
    return true;
  }

  // ── data ───────────────────────────────────────────────────────────────────────────────────

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return ctx.i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** All rows of a static bundle (one fetch per dataset). */
  async function staticRows() {
    const ds = dataset; // WP-97: the cache entry belongs to the dataset the request was made for
    if (staticCache && staticCache.dataset === ds) return staticCache.rows;
    const res = await ctx.api[isUser ? "users" : "items"](ds);
    if (ds === dataset) staticCache = { dataset: ds, rows: res.items }; // an answer for a dataset the page left is not kept
    return res.items;
  }

  /**
   * The rows of one view as `{items, total}`. Page 1 asks for `max(size, all_rows_max)` rows so a
   * small dataset arrives whole in a single request; later pages ask for exactly their window.
   * @param {ReturnType<typeof derive>} d
   */
  async function fetchView(d) {
    const first = d.pageNo === 1;
    const offset = first ? 0 : (d.pageNo - 1) * d.size;
    const limit = first ? Math.min(SERVER_LIMIT_MAX, Math.max(d.size, Number(d.cfg.all_rows_max))) : d.size;
    if (ctx.api.mode === "static") {
      const rows = filterRows(await staticRows(), {
        q: d.q,
        labelKey,
        filterKey: filterName,
        filterValue: d.filter,
        minKey: countKey, // WP-95 (21); a bundle has no flags, so no flag filter here
        minValue: d.min,
      });
      const ordered = sortRows(rows, d.sort, d.dir);
      return { items: ordered.slice(offset, offset + limit), total: ordered.length };
    }
    return ctx.api[isUser ? "users" : "items"](dataset, {
      q: d.q || undefined,
      [filterName]: d.filter || undefined,
      ...(isUser ? {} : { kind: d.kind || undefined, flag: d.flags.length ? d.flags : undefined }), // WP-95 (20): repeated `flag=`
      [minApi]: d.min > 1 ? d.min : undefined, // WP-95 (21)
      sort: d.sort,
      dir: d.dir,
      offset,
      limit,
    });
  }

  // ── detail card ────────────────────────────────────────────────────────────────────────────

  /** The dataset's /stats (rating histogram, user / item / rating counts), one fetch per dataset. */
  async function getStats() {
    const ds = dataset; // WP-97: the cache entry belongs to the dataset the request was made for, not the one the page
    // shows when the answer arrives (a slow answer for the previous dataset used to be filed under the new one, and the
    // summary card then showed the old dataset's numbers under the new name); an answer for a dataset left is not kept
    if (statsCache && statsCache.dataset === ds) return statsCache.value;
    // WP-95 (25): the card and the table both ask for it at page open - one request, not two
    if (!statsFlight || statsFlight.dataset !== ds) {
      const promise = ctx.api.stats(ds).then((/** @type {any} */ value) => {
        if (ds === dataset) statsCache = { dataset: ds, value };
        return value;
      });
      const flight = { dataset: ds, promise };
      statsFlight = flight;
      const done = () => {
        if (statsFlight === flight) statsFlight = null;
      };
      promise.then(done, done);
    }
    return statsFlight.promise;
  }

  /** WP-95 (25): learn how many cohorts the dataset has (from /stats, once per dataset); a failure keeps every column. */
  async function noteCohorts() {
    const ds = dataset;
    if (cohortInfo && cohortInfo.dataset === ds) return;
    try {
      const stats = await getStats();
      if (ds === dataset) cohortInfo = { dataset: ds, count: Object.keys(stats?.cohorts || {}).length };
    } catch {
      /* the count stays unknown; the card reports a failing /stats itself */
    }
  }

  /**
   * Show what the route selects: the dataset summary (no `sel`) or the selected row's profile.
   * A static bundle has no detail endpoint (`user()` / `item()` reject with 501), so the card is
   * built from the table row alone and marked `partial` (tiles + histogram, no lists).
   * @param {ReturnType<typeof derive>} d
   */
  async function syncCard(d) {
    if (!card) return;
    const key = `${dataset}|${d.sel}`;
    if (key === cardKey) return;
    cardKey = key;
    ratingsRequestId += 1; // WP-100: a table re-ordering still in flight belongs to the previous selection
    const id = (cardRequestId += 1);
    const c = card;
    const scale = datasetMeta()?.scale || FALLBACK_SCALE;
    c.showLoading();
    try {
      if (d.sel === null) {
        const stats = await getStats();
        if (id !== cardRequestId || !root) return;
        c.showSummary({ stats, dataset, scale });
        return;
      }
      let detail;
      let partial = false;
      try {
        // WP-100: an item's card lists the class cohort's raters (all of them up to the server's cap); a film no class
        // member rated (`scope_total` 0) falls back to the all-cohort list the card always had
        const classScope = !isUser && ctx.api.mode !== "static" && !!datasetMeta()?.has_class_users;
        detail = await ctx.api[isUser ? "user" : "item"](dataset, d.sel, classScope ? { scope: "class" } : undefined);
        if (classScope && Number(detail.scope_total) === 0) detail = await ctx.api.item(dataset, d.sel);
      } catch (err) {
        if (ctx.api.mode !== "static") throw err;
        detail = (await staticRows()).find(/** @param {any} r */ (r) => r.index === d.sel);
        partial = true;
        if (!detail) throw err;
      }
      if (id !== cardRequestId || !root) return;
      if (isUser) {
        c.showUser({ detail, dataset, scale, partial });
        renderCompare(derive()); // WP-91: the card has its compare slot now (the route may have moved on)
      } else c.showItem({ detail, dataset, scale, partial, hasClass: !!datasetMeta()?.has_class_users });
    } catch (err) {
      if (id !== cardRequestId || !root) return;
      c.showError(errorText(err));
    }
  }

  /**
   * WP-100: the item card's class-ratings table was sorted by a header click - ask the server for that order and hand
   * the answer to the card. Only the newest request counts, and only for the item still selected.
   * @param {"recent" | "top" | "bottom"} order
   */
  async function reorderItemRatings(order) {
    const sel = derive().sel;
    if (isUser || sel === null || !card) return;
    const id = (ratingsRequestId += 1);
    const key = `${dataset}|${sel}`;
    try {
      const detail = await ctx.api.item(dataset, sel, { scope: "class", order });
      if (id !== ratingsRequestId || !card || key !== cardKey) return;
      card.updateItemRatings(detail, order);
    } catch {
      /* the table stays as it was; the card's own errors are the card load's business */
    }
  }

  /** @param {ReturnType<typeof derive>} d */
  async function load(d) {
    const id = (requestId += 1);
    const { i18n } = ctx;
    ensureTable();
    const tbl = /** @type {NonNullable<typeof table>} */ (table);
    tbl.setSort(d.sort, d.dir);
    tbl.setMessage(i18n.t("cohort.loading"));
    try {
      const [res] = await Promise.all([fetchView(d), noteCohorts()]); // WP-95 (25)
      if (id !== requestId || !root) return; // a newer request (or unmount) superseded this one
      if (!isUser) {
        // WP-95: the answer says which flags this dataset can judge - the table gets (or loses) its flag column and
        // the Kind filter appears; the table is empty ("Loading") at this moment, so the rebuild is not seen
        const avail = Array.isArray(res.flags_available) ? /** @type {string[]} */ (res.flags_available) : [];
        if (avail.join(",") !== flagsAvailable().join(",")) {
          flagsInfo = { dataset, list: avail };
          ensureTable();
          /** @type {NonNullable<typeof table>} */ (table).setSort(d.sort, d.dir);
          syncControls(d);
        }
      }
      // WP-95 (25): the cohort count is in - a single-cohort dataset loses its constant columns; the table is "Loading" now,
      // so the rebuild is not seen
      if (ensureTable()) {
        /** @type {NonNullable<typeof table>} */ (table).setSort(d.sort, d.dir);
        syncControls(d); // the cohort filter follows the cohort count
      }
      const first = d.pageNo === 1;
      const showAll = first && res.total <= Number(d.cfg.all_rows_max);
      const rows = showAll || !first ? res.items : res.items.slice(0, d.size);
      if (!showAll && rows.length === 0 && d.pageNo > 1) {
        patch({ page: undefined }); // a stale page number (filters narrowed the list): back to page 1
        return;
      }
      render(d, rows, res.total, showAll);
    } catch (err) {
      if (id !== requestId || !root) return;
      (table || tbl).setMessage(i18n.t("cohort.failed", { message: errorText(err) }));
      els.count.textContent = "";
    }
  }

  /**
   * @param {ReturnType<typeof derive>} d
   * @param {any[]} rows
   * @param {number} total
   * @param {boolean} showAll
   */
  function render(d, rows, total, showAll) {
    const { i18n } = ctx;
    const tbl = /** @type {NonNullable<typeof table>} */ (table);
    if (rows.length === 0) tbl.setMessage(i18n.t("cohort.empty"));
    else tbl.setRows(rows, d.sel);
    const offset = showAll ? 0 : (d.pageNo - 1) * d.size;
    els.count.textContent = rows.length
      ? i18n.t("cohort.count", { from: offset + 1, to: offset + rows.length, total })
      : i18n.t("cohort.count_none");
    const pages = Math.max(1, Math.ceil(total / d.size));
    // The pager keeps its row (visibility, not display) so the table never jumps when it appears.
    els.pager.style.visibility = showAll || pages === 1 ? "hidden" : "visible";
    els.pageInfo.textContent = i18n.t("cohort.page", { page: d.pageNo, pages });
    els.prev.disabled = d.pageNo <= 1;
    els.next.disabled = d.pageNo >= pages;
    els.sizeSel.disabled = showAll;
  }

  return { mount, update, unmount };
}
