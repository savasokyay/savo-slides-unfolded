// @ts-check
// WP-131: the orientation of the co-rated sub-matrix. The engine's view is fixed: ROWS are users (the active user first) and COLUMNS are films
// (the target film first). The instructor teaches the item-based page "transposed" - a film per row, a user per column - so the grid can draw
// the view either way. The trace (rows / cols / cells of every step's highlights) and the view are NEVER changed on the server and never
// rewritten in place: this module turns them into the shape the grid draws, so heat-grid.js keeps one code path ("a row is a thing, a column
// is another") and every step reference still means what the engine meant.
//
// `canonical` = the view as sent (users x films); `transposed` = films x users. Pure functions over plain values, hand-checked under node
// (tests/app/js/heat_orient_check.mjs). The item-based page ("icf") draws films x users, every other grid keeps the view as sent; there is no
// switch (a "users x films" choice with an `ori` route parameter is a later work package, WP-131a).

/**
 * `items` (WP-176): the content page's film x term table - the view as sent (a row per FILM, the target first; a column per TERM), drawn with the item-based grid's row
 * look: the film colour on the rows, the target film pinned. `profile` (WP-176 stage 2): the taste-profile view - two rows, the user's taste profile (a user: red) and the
 * target film (a film: blue), over the target's terms, signed cells on the diverging palette.
 * @typedef {"canonical" | "transposed" | "items" | "profile"} Orientation
 */

/**
 * Which orientation a page draws: the item-based page ("icf") films x users (the instructor teaches it "transposed"), the content page ("cb") films x terms as sent
 * ("items", WP-176), every other grid - the user-based page, the MF / DNN pages, the metrics grid - the view as sent, users x films.
 * @param {string} engine
 * @returns {Orientation}
 */
export function orientationFor(engine) {
  return engine === "icf" ? "transposed" : engine === "cb" ? "items" : "canonical";
}

/**
 * WP-176: the rows of a view are all films when the engine says so (`row_kinds`, the content trace's per-row kind) - the grid then draws the item-based row look. A view
 * without `row_kinds` (every older payload) and a view with a user among its rows are users x films.
 * @param {{row_kinds?: unknown} | null | undefined} view
 * @returns {boolean}
 */
export function rowsAreItems(view) {
  const kinds = view?.row_kinds;
  return Array.isArray(kinds) && kinds.length > 0 && kinds.every((k) => k === "item");
}

/**
 * The statistic axis the similarity subtracts from each rating: the engine's `centre_axis`; an older payload without the field but with a centre
 * statistic means the user's ("row") - the only one it had.
 * @param {{centre_axis?: unknown, centre_stat?: unknown} | null | undefined} view
 * @returns {"row" | "col" | null}
 */
export function centreAxisOf(view) {
  if (view?.centre_axis === "row" || view?.centre_axis === "col") return view.centre_axis;
  return view?.centre_stat === "mean" || view?.centre_stat === "median" ? "row" : null;
}

/**
 * The grid's shape of a view. Fields that keep their meaning in both orientations (`scale`, `centre_stat`, `centre_note_key`, `centre_scope`,
 * `centre_includes_target`) pass through; the rest are the ROWS the grid draws and the COLUMNS it draws:
 * - `row_*` / `col_*`: ids, labels, links, and statistics of the entity a row / a column stands for; `row_roles` of the thing in a row (the
 *   user roles, or - transposed - `target` for the target film and `candidate` for the others), `col_roles` of the thing in a column (`null`
 *   in the canonical orientation, where the columns are films and only `target_col` marks one; transposed: the users' roles);
 * - `row_kind` / `col_kind`: "user" | "item", what a row / a column is (the grid's CSS chooses the user or item colour from it);
 * - `centre_on_rows`: the statistic the formula subtracts belongs to the entity a ROW stands for, so the group of statistic cells beside the
 *   name is where the centre is (otherwise the numbers are not what the formula subtracts - the hover of each cell names the centre instead);
 * - `row_centre`: that statistic ("mean" | "median") when `centre_on_rows`, else null: the cell the group emphasises;
 * - `rows_scope` / `cols_scope` ("all" | "segment"): over which ratings the statistics of a row's / a column's entity were taken. The engine's
 *   `centre_scope` describes only the statistics of the CENTRE axis; the other axis' are over all the ratings (the item-based page's user
 *   statistics always are). A user-based payload carries no film statistics and keeps its scope as it was;
 * - `row_includes_target` / `col_includes_target` (true | false | null): whether the statistics of the ACTIVE row / target-film row hold the held-out
 *   rating. The engine's flag `centre_includes_target` belongs to the shown statistic of the active entity (user-based: the active user's row,
 *   whatever the measure subtracts; item-based: the target film, true only for the item-centred static case); the item-based page's user
 *   statistics always leave the target out. `null` = an older payload without the flag (the caller reads the convention from the note key).
 * @param {any} view the engine's `views.submatrix`
 * @param {Orientation} orientation
 * @returns {any} the same object shape for `canonical` (a shallow copy with the added fields), a new one for `transposed`; null stays null
 */
