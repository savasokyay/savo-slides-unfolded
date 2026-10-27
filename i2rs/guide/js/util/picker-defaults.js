// @ts-check
// WP-153: the film picker's "rated by the user" chip. On the memory-based and the content pages it opens ticked (the list keeps the films the user has RATED: the walk hides that
// rating and compares the prediction with it). On the matrix-factorization and neural pages it opens UNTICKED: since the stored models (WP-146) a film the user has not rated is
// answered at once, a film they have rated is the held-out cell and the model is trained again without that rating - so the page starts on the cheap case and the chip, ticked on
// purpose, brings the expensive one back; its (i) says why. The random pick follows the chip (`rated: "yes"` ticked, `"no"` unticked: trace-page.js), a film named in the link
// (`i=`) always wins (a route choice, not a chip's). Plain logic, checked under node (tests/app/js/picker_defaults_check.mjs); trace-page.js only calls it.

/** The engines whose trace is a fitted MODEL (the page's chip opens unticked, and carries the (i)). */
const MODEL_ENGINES = new Set(["mf", "dnn"]);

/**
 * What the item picker's "rated by the user" chip starts as, for a page.
 * @param {string} engine the page's engine ("ucf", "icf", "cb", "mf", "dnn")
 * @returns {{on: boolean, tipKey: string | null}} `on`: the chip opens ticked; `tipKey`: the i18n key of the (i) beside the chip (null: no (i) - the chip needs no explanation there)
 */
export function ratedChipFor(engine) {
  const model = MODEL_ENGINES.has(engine);
  return { on: !model, tipKey: model ? "picker.rated_by_user_tip_model" : null };
}
