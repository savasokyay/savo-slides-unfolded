// @ts-check
// WP-248: the rows of the Hybrid DNN page's "Values" tab - the vectors the network passes on for the pair on screen, stage by stage, in the order the walk visits them. Read from the trace's network
// view (`views.network.layers`): each stage carries its width `size`, the FIRST few of its numbers `values` (at most six; `truncated` says how many more there are) and, where only some of the numbers
// are non-zero, `nonzero`. Nothing here is computed from the numbers shown: a minimum, a mean or a spread over six of 2000 numbers would say nothing about the vector, so the tab does not show one.
// Plain logic, checked under node against the real feature-network stage list (tests/app/js/values_rows_check.mjs).

import { joinParts, nonzeroOf } from "./dnn-features.js";

/** @typedef {{id: string, label_key: string, kind: string, size: number, values?: number[], truncated?: number, nonzero?: number | null, activation?: string | null}} Stage */
/** @typedef {{row: number, id: string, labelKey: string, kind: string, side: "user" | "item" | "joined", size: number, nonzero: number | null, values: number[], more: number, composition: number[] | null, activation: string | null, largest: boolean}} ValuesRow */

/**
 * The stages the tab lists, in the view's own order (which is the order of the forward steps): every stage that hands numbers on. The two id inputs hand an index, not a vector, and have no row.
 * `row` is the stage's index in the view (a step's highlight names a stage by it); `side` colours the row (the user's stages, the film's, the joined ones from the join down); `composition` is
 * what the join is made of (the widths of the stages that feed it) and replaces its values, which would only be the first values of the user's embedding again; `nonzero` is the count when it is
 * lower than the width ("19 of 32"), null otherwise; `largest` marks the two wide side inputs, whose numbers are the SIX LARGEST (biggest first), not the first six: the engine reorders a sparse row by size.
 * @param {{layers?: Stage[], edges?: [string, string][]} | null | undefined} view
 * @returns {ValuesRow[]}
 */
export function valuesRows(view) {
  const layers = view?.layers ?? [];
  const parts = joinParts(/** @type {any} */ (view)).map((part) => part.size);
  return layers.flatMap((layer, row) => {
    if (layer.kind === "input") return [];
    const sized = nonzeroOf(layer);
    /** @type {ValuesRow} */
    const entry = {
      row,
      id: layer.id,
      labelKey: layer.label_key,
      kind: layer.kind,
      side: layer.id.startsWith("user_") ? "user" : layer.id.startsWith("item_") ? "item" : "joined",
      size: layer.size,
      nonzero: sized ? sized.nonzero : null,
      values: layer.kind === "concat" && parts.length > 0 ? [] : [...(layer.values ?? [])],
      more: layer.kind === "concat" && parts.length > 0 ? 0 : Math.max(0, layer.truncated ?? 0),
      composition: layer.kind === "concat" && parts.length > 0 ? parts : null,
      activation: layer.activation ?? null,
      largest: layer.kind === "features" && (layer.truncated ?? 0) > 0,
    };
    return [entry];
  });
}

/**
 * The rows a step lights: the network highlights that are `active` (a stage the walk is on) or `result` (the output stage of the last step).
 * @param {{view?: string, rows?: number[], style?: string}[] | null | undefined} highlights
 * @returns {Set<number>}
 */
export function litRows(highlights) {
  const lit = new Set();
  for (const h of highlights ?? []) {
    if (h.view !== "network" || (h.style !== "active" && h.style !== "result")) continue;
    for (const row of h.rows ?? []) lit.add(row);
  }
  return lit;
}

/**
 * The rows that feed the lit ones: the stages with an edge INTO a lit stage (the join's six parts feed the join; the join feeds the first MLP layer). A step lights one stage, so the rows read
 * as "these numbers went in, these came out".
 * @param {{layers?: Stage[], edges?: [string, string][]} | null | undefined} view
 * @param {Set<number>} lit rows
 * @returns {Set<number>}
 */
export function feederRows(view, lit) {
  const layers = view?.layers ?? [];
  const litIds = new Set([...lit].map((row) => layers[row]?.id).filter(Boolean));
  const fed = new Set();
  for (const [from, to] of view?.edges ?? []) {
    if (!litIds.has(to)) continue;
    const row = layers.findIndex((l) => l.id === from);
    if (row >= 0 && !lit.has(row)) fed.add(row);
  }
  return fed;
}

/**
 * One number as the tab writes it: an exact zero is "0" (a ReLU unit that is off), the rest three decimals with the typographic minus ("−0.101"). Never a plus sign: the column is a list of
 * numbers, not of changes.
 * @param {number} value
 * @returns {string}
 */
export function valueText(value) {
  if (value === 0) return "0";
  return `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(3)}`;
}
