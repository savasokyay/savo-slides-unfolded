// @ts-check
// WP-114: the rows of the "All similarities for this pair" table, in the order a lecture reads them, and the one co-rated count shown beside the
// neighbour selector instead of a column.
//
// Order by FAMILY: Pearson (the course's, with the means written out) -> Pearson (library) -> constrained Pearson -> median-robust -> cosine (full
// vectors) -> cosine (co-rated norms) -> adjusted cosine (+ the item-centred fault next to it on the item-based page) -> Jaccard -> Euclidean ->
// Manhattan -> Spearman -> Kendall. A row the list does not know (a measure added later) comes after the known ones, in the order the server sent
// it - never dropped, never an error. Plain logic, so tests/app/js/pair_rows_check.mjs can pin it under node.

/** the family order of the measures (the catalogue's names; `cosine_corated` is the cosine's second row, not a catalogue measure) */
export const PAIR_ROW_ORDER = [
  "pearson",
  "library_pearson",
  "constrained_pearson",
  "median_robust",
  "cosine",
  "cosine_corated",
  "adjusted_cosine",
  "adjusted_cosine_item_centred",
  "jaccard",
  "euclidean_inv",
  "manhattan_inv",
  "spearman",
  "kendall",
];

/**
 * @template {{ name: string }} T
 * @param {T[]} rows the server's rows
 * @returns {T[]} a new array, the known measures in family order, the unknown ones after them in their incoming order
 */
export function orderPairRows(rows) {
  const rank = (/** @type {string} */ name) => {
    const at = PAIR_ROW_ORDER.indexOf(name);
    return at < 0 ? PAIR_ROW_ORDER.length : at;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row.name) - rank(b.row.name) || a.index - b.index)
    .map((x) => x.row);
}

/**
 * The co-rated count of the pair (users: co-rated films, items: common raters). Every row of the response carries one, and the measures that
 * work on the co-rated set agree on it; the Pearson row is the reference, the first row with a count the fall-back.
 * @param {{ name: string, corated?: number | null }[]} rows
 * @returns {number | null} null when no row has a count
 */
export function pairCoratedCount(rows) {
  const isCount = (/** @type {unknown} */ n) => typeof n === "number" && Number.isFinite(n);
  const pearson = rows.find((r) => r.name === "pearson" && isCount(r.corated));
  if (pearson) return /** @type {number} */ (pearson.corated);
  const any = rows.find((r) => isCount(r.corated));
  return any ? /** @type {number} */ (any.corated) : null;
}
