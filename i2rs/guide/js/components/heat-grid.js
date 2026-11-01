// @ts-check
// WP-32: the co-rated sub-matrix as a CSS grid of real row boxes (so rows can be FLIP-reordered
// when the rank_select step sorts the candidates). Highlight styles map 1:1 to `.hl-<style>`
// classes; colour is never the only cue (outline / hatch / badge, see app.css).
// WP-117: when the view carries `row_stats`, three more fixed columns - each user's mean / median / std, the numbers the
// formula really subtracts - follow the name column and stick to the left edge with it (util/heat-stats.js decides what they show).
// WP-131: the grid draws ROWS and COLUMNS; what they are is util/heat-orient.js's business. The item-based page draws a film per row (the target
// film pinned right under the header, like the active user's row on the user-based page) and a user per column; every other page draws the
// engine's view as sent. `ctx.orientation` is fixed per grid; the trace's rows / cols / cells and the highlights of every step are mapped
// at this boundary, so what a step refers to never changes.

import { fmtRating } from "../util/format.js";
import { clampHeadLabel, labelColumnWidth } from "../util/heat-head.js"; // WP-105a
import { centredAvailable, centredTitle, centreOf, colourHalfRange, colourOf, signed } from "../util/heat-centred.js"; // WP-132
import { centreAxisOf, entityAxis, heldOutCell, orientCell, orientHighlight, orientView } from "../util/heat-orient.js"; // WP-131, WP-137
import { firstHighlightedLine, scrollLeftToReveal, scrollTopToReveal, stickyLeftWidth } from "../util/heat-reveal.js"; // WP-105a, WP-131, WP-138
import {
  STAT_KEYS,
  centreKey,
  centredColumnLines,
  centredStatCells,
  centredStatLines,
  centredStatsAvailable,
  centredStatsOffered,
  centredStoryOf,
  groupNoteKeys,
  hasStats,
  isSegmentScope,
  normKindOf,
  rowTip,
  statCells,
  statGroupWidth,
  statsStick,
} from "../util/heat-stats.js"; // WP-117, WP-131, WP-136
import { infoTip } from "../util/info-tip.js"; // WP-117
import { splitTitle } from "../util/title-clamp.js"; // WP-135
import { userLabel } from "../util/user-link.js"; // WP-96

