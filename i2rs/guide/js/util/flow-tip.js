// @ts-check
// WP-212: the hover tip of a flowchart box. A box has a tip when the language files say one under the box's own label key with `flow.` turned into `flow_tip.` - the box labelled
// `flow.topk_cb.mmr` ("Re-rank with MMR") says `flow_tip.topk_cb.mmr`. The rule needs nothing from the engine or the chart file (a warmed trace carries the chart as it was drawn): a chart
// gains a tip by adding a line to config/i18n/en.yaml and tr.yaml, and a box with no such line shows none. Plain logic, checked under node (tests/app/js/flow_tip_check.mjs).

/**
 * @param {string | undefined} labelKey a box's `label_key` (`flow.<chart>.<node>`)
 * @returns {string | null} the language key of its tip; null for a label key that is not under `flow.`
 */
export function flowTipKey(labelKey) {
  return typeof labelKey === "string" && labelKey.startsWith("flow.") && labelKey.length > 5 ? `flow_tip.${labelKey.slice(5)}` : null;
}

/**
 * @param {(key: string) => string} t the language lookup (it returns the key itself for a key the files do not have)
 * @param {string | undefined} labelKey
 * @returns {string} the tip's text, "" when the box has none
 */
export function flowTipText(t, labelKey) {
  const key = flowTipKey(labelKey);
  if (key === null) return "";
  const text = t(key);
  return text === key ? "" : text;
}
