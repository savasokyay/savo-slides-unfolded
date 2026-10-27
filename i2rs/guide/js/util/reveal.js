// @ts-check
// WP-137a: the held-out reveal SETTING - when the rating the walk predicts (the active user's rating of the target film) shows. "step" (the default): hidden until
// the prediction step opens it - in the sub-matrix cell (`?`), in the summary bar's Prediction / Actual / Error values and in the picker chip's number - and closed
// again when the player steps back before it. "start": every one of them shows from the first step, as before WP-137. View state like `vals` and `nb`: the route
// parameter `reveal` (`step` | `start`), never sent to the API, kept by Apply and by every step; nothing is stored in the browser. Pure functions, hand-checked under
// node (tests/app/js/reveal_check.mjs); the page and the grid build the DOM from them.

/** @typedef {"step" | "start"} RevealMode */

/**
 * The mode the route parameter `reveal` asks for: `start` shows the rating from the first step; anything else - `step`, none, a stray value - reveals it at the
 * prediction step (the default).
 * @param {unknown} param the `reveal` route parameter
 * @returns {RevealMode}
 */
export function revealModeFor(param) {
  return param === "start" ? "start" : "step";
}

/**
 * The route parameter of a mode.
 * @param {RevealMode} mode
 * @returns {"step" | "start"}
 */
export function revealParam(mode) {
  return mode === "start" ? "start" : "step";
}

/**
 * Whether the held-out rating is hidden right now: the setting is "step", the trace HAS a step that reveals it (a trace that never does has nothing to hide - the
 * content page, a view without the cell), and the step on screen is not one that does.
 * @param {{mode: RevealMode, hasReveal: boolean, revealed: boolean}} p `revealed`: the current frame opens the cell (`revealsCell`, util/heat-orient.js)
 * @returns {boolean}
 */
export function isHidden({ mode, hasReveal, revealed }) {
  return hasReveal && mode === "step" && !revealed;
}

/** What a hidden number is written as: the same question mark the sub-matrix cell shows. */
export const HIDDEN_TEXT = "?";

/**
 * The text a hidden-able value shows: the question mark while hidden, the value otherwise.
 * @param {string} value
 * @param {boolean} hidden
 * @returns {string}
 */
export function shown(value, hidden) {
  return hidden ? HIDDEN_TEXT : value;
}

/**
 * Write the summary bar's prediction-giving figures as the setting says: a question mark with the reason as its hover text while hidden, the real text (and no hover
 * text of its own) otherwise. The class `is-held-out` marks a hidden one (the pointer: trace.css).
 * @param {{el: {textContent: string | null, title: string, classList: {toggle: (name: string, force?: boolean) => boolean}}, text: string}[]} figures
 * @param {boolean} hide
 * @param {string} reason the hover text of a hidden figure
 */
export function paintFigures(figures, hide, reason) {
  for (const { el, text } of figures) {
    el.textContent = shown(text, hide);
    el.classList.toggle("is-held-out", hide);
    el.title = hide ? reason : "";
  }
}

/**
 * Write the picker chip ("4.0 - held out (dynamic)") as the setting says: the rating becomes a question mark while hidden ("? - held out (dynamic)"), the words stay.
 * A chip with no rating (the target was not rated: the notice there has no number to hide) is left as it is.
 * @param {{textContent: string | null, title: string, classList: {toggle: (name: string, force?: boolean) => boolean}} | null | undefined} chip
 * @param {{rating: string, convention: string} | null} state
 * @param {boolean} hide
 * @param {(key: string, params: Record<string, string>) => string} t the translator (`picker.held_out`)
 * @param {string} reason the hover text of a hidden rating
 */
export function paintChip(chip, state, hide, t, reason) {
  if (!chip || !state) return;
  chip.textContent = t("picker.held_out", { rating: shown(state.rating, hide), convention: state.convention });
  chip.classList.toggle("is-held-out", hide);
  chip.title = hide ? reason : "";
}
