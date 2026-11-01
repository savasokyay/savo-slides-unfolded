// @ts-check
// WP-91: the pair explorer's film block - for two users, which films BOTH rated (two ratings and the
// difference, largest |delta| first), which only A rated and which only B rated, with the set sizes
// and the Jaccard overlap, from GET /api/datasets/{ds}/pair-films. Each film carries data-quality
// flag chips (`unreleased`, `no_metadata`, `tv`) so the odd cases the lecture talks about - a rating
// of a film nobody could have watched yet, a film the item store knows nothing about, a TV series in
// a film catalogue - are visible next to the numbers. A flag the dataset cannot judge is never drawn
// (`flags_available`). One component serves two hosts: the uCF page's "all similarities for this
// pair" panel (pair-similarities.js) and the Users detail card (cohort-page.js "Compare with...").
// The component owns its request: a response that arrives after a newer `show()` is dropped.
// Stage 2: `mode: "raters"` is the item-item counterpart for the iCF page - the USERS who rated both
// items (and only one of them), from GET /api/datasets/{ds}/pair-raters; a row is a user with a
// cohort pill instead of a film with flags, the texts live under `pairraters.*`.
// WP-105: `layout: "columns"` (the uCF / iCF pages' second heat-panel tab) shows the three lists SIDE BY SIDE at the panel's
// full width - rated by both | only A | only B, each scrolling on its own - instead of one list under three chips, without
// the block's own heading (the tab says it), and draws the two ends (A, B) and the rows in the app's role colours (WP-106:
// users dark red, items blue). The Users card keeps the default layout.

import { flagPill as makeFlagPill } from "../util/flags.js";
import { fillClampedTitle } from "../util/title-clamp.js"; // WP-135
import { entityLabel, filmTipText, linkedText } from "../util/user-link.js"; // WP-96 / WP-99 / WP-105

const TABS = /** @type {const} */ (["common", "a", "b"]);

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

/** @param {number | null | undefined} v */
function rating(v) {
  return v === null || v === undefined ? "—" : v.toFixed(1);
}

/**
 * Signed difference with a true minus sign; both signs have the same tabular width.
 * @param {number | null | undefined} v
 */