export function orientView(view, orientation) {
  if (!view) return null;
  const axis = centreAxisOf(view);
  const centreStat = view.centre_stat === "mean" || view.centre_stat === "median" ? view.centre_stat : null;
  const filmStats = Array.isArray(view.col_stats); // only the item-based page's payload carries them
  const scope = view.centre_scope === "segment" ? "segment" : "all";
  /** the scope of the statistics of the entity on `entityAxis` ("row" = the users, "col" = the films) */
  const scopeOf = (/** @type {"row" | "col"} */ entityAxis) => (axis !== null ? (axis === entityAxis ? scope : "all") : filmStats ? "all" : scope);
  const flag = typeof view.centre_includes_target === "boolean" ? view.centre_includes_target : null;
  if (orientation === "profile") {
    // WP-176 (stage 2): the engine's roles are `active` (the user's taste profile row) and `focus` (the target film); the film row takes the film's own role. The rows are of two
    // kinds (`row_kinds`: user, item), so the grid draws each label as what it is; the cells are SIGNED (`palette: "diverging"`): a preference p(t) below zero is a term the user
    // disliked, a weight x(t) is never negative.
    return {
      ...view,
      row_kind: "user",
      col_kind: "term",
      row_roles: (view.row_roles || []).map((/** @type {string} */ role) => (role === "focus" ? "target" : role)),
      col_roles: null,
      centre_on_rows: false,
      row_centre: null,
      rows_scope: "all",
      cols_scope: "all",
      row_includes_target: false,
      col_includes_target: null,
    };
  }
  if (orientation === "items") {
    // WP-176: films x terms as sent. The target film's row (the engine's role `active`) takes the film's own role - the item-based grid's `target` - so it is pinned and
    // drawn in the film colour; the columns are TERMS (no user, no film: no column role, no per-column tip beyond the term's own); there are no rating statistics
    return {
      ...view,
      row_kind: rowsAreItems(view) ? "item" : "user",
      col_kind: "term",
      row_roles: (view.row_roles || []).map((/** @type {string} */ role) => (role === "active" ? "target" : role)),
      col_roles: null,
      centre_on_rows: false,
      row_centre: null,
      rows_scope: "all",
      cols_scope: "all",
      row_includes_target: false,
      col_includes_target: null,
    };
  }
  if (orientation !== "transposed") {
    return {
      ...view,
      row_kind: "user",
      col_kind: "item",
      col_roles: null,
      centre_on_rows: axis === "row",
      row_centre: axis === "row" ? centreStat : null,
      rows_scope: scopeOf("row"),
      cols_scope: scopeOf("col"),
      row_includes_target: filmStats ? false : flag,
      col_includes_target: null,
    };
  }
  const targetCol = typeof view.target_col === "number" ? view.target_col : null;
  const filmRoles = (view.col_labels || []).map((/** @type {unknown} */ _, /** @type {number} */ i) => (i === targetCol ? "target" : "candidate"));
  return {
    ...view,
    row_ids: view.col_ids,
    row_labels: view.col_labels,
    row_roles: filmRoles,
    row_links: [], // the view carries no film links (the film pages are linked from the tables)
    row_stats: Array.isArray(view.col_stats) ? view.col_stats : null,
    // WP-136: the statistics of the CENTRED values follow their entities the same way: the films' are the rows' now, the users' the columns'. Three states are kept apart:
    // a list (the engine sent them), null (the engine says there are none: the formula centres on no shown number, a trained model) and undefined (an older payload
    // that has no such field: the grid offers no switch at all)
    row_stats_centred: Array.isArray(view.col_stats_centred) ? view.col_stats_centred : view.col_stats_centred === null ? null : undefined,
    col_stats_centred: Array.isArray(view.row_stats_centred) ? view.row_stats_centred : view.row_stats_centred === null ? null : undefined,
    col_ids: view.row_ids,
    col_labels: view.row_labels,
    col_roles: view.row_roles,
    target_col: null,
    cells: (view.cells || []).map((/** @type {number[]} */ [r, c, v]) => [c, r, v]),
    col_stats: Array.isArray(view.row_stats) ? view.row_stats : null,
    truncated_rows: view.truncated_cols || 0,
    truncated_cols: view.truncated_rows || 0,
    row_kind: "item",
    col_kind: "user",
    centre_on_rows: axis === "col",
    row_centre: axis === "col" ? centreStat : null,
    rows_scope: scopeOf("col"), // the rows are films now
    cols_scope: scopeOf("row"),
    row_includes_target: flag === true,
    col_includes_target: false,
  };
}

