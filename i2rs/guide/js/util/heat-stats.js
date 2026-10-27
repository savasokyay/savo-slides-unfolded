// @ts-check
// WP-117: the sub-matrix's fixed statistic group - each user's mean / median / std right after the user name, before the
// first film. The numbers are the engine's (`view.row_stats`, the centres the formula really subtracts); nothing is
// recomputed in the browser. These pure functions decide WHAT the group shows - the three texts of a row, which statistic
// the formula uses, which hover sentence a row gets - and heat-grid.js builds the DOM from them. Plain values in, plain
// values out, so they are checked under node against hand-derived cases (tests/app/js/heat_stats_check.mjs).

/** The three statistics, in the order the columns are drawn. */
export const STAT_KEYS = /** @type {const} */ (["mean", "median", "std"]);

/**
 * @typedef {"mean" | "median" | "std"} StatKey
 * @typedef {{n?: number | null, mean?: number | null, median?: number | null, std?: number | null, norm?: number | null}} RowStat
 */

/** Decimals the mean and the std are WRITTEN with in the grid (the column is narrow, user feedback round 1); the median has its own rule below. */
export const STAT_DECIMALS = 3;

/** Decimals of the full value kept in the cell's hover text: the same four the candidate table's `mean` column and the formula panel print. */
export const STAT_TITLE_DECIMALS = 4;

/**
 * Text of one statistic: fixed decimals, an em dash when the engine has no value (a user with no ratings, an undefined std).
 * @param {unknown} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function statText(value, decimals = STAT_DECIMALS) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

/**
 * Digits after the point of a median: the fewest that write it exactly (at least one), never a rounding. The ratings sit on a half-star grid,
 * so a median is x.0 or x.5 - or, the mean of two middle values, x.25 / x.75. A value no short text holds (a median over another scale) gets
 * the most the hover text keeps, `STAT_TITLE_DECIMALS`.
 * @param {number} value
 * @returns {number} 1 .. STAT_TITLE_DECIMALS
 */
export function medianDecimals(value) {
  for (let d = 1; d < STAT_TITLE_DECIMALS; d += 1) {
    if (Math.abs(Number(value.toFixed(d)) - value) < 1e-9) return d;
  }
  return STAT_TITLE_DECIMALS;
}

/**
 * The three cells of a row: its texts, and whether the engine had a value for each. A row without a stat object (the engine
 * sent a shorter list) is three dashes, never a crash.
 * - `text`: what the cell shows. The mean and the std with `STAT_DECIMALS` (3) digits; the median with the fewest exact digits
 *   (`medianDecimals`), at most `STAT_DECIMALS`. When a median takes two or more, the digits after the point are the `tail` (the grid draws
 *   them smaller: 2.25 reads "2." + small "25"); `lead` + `tail` = `text`.
 * - `full`: the value with `STAT_TITLE_DECIMALS` (4) digits - the number of the formula panel and the candidate table - for the hover text, so
 *   three digits in the grid and four in the formula read without a contradiction. For a median that is exact (a half-star grid) it equals `text`.
 * @param {RowStat | null | undefined} stat
 * @returns {{key: StatKey, text: string, full: string, lead: string, tail: string, missing: boolean}[]}
 */
export function statCells(stat) {
  return STAT_KEYS.map((key) => {
    const value = stat ? stat[key] : null;
    const finite = typeof value === "number" && Number.isFinite(value);
    const exact = key === "median" && finite ? medianDecimals(value) : STAT_TITLE_DECIMALS;
    const shown = key === "median" ? Math.min(exact, STAT_DECIMALS) : STAT_DECIMALS;
    const text = statText(value, shown);
    const full = statText(value, exact);
    const point = text.indexOf(".");
    const small = key === "median" && finite && text.length - point - 1 >= 2;
    return {
      key,
      text,
      full,
      lead: small ? text.slice(0, point + 1) : text, // "2." + "25": the digits after the point are small
      tail: small ? text.slice(point + 1) : "",
      missing: text === "—",
    };
  });
}

// -- WP-136: the second story of the group - the statistics of the CENTRED values (rating - centre) ------------------------------------------------------------
// The engine sends them beside the raw ones (`view.row_stats_centred` / `col_stats_centred`, one entry per user / film, `RowStats` with `norm` = the length of the
// centred vector). Plain logic here, hand-checked under node (tests/app/js/heat_stats_check.mjs); heat-grid.js builds the DOM.

/** @typedef {"raw" | "centred"} StatsMode */

/** The i18n key of each centred statistic's hover line: written out, so the key scan of tests/app/test_heat_stats.py sees every one (a template would hide them). */
const D_TIP = /** @type {const} */ ({ mean: "heat.stat.d_mean_tip", median: "heat.stat.d_median_tip", std: "heat.stat.d_std_tip" });

