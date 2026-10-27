// @ts-check
// WP-233: the name cell of the hybrid's bases table - a base is the method of an earlier page, so its cell says which one (the sidebar badge, the page's short name and its method: the same
// words as the base's check box in the Parameters panel, `params.hybrid_base_<id>`), links that page for the same user and film ("open its page"), and carries the settings in effect as its
// hover sentence. Dressed through the data table's `decorate` hook; the row's `id` is the engine's base id (the intercept row has none, so it stays a plain cell).

import { baseRoute, baseSettings, settingsText } from "../util/hybrid-bases.js";

/**
 * @param {HTMLElement} td the cell, its text already set
 * @param {{id?: unknown}} row a row of the `bases` table
 * @param {{i18n: any, tree: any[], pair: {u?: string | number | null, i?: string | number | null, ds?: string | null}, algorithms: any, overrides?: Record<string, any> | null}} ctx
 */
export function dressBaseCell(td, row, ctx) {
  const id = typeof row.id === "string" ? row.id : "";
  const route = baseRoute(id, ctx.tree, ctx.pair);
  if (!route) return;
  const { i18n } = ctx;
  const link = document.createElement("a");
  link.className = "hybrid-base-link";
  link.href = route.hash;
  const name = document.createElement("span");
  name.className = "hybrid-base-name";
  name.textContent = i18n.t(`params.hybrid_base_${id}`); // the check box's own words: badge, name, method
  link.append(name);
  const open = document.createElement("span");
  open.className = "hybrid-base-open";
  open.setAttribute("aria-hidden", "true");
  open.textContent = "↗";
  link.append(" ", open);
  td.replaceChildren(link);
  td.classList.add("hybrid-base-cell");
  const settings = settingsText(id, baseSettings(id, ctx.algorithms, ctx.overrides), (key, params) => i18n.t(key, params));
  td.title = [i18n.t("hybrid.walk.base.open", { page: i18n.t(route.labelKey) }), settings ? i18n.t("hybrid.walk.base.settings", { settings }) : ""].filter(Boolean).join("\n");
}
