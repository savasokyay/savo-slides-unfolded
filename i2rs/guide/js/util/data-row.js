// @ts-check
// WP-242: the "Data" row at the top of a walk page's Parameters panel - what the page trained on, what it validated on and what it was tested on, in one read-only line. The instructor's
// rule: this belongs on the screen, not only in the lecture ("neither train nor test: it shows in the parameters too"). The numbers come from the trace when there is one (the walk's own
// split step: its counts are the truth the narration also reads), else from the settings the page would send (the route's value over the engine's default; the tip names the key). Pure and
// import-free so tests/app/js/data_row_check.mjs can pin every template under node.
//
// What each page splits (checked against the engines, not copied from the lecture):
//   * weighted hybrid: the newest share of EVERY user's ratings is held out (a per-user cap, users with too few ratings keep all of theirs), the bases train on the rest, the target is in neither
//     (engines/hybrid/explain_weighted.py `split`: frac, cap, n_heldout pairs, n_train);
//   * switching hybrid: only the ACTIVE user's newest ratings are held out (`switch_holdout_frac`, at most the cap), every other rating - the other users' newest included - trains
//     (explain_switching.py `split`: frac, cap, n_heldout, n_train);
//   * the trained rating models (MF page, neural pages): the target is hidden and the model trained again without it; the newest `valid_frac` share of EACH user's remaining ratings is the
//     validation set that early stopping watches (`trainer.valid_frac`, only users with `valid_min_ratings`; a tail under `min_valid_size` is not used; a closed-form model has none)
//     (engines/mf/explain_mf.py `holdout`: n_train, n_valid, valid_frac, n_hidden);
//   * the per-user content model: the student's rated films without the target; a validation share of them is held out (a key drawn per student, so the same films whatever the target is:
//     `model.mlp.val_fraction`, at least `val_min`; the small network is watched by early stopping, the ridge only reports an error from a separate fit; fewer than 2 x val_min films: none)
//     (engines/cb/explain_model.py `result.model`: n_films, n_train, n_val);
//   * the memory-based pages, the item-similarity method and Rocchio: the target rating is hidden (`holdout: in_matrix`) and the prediction is made from the others - Rocchio's profile
//     reads only this student's films.

/** @typedef {(key: string, params?: Record<string, unknown>) => string} Translate */