/**
 * The mode the route parameter `stats` asks for (`c` = centred Δ, anything else - `r`, none, a stray value - the ratings as given: the main story).
 * @param {unknown} stats the `stats` route parameter
 * @returns {StatsMode}
 */
export function statsModeFor(stats) {
  return stats === "c" ? "centred" : "raw";
}

/**
 * The route parameter of a mode.
 * @param {StatsMode} mode
 * @returns {"c" | "r"}
 */
export function statsParam(mode) {
  return mode === "centred" ? "c" : "r";
}

/**
 * Whether the group OFFERS the second story: it has the group and the payload has the field at all (a list, or the engine's explicit null for "none to show"). An older
 * payload without the field offers nothing - no switch is drawn. (`undefined` is that; `null` is "offered, switched off".)
 * @param {{row_stats?: unknown, row_labels?: unknown, row_stats_centred?: unknown} | null | undefined} view
 * @returns {boolean}
 */
export function centredStatsOffered(view) {
  return hasStats(view) && view?.row_stats_centred !== undefined;
}

/**
 * Whether the group can tell the centred story for a view (one from `orientView`): it has the group and the engine sent a list of centred statistics with one
 * entry per row - none where the formula subtracts no shown number (`centre_axis` null), none on a trained model's grid, none in an older payload.
 * @param {{row_stats?: unknown, row_labels?: unknown, row_stats_centred?: unknown} | null | undefined} view
 * @returns {boolean}
 */
export function centredStatsAvailable(view) {
  const list = view?.row_stats_centred;
  return hasStats(view) && Array.isArray(list) && list.length === /** @type {unknown[]} */ (view?.row_labels).length;
}

/**
 * A figure of the ratings' rules written for a centred value: the minus is a true minus (U+2212), a positive figure carries no sign (as the ratings' do not), and a value that
 * rounds to zero - float residue, a `-0` - is plain zero, never "-0.000".
 * @param {string} text `statText` output ("-0.053", "0.250", "-0.000", "—")
 * @returns {string}
 */
function minusSign(text) {
  if (!/^-?\d/.test(text)) return text;
  if (Number(text) === 0) return text.replace(/^-/, "");
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
}

/**
 * The three cells of a row in the centred story, shaped like `statCells` and written with ITS rules - the figure of the ratings and the figure of the centred values read alike:
 * three decimals for the mean and the std, the fewest exact digits for the median (the digits after the point small when it takes two or more), four decimals in the hover
 * text (the median's exact digits) - with a true minus where the value is negative (a mean or a median can be; a std cannot), no plus, and "0.000" / "0.0" for zero.
 * @param {RowStat | null | undefined} stat the row's entry of `row_stats_centred`
 * @returns {{key: StatKey, text: string, full: string, lead: string, tail: string, missing: boolean}[]}
 */
export function centredStatCells(stat) {
  return statCells(stat).map((cell) => {
    if (cell.missing) return cell;
    const text = minusSign(cell.text);
    const point = text.indexOf(".");
    return {
      key: cell.key,
      text,
      full: minusSign(cell.full),
      lead: cell.tail ? text.slice(0, point + 1) : text, // "-0." + the small "25"
      tail: cell.tail ? text.slice(point + 1) : "",
      missing: false,
    };
  });
}

/**
 * Which sentence about the norm a hover text gets: for the adjusted cosine the length of the centred vector IS the factor the similarity divides by
 * (`norm_a` / `norm_u` / `norm_t` / `norm_j`, in every convention); every other measure (the Pearson family) sums over the ratings each PAIR has in common, so the
 * length is only the vector's. The trace names the measure (`meta.request.config.similarity`); a trace that does not is told as the cautious one.
 * @param {any} trace
 * @returns {"denominator" | "length"}
 */
export function normKindOf(trace) {
  return trace?.meta?.request?.config?.similarity === "adjusted_cosine" ? "denominator" : "length";
}

/**
 * The lines of the hover text of a centred statistic, as i18n keys with their parameters (the grid translates and joins them): the figure, over how many ratings
 * (and, when that differs from the ratings as given, both counts - the vector leaves out the held-out rating of the active entity under every convention, and a
 * filter narrows it), the length of the vector, and the ratings-as-given statistic beside it. A row with no rating in the formula's vector says only that.
 * @param {{key: StatKey, stat: RowStat | null | undefined, raw: RowStat | null | undefined, normKind: "denominator" | "length", withRaw?: boolean}} p
 *   `key` the statistic of the cell (null of the head tip: pass the three with `centredColumnLines`)
 * @returns {{key: string, params?: Record<string, string | number>}[]}
 */
