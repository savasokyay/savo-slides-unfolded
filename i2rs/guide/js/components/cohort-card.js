// @ts-check
// WP-83: the detail card beside the Users / Items table - a Letterboxd-profile-like preview.
// No selection: the dataset's summary (users, items, ratings, sparsity, average ± std, median and
// the rating histogram). A selected user: label + cohort, RATED / WATCHED / DIARY / AVERAGE /
// MEDIAN / RANGE tiles, the big histogram, top genres, highest rated, most recent and a door into
// the uCF page. A selected item: title, genres, ids, RATERS / CLASS RATERS / AVERAGE / MEDIAN /
// RANGE, the histogram, the mean per cohort, the most recent raters and a door into the iCF page.
// A static bundle has no detail endpoint, so a card built from the table row alone (`partial`)
// shows the tiles and the histogram and says the lists need the live server.
//
// The card knows no network: the page fetches and calls `showSummary / showUser / showItem /
// showLoading / showError`. Tile values are `--navy` (the logo's gold is below AA contrast on a
// white card; it stays the colour of the signed-off badge). The card folds into a 36 px rail; the
// choice is remembered (`localStorage i2rs.cohortCard`).
// WP-100: an item's card lists EVERY class rater (up to the server's cap) as a table - who | when | rating - whose
// Date / Rating headers sort it; the order is the server's (`order=recent|top|bottom`), so a click asks the page
// (`onItemOrder`) and the page hands the re-ordered detail to `updateItemRatings` (the card keeps its scroll position).
// WP-98: a user's `traits` (when the API sends them) add a "Rating profile" block above Top genres - a radar of
// six scores, each in its own unit, at the histogram's width - and the dominant chip beside the name
// (trait-radar.js). A2: no cohort numbers or ranks; the tooltips' cut-offs come with the user's `traits`, the chip
// words / unit keys / tooltip keys from `/api/meta` `traits` (`traitsMeta`).

import { fmtDate, fmtStars } from "../util/format.js";
import { entityLabel } from "../util/user-link.js"; // WP-96 / WP-99
import { infoTip } from "../util/info-tip.js"; // WP-98
import { histStats, markerLegend, sparklineHist } from "./sparkline-hist.js";
import { isEmptyProfile, normalizeTraits, normalizeTraitsMeta, traitChip, traitRadar } from "./trait-radar.js"; // WP-98

const STORAGE_KEY = "i2rs.cohortCard";
const NARROW_VIEWPORT_PX = 1500; // below this the card starts folded (the table needs the room)
const CARD_PADDING_PX = 28; // .cohort-card-body horizontal padding (14 + 14)

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

/** @param {number | null | undefined} v @param {number} decimals */
function num(v, decimals) {
  return v === null || v === undefined ? "—" : v.toFixed(decimals);
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   i18n: {t: (key: string, params?: Record<string, unknown>) => string},
 *   router: {navigate: (page: string, params?: Record<string, any>) => void},
 *   kind: "user" | "item",
 *   width: number,
 *   lists: number,
 *   markerMode: "none" | "card" | "all",
 *   onClear: () => void,
 *   onItemOrder?: (order: "recent" | "top" | "bottom") => void,
 *   traitsMeta?: () => any,
 * }} opts `width` is the card width in px (histogram width follows), `lists` the rows per list,
 *   `markerMode` (config `ui.cohort_tables.hist_markers`) whether the big histogram gets its
 *   mean / median / ± std lines and the legend under it (`card` and `all` both do), `traitsMeta` the `traits`
 *   block of `/api/meta` (WP-98: the cut-offs of the profile tooltips; read when a card is drawn)
 */