function delta(v) {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0.0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

/**
 * @param {HTMLElement} root the host box; it is emptied and refilled
 * @param {{
 *   i18n: {t: (key: string, params?: Record<string, unknown>) => string},
 *   api: any,
 *   mode?: "films" | "raters",
 *   layout?: "tabs" | "columns",
 *   onClear?: () => void,
 *   onLoad?: (data: any) => void,
 * }} ctx `onClear` adds a remove button to the header; `onLoad` receives every successful response
 */
export function createPairFilms(root, ctx) {
  const { i18n, api } = ctx;
  const raters = ctx.mode === "raters";
  const columns = ctx.layout === "columns"; // WP-105
  const ns = raters ? "pairraters" : "pairfilms"; // the texts that differ between the two modes
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ params) => i18n.t(key, params);
  /** The two ends of the pair: users (films mode) or items (raters mode). @param {any} d */
  const ends = (d) => ({ a: raters ? d.item : d.user, b: d.other });
  /** @type {"common" | "a" | "b"} */
  let tab = "common"; // kept across `show()` calls: flipping neighbours should not reset the list
  let requestId = 0;
  /** @type {any} */
  let data = null;

  root.classList.add("pairfilms");
  if (columns) {
    root.classList.add("pf-columns");
    root.dataset.kind = raters ? "raters" : "films"; // CSS: the colour of the ends and of the rows follows the kind
  }
  /** the block's own heading (with the clear button): not in the columns layout, where the tab names it */
  const headerBlock = () => (columns ? [] : [header()]);

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  function header() {
    const head = el("div", "pairfilms-head");
    head.appendChild(el("h4", "", t(`${ns}.title`)));
    if (ctx.onClear) {
      const clear = /** @type {HTMLButtonElement} */ (el("button", "card-clear", "✕"));
      clear.type = "button";
      clear.title = t("pairfilms.clear");
      clear.setAttribute("aria-label", clear.title);
      clear.addEventListener("click", ctx.onClear);
      head.appendChild(clear);
    }
    return head;
  }

  /** @param {string} flag */
  function flagPill(flag) {
    return makeFlagPill(t, flag);
  }

  /**
   * One count chip: a label and a bold number, with an optional tooltip.
   * @param {string} label
   * @param {string} value
   * @param {string} [tip]
   */
  function countChip(label, value, tip) {
    const chip = el("span", "chip");
    chip.appendChild(el("span", "", `${label} `));
    chip.appendChild(el("strong", "num", value));
    if (tip) chip.title = tip;
    return chip;
  }

  /** @param {any} d */
  function countsRow(d) {
    const c = d.counts;
    const { a, b } = ends(d);
    const row = el("div", "pairfilms-counts");
    // WP-105: the columns layout names the two ends (a pseudonym / a film title) instead of the letters A / B
    row.append(
      countChip(t(`${ns}.count_rated`, { who: columns ? a.label : "A" }), String(c.a), a.label),
      countChip(t(`${ns}.count_rated`, { who: columns ? b.label : "B" }), String(c.b), b.label),
      countChip(t("pairfilms.count_common"), String(c.common)),
      countChip(t("pairfilms.count_jaccard"), c.jaccard === null ? "—" : c.jaccard.toFixed(4), t(`${ns}.tip_jaccard`))
    );
    return row;
  }

  /** @param {any} d */
  function tabsRow(d) {
    // chips, not a segmented control: three labels do not fit one row of a 320 px card, chips wrap
    const seg = el("div", "pairfilms-tabs");
    seg.setAttribute("role", "group");
    const labels = {
      common: t(`${ns}.tab_common`, { n: d.counts.common }),
      a: t(`${ns}.tab_only`, { who: "A", n: d.counts.only_a }),
      b: t(`${ns}.tab_only`, { who: "B", n: d.counts.only_b }),
    };
    for (const key of TABS) {
      const btn = /** @type {HTMLButtonElement} */ (el("button", key === tab ? "chip on" : "chip", labels[key]));
      btn.type = "button";
      btn.dataset.tab = key;
      btn.setAttribute("aria-pressed", String(key === tab));
      btn.addEventListener("click", () => {
        tab = key;
        draw();
      });
      seg.appendChild(btn);
    }
    return seg;
  }

  /**
   * Stage 2: how many films of a list (the whole set, also past the row cap) carry each
   * data-quality flag, as the same amber pills the rows use ("no metadata ×28"); a muted note when
   * the dataset can judge flags but this list has none. Films mode only (raters have no flags).
   * @param {any} d
   * @param {"common" | "a" | "b"} [which] the list; the active tab by default
   */
  function flagSummary(d, which = tab) {
    const counts = d.flag_counts ? d.flag_counts[which === "common" ? "common" : which === "a" ? "only_a" : "only_b"] : null;
    const judged = d.flags_available || [];
    if (raters || !counts || judged.length === 0) return null;
    const box = el("div", "pairfilms-flagsum");
    const present = judged.filter((/** @type {string} */ f) => counts[f] > 0);
    // WP-105: in the columns layout a list without flags says nothing (the line "No data-quality flags in this list" cost a row)
    if (present.length === 0) {
      if (columns) return null;
      box.appendChild(el("span", "sub", t("pairfilms.flags_none")));
    }
    for (const f of present) {
      const pill = flagPill(f);
      pill.textContent = `${t(`pairfilms.flag.${f}`)} ×${counts[f]}`;
      box.appendChild(pill);
    }
    return box;
  }

  /**
   * @param {any} d
   * @param {"common" | "a" | "b"} which
   */
  function listTable(d, which) {
    const rows = which === "common" ? d.common : which === "a" ? d.only_a : d.only_b;
    const { a, b } = ends(d);
    const wrap = el("div", "pairfilms-list table-wrap");
    if (rows.length === 0) {
      wrap.appendChild(
        el(
          "p",
          "sub pairfilms-empty",
          which === "common"
            ? t(`${ns}.empty_common`)
            : t(`${ns}.empty_only`, {
                user: which === "a" ? a.label : b.label,
                other: which === "a" ? b.label : a.label,
              })
        )
      );
      return wrap;
    }
    const table = el("table", "data-table pairfilms-table");
    const cols = which === "common" ? ["film", "a", "b", "delta"] : ["film", "rating"];
    const colgroup = el("colgroup");
    for (const c of cols) {
      colgroup.appendChild(el("col", c === "film" ? "pf-col-film" : c === "delta" ? "pf-col-num pf-col-delta" : "pf-col-num"));
    }
    const thead = el("thead");
    const tr = el("tr");
    // headers are the lecture's letters A / B (a pseudonym does not fit a 50 px column); the full names sit in the legend
    // line and in each header's tooltip. WP-105: in the columns layout the headers ARE the names (cut with an ellipsis, the
    // full name as the tooltip) and the legend is gone
    const nameA = columns ? a.label : "A";
    const nameB = columns ? b.label : "B";
    /** @type {Record<string, [string, string, string]>} [text, class, tooltip] */
    const heads = {
      film: [t(`${ns}.col_label`), "", t(`${ns}.col_label`)],
      a: [nameA, "num", a.label],
      b: [nameB, "num", b.label],
      delta: [t("pairfilms.col_delta"), "num", t(`${ns}.tip_delta`, { a: a.label, b: b.label })],
      rating: [which === "a" ? nameA : nameB, "num", which === "a" ? a.label : b.label],
    };
    for (const c of cols) {
      // WP-105: the letters A / B stand for the two ends of the pair - in the columns layout they carry their role colour
      const who = columns && (c === "a" || c === "b" || c === "rating") ? " pf-who" : "";
      const th = el("th", `${heads[c][1]}${who}`.trim(), heads[c][0]);
      // WP-135: in the columns layout the head IS the name of an end of the pair - a film in the raters layout: its name gives way, the year stays
      if (who) {
        const name = el("span");
        fillClampedTitle(name, heads[c][0]);
        th.replaceChildren(name);
      }
      th.title = heads[c][2];
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = el("tbody");
    for (const r of rows) {
      const row = el("tr");
      const film = el("td", "pf-film");
      if (raters) {
        // a user: the label and the cohort pill (the cohort tables' tag pills)
        const who = entityLabel(r, { className: "pf-title", t }); // WP-96: links the user (handles mode)
        film.appendChild(who);
        const flags = el("span", "pf-flags");
        flags.appendChild(el("span", `pill tag-${r.cohort === "class" ? "class" : "ml"}`, t(r.cohort === "class" ? "cohort.class" : "cohort.ml")));
        film.appendChild(flags);
      } else {
        // WP-99: the film's title opens its Letterboxd / TMDB page when the server knows one (every mode)
        film.appendChild(
          entityLabel(r, {
            className: "pf-title",
            text: r.title,
            title: filmTipText(r.title, r.year), // WP-105: the year once - the store's titles already end in "(year)"
            t,
          })
        );
        if (r.flags.length) {
          const flags = el("span", "pf-flags");
          for (const f of r.flags) flags.appendChild(flagPill(f));
          film.appendChild(flags);
        }
      }
      row.appendChild(film);
      if (which === "common") {
        row.append(el("td", "num", rating(r.rating_a)), el("td", "num", rating(r.rating_b)), el("td", "num pf-delta", delta(r.delta)));
      } else {
        row.appendChild(el("td", "num", rating(which === "a" ? r.rating_a : r.rating_b)));
      }
      tbody.appendChild(row);
    }
    table.append(colgroup, thead, tbody);
    wrap.appendChild(table);
    return wrap;
  }

  /** The counts row, tabs and the active list for the last response. */
  function draw() {
    if (!data) return;
    root.innerHTML = "";
    root.hidden = false;
    // WP-105: the columns layout names the two ends everywhere (counts, list headings, column heads), so it has no "A = x · B = y"
    // legend line
    if (columns) {
      root.append(countsRow(data), columnsRow(data));
      return;
    }
    const { a, b } = ends(data);
    const legend = el("p", "sub pairfilms-legend");
    // WP-96: the two users of a pair carry their profile address (handles mode); WP-99: the two films of a
    // raters pair carry their film page (every mode)
    legend.appendChild(
      raters
        ? linkedText(t, "pairfilms.legend", { a: a.label, b: b.label }, { a: a.film_url, b: b.film_url }, "film_url")
        : linkedText(t, "pairfilms.legend", { a: a.label, b: b.label }, { a: a.profile_url, b: b.profile_url })
    );
    const summary = flagSummary(data);
    root.append(...headerBlock(), legend, countsRow(data), tabsRow(data), ...(summary ? [summary] : []), listTable(data, tab));
    const shown = tab === "common" ? data.common.length : tab === "a" ? data.only_a.length : data.only_b.length;
    const total = tab === "common" ? data.counts.common : tab === "a" ? data.counts.only_a : data.counts.only_b;
    if (shown < total) root.appendChild(el("p", "sub pairfilms-note", t("pairfilms.truncated", { shown, total })));
  }

  /**
   * WP-105: the three lists side by side - each with its own heading (the set and its size), the flag summary of its films
   * and its table, scrolling on its own; a note under a list that was cut at the row cap.
   * @param {any} d
   */
  function columnsRow(d) {
    const row = el("div", "pf-cols");
    const { a, b } = ends(d);
    const role = raters ? "item" : "user"; // WP-106: the two ends are users (films mode) or items (raters mode)
    for (const which of TABS) {
      const col = el("section", "pf-col");
      col.dataset.which = which;
      const counts = d.counts;
      const head = el("h5", "pf-col-head");
      if (which === "common") {
        head.textContent = t(`${ns}.tab_common`, { n: counts.common });
      } else {
        // "Only <name> (n)": the name, not the letter - in its role colour, a link where the server gave an address
        const end = which === "a" ? a : b;
        const n = which === "a" ? counts.only_a : counts.only_b;
        head.appendChild(
          linkedText(
            t,
            `${ns}.tab_only`,
            { who: end.label, n },
            { who: raters ? end.film_url : end.profile_url },
            raters ? "film_url" : "profile_url",
            { who: role },
            { clamp: true } // WP-135: "Rated only <film> (n)" is one line: the film's name gives way, its year and the count stay
          )
        );
        head.title = t(`${ns}.tab_only`, { who: end.label, n });
      }
      col.appendChild(head);
      const summary = flagSummary(d, which);
      if (summary) col.appendChild(summary);
      col.appendChild(listTable(d, which));
      const shown = which === "common" ? d.common.length : which === "a" ? d.only_a.length : d.only_b.length;
      const total = which === "common" ? counts.common : which === "a" ? counts.only_a : counts.only_b;
      if (shown < total) col.appendChild(el("p", "sub pairfilms-note", t("pairfilms.truncated", { shown, total })));
      row.appendChild(col);
    }
    return row;
  }

  return {
    /**
     * Load and show the sets of two entities (dense indices): the films of users `a` and `b`
     * (films mode) or the raters of items `a` and `b` (raters mode).
     * @param {{dataset: string, a: number, b: number}} next
     */
    async show({ dataset, a, b }) {
      const id = (requestId += 1);
      root.hidden = false;
      root.innerHTML = "";
      root.append(...headerBlock(), el("p", "sub", t("pairfilms.loading")));
      try {
        const res = raters
          ? await api.pairRaters(dataset, { item: a, other: b })
          : await api.pairFilms(dataset, { user: a, other: b });
        if (id !== requestId) return; // a newer show() / clear() superseded this response
        data = res;
        draw();
        if (ctx.onLoad) ctx.onLoad(res);
      } catch (err) {
        if (id !== requestId) return;
        data = null;
        root.innerHTML = "";
        root.append(...headerBlock(), el("p", "warn-banner", t("pairfilms.failed", { message: errorText(err) })));
      }
    },
    /** Empty and hide the block; an in-flight response is dropped. */
    clear() {
      requestId += 1;
      data = null;
      root.innerHTML = "";
      root.hidden = true;
    },
  };
}