export function centredStatLines({ key, stat, raw, normKind, withRaw = true }) {
  const n = stat?.n;
  if (typeof n !== "number" || !Number.isFinite(n)) return [];
  if (n === 0) return [{ key: "heat.stat.d_none" }];
  const cell = centredStatCells(stat).find((c) => c.key === key);
  /** @type {{key: string, params?: Record<string, string | number>}[]} */
  const lines = [{ key: D_TIP[key], params: { value: cell ? cell.full : "—" } }];
  const rawN = raw?.n;
  lines.push(typeof rawN === "number" && Number.isFinite(rawN) && rawN !== n ? { key: "heat.stat.d_n_diff", params: { n, raw: rawN } } : { key: "heat.stat.d_n", params: { n } });
  if (typeof stat?.norm === "number" && Number.isFinite(stat.norm)) {
    lines.push({ key: normKind === "denominator" ? "heat.stat.d_norm_den" : "heat.stat.d_norm_len", params: { norm: stat.norm.toFixed(STAT_TITLE_DECIMALS) } });
  }
  if (withRaw) {
    const rawCell = statCells(raw).find((c) => c.key === key);
    if (rawCell && !rawCell.missing) lines.push({ key: "heat.stat.d_raw", params: { value: rawCell.full } });
  }
  return lines;
}

/**
 * The lines of the hover text of a user COLUMN head (the item-based grid): the three centred statistics of that user's ratings, then the counts and the length once.
 * @param {{stat: RowStat | null | undefined, raw: RowStat | null | undefined, normKind: "denominator" | "length"}} p
 * @returns {{key: string, params?: Record<string, string | number>}[]}
 */
export function centredColumnLines({ stat, raw, normKind }) {
  const n = stat?.n;
  if (typeof n !== "number" || !Number.isFinite(n)) return [];
  if (n === 0) return [{ key: "heat.stat.d_none" }];
  const lines = STAT_KEYS.map((key) => ({ key: D_TIP[key], params: { value: centredStatCells(stat).find((c) => c.key === key)?.full ?? "—" } }));
  const rest = centredStatLines({ key: "mean", stat, raw, normKind, withRaw: false }).slice(1); // the count line and the norm line, once
  return [...lines, ...rest];
}

/**
 * Whether the rows ARE the entities the formula centres (`view.centre_on_rows`): each is centred by its own centre, so its Δ mean is 0 whenever that centre ran
 * over the same ratings as the vector. Else each rating is centred by another entity's mean (a film's ratings by their raters' means): the Δ mean is the row's
 * average deviation. Picks the (i)'s sentence about the centred story.
 * @param {{centre_on_rows?: unknown} | null | undefined} view
 * @returns {"own" | "other"}
 */
export function centredStoryOf(view) {
  return view?.centre_on_rows === true ? "own" : "other";
}

/**
 * Whether a view carries the group: `row_stats` is a list with one entry per row (an empty row list or a list of another
 * length is not drawn - a mismatched list would put a user's numbers on another user's row).
 * @param {{row_stats?: unknown, row_labels?: unknown} | null | undefined} view
 * @returns {boolean}
 */
export function hasStats(view) {
  const stats = view?.row_stats;
  const labels = view?.row_labels;
  return Array.isArray(stats) && Array.isArray(labels) && labels.length > 0 && stats.length === labels.length;
}

/**
 * The statistic the formula subtracts, or null when it subtracts none of these (the cell is then not emphasised).
 * @param {unknown} centreStat `view.centre_stat`
 * @returns {StatKey | null}
 */
export function centreKey(centreStat) {
  return centreStat === "mean" || centreStat === "median" ? centreStat : null;
}

/**
 * The hover sentence of a row's statistic cells: it says over how many ratings the numbers were computed (the films shown
 * are a subset - that is the point) and, on the active row, whether the target is in. WP-131: whether it is in is the ENGINE's flag
 * (`includesTarget`, `centre_includes_target`: true when the shown statistic of the active entity holds the target rating), whatever the
 * measure subtracts; only a payload without the flag (`null` / undefined) falls back to reading the convention from the note key the engine
 * sent (`heat.centre.dynamic` / `heat.centre.static`; any other note says nothing about the target).
 * With an attribute filter on (`scope` "segment": the numbers are taken over the ratings INSIDE the filter, the set the similarity centres
 * on) the sentence says so (`heat.stat.row_seg*`); any other scope - or none, an older trace - is the whole-profile wording.
 * WP-131: a row of FILMS (`kind` "item": the item-based page draws a film per row) is told apart - the target film's statistic leaves the active
 * user's rating out (it is the one being predicted) unless `includesTarget`, every other film's counts it (a known rating) - and an attribute
 * filter appends its own sentence (`scopeKey`).
 * @param {{stat: RowStat | null | undefined, role: string | undefined, noteKey: string | null | undefined, scope?: string | null,
 *   kind?: "user" | "item", includesTarget?: boolean | null}} p
 * @returns {{key: string, params: {n: number}, scopeKey?: string} | null} an i18n key with its parameter, null when the row has no count
 */
