// @ts-check
// WP-188: the notes under a step's Formula box - the plain-language remarks of the closing step of a content-based predict trace ("the look-alikes average 2.78 while this film is one of the
// user's favourites"). The engine sends `steps[i].notes = [{text_key: "diag.<code>", text_params: {...}}]` (design note docs/plans/2610171316-result-diagnostics-design.md); the viewer's
// language writes the sentence. This module is the plain logic of that block: how each number is written, which sentences can be written at all, and the "(s)" ending (WP-188 follow-up). Pure functions, hand-derived in
// tests/app/js/diag_notes_check.mjs under node (the notes of the contract fixture are the input there).

/** the params that are rating-scale numbers: two decimals, whole numbers included (4 -> "4.00"), so a column of them reads alike */
const RATING_PARAMS = new Set(["pred", "actual", "error", "abs_error", "center", "q_fav", "q_dis"]);
/** the percentage (`share`): one decimal; the sentence carries the percent sign itself ("({share} %)", "(% {share})") */
const PERCENT_PARAMS = new Set(["share"]);
/** WP-224: an error measure or a gain in it (`rmse`, `rmse_ids`, `val_loss`, `gain`, `mae`): four decimals, as the traces write every error; a whole-number rounding would turn 0.87 into "1" */
const ERROR_PARAMS = /(^|_)(rmse|mae|mse|loss|gain)($|_)/;
/** WP-222: the weighted hybrid's notes: a blend weight (`alpha`), a distance between two weight vectors (`alpha_gap`) or between two errors (`gap`): four decimals, as the walk's own texts write them */
const WEIGHT_PARAMS = new Set(["alpha", "alpha_gap", "gap"]);
/** WP-220a: the weighted hybrid's intercept (`beta0`, `beta0_equal`, `beta0_gd`, `beta0_ridge`): four decimals with its sign (a whole-number rounding wrote "-0" for -0.2551); a value that rounds to zero loses its minus */
const BETA_PARAMS = /^beta0(_|$)/;
/** WP-222: the sum of the weights (`sum`): three decimals - a free fit adds up to 0.923, and a whole-number rounding would say "1" next to "instead of 1" */
const SUM_PARAMS = new Set(["sum"]);
/** WP-222: the hybrid's notes name things - a base (`base`, `best`), a list of bases (`bases`), the active user (`user`): ready-made strings of the engine, written as they come. Any other string stays out */
const NAME_PARAMS = new Set(["base", "best", "bases", "user"]);

/**
 * Every param of a note as the text shows it. A rating is written with two decimals, `share` with one, any other number (`n_used`, `n_rated`, `n_fav`, `n_dis`) as a whole number. A value
 * that is not a finite number (null, missing, NaN) is left out - never written as a blank - so a sentence that needs it cannot be written (see `noteSentences`).
 * @param {Record<string, unknown> | undefined} params `text_params` of a note
 * @returns {Record<string, string>}
 */
export function formatNoteParams(params) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (typeof value === "string" && NAME_PARAMS.has(key) && value.trim()) {
      out[key] = value; // WP-222
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    // the counts (`n_used`, `n_item`, `kept_epoch` ...) keep the whole-number branch: a count written with decimals would read as a measurement
    out[key] = RATING_PARAMS.has(key) ? value.toFixed(2) : PERCENT_PARAMS.has(key) ? value.toFixed(1) : SUM_PARAMS.has(key) ? value.toFixed(3) : BETA_PARAMS.test(key) ? value.toFixed(4).replace(/^-(0\.0+)$/, "$1") : WEIGHT_PARAMS.has(key) || ERROR_PARAMS.test(key) ? value.toFixed(4) : String(Math.round(value));
  }
  return out;
}

/**
 * The sentences of a step's notes, in the order the engine sent them. A note whose text the language file lacks (the lookup returns the key itself) or whose sentence names a number the
 * note does not carry is dropped: the box never shows a `{placeholder}` or a blank where a number belongs.
 * @param {Array<{text_key?: string, text_params?: Record<string, unknown>}> | null | undefined} notes `step.notes`
 * @param {(key: string) => string} template the viewer's language: the sentence of an i18n key with its `{param}` placeholders (the key itself when there is none)
 * @returns {string[]}
 */
export function noteSentences(notes, template) {
  /** @type {string[]} */
  const out = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    const key = note && typeof note.text_key === "string" ? note.text_key : "";
    if (!key) continue;
    const text = template(key);
    if (typeof text !== "string" || text === key) continue;
    const shown = formatNoteParams(note.text_params);
    const wanted = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (wanted.some((name) => !(name in shown))) continue;
    out.push(plural(text.replace(/\{(\w+)\}/g, (_match, name) => shown[name]), note.text_params));
  }
  return out;
}

/**
 * The "(s)" of a sentence ("{n_used} neighbour(s)", "the {n_used} most similar film(s)"): "" when the note's `n_used` is 1, "s" for any other count. The page has no plural rule of its own, so
 * the sentence's author marks the optional ending and this settles it. A sentence with no "(s)" (the Turkish ones) is returned as it is; with no usable `n_used` the "(s)" stays as written.
 * @param {string} text
 * @param {Record<string, unknown> | undefined} params `text_params` of the note
 * @returns {string}
 */
function plural(text, params) {
  const n = params ? params.n_used : undefined;
  if (typeof n !== "number" || !Number.isFinite(n)) return text;
  return text.replace(/\(s\)/g, Math.round(n) === 1 ? "" : "s");
}