/**
 * WP-137: the HELD-OUT cell of a view - the active user's rating of the target film, the number the walk predicts. The engine's view carries it (it is a cell of
 * the active user's row at the target column); the grid shows `?` there until the step that reveals it. A cell is only held out where the trace DOES reveal it:
 * some step highlights it with the style `result` (the prediction step), so a view whose trace never does is drawn as it was. Works on the view as sent (users x
 * films) and gives its coordinates; `orientCell` maps them to the grid's.
 * @param {any} view the engine's `views.submatrix` (as sent, not oriented)
 * @param {any[] | null | undefined} steps the trace's steps
 * @returns {[number, number] | null} [user row, film column], or null when there is nothing to hold out
 */
export function heldOutCell(view, steps) {
  if (!view || !Array.isArray(view.row_roles) || typeof view.target_col !== "number") return null;
  const r = view.row_roles.indexOf("active");
  const c = view.target_col;
  if (r < 0 || c < 0) return null;
  const rated = (view.cells || []).some((/** @type {number[]} */ cell) => cell[0] === r && cell[1] === c);
  if (!rated) return null;
  const revealed = (steps || []).some((/** @type {any} */ step) => revealsCell(step?.highlights, [r, c]));
  return revealed ? [r, c] : null;
}

/**
 * WP-137a: whether a list of highlights - a step's own, or a frame's (the persistent ones included) - opens the cell: one of them is the style `result` of the
 * sub-matrix view and names it. The same test the grid's reveal, the summary bar's and the picker chip's use, so the three open on the same step.
 * @param {any[] | null | undefined} highlights
 * @param {[number, number] | null} cell [user row, film column] of the view as sent
 * @returns {boolean}
 */
export function revealsCell(highlights, cell) {
  if (!cell) return false;
  return (highlights || []).some(
    (/** @type {any} */ h) => h?.style === "result" && (!h.view || h.view === "submatrix") && (h.cells || []).some((/** @type {number[]} */ at) => at[0] === cell[0] && at[1] === cell[1])
  );
}

/**
 * WP-137: a (row, column) of the view as sent, in the grid's orientation (transposed: the pair swaps).
 * @param {[number, number] | null} cell
 * @param {Orientation} orientation
 * @returns {[number, number] | null}
 */
export function orientCell(cell, orientation) {
  if (!cell) return null;
  return orientation === "transposed" ? [cell[1], cell[0]] : [cell[0], cell[1]];
}

/**
 * A step's highlight in the grid's orientation: transposed, its `rows` are the grid's columns, its `cols` the grid's rows and every `cells`
 * pair swaps. Anything else (style, persist, view) is kept; a highlight of another view is returned as it is.
 * @param {any} highlight one entry of `frame.highlights`
 * @param {Orientation} orientation
 * @returns {any}
 */
export function orientHighlight(highlight, orientation) {
  if (!highlight || orientation === "canonical" || orientation === "profile") return highlight; // the profile grid draws no step highlight (two rows: nothing to point at)
  if (highlight.view && highlight.view !== "submatrix") return highlight;
  if (orientation === "items") return highlight.style === "active" ? { ...highlight, style: "target" } : highlight; // WP-176: the target film's row is the film's `target`
  return {
    ...highlight,
    rows: highlight.cols || [],
    cols: highlight.rows || [],
    cells: (highlight.cells || []).map((/** @type {number[]} */ [r, c]) => [c, r]),
  };
}

/**
 * Which line of the grid a rank order moves: a candidate table of USERS (uCF's neighbours) reorders the user lines, one of FILMS (iCF's
 * candidates) the film lines; in the canonical view users are the rows, transposed they are the columns.
 * @param {"user" | "item"} entity
 * @param {Orientation} orientation
 * @returns {"rows" | "cols"}
 */
export function entityAxis(entity, orientation) {
  const rowsAreUsers = orientation === "canonical" || orientation === "profile"; // WP-176: the content page's rows are films too (the taste-profile view's first row is a user)
  return (entity === "user") === rowsAreUsers ? "rows" : "cols";
}