export function rowTip({ stat, role, noteKey, scope, kind = "user", includesTarget = null }) {
  const n = stat?.n;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (kind === "item") {
    const key = role === "target" ? (includesTarget === true ? "heat.stat.col_target_incl" : "heat.stat.col_target_excl") : "heat.stat.col_cand";
    return scope === "segment" ? { key, params: { n }, scopeKey: "heat.stat.col_scope_seg" } : { key, params: { n } };
  }
  const base = scope === "segment" ? "heat.stat.row_seg" : "heat.stat.row_all";
  if (role === "active") {
    const included = typeof includesTarget === "boolean" ? includesTarget : noteKey === "heat.centre.static" ? true : noteKey === "heat.centre.dynamic" ? false : null;
    if (included === true) return { key: `${base}_incl`, params: { n } };
    if (included === false) return { key: `${base}_excl`, params: { n } };
  }
  return { key: base, params: { n } };
}

/**
 * WP-131: the i18n keys to try, in order, for the note beside the statistic group ((i) in the panel head). The engine's `centre_note_key` is
 * written for a group of USER statistics; when the group is the FILMS' (the item-based page draws a film per row) the note has to say what the
 * formula subtracts and where it is: `row_elsewhere` when the centre is the user's mean (the course's rule - those numbers are not in the group),
 * `<key>_col` when it is a film's statistic or no shown number. A missing text falls back to the engine's own key.
 * @param {{noteKey: string, axis: "row" | "col" | null, rowKind: "user" | "item"}} p `axis`: `centreAxisOf(view)`
 * @returns {string[]}
 */
export function groupNoteKeys({ noteKey, axis, rowKind }) {
  if (rowKind !== "item") return [noteKey];
  if (axis === "row") return ["heat.centre.row_elsewhere", noteKey];
  return [`${noteKey}_col`, noteKey];
}

/**
 * Whether the numbers are taken over the ratings inside an attribute filter (`view.centre_scope === "segment"`); anything else - "all", a missing
 * field - is the whole profile, so with the filter off nothing changes.
 * @param {unknown} centreScope `view.centre_scope`
 * @returns {boolean}
 */
export function isSegmentScope(centreScope) {
  return centreScope === "segment";
}

/**
 * Width of the sticky statistic group (px): the three tracks - each its own width, the median's is the narrowest - and the gap after each, i.e.
 * what the sticky labels cover in addition to the name column. 0 without the group (or when a width is not measured yet).
 * @param {number[]} widths measured widths of the mean, median and std columns (px)
 * @param {number} gap grid gap (px)
 * @returns {number}
 */
export function statGroupWidth(widths, gap) {
  if (!Array.isArray(widths) || widths.length !== STAT_KEYS.length || !widths.every((w) => w > 0)) return 0;
  return widths.reduce((sum, w) => sum + w + gap, 0);
}

/** Film columns that must stay visible beside the sticky part; with fewer the statistic group stops sticking (see `statsStick`). */
export const MIN_FILM_COLUMNS = 4;

/**
 * Whether the statistic group may stick next to the name. This guard is not something the user asked for: it is a narrow-box protection added
 * with the group (WP-117 round 1 report), kept so the grid stays readable where the sticky part would eat the box. It covers ~230 px; in a narrow panel (a 1400 px window at 140 % zoom leaves the grid
 * box 365 px) that is most of the box and only two or three films would be left to look at. Measured: below `minColumns` free film columns
 * the group scrolls away with the films and only the name column stays.
 * @param {{clientWidth: number, labelWidth: number, statWidths: number[], gap: number, columnWidth: number, minColumns?: number, pinnedWidth?: number}} p widths in px: the
 *   scroll box, the name column, the three statistic columns, the grid gap, one film column; WP-138: `pinnedWidth` the pinned target column (0 / absent: none)
 * @returns {boolean}
 */
export function statsStick({ clientWidth, labelWidth, statWidths, gap, columnWidth, minColumns = MIN_FILM_COLUMNS, pinnedWidth = 0 }) {
  const sticky = labelWidth + gap + statGroupWidth(statWidths, gap) + (pinnedWidth > 0 ? pinnedWidth + gap : 0); // WP-138: a pinned target column covers the films' room too
  return clientWidth - sticky >= minColumns * (columnWidth + gap);
}
