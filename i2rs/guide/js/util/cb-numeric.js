// @ts-check
// WP-176a (b): the numeric card of the content page - the numbers of the film under test (`trace.meta.numeric_fields`, the engine's `numeric` registry fields: runtime, year, the
// vote figures, the budget ...) that NEVER enter the similarity. The card is a summary-bar element; this module is its plain logic (the order, the number formats, which fields
// show) so it can be checked under node (tests/app/js/cb_numeric_check.mjs).

/** the order the card lists the fields in (the registry's own order is the config's; a field the page does not know follows, in the trace's order) */
export const NUMERIC_ORDER = ["year", "runtime", "lbd_rating", "tmdb_vote_average", "tmdb_vote_count", "tmdb_popularity", "budget", "revenue"];

/** the currency of the catalogue's budget and revenue figures (TMDB reports them in US dollars) */
const MONEY_CURRENCY = "USD";

/** @typedef {{name: string, text: string, unit: "min" | null}} NumericItem */

/**
 * One value in the form the card shows it: a year without a thousands separator, the runtime as a plain whole number (the unit is the caller's text), a vote count with grouping, a
 * rating with the decimals its scale needs, a budget or revenue as a compact amount in dollars ("$50M"). A field the card does not know is its number as is.
 * @param {string} name
 * @param {number} value
 * @param {string} lang "en" | "tr"
 * @returns {string}
 */
export function formatNumeric(name, value, lang) {
  const nf = (/** @type {Intl.NumberFormatOptions} */ options) => new Intl.NumberFormat(lang, options).format(value);
  switch (name) {
    case "year":
      return String(Math.round(value));
    case "runtime":
      return nf({ maximumFractionDigits: 0 });
    case "lbd_rating":
      return nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "tmdb_vote_average":
    case "tmdb_popularity":
      return nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "tmdb_vote_count":
      return nf({ maximumFractionDigits: 0 });
    case "budget":
    case "revenue":
      return nf({ style: "currency", currency: MONEY_CURRENCY, notation: "compact", maximumFractionDigits: 1 });
    default:
      return String(value);
  }
}

/**
 * The fields the card lists: the numbers the trace carries, in the card's order; a null (the data set has no such column, or the film has no value) is left out, so the card never
 * says "-" for a column nobody has. Nothing usable (no object, every value empty) gives an empty list - and the page draws no card.
 * @param {unknown} fields `trace.meta.numeric_fields`: {field: number | null}
 * @param {string} lang "en" | "tr"
 * @returns {NumericItem[]}
 */
export function numericItems(fields, lang) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
  const record = /** @type {Record<string, unknown>} */ (fields);
  const names = [...NUMERIC_ORDER.filter((n) => n in record), ...Object.keys(record).filter((n) => !NUMERIC_ORDER.includes(n))];
  /** @type {NumericItem[]} */
  const items = [];
  for (const name of names) {
    const value = record[name];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    items.push({ name, text: formatNumeric(name, value, lang), unit: name === "runtime" ? "min" : null });
  }
  return items;
}