export function createCohortCard(root, { i18n, router, kind, width, lists, markerMode, onClear, onItemOrder, traitsMeta }) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ params) => i18n.t(key, params);
  const panel = el("section", "panel cohort-card-panel");
  panel.setAttribute("aria-label", t("cohort.card.aria"));
  panel.style.setProperty("--cohort-card-w", `${width}px`);
  const toggle = /** @type {HTMLButtonElement} */ (el("button", "cohort-card-toggle"));
  toggle.type = "button";
  const body = el("div", "cohort-card-body");
  panel.append(toggle, body);
  root.appendChild(panel);

  let collapsed = false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    collapsed = stored === null ? window.innerWidth < NARROW_VIEWPORT_PX : stored === "1";
  } catch {
    collapsed = window.innerWidth < NARROW_VIEWPORT_PX;
  }

  /** @param {boolean} next @param {boolean} [remember] */
  function setCollapsed(next, remember = true) {
    collapsed = next;
    panel.classList.toggle("collapsed", next);
    toggle.textContent = next ? "‹" : "›";
    toggle.title = t(next ? "cohort.card.expand" : "cohort.card.collapse");
    toggle.setAttribute("aria-label", toggle.title);
    toggle.setAttribute("aria-expanded", String(!next));
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* private browsing: the fold still works for this page view */
      }
    }
  }
  toggle.addEventListener("click", () => setCollapsed(!collapsed));
  setCollapsed(collapsed, false);

  // ── building blocks ────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} title
   * @param {Node[]} [extra] pills / buttons after the title
   * @param {boolean} [clearable] a user / item card (it has the ✕): its title row also stays at the top of the card
   *   while the body scrolls (WP-95 item 24)
   * @param {{profile_url?: string | null, film_url?: string | null} | null} [link] WP-96 / WP-99: the
   *   address of the entity the title names (a user's Letterboxd profile, a film's page); the title links to it
   */
  function header(title, extra = [], clearable = false, link = null) {
    const row = el("div", clearable ? "card-head sticky" : "card-head"); // WP-95 (24)
    const h = el("h3", "", title);
    h.title = title;
    // WP-96: a user's card names the user - the title opens the Letterboxd profile (handles mode)
    if (link && (link.profile_url || link.film_url)) h.replaceChildren(entityLabel({ label: title, ...link }, { t }));
    row.appendChild(h);
    for (const node of extra) row.appendChild(node);
    if (clearable) {
      const clear = /** @type {HTMLButtonElement} */ (el("button", "card-clear", "✕"));
      clear.type = "button";
      clear.title = t("cohort.card.clear");
      clear.setAttribute("aria-label", clear.title);
      clear.addEventListener("click", onClear);
      row.appendChild(clear);
    }
    return row;
  }

  /**
   * @param {string} label
   * @param {string} value
   * @param {{sub?: string, title?: string, muted?: boolean}} [opts]
   */
  function tile(label, value, opts = {}) {
    const box = el("div", "stat-tile");
    if (opts.title) box.title = opts.title;
    box.appendChild(el("div", "tile-label", label));
    box.appendChild(el("div", `tile-value${opts.muted ? " muted" : ""}`, value));
    if (opts.sub) box.appendChild(el("div", "tile-sub", opts.sub));
    return box;
  }

  /** @param {HTMLElement[]} tiles */
  function tiles(tiles_) {
    const grid = el("div", "stat-tiles");
    for (const x of tiles_) grid.appendChild(x);
    return grid;
  }

  /**
   * @param {{mean: number | null, std: number | null, median: number | null, min: number | null, max: number | null}} s
   * @returns {HTMLElement[]} the AVERAGE / MEDIAN / RANGE tiles
   */
  function scoreTiles(s) {
    return [
      tile(t("cohort.card.tile.average"), num(s.mean, 3), {
        sub: s.mean === null ? "" : `${fmtStars(s.mean)}
± ${num(s.std, 3)}`, // two lines: one never fits a tile
        title: t("cohort.tip.std"),
      }),
      tile(t("cohort.card.tile.median"), num(s.median, 1), { sub: s.median === null ? "" : fmtStars(s.median) }),
      // no stars under the range: "★★★ – ★★★★★" is wider than a tile and the table has min / max already
      tile(t("cohort.card.tile.range"), s.min === null ? "—" : `${num(s.min, 1)}–${num(s.max, 1)}`),
    ];
  }

  /**
   * The big histogram, with the mean / median / ± std lines and their legend unless the config
   * switches the markers off or there is nothing to mark (no ratings).
   * @param {number[]} counts
   * @param {{min: number, max: number, step: number}} scale
   * @param {{mean: number | null, median: number | null, std: number | null}} stats
   */
  function histogram(counts, scale, stats) {
    const wrap = el("div", "card-hist");
    const marked = markerMode !== "none" && counts.some((c) => c > 0);
    const markers = marked
      ? {
          mean: stats.mean,
          median: stats.median,
          std: stats.std,
          labels: { mean: t("cohort.card.marker.mean"), median: t("cohort.card.marker.median"), std: t("cohort.card.marker.std") },
        }
      : undefined;
    wrap.appendChild(
      sparklineHist(counts, { scale, width: width - CARD_PADDING_PX, height: 72, captions: true, markers, i18n })
    );
    if (markers) wrap.appendChild(markerLegend(markers));
    return wrap;
  }

  /** @param {string} title */
  function section(title) {
    const box = el("div", "card-section");
    box.appendChild(el("div", "tile-label", title));
    return box;
  }

  /**
   * A cell as wide as its widest `ghosts` entry - hidden copies of the widest values the column can
   * hold - so a column has one width in every row whatever the row holds (WP-83c: "★" and "★★★★★"
   * start at the same x and a missing date never pulls the stars along).
   * @param {string} cls
   * @param {string} text
   * @param {string[]} ghosts
   */
  function cell(cls, text, ghosts) {
    const c = el("span", `card-cell ${cls}`);
    c.appendChild(el("span", "card-cell-text", text));
    for (const ghost of ghosts) {
      const g = el("span", "card-cell-ghost", ghost);
      g.setAttribute("aria-hidden", "true");
      c.appendChild(g);
    }
    return c;
  }

  /**
   * A rating list as a table of fixed columns: who | when | how much (stars, then the number).
   * `date` absent on every row = a list without the "when" column ("Highest rated"); the stars and
   * the number are the last two columns either way, so they sit at the same x in every list.
   * @param {string} title
   * @param {{label: string, rating: number, date?: string, profile_url?: string | null, film_url?: string | null}[]} rows
   * @param {{max: number}} scale the widest star string / number is that of the scale maximum
   */
  function list(title, rows, scale) {
    const box = section(title);
    box.appendChild(ratingRows(rows, scale));
    return box;
  }

  /**
   * The rows of {@link list} without its title (WP-100: the class-ratings table has its own header).
   * @param {{label: string, rating: number, date?: string, profile_url?: string | null, film_url?: string | null}[]} rows
   * @param {{max: number}} scale
   */
  function ratingRows(rows, scale) {
    const dated = rows.some((r) => r.date !== undefined);
    const ul = el("ul", dated ? "card-list" : "card-list card-list-plain");
    // "½" is wider than "★" in most fonts, so "★★★★½" can be wider than "★★★★★": reserve both
    const starsGhosts = [fmtStars(scale.max), fmtStars(scale.max - 0.5)];
    const valueGhosts = [scale.max.toFixed(1)];
    for (const r of rows) {
      const li = el("li");
      // WP-96: a rater links its user; WP-99: a film its page; WP-135: a film title that does not fit gives up its NAME, never its year
      const name = entityLabel(r, { className: "card-list-name", clamp: true, t });
      li.appendChild(name);
      if (dated) li.appendChild(cell("card-list-date", r.date ?? "—", ["0000-00-00"]));
      li.appendChild(cell("card-list-stars", fmtStars(r.rating), starsGhosts));
      li.appendChild(cell("card-list-value", r.rating.toFixed(1), valueGhosts));
      ul.appendChild(li);
    }
    return ul;
  }

  /**
   * WP-100: the class cohort's ratings of the film as a table - who | when | rating. The headers "Date" and "Rating"
   * sort it: Date is always newest first (the default), Rating toggles highest first / lowest first; the server
   * orders (ties newest first), the card only asks.
   * @type {{host: HTMLElement, scale: {max: number}} | null}
   */
  let ratingsHost = null;
  /** The table just built for an item card that `fill` has not put on the page yet (`fill` clears `ratingsHost`). */
  /** @type {{host: HTMLElement, scale: {max: number}} | null} */
  let nextRatingsHost = null;

  /**
   * @param {any} d the item detail with `scope: "class"`
   * @param {{max: number}} scale
   */
  function classRatings(d, scale) {
    const box = section(t("cohort.card.section.ratings"));
    const host = el("div", "card-class-ratings");
    box.appendChild(host);
    nextRatingsHost = { host, scale };
    drawClassRatings(host, scale, d, "recent");
    return box;
  }

  /**
   * @param {HTMLElement} host
   * @param {{max: number}} scale
   * @param {any} d
   * @param {"recent" | "top" | "bottom"} order what `d.ratings` is sorted by (the arrow on its header)
   */
  function drawClassRatings(host, scale, d, order) {
    const rows = (d.ratings || []).map(
      (/** @type {any} */ r) => ({ label: r.label, rating: r.rating, date: fmtDate(r.timestamp), profile_url: r.profile_url, film_url: r.film_url })
    );
    const starsGhosts = [fmtStars(scale.max), fmtStars(scale.max - 0.5)];
    // the header is a row of the same grid as the list rows, with the same hidden widest values, so "Date" and
    // "Rating" stand exactly over their columns
    const head = el("div", "card-list-head");
    head.appendChild(el("span", "card-list-name", t("cohort.card.col.rater")));
    /** @param {string} cls @param {string} label @param {boolean} on @param {string} arrow @param {string[]} ghosts @param {(() => void) | null} go */
    const headCell = (cls, label, on, arrow, ghosts, go) => {
      const c = el("span", `card-cell ${cls}`);
      if (go) {
        const b = /** @type {HTMLButtonElement} */ (el("button", `card-sort${on ? " active" : ""}`, on ? `${label} ${arrow}` : label));
        b.type = "button";
        b.addEventListener("click", go);
        c.appendChild(b);
      }
      for (const g of ghosts) {
        const ghost = el("span", "card-cell-ghost", g);
        ghost.setAttribute("aria-hidden", "true");
        c.appendChild(ghost);
      }
      return c;
    };
    const topFirst = order === "top";
    head.append(
      headCell("card-list-date", t("cohort.card.col.date"), order === "recent", "↓", ["0000-00-00"], () => onItemOrder?.("recent")),
      headCell("card-list-stars", t("cohort.card.col.rating"), order !== "recent", topFirst ? "↓" : "↑", starsGhosts, () =>
        onItemOrder?.(topFirst ? "bottom" : "top")
      ),
      headCell("card-list-value", "", false, "", [scale.max.toFixed(1)], null)
    );
    host.replaceChildren(head, ratingRows(rows, scale));
    const shown = rows.length;
    const total = Number(d.scope_total ?? shown);
    if (total > shown) host.appendChild(note(t("cohort.card.class_n_of_m", { n: shown, m: total })));
  }

  /** @param {string} text */
  function note(text) {
    return el("p", "card-note", text);
  }

  /** @param {string} label @param {() => void} go */
  function door(label, go) {
    const btn = /** @type {HTMLButtonElement} */ (el("button", "btn btn-primary btn-sm card-door", `${label} ↗`));
    btn.type = "button";
    btn.addEventListener("click", go);
    return btn;
  }

  /** @type {HTMLElement | null} WP-91: the "Compare with..." section of the user card on show */
  let compareSlot = null;

  /** @param {HTMLElement[]} children */
  function fill(children) {
    body.innerHTML = "";
    compareSlot = null; // WP-91: every state but a built user card has none
    ratingsHost = null; // WP-100: nor a class-ratings table
    for (const c of children) body.appendChild(c);
    body.scrollTop = 0;
  }

  /**
   * WP-98: "Rating profile" - the title with its help button and the chips of what stands out (the dominant
   * one is beside the user's name instead), then the radar as wide as the rating histogram above it.
   * @param {import("./trait-radar.js").Traits} traits
   */
  function profileBlock(traits) {
    const meta = normalizeTraitsMeta(traitsMeta?.());
    const box = el("div", "card-section trait-block");
    const head = el("div", "trait-head");
    box.appendChild(head);
    head.appendChild(el("span", "tile-label", t("cohort.card.section.profile")));
    head.appendChild(infoTip(t("cohort.trait.info"), t("cohort.card.section.profile")));
    const others = traits.chips.filter((word) => word !== traits.dominant);
    if (others.length) {
      const chips = el("div", "trait-chips");
      for (const word of others) chips.appendChild(traitChip(word, { t, traits, meta }));
      head.appendChild(chips);
    }
    box.appendChild(
      traitRadar(
        // WP-98 (A5): `chips` (which direction word the corners show), `counts` / `source` (the Mainstream tooltip's note)
        [{ axes: traits.axes, raw: traits.raw, cutoffs: traits.cutoffs, chips: traits.chips, counts: traits.counts, source: traits.source, tone: "a" }],
        { t, width: width - CARD_PADDING_PX, meta }
      )
    );
    if (isEmptyProfile(traits)) box.appendChild(note(t("cohort.trait.not_enough"))); // too few ratings for any score
    return box;
  }

  /** @param {string} cohort */
  function cohortPill(cohort) {
    return el("span", `pill tag-${cohort === "class" ? "class" : "ml"}`, t(cohort === "class" ? "cohort.class" : "cohort.ml"));
  }

  /**
   * One grid for the "by cohort" lines: the pill is one column, so the text starts at the same x
   * whatever the pill's width ("Class" vs "MovieLens") (WP-83c).
   * @param {[string, string][]} lines [cohort, text]
   */
  function cohortRows(lines) {
    const rows = el("div", "card-cohort-rows");
    for (const [cohort, text] of lines) {
      const row = el("div", "card-cohort-row");
      row.appendChild(cohortPill(cohort));
      row.appendChild(el("span", "card-cohort-text", text));
      rows.appendChild(row);
    }
    return rows;
  }

  // ── states ─────────────────────────────────────────────────────────────────────────────────

  return {
    el: panel,
    setCollapsed,
    /** @returns {boolean} */
    isCollapsed: () => collapsed,
    /** WP-91: the section a built user card reserves for "Compare with..." (null on any other state). */
    compareSlot: () => compareSlot,
    /** WP-98: the width of the rating histogram, which the radars match. */
    innerWidth: () => width - CARD_PADDING_PX,
    showLoading() {
      fill([header(t("cohort.loading")), el("div", "card-skeleton")]);
    },
    /** @param {string} message */
    showError(message) {
      fill([header(t("cohort.card.summary_title")), el("p", "warn-banner", t("cohort.card.failed", { message }))]);
    },

    /**
     * Nothing selected: the dataset in six tiles + the rating histogram.
     * @param {{stats: any, dataset: string, scale: {min: number, max: number, step: number}}} s
     */
    showSummary({ stats, dataset, scale }) {
      const counts = scaleValues(scale).map((v) => Number(stats.rating_hist?.[String(v)] ?? 0));
      const h = histStats(counts, scale);
      /** @type {HTMLElement[]} */
      const out = [header(t("cohort.card.summary_title")), el("div", "card-sub", dataset)];
      out.push(
        tiles([
          tile(t("cohort.card.tile.users"), String(stats.n_users)),
          tile(t("cohort.card.tile.items"), String(stats.n_items)),
          tile(t("cohort.card.tile.ratings"), String(stats.n_ratings)),
          tile(t("cohort.card.tile.sparsity"), `${(100 * stats.sparsity).toFixed(2)}%`),
          ...scoreTiles(h).slice(0, 2),
        ])
      );
      out.push(histogram(counts, scale, h));
      const cohorts = stats.cohorts || {};
      const named = Object.keys(cohorts);
      if (named.length > 1) {
        const box = section(t("cohort.card.by_cohort"));
        box.appendChild(
          cohortRows(
            named.map((c) => [c, t("cohort.card.cohort_line", { users: cohorts[c].n_users, ratings: cohorts[c].n_ratings })])
          )
        );
        out.push(box);
      }
      out.push(note(t("cohort.card.pick_hint")));
      fill(out);
    },

    /**
     * @param {{detail: any, dataset: string, scale: {min: number, max: number, step: number}, partial: boolean}} s
     */
    showUser({ detail: d, dataset, scale, partial }) {
      // WP-98: no `traits` (an older server, a static bundle) = no profile block and no chip, as before
      const traits = normalizeTraits(d.traits);
      const dominant = traits?.dominant ? [traitChip(traits.dominant, { t, traits, meta: normalizeTraitsMeta(traitsMeta?.()) })] : [];
      /** @type {HTMLElement[]} */
      const out = [header(d.label, [...dominant, cohortPill(d.cohort)], true, { profile_url: d.profile_url })];
      out.push(
        tiles([
          tile(t("cohort.card.tile.rated"), String(d.n_ratings)),
          tile(t("cohort.card.tile.watched"), String(d.n_watched ?? "—"), {
            title: d.n_watched === null || d.n_watched === undefined ? t("cohort.na_export") : t("cohort.tip.n_watched"),
            muted: d.n_watched === null || d.n_watched === undefined,
          }),
          tile(t("cohort.card.tile.diary"), String(d.n_diary ?? "—"), {
            title: d.n_diary === null || d.n_diary === undefined ? t("cohort.na_export") : t("cohort.tip.n_diary"),
            muted: d.n_diary === null || d.n_diary === undefined,
          }),
          ...scoreTiles(d),
        ])
      );
      out.push(histogram(d.hist || [], scale, d));
      if (d.first_ts !== null && d.first_ts !== undefined) {
        out.push(el("div", "pill card-span", t("cohort.card.span", { first: fmtDate(d.first_ts), last: fmtDate(d.last_ts) })));
      }
      if (partial) {
        out.push(note(t("cohort.card.static_note")));
      } else {
        if (traits) out.push(profileBlock(traits)); // WP-98: above Top genres
        if ((d.top_genres || []).length) {
          const box = section(t("cohort.card.section.genres"));
          const chips = el("div", "card-chips");
          for (const g of d.top_genres) {
            const chip = el("span", "chip", g.name);
            chip.appendChild(el("span", "pill", String(g.count)));
            chips.appendChild(chip);
          }
          box.appendChild(chips);
          out.push(box);
        }
        out.push(
          list(
            t("cohort.card.section.highest"),
            (d.top_rated || []).slice(0, lists).map((r) => ({ label: r.label, rating: r.rating, profile_url: r.profile_url, film_url: r.film_url })),
            scale
          ),
          list(
            t("cohort.card.section.recent"),
            (d.ratings || []).slice(0, lists).map((r) => ({ label: r.label, rating: r.rating, date: fmtDate(r.timestamp), profile_url: r.profile_url, film_url: r.film_url })),
            scale
          )
        );
      }
      // WP-91: an empty section the page fills (the card knows no network): picker + pair films
      const compare = section(t("pairfilms.compare_label"));
      if (!partial) out.push(compare);
      out.push(door(t("cohort.card.gate_ucf"), () => router.navigate("ucf", { ds: dataset, u: d.index })));
      fill(out);
      if (!partial) compareSlot = compare;
    },

    /**
     * @param {{detail: any, dataset: string, scale: {min: number, max: number, step: number}, partial: boolean, hasClass: boolean}} s
     */
    showItem({ detail: d, dataset, scale, partial, hasClass }) {
      /** @type {HTMLElement[]} */
      const out = [header(d.title, [], true, { film_url: d.film_url })]; // WP-99: the film's page
      if ((d.genres || []).length) {
        const chips = el("div", "card-chips");
        for (const g of d.genres) chips.appendChild(el("span", "chip", g));
        out.push(chips);
      }
      const ids = [];
      if (d.letterboxd_id !== null && d.letterboxd_id !== undefined) ids.push(`LBXD ${d.letterboxd_id}`);
      if (d.tmdb_id !== null && d.tmdb_id !== undefined) ids.push(`TMDB ${d.tmdb_id}`);
      ids.push(`#${d.movie_id}`);
      out.push(el("div", "card-ids mono", ids.join(" · ")));
      out.push(
        tiles([
          tile(t("cohort.card.tile.raters"), String(d.n_raters)),
          ...(hasClass ? [tile(t("cohort.card.tile.class_raters"), String(d.n_class_raters))] : []),
          ...scoreTiles(d),
        ])
      );
      out.push(histogram(d.hist || [], scale, d));
      if (partial) {
        out.push(note(t("cohort.card.static_note")));
      } else {
        const by = d.mean_by_cohort || {};
        const counts = d.raters_by_cohort || {};
        const present = ["class", "ml"].filter((c) => (counts[c] || 0) > 0);
        if (present.length > 1 || (present.length === 1 && hasClass)) {
          const box = section(t("cohort.card.by_cohort"));
          box.appendChild(
            cohortRows(present.map((c) => [c, t("cohort.card.cohort_mean", { mean: num(by[c], 3), n: counts[c] })]))
          );
          out.push(box);
        }
        if (d.scope === "class" && Number(d.scope_total) > 0) {
          out.push(classRatings(d, scale)); // WP-100: every class rater, sortable (the page fetched `scope=class`)
        } else {
          const recent = (d.ratings || []).slice(0, lists);
          const box = list(
            t("cohort.card.section.recent_raters"),
            recent.map((r) => ({ label: r.label, rating: r.rating, date: fmtDate(r.timestamp), profile_url: r.profile_url, film_url: r.film_url })),
            scale
          );
          // WP-100: a film no class member rated (a MovieLens title) keeps the short list; say how much of it that is
          if (Number(d.scope_total) > recent.length) box.appendChild(note(t("cohort.card.n_of_m", { n: recent.length, m: Number(d.scope_total) })));
          out.push(box);
        }
      }
      out.push(door(t("cohort.card.gate_icf"), () => router.navigate("icf", { ds: dataset, i: d.index })));
      fill(out);
      ratingsHost = nextRatingsHost; // WP-100: the class-ratings table (if this card has one) is now the one on show
      nextRatingsHost = null;
    },
    /**
     * WP-100: the class-ratings table of the item on show, re-ordered (a header click answered by the page).
     * The rest of the card, and its scroll position, stay as they are.
     * @param {any} detail the item detail fetched with `scope=class` and the new `order`
     * @param {"recent" | "top" | "bottom"} order
     */
    updateItemRatings(detail, order) {
      if (ratingsHost) drawClassRatings(ratingsHost.host, ratingsHost.scale, detail, order);
    },
  };
}

/**
 * The values of a rating scale, lowest first (the `rating_hist` keys are `String(value)`).
 * @param {{min: number, max: number, step: number}} scale
 */
function scaleValues(scale) {
  const n = Math.round((scale.max - scale.min) / scale.step) + 1;
  return Array.from({ length: n }, (_, k) => Math.round((scale.min + k * scale.step) * 1e4) / 1e4);
}