/** Gap between the grid tracks (px), see `.heat-row` in trace.css; part of the width the sticky labels cover. */
const GRID_GAP = 3;
/** Distance kept between a revealed column and the edge of the scroll box (px). */
const REVEAL_MARGIN = 6;
/** WP-131: the widest the name column grows (px) - 150 for user names, this for film titles (one line, an ellipsis, the full title in `title`). */
const TITLE_LABEL_MAX = 230;
/** WP-136: the i18n keys of the centred story's heads and notes, written out (the key scan of tests/app/test_heat_stats.py reads the source for literal keys). */
const D_HEAD = /** @type {const} */ ({ mean: "heat.stat.d_mean_head", median: "heat.stat.d_median_head", std: "heat.stat.d_std_head" });
const STATS_NOTE = /** @type {const} */ ({ own: "heat.stats_mode.note_own", other: "heat.stats_mode.note_other" });

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, headSlot?: HTMLElement | null, orientation?: import("../util/heat-orient.js").Orientation, viewKey?: string, profileTexts?: {row?: string, userTip?: string, itemTip?: string}, alias?: Record<string, string>, labelMax?: number}} ctx `headSlot` (WP-117): an element
 *   of the panel head, outside the scroll box, that holds the (i) of the mean / median / std group; without it the group is drawn without that (i).
 *   `orientation` (WP-131): "canonical" (default: users are the rows, films the columns - the view as sent) or "transposed" (a film per row).
 *   WP-132: `mode` is the mode the cells open in ("raw" - the default - or "centred": the rating minus the centre the similarity subtracts from it,
 *   util/heat-centred.js; it falls back to raw where the view has no centred value) and `onModeChange(mode)` hears a choice made with the switch in
 *   the panel head (the page writes it to the URL); the switch lives in `headSlot` beside the (i)
 *   WP-137: the held-out cell shows `?` until the prediction step; WP-137a: `reveal` ("step" - the default - or "start", util/reveal.js) is the setting that says
 *   so, and `setReveal` follows it when the page's switch or the URL changes it; `heldRole` ("user" on the user-based page) makes the `?` box the users' red instead of
 *   the navy of the item-based and the model pages
 *   WP-136: `statsMode` ("raw" - the default - or "centred") is the story the statistic group tells, util/heat-stats.js; `onStatsModeChange(mode)` hears a choice made with
 *   the switch above the group (the page writes it to the URL), `setStatsMode` follows the URL
 *   WP-176 (stage 2): `viewKey` ("submatrix" by default) names the view of the trace the grid draws and the highlights it follows; a view with `palette: "diverging"` has SIGNED
 *   cells (the taste profile): written with a sign, coloured on the centred diverging scale around zero, no raw | centred switch
 *   WP-222: `profileTexts` ({row, userTip, itemTip}: i18n keys) say what the two kinds of row of such a view ARE - by default the taste profile's words; the weighted hybrid draws the same
 *   view for its blend weights against what the bases say, with words of its own
 *   WP-233: `alias` - display names: a column label (and the term in a cell's tip) that equals a key is written as its value (the hybrid says CBF where the engine's labels say CB)
 *   WP-235: `labelMax` - the widest the label column may be (px; the default is 150, a film-row grid's 230): the hybrid's weights grid names "α* closed-form weights" and a whole film title; `remeasure()` - measure it again
 *   (a grid built in a closed tab has no width to measure)
 */
export function createHeatGrid(root, ctx) {
  const orientation = ctx.orientation || "canonical"; // WP-131
  const viewKey = ctx.viewKey || "submatrix"; // WP-176 (stage 2): which of the trace's views this grid draws (the content page's second grid draws `profile`)
  const profileTexts = { row: "heat.profile_row", userTip: "heat.profile_p_tip", itemTip: "heat.profile_x_tip", ...(ctx.profileTexts || {}) }; // WP-222: the words of the signed view's two kinds of row
  /** @type {import("../util/heat-centred.js").CellMode} */
  let mode = ctx.mode === "centred" ? "centred" : "raw"; // WP-132: the mode asked for; the one drawn is `centredOn()`
  /** @type {Map<string, number>} */
  let values = new Map(); // WP-132: (row, column) -> rating, the cells that have one
  /** @type {HTMLElement | null} */
  let gridEl = null; // WP-132: carries `is-centred`
  /** @type {any} */
  let view = null;
  /** @type {HTMLElement[]} */
  let rowEls = [];
  /** @type {HTMLElement[][]} */
  let cellEls = [];
  /** @type {HTMLElement[]} */
  let headEls = [];
  /** @type {HTMLElement[]} */
  let statHeadEls = []; // WP-117: the three fixed statistic heads; NOT in `headEls` (highlights and the column FLIP index the film columns)
  let withStats = false; // WP-117: this view carries the mean / median / std group (`view.row_stats`)
  /** @type {import("../util/heat-stats.js").StatsMode} */
  let statsMode = ctx.statsMode === "centred" ? "centred" : "raw"; // WP-136: which story the group tells - the ratings as given (default) or the centred values (Δ)
  /** @type {HTMLElement[][]} */
  let statCellEls = []; // WP-136: per row, its three statistic cells (NOT in `cellEls`: the highlights and the column FLIP index the film cells)
  /** @type {HTMLElement | null} */
  let statSwitchEl = null; // WP-136: the "ratings | Δ" switch, standing in the white space above the group's heads
  let normKind = "length"; // WP-136: "denominator" for the adjusted cosine (the hover text says the vector length is the factor its denominator divides by), else "length"
  /** WP-136: the group tells the centred story now: asked for, and the engine sent the centred statistics. */
  const statsCentredOn = () => statsMode === "centred" && centredStatsAvailable(view);
  /** @type {HTMLElement | null} */
  let body = null;
  /** @type {HTMLElement | null} */
  let scrollEl = null; // WP-105a: the box that scrolls sideways (the grid is wider than the panel)
  let labelWidth = 72; // WP-105a: measured width of the sticky label column (px), shared by every row
  let headHeight = 0; // WP-131: measured height of the sticky header row (px): what a scroll-to-row must keep clear
  let revealKey = ""; // WP-105a: "<step>:<sub>" of the last scroll-to-column, so a step scrolls once
  /** @type {ResizeObserver | null} */
  let headHeightObserver = null; // WP-107 (d): keeps `--heat-head-h` in step with the header row
  /** @type {ResizeObserver | null} */
  let boxObserver = null; // WP-117: keeps the statistic group's sticky / loose state in step with the scroll box's width
  let statsLoose = false; // WP-117: the box is too narrow for the sticky group (trace.css `.stats-loose`): it scrolls with the films
  /** @type {string | null} */
  let currentOrder = null; // "<entity>:<order>" of the last FLIP, to skip no-op reorders
  /** @type {[number, number] | null} */
  let heldOut = null; // WP-137: the grid cell (row, column) of the held-out rating - the active user's rating of the target film - where the trace reveals it
  let revealed = false; // WP-137: the step being shown reveals it (the cell carries `hl-result`)
  /** @type {import("../util/reveal.js").RevealMode} */
  let reveal = ctx.reveal === "start" ? "start" : "step"; // WP-137a: the setting - "step" hides the cell until the prediction step, "start" shows it from the first step
  /** WP-137: this cell is the held-out one and the walk has not reached the step that reveals it: it shows `?` in every mode, with no number in its hover text. WP-137a: only while the setting is "step". */
  const hidden = (/** @type {number} */ r, /** @type {number} */ c) => heldOut !== null && reveal === "step" && !revealed && heldOut[0] === r && heldOut[1] === c;

  /**
   * WP-105a: every row is its own grid, so the label column is sized once for all of them: the widest label (min 72 px),
   * which keeps the columns of the rows aligned and tells the scroll code how much of the box the sticky labels cover.
   * @param {HTMLElement} box the scroll box (carries `--heat-label-w` for the grid and `scroll-padding-left`)
   */
  function measureLabelColumn(box) {
    box.style.setProperty("--heat-label-w", "max-content");
    const widths = [...box.querySelectorAll(".heat-rowlabel")].map((el) => el.getBoundingClientRect().width);
    const labelMax = ctx.labelMax ?? (view?.row_kind === "item" ? TITLE_LABEL_MAX : undefined); // WP-131: film titles are longer than names; WP-235: a page may name its own widest column
    labelWidth = labelMax === undefined ? labelColumnWidth(widths) : labelColumnWidth(widths, 72, labelMax);
    box.style.setProperty("--heat-label-w", `${labelWidth}px`);
  }

  /**
   * WP-117: the statistic group sticks next to the name only while at least four film columns stay visible beside it (util/heat-stats.js
   * `statsStick`); in a narrower box (a 1400 px window at 140 % zoom leaves it 365 px, the group alone covers ~260) it scrolls away with the
   * films and the name column alone stays (`.stats-loose`, trace.css). Widths are layout pixels (offsetWidth), like clientWidth.
   */
  function syncStatsSticky() {
    const box = scrollEl;
    if (!box || !withStats) return;
    const stats = statHeadEls.map((h) => h.offsetWidth);
    const film = headEls[0]?.offsetWidth ?? 0;
    if (!film || !statGroupWidth(stats, GRID_GAP)) return; // not laid out (a hidden tab / panel): keep the last state
    // WP-138: the pinned target column (users as rows) covers part of the films' room too: the group sticks only while four films stay visible beside ALL of the sticky part
    const pinnedCol = orientation === "canonical" && typeof view?.target_col === "number" ? view.target_col : null;
    const pinnedWidth = pinnedCol === null ? 0 : (headEls[pinnedCol]?.offsetWidth ?? 0);
    statsLoose = !statsStick({ clientWidth: box.clientWidth, labelWidth, statWidths: stats, gap: GRID_GAP, columnWidth: film, pinnedWidth });
    box.classList.toggle("stats-loose", statsLoose);
  }

  /**
   * WP-107 (d): the height of the sticky header row (px) is content-derived - the longest vertical title line - so it is
   * measured and handed to CSS as `--heat-head-h`, where the active user's row sticks right below it. Measured again
   * whenever the header row resizes (presentation mode scales the root font, the window may change the column widths).
   * @param {HTMLElement} box the scroll box
   * @param {HTMLElement} headRow the header row
   */
  function trackHeadHeight(box, headRow) {
    headHeightObserver?.disconnect();
    const write = () => {
      headHeight = headRow.getBoundingClientRect().height; // WP-131
      box.style.setProperty("--heat-head-h", `${headHeight}px`);
    };
    write();
    if (typeof ResizeObserver === "undefined") return;
    headHeightObserver = new ResizeObserver(write);
    headHeightObserver.observe(headRow);
  }

  /**
   * WP-105a: a column header is the film title written vertically in at most two lines (clampHeadLabel); the full
   * title stays in `title`. WP-131: on the item-based page the headers are USERS (the active user's is `is-active`) and the title also reads the
   * user's statistics - the centre the formula subtracts from that user's ratings is the mean there (see `columnTip`).
   * @param {string} label
   * @param {boolean} isTarget
   * @param {string | null} [role] the column's user role (transposed grid only)
   * @param {string} [extra] more lines for the hover text
   * @returns {HTMLElement}
   */
  function headCell(label, isTarget, role = null, extra = "") {
    label = ctx.alias?.[label] ?? label; // WP-233: the page's own name for a label the engine sends (the hybrid says CBF where the engine's columns say CB)
    const h = document.createElement("div");
    h.className = "heat-head" + (isTarget ? " is-target" : "") + (role === "active" ? " is-active" : "");
    const text = document.createElement("span");
    text.className = "heat-head-text";
    for (const line of clampHeadLabel(label).lines) {
      const part = document.createElement("span");
      part.className = "heat-head-line";
      part.textContent = line;
      text.appendChild(part);
    }
    h.appendChild(text);
    h.title = extra ? `${label}\n${extra}` : label;
    return h;
  }

  /**
   * WP-176: the hover text of a TERM column header (the content page's film x term table): which field the term comes from and how the profile writes it (the field's prefix
   * keeps one token of two fields two terms: `genre:Drama`, `kw:heist`).
   * @param {number} c column index
   * @returns {string} "" when the view carries no `col_meta` (an older payload)
   */
  function termTip(c) {
    const meta = view.col_meta?.[c];
    return meta?.field ? ctx.i18n.t("heat.term_tip", { field: meta.field, key: meta.key ?? view.col_labels[c] }) : "";
  }

  /** WP-176: the columns are the terms of the target film's profile (the content page's films x terms table), not films or users */
  const termColumns = () => view?.col_kind === "term";
  /** WP-176 (stage 2): the view's cells are signed values around zero (the taste profile), drawn on the centred diverging palette */
  const signedCells = () => view?.palette === "diverging";
  /** WP-176 (stage 2): what row `r` is - a view may mix users and films (`row_kinds`: the taste profile and its target film), else the view's own kind */
  const rowKindOf = (/** @type {number} */ r) => view?.row_kinds?.[r] ?? view?.row_kind;

  /**
   * WP-176: the figure of a cell: a rating with one decimal, a term's weight (tf x idf, the content page) with two - the weights are 0.3 ... 3, so one decimal would
   * merge 2.15 and 2.08.
   * @param {number} v
   * @returns {string}
   */
  const cellText = (v) => (signedCells() ? signed(v) : termColumns() ? v.toFixed(2) : fmtRating(v));

  /**
   * WP-176: the hover text of a weight cell: the film, the term (with its field's prefix) and the four-digit weight the formula uses.
   * @param {number} r grid row
   * @param {number} c grid column
   * @param {number} v
   * @returns {string}
   */
  function termCellTip(r, c, v) {
    const rawTerm = view.col_meta?.[c]?.key ?? view.col_labels[c];
    const term = ctx.alias?.[rawTerm] ?? rawTerm; // WP-233: aliased like the column header (a base's name on the hybrid page)
    // the taste profile's rows say what the number is: the user's preference p(t) (signed), the film's weight x(t)
    if (signedCells()) return ctx.i18n.t(rowKindOf(r) === "user" ? profileTexts.userTip : profileTexts.itemTip, { row: view.row_labels[r], term, x: signed(v, 4) });
    return ctx.i18n.t("heat.term_cell_tip", { item: view.row_labels[r], term, x: v.toFixed(4) });
  }

  /** WP-131: the suffix of the i18n keys that say "film" instead of "user" (`heat.stat.<key>_tip_item`): the group beside a film row is the FILM's. */
  const tipSuffix = () => (view?.row_kind === "item" ? "_item" : "");

  /**
   * WP-131: the hover text of a USER column header (the item-based grid): the user's mean / median / std - the numbers the formula subtracts from
   * that user's ratings - and the sentence that says over how many ratings they are (the active user's leaves the target out). Lines of the same
   * i18n keys as the user rows of the other grid, so a number reads the same wherever it is shown.
   * @param {number} c column index
   * @returns {string} "" when the view has no statistics for that user
   */
  function columnTip(c) {
    if (statsCentredOn()) {
      // WP-136: the group tells the centred story: the user's centred statistics, the counts and the vector length (the lines of util/heat-stats.js), not the raw ones
      const centred = centredColumnLines({ stat: view.col_stats_centred?.[c], raw: view.col_stats?.[c], normKind }).map((line) => ctx.i18n.t(line.key, line.params));
      if (centred.length) return centred.join("\n");
    }
    const stat = view.col_stats?.[c];
    if (!stat) return "";
    const lines = statCells(stat)
      .filter((info) => !info.missing)
      .map((info) => `${ctx.i18n.t(`heat.stat.${info.key}_tip`)}: ${info.full}`);
    const tip = rowTip({
      stat,
      role: view.col_roles?.[c],
      noteKey: view.centre_note_key,
      scope: view.cols_scope,
      kind: "user",
      includesTarget: view.col_includes_target,
    });
    if (tip) lines.push(ctx.i18n.t(tip.key, tip.params));
    return lines.join("\n");
  }

  /**
   * WP-117: a head cell of the statistic group ("mean" / "median" / "std"). A horizontal text, right-aligned like the numbers below it;
   * its hover text says what the statistic is. Sticky like the name column (trace.css `.heat-stat-head`); not a `.heat-head`, which is
   * the vertical film title.
   * @param {"mean" | "median" | "std"} key
   * @param {number} i position in the group (0-2)
   * @param {"mean" | "median" | null} centre the statistic the formula subtracts
   * @returns {HTMLElement}
   */
  function statHeadCell(key, i, centre) {
    const h = document.createElement("div");
    h.dataset.stat = key;
    paintStatHead(h, key, i, centre);
    return h;
  }

  /**
   * WP-136: write a head of the group in the story drawn. The ratings: the word ("mean"), the hover text of the statistic (WP-131: "of the film's ratings" beside a film
   * row), the statistic the formula subtracts marked `is-centre`. The centred values: a "Δ" over the word ("Δ" / "mean": two short lines, the columns are narrow), the hover
   * text of the Δ statistic, nothing emphasised (what the formula subtracts is the row's centre, which is no statistic of the centred values).
   * @param {HTMLElement} h
   * @param {"mean" | "median" | "std"} key
   * @param {number} i
   * @param {"mean" | "median" | null} centre
   */
  function paintStatHead(h, key, i, centre) {
    const centred = statsCentredOn();
    h.className = `heat-stat-head stat-${i}` + (!centred && key === centre ? " is-centre" : "") + (centred ? " is-centred" : "");
    if (centred) {
      const delta = document.createElement("span");
      delta.className = "heat-stat-delta";
      delta.textContent = "Δ";
      const word = document.createElement("span");
      word.textContent = ctx.i18n.t(`heat.stat.${key}`);
      h.replaceChildren(delta, word);
      h.title = ctx.i18n.t(D_HEAD[key]);
    } else {
      h.textContent = ctx.i18n.t(`heat.stat.${key}`);
      h.title = ctx.i18n.t(`heat.stat.${key}_tip${tipSuffix()}`); // WP-131: "of the film's ratings" beside a film row
    }
  }

  /**
   * WP-136: the three cells of a row's group, in the story drawn: the figures of `statCells` (the ratings as given: the three decimals and the median's small tail) or of
   * `centredStatCells` (the centred values: a sign and two decimals, "—" where the vector holds no rating), and the hover text - the ratings' sentence (WP-131: how many
   * ratings, whether the target is in) or the centred lines (the figure, both counts when they differ, the vector length, the ratings-as-given counterpart).
   * @param {HTMLElement[]} cells the row's three cell elements
   * @param {number} r grid row
   * @param {"mean" | "median" | null} centre the statistic the formula subtracts (raw story only)
   */
  function paintStatRow(cells, r, centre) {
    const centred = statsCentredOn();
    const stat = view.row_stats[r];
    // WP-131: the sentence follows what the row IS (a user, or a film) and the engine's flags (scope of THESE statistics, target included or not)
    const tip = centred
      ? null
      : rowTip({
          stat,
          role: view.row_roles[r],
          noteKey: view.centre_note_key,
          scope: view.rows_scope,
          kind: view.row_kind,
          includesTarget: view.row_includes_target,
        });
    const tipText = tip ? ctx.i18n.t(tip.key, tip.params) + (tip.scopeKey ? ` ${ctx.i18n.t(tip.scopeKey)}` : "") : "";
    const infos = centred ? centredStatCells(view.row_stats_centred[r]) : statCells(stat);
    infos.forEach((info, i) => {
      const s = cells[i];
      s.className = `heat-stat stat-${i}` + (info.missing ? " is-missing" : "") + (!centred && info.key === centre ? " is-centre" : "");
      // one inline box holds the number, so a smaller tail ("2." + "25" of a median) shares its baseline (the cell itself is a flex container)
      const num = document.createElement("span");
      num.textContent = info.lead;
      if (info.tail) {
        const tail = document.createElement("span");
        tail.className = "heat-stat-small";
        tail.textContent = info.tail;
        num.appendChild(tail);
      }
      s.replaceChildren(num);
      if (centred) {
        // WP-136: a row with no rating in the formula's vectors says so (the cell shows a dash); every other cell its figure, the counts and the length
        const lines = centredStatLines({ key: info.key, stat: view.row_stats_centred[r], raw: stat, normKind }).map((line) => ctx.i18n.t(line.key, line.params));
        s.title = lines.join("\n");
        return;
      }
      // the hover text keeps the four-digit value (the formula panel's number) beside the three the cell shows, then the row's sentence
      if (!info.missing) s.title = `${ctx.i18n.t(`heat.stat.${info.key}_tip${tipSuffix()}`)}: ${info.full}` + (tipText ? `
${tipText}` : "");
      else s.title = tipText;
    });
  }

  /**
   * WP-136: the switch "ratings | Δ" in the white space above the group's heads (the header row is as tall as the longest vertical title; the heads sit at its bottom). It is the
   * last head's child, positioned over the three columns (trace.css), small and dim like the (i) beside it. The Δ half is switched off - kept focusable, its tip says why -
   * where the engine sent no centred statistics (the formula subtracts no shown number, a trained model's grid).
   * @returns {HTMLElement}
   */
  function statsSwitch() {
    const available = centredStatsAvailable(view);
    const seg = document.createElement("div");
    seg.className = "heat-stat-switch";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", ctx.i18n.t("heat.stats_mode.group"));
    for (const m of /** @type {const} */ (["raw", "centred"])) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = ctx.i18n.t(`heat.stats_mode.${m}`);
      b.dataset.value = m;
      const off = m === "centred" && !available;
      if (off) b.setAttribute("aria-disabled", "true");
      b.title = off ? ctx.i18n.t("heat.stats_mode.unavailable") : ctx.i18n.t(`heat.stats_mode.${m}_tip`);
      b.addEventListener("click", (event) => {
        event.stopPropagation();
        if (off || (m === "centred") === statsCentredOn()) return;
        setStatsMode(m);
        ctx.onStatsModeChange?.(m);
      });
      seg.appendChild(b);
    }
    markStatsSwitch(seg);
    return seg;
  }

  /** WP-136: mark the pressed half of the switch (the story drawn). @param {HTMLElement} seg */
  function markStatsSwitch(seg) {
    seg.dataset.value = statsCentredOn() ? "centred" : "raw";
    for (const b of /** @type {HTMLElement[]} */ ([...seg.children])) {
      const pressed = (b.dataset.value === "centred") === statsCentredOn();
      b.classList.toggle("active", pressed);
      b.setAttribute("aria-pressed", String(pressed));
    }
  }

  /**
   * WP-136: the group tells the other story now: the heads, every row's cells, the user column heads' hover text (the item-based grid), the switch and the (i) are written
   * again where they stand; the highlights, the order and the scroll position stay as they are. The columns keep their widths (one width for both stories,
   * trace.css `--heat-stat-w-*`), so nothing moves.
   */
  function refreshStats() {
    if (!withStats) return;
    const centre = centreKey(view.row_centre);
    statHeadEls.forEach((h, i) => paintStatHead(h, STAT_KEYS[i], i, centre));
    if (statSwitchEl) statHeadEls[statHeadEls.length - 1]?.appendChild(statSwitchEl); // the heads' repaint cleared the last one's children
    statCellEls.forEach((cells, r) => paintStatRow(cells, r, centre));
    if (view.col_kind === "user") headEls.forEach((h, c) => (h.title = columnTipTitle(c)));
    if (statSwitchEl) markStatsSwitch(statSwitchEl);
  }

  /**
   * WP-136: the hover text of a user column head (the item-based grid): its name, then the user's statistics in the story drawn.
   * @param {number} c
   * @returns {string}
   */
  function columnTipTitle(c) {
    const extra = columnTip(c);
    const label = view.col_labels[c];
    return extra ? `${label}\n${extra}` : label;
  }

  /**
   * WP-136: ask for a story (the switch, or the page following the URL).
   * @param {import("../util/heat-stats.js").StatsMode} next
   */
  function setStatsMode(next) {
    statsMode = next === "centred" ? "centred" : "raw";
    refreshStats();
    renderGroupInfo();
  }

  /** WP-132: the centred mode is drawn: asked for, and the view has a centre to subtract. */
  const centredOn = () => mode === "centred" && centredAvailable(view);

  /**
   * WP-132: the half-range of the colour scale as the (i) writes it: "2.25" ("2,25" in Turkish).
   * @returns {string}
   */
  function halfRangeText() {
    const text = String(colourHalfRange(view?.scale));
    return ctx.i18n.lang?.() === "tr" ? text.replace(".", ",") : text;
  }

  /**
   * WP-132: the switch "raw | centred" of the panel head. The centred half is switched off (kept focusable, its tip says why) where the view has no centred
   * value: a measure that subtracts none of the numbers shown, a trained model. It is the app's segmented control (trace.css `.miniseg`).
   * @returns {HTMLElement}
   */
  function modeSwitch() {
    const available = centredAvailable(view);
    const seg = document.createElement("div");
    seg.className = "miniseg heat-mode";
    seg.dataset.value = centredOn() ? "centred" : "raw";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", ctx.i18n.t("heat.mode.group"));
    for (const m of /** @type {const} */ (["raw", "centred"])) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = ctx.i18n.t(`heat.mode.${m}`);
      b.dataset.value = m;
      const pressed = (m === "centred") === centredOn();
      b.classList.toggle("active", pressed);
      b.setAttribute("aria-pressed", String(pressed));
      const off = m === "centred" && !available;
      if (off) b.setAttribute("aria-disabled", "true");
      b.title = off ? ctx.i18n.t("heat.mode.unavailable") : ctx.i18n.t(`heat.mode.${m}_tip`);
      b.addEventListener("click", () => {
        if (off || pressed) return;
        setMode(m);
        ctx.onModeChange?.(m);
      });
      seg.appendChild(b);
    }
    return seg;
  }

  /**
   * WP-117: the head of the panel beside its title (outside the scroll box, whose overflow would clip a bubble): WP-132 the switch "raw | centred",
   * then the (i) of the statistic group. The (i) carries the engine's note on the centre - which statistic the formula subtracts, and how the active
   * user's differs - and, while the cells are centred, how to read them and the colour scale; it is empty without a note.
   */
  function renderGroupInfo() {
    const slot = ctx.headSlot;
    if (!slot) return;
    slot.replaceChildren();
    if (view && !termColumns()) slot.appendChild(modeSwitch()); // WP-132; WP-176: a film x term table holds weights, no ratings to centre
    const key = withStats ? view?.centre_note_key : null;
    if (typeof key !== "string" || !key) return;
    // WP-131: beside a film row the note is the film group's (util/heat-stats.js `groupNoteKeys`: its own text, else the engine's key)
    const itemRows = view.row_kind === "item";
    let note = null;
    for (const candidate of groupNoteKeys({ noteKey: key, axis: centreAxisOf(view), rowKind: view.row_kind })) {
      const found = ctx.i18n.t(candidate);
      if (found !== candidate) {
        note = found;
        break;
      }
    }
    if (note === null) return; // an unknown key: say nothing rather than print a key
    // WP-117a: with an attribute filter on, the numbers are over the ratings inside it - the (i) says so FIRST (the engine's note speaks of "all
    // their ratings", which that sentence tells the reader to read as the ratings inside the filter)
    const scopeKey = itemRows ? "heat.stat.scope_seg_col" : "heat.stat.scope_seg";
    const lead = isSegmentScope(view.rows_scope) ? `${ctx.i18n.t(scopeKey)} ${note}` : note;
    const read = centredOn() ? `${lead}\n${ctx.i18n.t("heat.mode.note", { h: halfRangeText() })}` : lead; // WP-132: how to read the centred cells
    // WP-136: the two stories of the group: the ratings as given (one sentence that says there is a Δ story) or the centred values (what Δ mean and Δ std tell - by whether the
    // rows are the centred entities or are centred by another's mean - and where to find the counts and the vector length)
    const stats = centredStatsAvailable(view)
      ? `${read}\n${ctx.i18n.t(statsCentredOn() ? STATS_NOTE[centredStoryOf(view)] : "heat.stats_mode.note_raw")}`
      : read;
    const text = heldOut && reveal === "step" ? `${stats}\n${ctx.i18n.t("heat.held_out.note")}` : stats; // WP-137: the held-out cell and when it opens (WP-137a: only while the setting hides it)
    const label = ctx.i18n.t(itemRows ? "heat.stat.group_item" : "heat.stat.group");
    slot.appendChild(infoTip(text, label, label));
  }

  /**
   * WP-132: what a cell shows in the mode drawn. Raw: the rating (a missing cell keeps its dot). Centred: the rating minus the centre of its entity
   * (util/heat-centred.js) - a signed figure, an arm (`is-neg` / `is-pos` / `is-zero`) and its strength on the fixed diverging scale (`--t`, trace.css
   * paints it), and a hover text that shows the sum with the centre named ("3.5 − ū(u07) 4.1000 = −0.6000"). A missing cell is unchanged; an entity
   * with no centre keeps its raw figure. Called for a fresh cell and, for every cell, when the mode changes.
   * @param {HTMLElement} cell
   * @param {number} r grid row
   * @param {number} c grid column
   */
  function paintCell(cell, r, c) {
    for (const cls of ["is-neg", "is-pos", "is-zero", "is-held-out", "is-held-user"]) cell.classList.remove(cls);
    cell.style.removeProperty("--t");
    cell.title = "";
    if (hidden(r, c)) {
      // WP-137: a question mark, not the number - also in the hover text (a projector must not give the answer away); no arm, no strength
      cell.classList.add("is-held-out");
      if (ctx.heldRole === "user") cell.classList.add("is-held-user"); // WP-137a: the user-based page's box is the users' red (trace.css)
      cell.textContent = "?";
      cell.title = ctx.i18n.t("heat.held_out.tip");
      return;
    }
    const v = values.get(`${r}:${c}`);
    if (v === undefined) {
      cell.textContent = "·";
      return;
    }
    if (signedCells()) {
      // WP-176 (stage 2): the taste profile - a sign on every figure, the centred diverging palette around zero (half the view's scale: the largest weight on screen)
      cell.textContent = signed(v);
      const { arm, strength } = colourOf(v, colourHalfRange(view.scale));
      cell.classList.add(`is-${arm}`);
      if (arm !== "zero") cell.style.setProperty("--t", strength.toFixed(3));
      cell.title = termCellTip(r, c, v);
      return;
    }
    const centre = centredOn() ? centreOf(view, r, c) : null;
    if (centre === null) {
      cell.textContent = cellText(v);
      if (termColumns()) cell.title = termCellTip(r, c, v); // WP-176
      return;
    }
    const diff = v - centre;
    cell.textContent = signed(diff);
    const { arm, strength } = colourOf(diff, colourHalfRange(view.scale));
    cell.classList.add(`is-${arm}`);
    if (arm !== "zero") cell.style.setProperty("--t", strength.toFixed(3));
    const onRows = view.centre_on_rows;
    cell.title = centredTitle({
      value: v,
      centre,
      stat: view.centre_stat,
      entityKind: onRows ? view.row_kind : view.col_kind,
      entity: onRows ? view.row_labels[r] : view.col_labels[c],
    });
  }

  /** WP-132: every cell shows the mode now drawn (a choice of the switch, or the page following the URL); highlights and order stay as they are. */
  function refreshCells() {
    gridEl?.classList.toggle("is-centred", centredOn());
    cellEls.forEach((cells, r) => cells.forEach((cell, c) => paintCell(cell, r, c)));
  }

  /**
   * WP-132: ask for a mode. The cells repaint where they stand; the switch and the (i) are drawn again (the (i) also tells how to read centred cells).
   * @param {import("../util/heat-centred.js").CellMode} next
   */
  function setMode(next) {
    mode = next === "centred" ? "centred" : "raw";
    refreshCells();
    renderGroupInfo();
  }

  function build() {
    root.innerHTML = "";
    scrollEl = null;
    headHeightObserver?.disconnect(); // WP-107 (d): the old header row is gone
    boxObserver?.disconnect(); // WP-117: the old box is gone
    statsLoose = false;
    statHeadEls = [];
    statCellEls = []; // WP-136
    statSwitchEl = null;
    withStats = hasStats(view); // WP-117
    renderGroupInfo();
    if (!view) return;
    const n = view.col_ids.length;
    const centre = withStats ? centreKey(view.row_centre) : null; // WP-117; WP-131: only where the formula's centre is the row entity's statistic
    // WP-105a: the grid scrolls sideways inside its own box; the "N more columns" note stays outside, below it
    const scroll = document.createElement("div");
    scroll.className = "heat-scroll" + (withStats ? " has-stats" : "");
    const grid = document.createElement("div");
    grid.className = "heat-grid" + (view.row_kind === "item" ? " rows-items" : "") + (centredOn() || signedCells() ? " is-centred" : ""); // WP-131: a film per row (trace.css: the item colour belongs to the rows); WP-132: the cells are centred
    gridEl = grid;
    // WP-117: the three fixed tracks of the statistic group sit between the name column and the first film
    grid.style.setProperty(
      "--cols",
      `var(--heat-label-w, 72px) ${withStats ? "var(--heat-stat-w-mean, 42px) var(--heat-stat-w-med, 34px) var(--heat-stat-w-std, 42px) " : ""}` +
        // WP-131 round 1 (instructor): every column is `--heat-col-w` wide (38 px, 42 px presenting), however few there are. It used to be
        // `minmax(--heat-col-w, 1fr)`, so a handful of columns grew to fill the box (95 px each for five); the free room stays at the right
        `repeat(${n}, var(--heat-col-w, 38px))`
    );

    const head = document.createElement("div");
    head.className = "heat-row heat-head-row";
    const corner = document.createElement("div");
    corner.className = "heat-corner";
    head.appendChild(corner);
    if (withStats) {
      STAT_KEYS.forEach((key, i) => {
        const h = statHeadCell(key, i, centre);
        head.appendChild(h);
        statHeadEls.push(h);
      });
      // WP-136: the switch "ratings | Δ" stands in the white space above the heads, as the last head's child - only where the payload has the centred statistics (a list, or the
      // engine's null: then the Δ half is switched off); an older payload without the field offers nothing
      statSwitchEl = centredStatsOffered(view) ? statsSwitch() : null;
      if (statSwitchEl) {
        statHeadEls[statHeadEls.length - 1].appendChild(statSwitchEl);
        scroll.classList.add("has-stat-switch");
      }
    }
    headEls = [];
    view.col_labels.forEach((label, c) => {
      const h = headCell(label, c === view.target_col, view.col_roles?.[c] ?? null, view.col_kind === "user" ? columnTip(c) : view.col_kind === "term" ? termTip(c) : ""); // WP-131; WP-176: a term column says which field it comes from
      head.appendChild(h);
      headEls.push(h);
    });
    grid.appendChild(head);

    body = document.createElement("div");
    body.className = "heat-body";
    rowEls = [];
    cellEls = [];
    values = new Map(); // WP-132: kept for the cells' mode switch (`paintCell`)
    for (const [r, c, v] of view.cells) values.set(`${r}:${c}`, v);
    view.row_labels.forEach((label, r) => {
      const row = document.createElement("div");
      row.className = `heat-row role-${view.row_roles[r] || "candidate"}`;
      row.dataset.row = String(r);
      const lab = document.createElement("div");
      lab.className = "heat-rowlabel";
      // WP-96: `row_links` is filled by the engine only for a view whose rows are users, in handles mode
      const url = view.row_links?.[r];
      if (url) {
        lab.appendChild(userLabel({ label, profile_url: url }, { t: (k, p) => ctx.i18n.t(k, p) }));
      } else if (rowKindOf(r) === "item") {
        // WP-135: a film title that does not fit clamps its NAME; the "(Year)" stays whole at the right edge (trace.css `.heat-title-name` /
        // `.heat-title-year`; the name is the shrinking, ellipsised span). The space between the spans is not rendered (a flex container ignores
        // it) but keeps the text a reader copies equal to the title. The full title is in `title`.
        const { name, year } = splitTitle(label);
        const nameEl = document.createElement("span");
        nameEl.className = "heat-title-name";
        nameEl.textContent = name;
        lab.appendChild(nameEl);
        if (year) {
          const yearEl = document.createElement("span");
          yearEl.className = "heat-title-year";
          yearEl.textContent = year;
          lab.append(" ", yearEl);
        }
        lab.title = label;
      } else if (viewKey === "profile" && rowKindOf(r) === "user") {
        // WP-176 (stage 2): the taste-profile view's user row is the user's name; what the row IS ("taste profile") is the language files' word, not the engine's (the engine's
        // label may still carry it after a middle dot: it is cut here)
        const name = label.split(" \u00b7 ")[0];
        const sub = ctx.i18n.t(profileTexts.row);
        lab.append(name);
        const subEl = document.createElement("span");
        subEl.className = "heat-row-sub";
        subEl.textContent = sub;
        lab.append(" ", subEl);
        lab.title = `${name} \u00b7 ${sub}`;
      } else {
        lab.textContent = label;
        lab.title = label;
      }
      row.appendChild(lab);
      if (withStats) {
        // WP-117: the row's mean / median / std. NOT `.heat-cell` (the row-level highlight rules paint those) and NOT in `cellEls` (the
        // highlight indices and the column FLIP address the film cells); the hover sentence says over how many ratings they were computed.
        // WP-136: written by `paintStatRow` in the story drawn (the ratings as given, or the centred values), and again when the switch changes it
        const statCellsOfRow = STAT_KEYS.map((key) => {
          const s = document.createElement("div");
          s.dataset.stat = key;
          row.appendChild(s);
          return s;
        });
        paintStatRow(statCellsOfRow, r, centre);
        statCellEls.push(statCellsOfRow);
      }
      const cells = [];
      for (let c = 0; c < n; c += 1) {
        const cell = document.createElement("div");
        const v = values.get(`${r}:${c}`);
        cell.className = "heat-cell" + (v === undefined ? " is-missing" : "");
        cell.textContent = v === undefined ? "·" : cellText(v);
        if (v !== undefined && termColumns()) cell.title = termCellTip(r, c, v); // WP-176
        if (c === view.target_col) cell.classList.add("is-target-col");
        if (view.col_roles?.[c] === "active") cell.classList.add("is-active-col"); // WP-131: the active user's column (transposed grid)
        if (centredOn() || signedCells() || hidden(r, c)) paintCell(cell, r, c); // WP-132; WP-137: the held-out cell is `?` in both modes; WP-176: a signed cell is always painted
        row.appendChild(cell);
        cells.push(cell);
      }
      rowEls.push(row);
      cellEls.push(cells);
      body.appendChild(row);
    });
    grid.appendChild(body);
    scroll.appendChild(grid);
    root.appendChild(scroll);
    scrollEl = scroll;
    measureLabelColumn(scroll); // WP-105a: after the grid is in the page, where the labels have a width
    trackHeadHeight(scroll, head); // WP-107 (d)
    if (withStats) {
      // WP-117: now (the box is laid out) and whenever its width changes (window, zoom, the splitters)
      syncStatsSticky();
      if (typeof ResizeObserver !== "undefined") {
        boxObserver = new ResizeObserver(syncStatsSticky);
        boxObserver.observe(scroll);
      }
    }
    revealKey = "";

    if (view.truncated_rows || view.truncated_cols) {
      const note = document.createElement("div");
      note.className = "heat-note";
      const parts = [];
      if (view.truncated_rows) parts.push(ctx.i18n.t("trace.truncated_rows", { n: view.truncated_rows }));
      if (view.truncated_cols) parts.push(ctx.i18n.t("trace.truncated_cols", { n: view.truncated_cols }));
      note.textContent = parts.join(" · ");
      root.appendChild(note);
    }
    currentOrder = null;
  }

  function clearHighlights() {
    const all = [...rowEls, ...headEls, ...cellEls.flat()];
    for (const el of all) {
      for (const cls of [...el.classList]) if (cls.startsWith("hl-")) el.classList.remove(cls);
    }
  }

  /** @param {any[]} highlights */
  function applyHighlights(highlights) {
    if (orientation === "profile") return; // WP-176 (stage 2): two rows, always the subject: nothing to point at
    for (const raw of highlights) {
      const h = orientHighlight(raw, orientation); // WP-131: transposed, a step's rows are the grid's columns and its cols the grid's rows
      if (h.view && h.view !== viewKey) continue; // WP-176: the grid follows the highlights of ITS view
      if (viewKey !== "submatrix" && !h.view) continue; // ... and a highlight with no view is the sub-matrix's
      const cls = `hl-${h.style}`;
      for (const r of h.rows || []) {
        if (rowEls[r]) rowEls[r].classList.add(cls);
      }
      for (const c of h.cols || []) {
        if (headEls[c]) headEls[c].classList.add(cls);
        for (const cells of cellEls) if (cells[c]) cells[c].classList.add(cls);
      }
      for (const [r, c] of h.cells || []) {
        if (cellEls[r] && cellEls[r][c]) cellEls[r][c].classList.add(cls);
      }
    }
  }

  /**
   * Rank order of the candidate axis: view position p (p >= 1; 0 is the active user / target
   * item) is candidate p-1 of the table - same order by construction (build_submatrix_view keeps
   * candidates in table order). Ineligible candidates (rank null) sink to the end.
   * WP-176: the content page's view does NOT list the table's candidates in the table's order (the film x term table keeps the films that share a term with the target, the table
   * keeps its own plan: view row_ids [4, 11, 15, ...] against table cols [0, 1, 2, ...]), so there a film is matched to its table row by its dense index (`ids` = the view's ids per
   * position, `idKey` = the table row's field that holds the same index); a film with no table row sinks to the end with the ineligible ones.
   * @param {any} table
   * @param {number} count number of candidate positions on that axis
   * @param {number[] | null} [ids] the view's id of every position (position 0 = the active / target one)
   * @param {string | null} [idKey]
   * @returns {number[]}
   */
  function orderByRank(table, count, ids = null, idKey = null) {
    const candidates = Array.from({ length: count }, (_, i) => i);
    if (ids && idKey) {
      /** @type {Map<unknown, number>} */
      const rankOf = new Map(table.rows.map((/** @type {any} */ r) => [r[idKey], r.rank ?? Infinity]));
      candidates.sort((a, b) => {
        const ra = rankOf.get(ids[a + 1]) ?? Infinity;
        const rb = rankOf.get(ids[b + 1]) ?? Infinity;
        return ra === rb ? a - b : ra - rb;
      });
      return [0, ...candidates.map((i) => i + 1)];
    }
    candidates.sort((a, b) => {
      const ra = table.rows[a]?.rank ?? Infinity;
      const rb = table.rows[b]?.rank ?? Infinity;
      return ra === rb ? a - b : ra - rb;
    });
    return [0, ...candidates.map((i) => i + 1)];
  }

  /**
   * FLIP: remember positions, re-append children in the new order, animate the difference.
   * @param {HTMLElement} parent
   * @param {HTMLElement[]} children in their ORIGINAL index order
   * @param {number[]} order
   * @param {"x" | "y"} axis
   */
  function flip(parent, children, order, axis) {
    const before = new Map(
      children.map((el) => {
        const r = el.getBoundingClientRect();
        return [el, axis === "y" ? r.top : r.left];
      })
    );
    for (const i of order) if (children[i]) parent.appendChild(children[i]);
    for (const el of children) {
      const r = el.getBoundingClientRect();
      const delta = (before.get(el) ?? 0) - (axis === "y" ? r.top : r.left);
      if (Math.abs(delta) < 1) continue;
      el.style.transition = "none";
      el.style.transform = axis === "y" ? `translateY(${delta}px)` : `translateX(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .35s ease";
        el.style.transform = "";
      });
    }
  }

  /**
   * WP-131: the order is applied to an AXIS of the grid, not to an entity - which axis the candidates of a table are on depends on the
   * orientation (`entityAxis`).
   * @param {"rows" | "cols"} axis which axis the order applies to
   * @param {number[]} order
   */
  function reorder(axis, order) {
    if (!body) return;
    const key = `${axis}:${order.join(",")}`;
    if (currentOrder === key) return;
    if (axis === "rows") {
      flip(body, rowEls, order, "y");
    } else {
      // columns: every row (and the header row) is its own grid, so reorder the cells row by row; the label / corner and
      // (WP-117) the three statistic cells that follow it are never in `children`, so they always stay in front of the films.
      const headRow = headEls[0]?.parentElement;
      if (headRow) flip(headRow, headEls, order.map((c) => c), "x");
      for (const cells of cellEls) {
        const row = cells[0]?.parentElement;
        if (row) flip(row, cells, order, "x");
      }
    }
    currentOrder = key;
  }

  /**
   * WP-105a: the column a step is about. `frame.highlights` also carries the PERSISTENT highlights of earlier steps
   * (the pinned target column is one of them), so its smallest column is always 0 and nothing would ever scroll; the
   * step's own highlights are used instead, and the target column is skipped when the step names another one (an iCF
   * similarity step highlights the target and the candidate: the candidate is what the viewer must see).
   * WP-131: the same for the ROW a step is about (the item-based grid draws a film per row; the pinned target film's row is skipped), in the
   * grid's orientation.
   * @param {import("./trace-player.js").Frame} frame
   * @param {"col" | "row"} axis
   * @returns {number | null}
   */
  function stepLine(frame, axis) {
    const own = (frame.step?.highlights || [])
      .filter((/** @type {any} */ h) => !h.view || h.view === viewKey) // WP-176: the highlights of THIS grid's view only
      .map((/** @type {any} */ h) => orientHighlight(h, orientation));
    const target = axis === "col" ? view.target_col : view.row_roles.indexOf("target");
    const key = axis === "col" ? "cols" : "rows";
    const at = axis === "col" ? 1 : 0;
    const others = own.map((/** @type {any} */ h) => ({
      ...h,
      [key]: (h[key] || []).filter((/** @type {number} */ i) => i !== target),
      cells: (h.cells || []).filter((/** @type {number[]} */ cell) => cell?.[at] !== target),
    }));
    return firstHighlightedLine(others, axis) ?? firstHighlightedLine(own, axis);
  }

  /**
   * WP-105a: scroll the box (never the page) so the first column the step highlights is visible next to the sticky
   * labels. Once per step - the key is "<step>:<sub>" - so it does not fight the viewer's own scrolling, and not at
   * all when the grid fits or the step names no column. The arithmetic is util/heat-reveal.js.
   * WP-131: the item-based grid also scrolls DOWN to the film row a step is about (40 films are taller than the panel), below the header row and
   * the pinned target film's row; both moves go out in one `scrollTo`.
   * @param {import("./trace-player.js").Frame} frame
   */
  function revealHighlightedColumn(frame) {
    const box = scrollEl;
    if (!box) return;
    const wide = box.scrollWidth > box.clientWidth;
    const tall = orientation !== "canonical" && box.scrollHeight > box.clientHeight; // WP-176: the content page's films are rows too
    if (!wide && !tall) return;
    const key = `${frame.index}:${frame.sub}`;
    if (key === revealKey) return;
    revealKey = key;
    /** @type {{left?: number, top?: number, behavior?: ScrollBehavior}} */
    const to = {};
    const col = wide ? stepLine(frame, "col") : null;
    // WP-138: a grid that pins its target column (users as rows: the target column is `view.target_col`; trace.css `.is-target-col`) never needs to scroll to it - it is always
    // in view - and its width and the gap after it are part of what the sticky part covers
    const pinnedCol = orientation === "canonical" && typeof view.target_col === "number" ? view.target_col : null;
    const head = col === null || col === pinnedCol ? undefined : headEls[col];
    if (head) {
      // offsetLeft is a CONTENT coordinate (box is `position: relative`) and ignores the FLIP translateX
      const next = scrollLeftToReveal({
        scrollLeft: box.scrollLeft,
        clientWidth: box.clientWidth,
        // WP-117: the sticky part is the name column AND the three statistic columns (measured: presenting mode widens them)
        // (a loose group scrolls with the films, so only the name column covers them); WP-138: and the pinned target column
        stickyWidth: stickyLeftWidth({
          labelWidth,
          gap: GRID_GAP,
          groupWidth: statsLoose ? 0 : statGroupWidth(statHeadEls.map((h) => h.offsetWidth), GRID_GAP),
          pinnedWidth: pinnedCol === null ? 0 : (headEls[pinnedCol]?.offsetWidth ?? 0),
        }),
        margin: REVEAL_MARGIN,
        colLeft: head.offsetLeft,
        colRight: head.offsetLeft + head.offsetWidth,
      });
      if (next !== null) to.left = next;
    }
    const row = tall ? stepLine(frame, "row") : null;
    const rowEl = row === null ? undefined : rowEls[row];
    if (rowEl) {
      // the sticky part: the header row, the grid's gap, and the pinned target film's row (trace.css `.heat-row.role-target`); the body rows follow
      // each other without a gap, so the first row below the pinned one starts right at its bottom edge
      const pinned = rowEls.find((el) => el.classList.contains("role-target"));
      const next = scrollTopToReveal({
        scrollTop: box.scrollTop,
        clientHeight: box.clientHeight,
        stickyHeight: headHeight + GRID_GAP + (pinned ? pinned.offsetHeight : 0),
        margin: REVEAL_MARGIN,
        rowTop: rowEl.offsetTop,
        rowBottom: rowEl.offsetTop + rowEl.offsetHeight,
      });
      if (next !== null) to.top = next;
    }
    if (to.left === undefined && to.top === undefined) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    to.behavior = reduced ? "auto" : "smooth";
    box.scrollTo(to);
  }

  return {
    /**
     * WP-235: measure the label column again. A grid built while its tab was closed measured no width at all (the labels fell to the 72 px minimum and were cut: "α* closed", "S... (199"); the page
     * calls this when the tab is shown.
     */
    remeasure() {
      if (scrollEl && scrollEl.isConnected && scrollEl.offsetWidth > 0) measureLabelColumn(scrollEl);
    },
    /** @param {any} trace */
    reset(trace) {
      const sent = trace.views?.[viewKey] || null; // WP-176 (stage 2)
      view = orientView(sent, orientation); // WP-131
      heldOut = orientCell(heldOutCell(sent, trace.steps), orientation); // WP-137: from the view as sent, then into the grid's orientation
      revealed = false;
      normKind = normKindOf(trace); // WP-136: which sentence the hover text of a centred statistic says about the vector length
      build();
    },
    /**
     * WP-132: the mode asked for (the one drawn is "raw" wherever the view has no centred value). The page calls `setMode` when the URL changes;
     * a choice made with the switch goes the other way, through `ctx.onModeChange`.
     * @returns {import("../util/heat-centred.js").CellMode}
     */
    mode: () => mode,
    /** @param {import("../util/heat-centred.js").CellMode} next */
    setMode,
    /**
     * WP-137a: the setting changed (the page follows the switch in the Parameters row or the URL): the cell and the (i)'s sentence are drawn again.
     * @returns {import("../util/reveal.js").RevealMode}
     */
    reveal: () => reveal,
    /**
     * WP-136: which story the statistic group tells ("raw": the ratings as given - the default; "centred": the statistics of the centred values, Δ) and a way for the page
     * to follow the URL (`stats`). A choice made with the switch goes the other way, through `ctx.onStatsModeChange`.
     * @returns {import("../util/heat-stats.js").StatsMode}
     */
    statsMode: () => statsMode,
    /** @param {import("../util/heat-stats.js").StatsMode} next */
    setStatsMode,
    /** @param {import("../util/reveal.js").RevealMode} next */
    setReveal(next) {
      reveal = next === "start" ? "start" : "step";
      refreshCells();
      renderGroupInfo();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!view) return;
      syncStatsSticky(); // WP-117: a hidden tab fires no ResizeObserver callback; a step is a cheap moment to look again
      clearHighlights();
      applyHighlights(frame.highlights);
      if (heldOut) {
        // WP-137: the step that carries the `result` highlight on the held-out cell (the prediction step and, persistent, the ones after it) opens it; a step before it
        // closes it again (stepping back must not leave the answer on the board)
        const [hr, hc] = heldOut;
        const cell = cellEls[hr]?.[hc];
        const shown = Boolean(cell?.classList.contains("hl-result"));
        if (cell && shown !== revealed) {
          revealed = shown;
          paintCell(cell, hr, hc);
          if (shown && reveal === "step") {
            // WP-137a: the question mark gives way to the figure with a short fade (trace.css `.is-opening`; reduced motion: none); the class is only a hook for it
            cell.classList.add("is-opening");
            const timer = setTimeout(() => cell.classList.remove("is-opening"), 500);
            /** @type {any} */ (timer)?.unref?.();
          }
        }
      }
      const sorted = Object.entries(frame.tables).find(([, t]) => t.sort_by === "rank");
      const table = sorted ? frame.trace.tables[sorted[0]] : null;
      const entity = table?.entity === "item" ? "item" : "user";
      if (table) {
        const axis = entityAxis(entity, orientation); // WP-131: which line of the grid the table's candidates are
        const count = (axis === "rows" ? rowEls.length : headEls.length) - 1;
        reorder(axis, orientation === "items" ? orderByRank(table, count, view.row_ids, "col") : orderByRank(table, count)); // WP-176
      } else if (currentOrder) {
        // WP-131: back to the natural order of the axis that was sorted - its OWN length. The length used to be the row count whatever the axis
        // was, so with more films than users (a heavy iCF target: 40 columns, 30 rows) stepping back past the rank step left the columns beyond
        // the 30th in front and the order scrambled.
        const axis = currentOrder.startsWith("rows") ? "rows" : "cols";
        reorder(axis, Array.from({ length: axis === "rows" ? rowEls.length : headEls.length }, (_, i) => i));
      }
      revealHighlightedColumn(frame); // WP-105a: after the reorder, so the column is where it will stay
    },
  };
}
