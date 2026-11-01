// @ts-check
// WP-116: pure helpers of the Memory-based CF overview page (pages/memory-page.js) - which formula template shows a catalogue
// measure, and in which order the catalogue is laid out. Kept out of the page so the rules are checked under node from
// hand-derived cases (tests/app/js/memory_measures_check.mjs) and against the REAL catalogue + formulas.yaml (tests/app/test_memory_page.py).

/** Tag precedence of a catalogue entry (each carries exactly one; a fault is shown after the foils, the foils after the course measures). */
export const GROUPS = /** @type {const} */ (["core", "foil", "fault"]);

/**
 * Teaching order inside a group: the course's own measure first (Pearson, then its variants), the six measures of the lecture next.
 * A catalogue entry that is not listed is appended alphabetically, so a new measure still gets a card.
 */
const ORDER = [
  "pearson",
  "cosine",
  "adjusted_cosine",
  "jaccard",
  "euclidean_inv",
  "manhattan_inv",
  "constrained_pearson",
  "median_robust",
  "library_pearson",
  "spearman",
  "kendall",
  "adjusted_cosine_item_centred",
];

/**
 * A catalogue entry whose `formula_id` is another measure's template (Kendall borrows Spearman's id, the item-centred fault the item
 * adjusted-cosine's) gets its formulas from here: `[templateId, variant | null]`, or `null` for "no template" (the page then reads
 * `memory_cf.measure.<name>.tex` from i18n instead).
 * @type {Record<string, {user: [string, string | null] | null, item: [string, string | null] | null}>}
 */
const BORROWED = {
  adjusted_cosine_item_centred: { user: null, item: ["adjusted_cosine_item", "item_centred"] },
  kendall: { user: null, item: null },
};

/**
 * The user-centred adjusted cosine has its own item template (`adjusted_cosine_item`); every other measure's item formula is the
 * `item` variant of its own template.
 * @type {Record<string, [string, string | null]>}
 */
const ITEM_TEMPLATE = { adjusted_cosine: ["adjusted_cosine_item", null] };

/**
 * @param {Record<string, any> | undefined} formulas config/formulas.yaml as JSON
 * @param {[string, string | null] | null | undefined} ref `[templateId, variant | null]`
 * @returns {string | null} the template's `symbolic` LaTeX, or null when it does not exist
 */
function symbolic(formulas, ref) {
  if (!ref) return null;
  const [id, variant] = ref;
  const template = formulas?.[id];
  const source = variant ? template?.variants?.[variant] : template;
  return typeof source?.symbolic === "string" ? source.symbolic : null;
}

/**
 * The symbolic formulas of one catalogue measure: the user-based one (sums over the co-rated items) and the item-based one (sums over
 * the common raters). `null` = the measure has no template for that side.
 * @param {{name: string, formula_id: string}} info a `/api/config/similarities` entry
 * @param {Record<string, any> | undefined} formulas
 * @returns {{user: string | null, item: string | null}}
 */
export function measureFormulas(info, formulas) {
  if (Object.hasOwn(BORROWED, info.name)) {
    const borrowed = BORROWED[info.name];
    return { user: symbolic(formulas, borrowed.user), item: symbolic(formulas, borrowed.item) };
  }
  if (info.name !== info.formula_id) return { user: null, item: null }; // someone else's template: never guess
  return {
    user: symbolic(formulas, [info.formula_id, null]),
    item: symbolic(formulas, Object.hasOwn(ITEM_TEMPLATE, info.name) ? ITEM_TEMPLATE[info.name] : [info.formula_id, "item"]),
  };
}

/**
 * The catalogue split into the three groups of the page, each in teaching order.
 * @param {{name: string, tags?: string[]}[]} catalogue
 * @returns {Record<"core" | "foil" | "fault", {name: string, tags?: string[]}[]>}
 */
export function groupMeasures(catalogue) {
  /** @type {Record<"core" | "foil" | "fault", {name: string, tags?: string[]}[]>} */
  const out = { core: [], foil: [], fault: [] };
  for (const info of catalogue) {
    const tags = info.tags || [];
    const group = tags.includes("fault") ? "fault" : tags.includes("foil") ? "foil" : "core";
    out[group].push(info);
  }
  const rank = (/** @type {string} */ name) => {
    const at = ORDER.indexOf(name);
    return at < 0 ? ORDER.length : at;
  };
  for (const group of GROUPS) {
    out[group].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  }
  return out;
}

/**
 * How many comparison cells still hold the placeholder text (the page's beta marker).
 * @param {(key: string) => string} t the i18n lookup
 * @param {string[]} rows the row ids of the comparison table
 * @param {string[]} [spanning] the rows that are one cell over both columns (`.both`, counted once)
 * @returns {number}
 */
export function countTbd(t, rows, spanning = []) {
  const marker = t("memory_cf.tbd");
  let n = 0;
  for (const row of rows) {
    for (const side of spanning.includes(row) ? ["both"] : ["ucf", "icf"]) {
      if (t(`memory_cf.cmp.row.${row}.${side}`) === marker) n += 1;
    }
  }
  return n;
}
