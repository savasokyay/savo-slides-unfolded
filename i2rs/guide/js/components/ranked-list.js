// @ts-check
// WP-141: the RANKED LIST of the top-K task - the model's answer to "which films would you put at the top of this user's list", drawn as a list instead of the
// co-rated sub-matrix (the top-K walk has no film to predict, so there is no sub-matrix to show). One row per film of the `ranked` table: its rank, the film (the
// name gives way before the year, WP-135), the score to four decimals, a "seen" badge for a film the user has rated (candidates "all": display only), a check for the
// relevant ones (score >= the threshold), and - for the row the step is about - what the score is made of (`why`: for a factor model mu + b_u + b_j + p.q with the
// numbers) in a strip under the list, one line reserved so the rows never move with the step.
// The player drives it with the references every table has (`reveal_upto`, `sort_by`, `focus_rows`) and a `table` highlight in the "selected" style for the cut
// (util/ranked.js holds the rules and is checked under node): the rows appear as they are scored, in candidate order; the ranking step sorts them by score
// (FLIP, like the candidate table); the cut draws the K line under the last kept row and fades the rest.
// A model that cannot score every film (EASE leaves out the films with too few raters) says how many it left out: `meta.topk.n_unscored`, one note under the caption.
// A model that ranks by a SCORE rather than a rating (BPR, EASE) has no relevance threshold: its rows carry `relevant: null` and `meta.topk.threshold` is null -
// the relevant column and the threshold chip are then not drawn (plan section 7a).
// WP-198: the content page's list (`meta.request.engine` "content_based", the three methods) explains ITS method, not the factor models': a film it leaves out is one with no
// term in the selected fields (the cosine is undefined), not one with "too few ratings"; and the taste-profile method (`result.kind` "score") lists cosines, not ratings, so
// the Score column's hover text says what the number is and why it is small.
// Reads `trace.tables.ranked` and `trace.meta.topk` (docs/plans/2610101900-topk-task-switch.md section 7); a trace without the table shows one sentence.

import { phaseReached } from "../util/column-phase.js";
import { keepInView } from "../util/scroll-within.js";
import { countText } from "../util/topk.js";
import { cellKnown, hasRelevance, isRankedTable, rankedState } from "../util/ranked.js";
import { fillClampedTitle } from "../util/title-clamp.js"; // WP-135
import { entityLabel } from "../util/user-link.js"; // WP-193

/**
 * @param {HTMLElement} root the panel's body
 * @param {{i18n: any, tableId?: string}} ctx
 */