/** @param {unknown} raw @returns {number | null} a finite number, null for anything else (an empty string is not zero) */
function num(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 0.2 -> "20", 0.25 -> "25", 0.125 -> "12.5": the share as a bare number (the sentence carries the percent sign) @param {number} share */
export function percentOf(share) {
  return String(Math.round(share * 1000) / 10);
}

/** a count as the row's tail " (123)" - nothing while the trace has not said @param {unknown} n */
function tail(n) {
  const v = num(n);
  return v === null ? "" : ` (${Math.round(v)})`;
}

/** the first step of a node whose text key starts with a prefix (a walk may repeat a node) @param {any} trace @param {string} node @param {string} [prefix] */
function stepParams(trace, node, prefix = "") {
  const step = (trace?.steps ?? []).find((/** @type {any} */ s) => s.node_id === node && String(s.text_key ?? "").startsWith(prefix));
  return step?.text_params ?? null;
}

/** the route's value over the engine's default @param {Record<string, string | undefined> | undefined} route @param {string} key @param {unknown} fallback */
function valueOf(route, key, fallback) {
  const given = route?.[key];
  return given !== undefined && given !== "" ? given : fallback;
}

/**
 * "(at most 60 per user; 9400 pairs)" - the cap (nothing for no cap) and the pairs held out (nothing before the trace); empty when neither is known.
 * @param {Translate} t
 * @param {"each" | "one"} who the cap is per user or for the one user
 * @param {number | null} cap
 * @param {number | null} pairs
 */
function heldDetail(t, who, cap, pairs) {
  const parts = [];
  if (cap !== null) parts.push(t(who === "each" ? "data_row.cap_each" : "data_row.cap_one", { cap: Math.round(cap) }));
  if (pairs !== null) parts.push(t("data_row.pairs", { n: Math.round(pairs) }));
  return parts.length ? ` (${parts.join("; ")})` : "";
}

/**
 * @param {Record<string, string | undefined> | undefined} route
 * @param {Record<string, any>} d the hybrid defaults
 * @returns {number | null} the per-user cap: the route's `hc` ("none": no cap), else the default (null: no cap)
 */
function capOf(route, d) {
  if (route?.hc === "none") return null;
  const given = num(route?.hc);
  if (given !== null) return given;
  return num(d.holdout_max_per_user);
}

/**
 * The row for a page: its template, its numbers and its tip. null where the page has no train / test split to state (the top-K task has no target).
 * @param {{
 *   engine: string, method?: string | null, task?: string | null, trace?: any, route?: Record<string, string | undefined>,
 *   defaults?: Record<string, any> | null, t: Translate
 * }} o `engine`: ucf | icf | mf | dnn | cb | hybrid; `method`: the content page's (item | profile | model) or the hybrid's (weighted | switching); `defaults`: that engine's block of config/algorithms.yaml
 * @returns {{kind: string, text: string, tip: string} | null}
 */
export function dataRowFor(o) {
  const { engine, method, trace, route, t } = o;
  const d = o.defaults ?? {};
  if (o.task === "topk") return null;

  if (engine === "hybrid") {
    const split = stepParams(trace, "split");
    const cap = split ? num(split.cap) : capOf(route, d);
    if (method === "switching") {
      const frac = split ? String(split.frac) : percentOf(num(valueOf(route, "sh", d.switch_holdout_frac)) ?? 0.25);
      return {
        kind: "switching",
        text: t("data_row.switching", { frac, train_n: tail(split?.n_train), held_detail: heldDetail(t, "one", cap, num(split?.n_heldout)) }),
        tip: t("data_row.tip.switching"),
      };
    }
    const frac = split ? String(split.frac) : percentOf(num(valueOf(route, "hf", d.holdout_frac)) ?? 0.2);
    return {
      kind: "weighted",
      text: t("data_row.weighted", { frac, train_n: tail(split?.n_train), held_detail: heldDetail(t, "each", cap, num(split?.n_heldout)) }),
      tip: t("data_row.tip.weighted"),
    };
  }

  if (engine === "dnn" || engine === "mf") {
    const trainer = d.trainer ?? {};
    const hold = stepParams(trace, "holdout", "step.mf.holdout");
    // a closed-form model (EASE) has no validation set; before a trace the algorithm says it
    const iterative = engine === "dnn" || String(valueOf(route, "alg", d.algorithm ?? "funk_svd")) !== "ease";
    const share = num(hold ? hold.valid_frac : valueOf(route, "vf", trainer.valid_frac ?? 0.1));
    const validated = hold ? Number(hold.n_valid) > 0 : iterative && share !== null && share > 0;
    return {
      kind: validated ? "trained_valid" : "trained_plain",
      text: validated
        ? t("data_row.trained_valid", { share: percentOf(share ?? 0), train_n: tail(hold?.n_train), valid_n: tail(hold?.n_valid) })
        : t("data_row.trained_plain", { train_n: tail(hold?.n_train) }),
      tip: t("data_row.tip.trained"),
    };
  }

  if (engine === "cb" && method === "model") {
    const model = d.model ?? {};
    const kind = route?.mk === "mlp" ? "mlp" : "ridge"; // the route's `mk`: any other value is the regression (trace-page.js `cbKind`)
    const result = trace?.result?.model ?? null; // `result.model`: kind, n_films (the films without the target), n_train, n_val
    const share = num(kind === "mlp" ? valueOf(route, "vf", model.mlp?.val_fraction ?? 0.2) : (model.mlp?.val_fraction ?? 0.2)) ?? 0.2;
    // the trace says when the history was too short to hold any film out (`n_val` 0)
    const none = result !== null && num(result.n_val) === 0;
    // `es=0` is the labelled foil: the network trains all its epochs on purpose, the validation films only measure
    const key = none ? "model_none" : kind === "mlp" ? (route?.es === "0" ? "model_mlp_off" : "model_mlp") : "model_ridge";
    return {
      kind: key,
      text: t(`data_row.${key}`, { share: percentOf(share), train_n: tail(none || kind === "ridge" ? result?.n_films : result?.n_train), valid_n: tail(result?.n_val) }),
      tip: t("data_row.tip.model"),
    };
  }

  if (engine === "cb" && method === "profile") return { kind: "profile", text: t("data_row.profile"), tip: t("data_row.tip.profile") };
  if (engine === "ucf" || engine === "icf" || engine === "cb") return { kind: "target", text: t("data_row.target"), tip: t("data_row.tip.target") };
  return null;
}
