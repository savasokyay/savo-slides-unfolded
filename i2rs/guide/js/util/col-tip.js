// @ts-check
// WP-115 (9b): which tooltip a table's head cell gets - looked up by the column's LABEL first, by its key second.
//
// A table's columns have a `key` (the data field: `c`, `w`, `rating`, `mean`) and a `label_key` (the head's text: `col.c`). The item-based candidate table keeps
// the user-based table's data fields but gives them item-based labels - `key: "c"` with `label_key: "col.c_raters"`, `w` -> `col.s`, `rating` -> `col.rating_uj`,
// `mean` -> `col.item_mean` - and the tooltip was looked up by the KEY, so the item-based "common raters" head carried the user-based sentence ("co-rated: how many
// items this neighbour and the active user both rated"). The tooltip catalogue (`col_tip.<name>`) is named like the labels (`col.<name>`): the label's name is
// asked first, the key only when the label has no tip of its own - for every table whose label is `col.<key>` the result is the same as before.
// Pure, so tests/app/js/col_tip_check.mjs can pin the rule under node.

/**
 * @param {{ key?: string, label_key?: string }} col
 * @returns {string[]} the `col_tip.*` keys to try, in order, without duplicates
 */
export function colTipKeys(col) {
  /** @type {string[]} */
  const keys = [];
  const named = /^col\.(.+)$/.exec(String(col.label_key ?? ""));
  if (named) keys.push(`col_tip.${named[1]}`);
  if (col.key !== undefined && col.key !== "") keys.push(`col_tip.${col.key}`);
  return [...new Set(keys)];
}

/**
 * WP-208 (the ui half of WP-206): the column's own `label_params` fill the tip as they fill its label - the engine's g(t) column sends `{a}` and its tip says "a = {a}".
 * @param {(key: string, params?: Record<string, unknown>) => string} t the translator (returns the key itself for a missing entry)
 * @param {{ key?: string, label_key?: string, label_params?: Record<string, unknown> }} col
 * @returns {string | null} the tip, null when the column has none
 */
export function colTipText(t, col) {
  const params = col.label_params || {};
  for (const key of colTipKeys(col)) {
    const text = t(key, params);
    if (text !== key) return text;
  }
  return null;
}
