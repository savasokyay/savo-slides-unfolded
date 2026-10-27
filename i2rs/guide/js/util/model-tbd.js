// @ts-check
// WP-121: pure helpers of the Model-based CF overview page (pages/model-page.js) - which i18n keys are the cells of its comparison table, and
// how many of them still hold the placeholder text (the page's beta marker). Kept out of the page so the rule is checked under node from
// hand-derived cases (tests/app/js/model_tbd_check.mjs) and against the REAL i18n files (tests/app/test_model_page.py).

/**
 * The i18n keys of the cells of the comparison table: two per row (`memory`, `model`), or one (`both`) for a row that spans the two columns.
 * @param {string[]} rows the row ids of the table
 * @param {string[]} [spanning] the rows that are one cell over both columns
 * @returns {string[]}
 */
export function cmpCellKeys(rows, spanning = []) {
  /** @type {string[]} */
  const keys = [];
  for (const row of rows) {
    for (const side of spanning.includes(row) ? ["both"] : ["memory", "model"]) {
      keys.push(`model_cf.cmp.row.${row}.${side}`);
    }
  }
  return keys;
}

/**
 * How many of the given cells still hold the placeholder text (their text IS `model_cf.tbd`).
 * @param {(key: string) => string} t the i18n lookup (a missing key comes back as itself, so it never counts)
 * @param {string[]} keys
 * @returns {number}
 */
export function countTbd(t, keys) {
  const marker = t("model_cf.tbd");
  let n = 0;
  for (const key of keys) {
    if (t(key) === marker) n += 1;
  }
  return n;
}
