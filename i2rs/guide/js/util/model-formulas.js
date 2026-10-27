// @ts-check
// WP-121: pure helper of the Model-based CF overview page (pages/model-page.js), section 3 - which LaTeX a formula card shows. A card shows the
// `symbolic` layer of one template of config/formulas.yaml and, for a template that has one, the same statement for the other setting of the
// Matrix factorization page (the `no_bias` variant = the Biases setting off). Kept out of the page so the rule is checked under node from
// hand-derived cases and against the REAL formulas.yaml (tests/app/js/model_formulas_check.mjs, tests/app/test_model_page.py).

/**
 * @param {string} id the template id (config/formulas.yaml key)
 * @param {Record<string, any> | undefined} formulas config/formulas.yaml as JSON (`/api/config/formulas`)
 * @param {string | null} [variant] the variant to show after the main formula (null = none)
 * @returns {{variant: string | null, tex: string}[]} the main formula first, then the variant when the template has it; `[]` when the
 *   template does not exist or has no `symbolic` text (the page then shows the card's text alone, never a blank formula)
 */
export function cardFormulas(id, formulas, variant = null) {
  const template = formulas?.[id];
  if (typeof template?.symbolic !== "string") return [];
  /** @type {{variant: string | null, tex: string}[]} */
  const out = [{ variant: null, tex: template.symbolic }];
  const extra = variant ? template.variants?.[variant]?.symbolic : undefined;
  if (typeof extra === "string") out.push({ variant, tex: extra });
  return out;
}
