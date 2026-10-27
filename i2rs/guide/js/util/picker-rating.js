// @ts-check
// WP-156: the film picker marks the films the chosen user has rated (every page that has a user and a film picker: the user-based, item-based, content, matrix-factorization and
// neural pages, and the pitfall gallery). The list shows every film, as it always did, and a film the user rated carries a tinted row and the rating in a column of its own at the
// right: "title | 43 raters | ★ 4.0". The logic is plain, so it is checked by hand under node (tests/app/js/picker_rating_check.mjs); the picker (components/entity-picker.js) only calls it.
//
// The server (`GET /api/datasets/{ds}/items`, WP-156) answers two ways: `rated_by=<user>` FILTERS the list to the user's films, and `mark_rated_by=<user>` marks without filtering; every
// row of either carries `user_rating` (the rating, or null for a film the user has not rated). The "rated by the user" chip decides which is asked: on, the filtering one; off, the marking
// one. An offline copy (a static bundle) has no such parameter - its list is a frozen file - so nothing is marked there and the list is what it was.

/**
 * Whether a list row carries the chosen user's rating.
 * @param {{user_rating?: unknown} | null | undefined} row
 * @returns {boolean}
 */
export function hasRating(row) {
  return typeof row?.user_rating === "number" && Number.isFinite(row.user_rating);
}

/**
 * A rating as the column shows it: one decimal, the decimal separator of the language ("4.0" / "4,5"), never "undefined" or "NaN".
 * @param {unknown} value
 * @param {string} [lang]
 * @returns {string} "" for something that is no rating
 */
export function ratingText(value, lang = "en") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const text = value.toFixed(1);
  return lang === "tr" ? text.replace(".", ",") : text;
}

/**
 * Whether the item picker marks the rated films: a user is chosen and the server is live (a static bundle has no marking).
 * @param {{kind: string, ratedBy: number | null | undefined, mode?: string}} opts
 * @returns {boolean}
 */
export function marksRatings({ kind, ratedBy, mode }) {
  return kind === "item" && ratedBy !== null && ratedBy !== undefined && mode !== "static";
}

/**
 * The query of one item-list request. `chipOn`: the "rated by the user" chip filters (`rated_by`, the rows carry the rating too); off - or when the guarded search had nothing and the
 * list falls back to an unguarded one - the list is not filtered and the user's films are marked (`mark_rated_by`). Never both, and neither without a user or on an offline copy.
 * @param {{q: string, minRaters: number, guarded: boolean, chipOn: boolean, ratedBy: number | null | undefined, mode?: string, limit: number}} opts
 * @returns {{q: string, min_raters: number, rated_by: number | undefined, mark_rated_by: number | undefined, limit: number}}
 */
export function itemQuery({ q, minRaters, guarded, chipOn, ratedBy, mode, limit }) {
  const marks = marksRatings({ kind: "item", ratedBy, mode });
  const filters = marks && guarded && chipOn;
  return {
    q,
    min_raters: guarded ? minRaters : 0,
    rated_by: filters ? /** @type {number} */ (ratedBy) : undefined,
    mark_rated_by: marks && !filters ? /** @type {number} */ (ratedBy) : undefined,
    limit,
  };
}
