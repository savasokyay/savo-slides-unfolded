// @ts-check
// WP-168c: which sentences a box of the neural network diagram says when it is hovered (components/network-panel.js draws the bubble). The choice is made from what the engine's view
// says about the stage - its kind, its label key and its activation - not from its id, and from one fact about the whole view: whether the model has TWO branches (a stage labelled
// `layer.concat_out` is where the GMF product and the MLP output meet; only NeuMF has it). The sentences are `mf.layer_tip_*` in the language files; the last one of every box that
// shows bars is `mf.layer_tip_bars`. Plain logic, checked under node against the four architectures' stage lists (tests/app/js/layer_tip_check.mjs).

import { nonzeroOf } from "./dnn-features.js"; // WP-244: whether only some of a stage's numbers are non-zero for this pair

/** @typedef {{id?: string, kind: string, label_key: string, activation?: string | null, detail?: string | null, size?: number, nonzero?: number | null, n_params?: number, truncated?: number}} Stage */

const BRANCH = /^layer\.(?:user|item)_embedding_(gmf|mlp)$/;

/**
 * Whether the view has both branches of NeuMF (the GMF product and the MLP output, side by side before the output unit).
 * @param {{layers?: Stage[]} | null | undefined} view
 * @returns {boolean}
 */
export function hasTwoBranches(view) {
  return Boolean(view?.layers?.some((l) => l.label_key === "layer.concat_out"));
}

/**
 * The language keys a stage's tip is made of, in reading order (joined by a space). Never empty for a stage the engine can send; a stage of a kind this table does not know gets only the
 * bars sentence (the diagram stays usable when the engine grows a new kind).
 * @param {Stage} layer
 * @param {{layers?: Stage[], architecture?: string} | null | undefined} view the whole view (two branches or one; WP-243: the architecture, for the feature network's join and MLP)
 * @returns {string[]}
 */
export function layerTipKeys(layer, view) {
  // WP-248: on the feature network the last sentence reads the box's bars exactly (the first six numbers, in order, one scale for the diagram) and, where the box's caption is a plain "n = 8", says what
  // it counts ("n" the numbers it holds, `|θ|` the weights it learned); a caption of the "16 of 2000" kind is explained by the box's own sentences. Every other page keeps the short sentence.
  // A wide side input (the film's terms, the user's profile: the engine's `features` stages with numbers left out) shows its six LARGEST numbers, biggest first - not its first six (explain_dnn.py `_leading`).
  const features = view?.architecture === "features";
  const largest = layer.kind === "features" && (layer.truncated ?? 0) > 0;
  const bars = features ? (largest ? "mf.layer_tip_bars_largest" : "mf.layer_tip_bars_features") : "mf.layer_tip_bars";
  const read = features ? [(layer.n_params ?? 0) > 0 ? "mf.layer_tip_read_n_theta" : "mf.layer_tip_read_n"] : [];
  // WP-199: the content page's per-user network has no bias and no ids, so the neural page's sentences about them would be wrong; its three stages say what they are (the film's terms
  // - the names behind them, when the engine sends them -, the hidden units, the output deviation with the sum the engine writes out)
  if (layer.label_key === "layer.cb_terms") return ["mf.layer_tip_cb_terms", ...(layer.detail ? ["mf.layer_tip_cb_terms_of"] : []), bars];
  if (layer.label_key === "layer.cb_hidden") return ["mf.layer_tip_cb_hidden", bars];
  if (layer.label_key === "layer.cb_output") return ["mf.layer_tip_cb_output", ...(layer.detail ? ["mf.layer_tip_cb_output_is"] : []), bars]; // the engine's `detail`: "4.00 + 0.83 = 4.83" (the mean, the deviation, the prediction)
  // WP-223: the feature network's side inputs (the film's terms, the user's profile, the two numeric groups) and their towers say what they hold and what they learned from; the engine's
  // `detail` names the terms ("genre: Drama, kw: heist"), the signed profile terms, or the raw numbers before standardising
  // WP-244: and how many of their numbers are non-zero for this pair (a film with 16 terms of a 2000-term vocabulary; a profile of 673), and what ReLU zeroed in a layer
  const some = nonzeroOf(/** @type {{size: number, nonzero?: number | null}} */ (layer)) !== null;
  // WP-248: ReLU is said on EVERY hidden layer of the feature network (the output unit is linear and says nothing about it); what the caption counts follows only where some units are off
  const relu = layer.activation === "relu" ? ["mf.layer_tip_relu", ...(some ? ["mf.layer_tip_relu_zeros"] : read)] : [];
  if (layer.label_key === "layer.item_content") return ["mf.layer_tip_item_content", ...(some ? ["mf.layer_tip_item_content_nz"] : []), ...(layer.detail ? ["mf.layer_tip_item_content_of"] : []), bars];
  if (layer.label_key === "layer.user_profile") return ["mf.layer_tip_user_profile", ...(some ? ["mf.layer_tip_user_profile_nz"] : []), ...(layer.detail ? ["mf.layer_tip_user_profile_of"] : []), bars];
  if (layer.label_key === "layer.user_stats") return ["mf.layer_tip_user_stats", ...(layer.detail ? ["mf.layer_tip_numbers_of"] : []), ...read, bars];
  if (layer.label_key === "layer.item_numeric") return ["mf.layer_tip_item_numeric", ...(layer.detail ? ["mf.layer_tip_numbers_of"] : []), ...read, bars];
  if (layer.label_key === "layer.item_dense") return ["mf.layer_tip_item_dense", ...relu, bars];
  if (layer.label_key === "layer.user_dense") return ["mf.layer_tip_user_dense", ...relu, bars]; // WP-244
  // WP-243: in the feature network the embedding tables, the join and the MLP layers say what they do THERE - there is no dot product and no second branch, the join lays the parts side by side
  // and the MLP mixes them, and a switched-off input group takes its part out of the join
  if (view?.architecture === "features") {
    if (layer.kind === "embedding") return ["mf.layer_tip_embedding_features", ...read, bars];
    if (layer.kind === "concat") return ["mf.layer_tip_join_features"]; // WP-245: no bars sentence - the join's box shows what it is made of (n = 53 = 8+8+16+...) where the bars were
    if (layer.kind === "dense" && layer.label_key === "layer.dense") return ["mf.layer_tip_mlp_features", ...relu, bars]; // WP-244
  }
  switch (layer.kind) {
    case "input":
      return ["mf.layer_tip_input"]; // an id has no bars
    case "embedding": {
      const branch = BRANCH.exec(layer.label_key)?.[1]; // only a model with both branches labels its tables by branch
      return ["mf.layer_tip_embedding", ...(branch ? [`mf.layer_tip_branch_${branch}`] : []), bars];
    }
    case "product":
      return ["mf.layer_tip_product", bars];
    case "concat":
      if (layer.label_key === "layer.concat_out") return ["mf.layer_tip_concat_out", bars];
      if (layer.label_key === "layer.concat_item") return ["mf.layer_tip_concat_item", bars];
      return [hasTwoBranches(view) ? "mf.layer_tip_concat_mlp" : "mf.layer_tip_concat", bars];
    case "dense":
      if (layer.label_key === "layer.genre_dense") return ["mf.layer_tip_genre_dense", bars];
      return [layer.activation === "relu" ? "mf.layer_tip_dense_relu" : "mf.layer_tip_dense_linear", bars];
    case "features":
      return ["mf.layer_tip_features", ...(layer.detail ? ["mf.layer_tip_features_of"] : []), bars];
    case "output":
      return ["mf.layer_tip_output", ...read, bars];
    default:
      return [bars];
  }
}