export function createRankedList(root, ctx) {
  const { i18n } = ctx;
  const tableId = ctx.tableId || "ranked";
  /** @type {any} */
  let table = null;
  /** @type {any} */
  let topk = null;
  /** WP-198: the trace is the content page's (its texts name its own method) @type {boolean} */
  let contentBased = false;
  /** WP-198: ... and ranks by the taste profile's cosine (`result.kind` "score"), not by a predicted rating @type {boolean} */
  let cosineScore = false;
  /** @type {HTMLElement | null} */
  let list = null;
  /** @type {HTMLElement | null} */
  let headRow = null;
  /** @type {HTMLElement | null} */
  let noneEl = null;
  /** @type {HTMLElement | null} */
  let whyEl = null;
  /** @type {HTMLElement | null} */
  let cutEl = null;
  /** @type {HTMLElement[]} */
  let rowEls = [];
  /** the cells of the columns that belong to a phase: "?" until the player reaches it @type {{el: HTMLElement, column: any, value: unknown}[]} */
  let phasedCells = [];
  /** @type {string} the order the rows last stood in (a key), so a step that moves nothing does not animate */
  let lastOrder = "";
  /** @type {number[]} */
  let focusRows = [];
  /** @type {number | null} the row the pointer is over (its numbers show in the strip) */
  let hovered = null;

  /** @param {string} tag @param {string} className @param {string} [text] @returns {HTMLElement} */
  function el(tag, className, text) {
    const e = document.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** @param {string} key */
  function idle(key) {
    root.replaceChildren(el("p", "formula-idle", i18n.t(key)));
    table = null;
    list = null;
    rowEls = [];
  }

  function build() {
    root.replaceChildren();
    rowEls = [];
    phasedCells = [];
    lastOrder = "";
    focusRows = [];
    hovered = null;
    cutEl = null;
    noneEl = null;
    if (!isRankedTable(table)) {
      idle("ranked.idle");
      return;
    }
    const lang = typeof i18n.lang === "function" ? i18n.lang() : "en";
    const rows = /** @type {any[]} */ (table.rows);
    const hasSeen = rows.some((r) => r.seen);
    const relevance = hasRelevance(table, topk);
    const wrap = el("div", "ranked");
    wrap.classList.toggle("has-seen", hasSeen);
    wrap.classList.toggle("has-relevance", relevance);

    // -- the caption: what the list is, the relevance threshold ---------------------------------------------------------------------------------------------
    const caption = el("div", "ranked-caption");
    const lead = el("span", "ranked-lead");
    if (topk) {
      lead.textContent = i18n.t(topk.candidates_mode === "all" ? "ranked.lead_all" : "ranked.lead", {
        k: topk.k,
        candidates: countText(topk.n_candidates, lang),
        items: countText(topk.n_items, lang),
      });
    }
    caption.appendChild(lead);
    if (relevance && topk && Number.isFinite(topk.threshold)) {
      const chip = el("span", "chip ranked-threshold", i18n.t("ranked.relevant_chip", { threshold: topk.threshold }));
      chip.title = i18n.t("ranked.relevant_tip", { threshold: topk.threshold });
      caption.appendChild(chip);
    }
    wrap.appendChild(caption);
    if (hasSeen) wrap.appendChild(el("p", "ranked-note", i18n.t("ranked.all_note")));
    // films the model has no score for (EASE: too few raters) are counted but never ranked; the note appears only when there are some
    // WP-198: the content page's films are left out for another reason (no term in the selected fields), so it has its own sentence
    // WP-203: one film is "1 more film has no ...", not "1 more films have no ..." (the sentence has its own singular, like the other counts: `_one`)
    if (topk && topk.n_unscored > 0) {
      const note = contentBased ? "ranked.unscored_note_cb" : "ranked.unscored_note";
      wrap.appendChild(el("p", "ranked-note ranked-unscored", i18n.t(topk.n_unscored === 1 ? `${note}_one` : note, { n: countText(topk.n_unscored, lang) })));
    }

    // -- the list: a head row, one row per film -------------------------------------------------------------------------------------------------------------
    list = el("div", "ranked-table");
    list.setAttribute("role", "table");
    headRow = el("div", "ranked-row ranked-head");
    for (const [key, cls] of /** @type {const} */ ([["rank", "r-rank"], ["film", "r-film"], ["score", "r-score"], ["seen", "r-seen"], ["relevant", "r-rel"]])) {
      if ((key === "seen" && !hasSeen) || (key === "relevant" && !relevance)) continue;
      const cell = el("span", `ranked-cell ${cls}`, i18n.t(`ranked.head_${key}`));
      // WP-198: the taste-profile method's Score column is a cosine (a relevance score, small with many fields), not a rating
      const tipKey = key === "score" && cosineScore ? "ranked.head_score_tip_cosine" : `ranked.head_${key}_tip`;
      cell.title = i18n.t(tipKey, key === "relevant" ? { threshold: topk?.threshold } : undefined);
      headRow.appendChild(cell);
    }
    const rankColumn = table.columns.find((/** @type {any} */ c) => c.key === "rank");
    rows.forEach((row, i) => {
      const tr = el("div", "ranked-row");
      tr.dataset.index = String(i);
      tr.classList.toggle("is-seen", Boolean(row.seen));
      tr.classList.toggle("is-relevant", row.relevant === true);
      // the rank: a column of the phase "rank" (`Column.phase`) shows "?" until the ranking step; the number stays in the cell, hidden, so the column keeps its width
      const rank = el("span", "ranked-cell r-rank phase-cell");
      rank.appendChild(el("span", "cv", String(row.rank)));
      if (rankColumn) phasedCells.push({ el: rank, column: rankColumn, value: row.rank });
      tr.appendChild(rank);
      // the film: the name gives way before the year; the full title is the hover text of the film cell
      const film = el("span", "ranked-cell r-film");
      // WP-193: a film the server tagged with an address (`film_url`, every mode: films are public data) is a link, written with the same clamp as the tables' film cells
      // (util/user-link.js `entityLabel`: it opens in a new tab and does not bubble its click); a row with no address is the plain clamped name it was
      /** @type {HTMLElement} */
      let name;
      if (row.film_url) {
        name = entityLabel({ label: String(row.title ?? ""), film_url: row.film_url }, { t: (k, p) => i18n.t(k, p), clamp: true, className: "ranked-title" });
      } else {
        name = el("span", "ranked-title");
        fillClampedTitle(name, String(row.title ?? ""));
      }
      film.appendChild(name);
      film.title = String(row.title ?? "");
      tr.appendChild(film);
      tr.appendChild(el("span", "ranked-cell r-score num", Number(row.score).toFixed(4)));
      if (hasSeen) {
        const seen = el("span", "ranked-cell r-seen");
        if (row.seen) {
          const pill = el("span", "pill ranked-seen", i18n.t("ranked.seen"));
          pill.title = i18n.t("ranked.seen_tip");
          seen.appendChild(pill);
        }
        tr.appendChild(seen);
      }
      if (relevance) {
        const rel = el("span", `ranked-cell r-rel${row.relevant ? " is-yes" : ""}`, row.relevant ? "✓" : "—");
        rel.title = i18n.t(row.relevant ? "ranked.relevant_yes" : "ranked.relevant_no", { threshold: topk?.threshold });
        tr.appendChild(rel);
      }
      tr.addEventListener("mouseenter", () => {
        hovered = i;
        paintWhy();
      });
      tr.addEventListener("mouseleave", () => {
        if (hovered === i) hovered = null;
        paintWhy();
      });
      rowEls.push(tr);
    });
    cutEl = el("div", "ranked-cut");
    cutEl.appendChild(el("span", "ranked-cut-label", i18n.t("ranked.cut", { k: topk?.k ?? "" })));
    if (!rows.length) noneEl = el("p", "ranked-none", i18n.t("ranked.none"));
    list.replaceChildren(headRow, ...(noneEl ? [noneEl] : []), ...rowEls);
    wrap.appendChild(list);
    whyEl = el("div", "ranked-why");
    wrap.appendChild(whyEl);
    root.appendChild(wrap);
    paintWhy();
  }

  /** the numbers behind the score of the row the step is about (or the one under the pointer) */
  function paintWhy() {
    if (!whyEl) return;
    const at = hovered ?? (focusRows.length ? focusRows[0] : null);
    const row = at === null ? null : table.rows[at];
    const text = row?.why ? `${row.title}: ${row.why}` : "";
    whyEl.textContent = text || i18n.t("ranked.why_hint");
    whyEl.title = text; // the line is one line: a long film name or formula is read in full here
    whyEl.classList.toggle("is-hint", !text);
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      table = trace.tables?.[tableId] || null;
      topk = trace.meta?.topk ? { ...trace.meta.topk, candidates_mode: trace.meta?.request?.candidates } : null;
      contentBased = trace.meta?.request?.engine === "content_based"; // WP-198: the name the content engine's top-K trace is built under (engines/cb/explain_topk.py)
      cosineScore = contentBased && trace.result?.kind === "score"; // the taste-profile method; the item and model methods list predicted ratings (`kind` "rating")
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!table || !list || !headRow) return;
      const phaseIds = (frame.trace?.phases || []).map((/** @type {{id: string}} */ p) => p.id);
      const now = frame.phase ? frame.phase.id : null;
      const state = rankedState(table, frame, { cutReached: phaseIds.includes("cut") && phaseReached(phaseIds, now, "cut"), k: topk ? topk.k : null });
      for (const cell of phasedCells) cell.el.classList.toggle("masked", !cellKnown(cell.column, cell.value, phaseIds, now));
      focusRows = state.focus;
      rowEls.forEach((tr, i) => {
        tr.classList.toggle("hidden-row", !state.visible[i]);
        tr.classList.toggle("is-focus", state.focus.includes(i));
        const kept = state.selected.has(i);
        tr.classList.toggle("is-selected", kept);
        tr.classList.toggle("is-below-cut", state.cutAfter !== null && !kept);
      });
      // the order: the rows stand where the step puts them, the K line under the last kept one (no line before the cut); a changed order slides (FLIP)
      const key = `${state.order.join(",")}|${state.cutAfter}`;
      if (key !== lastOrder) {
        // the first drawing of a trace (a deep link to a step, a new K) takes its place without sliding: only a step the reader takes moves the rows
        const slide = lastOrder !== "";
        const before = new Map(rowEls.map((e) => [e, e.getBoundingClientRect().top]));
        /** @type {HTMLElement[]} */
        const nodes = [];
        state.order.forEach((index, position) => {
          nodes.push(rowEls[index]);
          if (state.cutAfter === position && cutEl) nodes.push(cutEl);
        });
        list.replaceChildren(headRow, ...(noneEl ? [noneEl] : []), ...nodes);
        if (slide) {
          // FLIP: put every moved row back at its old place with no transition, commit that with ONE reflow, then let it slide to its new place. (No requestAnimationFrame: a hidden
          // or throttled page never runs it, and the rows would stay where the invert put them.)
          const moved = rowEls.filter((tr) => Math.abs((before.get(tr) ?? 0) - tr.getBoundingClientRect().top) >= 1);
          for (const tr of moved) {
            tr.style.transition = "none";
            tr.style.transform = `translateY(${(before.get(tr) ?? 0) - tr.getBoundingClientRect().top}px)`;
          }
          if (moved.length) void list.offsetHeight;
          for (const tr of moved) {
            tr.style.transition = "transform .35s ease";
            tr.style.transform = "";
          }
        }
        lastOrder = key;
      }
      paintWhy();
      const first = state.focus.length ? rowEls[state.focus[0]] : null;
      if (first && state.visible[state.focus[0]]) keepInView(root, first);
    },
  };
}
