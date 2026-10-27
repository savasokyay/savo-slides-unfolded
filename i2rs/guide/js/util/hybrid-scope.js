// @ts-check
// WP-239: the scope of each choice the hybrid walks make - whole class, this user only, per user, per user x film, this pair. The instructor's rule: it is written on the screen, at the
// step that makes the choice, whether the choice is made for the whole dataset, for a user, for a film or for a user x film pair. The step card (components/narration.js) shows a small
// chip with the short form ("Scope: whole class"), its sentence ends with the long one ("Scope: the whole class. One held-out set from every user; ...") and the chip's hover tip adds,
// where the literature does it differently, what it does instead (`hybrid.walk.scope.lit.<id>`).
// Pure and import-free, so tests/app/js/hybrid_scope_check.mjs can pin the step -> scope table under node. A step the table does not name has no chip.

/**
 * @typedef {{ id: string, chip: string, lit: boolean }} Scope `id`: the sentence (`hybrid.walk.scope.text.<id>`); `chip`: the short form (`hybrid.walk.scope.chip.<chip>`); `lit`: the
 *   literature's alternative follows in the chip's tip (`hybrid.walk.scope.lit.<id>`)
 */

/** @type {Readonly<Record<string, Scope>>} */
export const SCOPES = {
  class_split: { id: "class_split", chip: "class", lit: false }, // weighted split: one held-out set from every user
  class_fit: { id: "class_fit", chip: "class", lit: false }, // weighted fit: the training ratings of everyone; one model per base for all users
  class_weights: { id: "class_weights", chip: "class", lit: true }, // weighted weights (equal, gradient steps, closed form, the compare, the blend): one set for the class
  user_split: { id: "user_split", chip: "user_only", lit: false }, // switching split: only the active user's newest ratings are held out
  user_bucket: { id: "user_bucket", chip: "user", lit: true }, // switching bucket: the winner is chosen once for this user
  user_film: { id: "user_film", chip: "user_film", lit: false }, // switching neighbour rule: one choice per pair, from its neighbour count
  pair: { id: "pair", chip: "pair", lit: false }, // the answer is for the pair on screen
};

/** the weighted walk's nodes (`engines/hybrid/explain_weighted.py`): the weights steps are one scope; `result` is the pair's answer (the walk has no node called answer) */
const WEIGHTED = {
  split: "class_split",
  fit_bases: "class_fit",
  equal: "class_weights",
  gd: "class_weights",
  ridge: "class_weights",
  compare: "class_weights",
  blend: "class_weights",
  result: "pair",
};

/** the switching walk's nodes (`engines/hybrid/explain_switching.py`): `choose` under the neighbour rule is per pair, see `scopeOf` */
const SWITCHING = {
  split: "user_split",
  fit_bases: "class_fit", // WP-239: the bases are fitted as on the weighted walk (the training ratings of everyone but the active user's newest): the same sentence holds
  score: "user_bucket",
  choose: "user_bucket",
  answer: "pair",
};

/**
 * Which scope a step states, if any.
 * @param {string | null | undefined} method "weighted" | "switching" (anything else: no chip)
 * @param {{ node_id?: string } | null | undefined} step
 * @param {string | null | undefined} [rule] the switching walk's rule (the trace's `result.rule`): "bucket" | "neighbours"
 * @returns {Scope | null}
 */
export function scopeOf(method, step, rule) {
  const node = step?.node_id;
  if (!node) return null;
  if (method === "weighted") return Object.hasOwn(WEIGHTED, node) ? SCOPES[/** @type {Record<string, string>} */ (WEIGHTED)[node]] : null;
  if (method !== "switching") return null;
  if (rule === "neighbours") {
    // the cold-start rule chooses for each pair from its neighbour count; its leaderboard steps only measure the two bases (no choice is made on them)
    if (node === "choose") return SCOPES.user_film;
    if (node === "score") return null;
  }
  return Object.hasOwn(SWITCHING, node) ? SCOPES[/** @type {Record<string, string>} */ (SWITCHING)[node]] : null;
}

/**
 * The words of a scope in the viewer's language.
 * @param {(key: string) => string} t
 * @param {Scope} scope
 * @returns {{ chip: string, text: string, tip: string }} `tip`: the sentence, then (a scope that has one) what the literature does instead
 */
export function scopeTexts(t, scope) {
  const text = t(`hybrid.walk.scope.text.${scope.id}`);
  return {
    chip: t(`hybrid.walk.scope.chip.${scope.chip}`),
    text,
    tip: scope.lit ? `${text}\n\n${t(`hybrid.walk.scope.lit.${scope.id}`)}` : text,
  };
}
