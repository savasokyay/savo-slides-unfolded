// @ts-check
// WP-110 (d) / WP-118 (1): the similarity-measure selector's groups. Every catalogue measure carries ONE tag (core | foil |
// fault); the selector shows them as optgroups. WP-118: on the item-based page only the user-centred adjusted cosine is the
// course's measure - the rule "centre every rating by its USER's mean" - so its other core measures (raw cosine, Pearson,
// Jaccard, ...) move into a group of their own, `icf_other`, whose label says what they have in common. The user-based page
// keeps its three groups. Plain values in, plain values out, so the rule is checked under node
// (tests/app/js/measure_groups_check.mjs); param-form.js builds the optgroups from it.

/** The groups in the order the selector draws them: the course's measures first, the faults last. */
export const MEASURE_GROUPS = /** @type {const} */ (["core", "icf_other", "foil", "fault"]);

/** The one measure that is the course's measure on the item-based page. */
export const ICF_COURSE_MEASURE = "adjusted_cosine";

/**
 * The catalogue tag of a measure: fault beats foil beats core (a measure with no tag is a course measure).
 * @param {{tags?: string[]}} measure
 * @returns {"core" | "foil" | "fault"}
 */
export function measureKind(measure) {
  const tags = measure.tags ?? [];
  return tags.includes("fault") ? "fault" : tags.includes("foil") ? "foil" : "core";
}

/**
 * The selector group of a measure.
 * @param {{name: string, tags?: string[]}} measure
 * @param {boolean} itemBased the item-based page
 * @returns {"core" | "icf_other" | "foil" | "fault"}
 */
export function measureGroup(measure, itemBased) {
  const kind = measureKind(measure);
  return itemBased && kind === "core" && measure.name !== ICF_COURSE_MEASURE ? "icf_other" : kind;
}
