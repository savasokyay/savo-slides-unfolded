// @ts-check
// WP-233: the weighted hybrid's four bases ARE the methods of the earlier pages (uCF = the user-based page, iCF = the item-based page, MF = the matrix factorization page, CBF = the content page's
// kNN item-similarity method), fitted with that page's own defaults on the training part of the split. This module is what the Bases tab needs to say so: which sidebar row each base is (its
// page and route come from the nav tree, never from a copy of config/nav.yaml), the link to that page for the same user and film, the settings in effect (the trace's own
// `base_configs` over the `config/algorithms.yaml` block of that page), and the display names of the engine's abbreviations. Pure functions, pinned under node by tests/app/js/hybrid_bases_check.mjs.

import { toHash } from "../router.js";
import { navNodeById } from "./nav-dataset.js";

/** the nav row (config/nav.yaml `id`) of the page each base is the method of */
export const BASE_NAV = /** @type {const} */ ({ ucf: "ucf", icf: "icf", mf: "mf", cb: "content.item" });

/** the `config/algorithms.yaml` block each base reads (engines/hybrid/bases.py `base_engine`: `UserKNN`, `ItemKNN`, `build_mf_engine`, `ContentBased`) */
export const BASE_BLOCK = /** @type {const} */ ({ ucf: "knn", icf: "item_knn", mf: "mf", cb: "cb" });

/** the engine's abbreviations (engines/hybrid/bases.py `BASE_ABBREV`, the keys of the trace's tables) -> the base id; the page shows its own names (`hybrid.walk.abbrev.<id>`) */
export const ENGINE_ABBREV = /** @type {const} */ ({ uCF: "ucf", iCF: "icf", MF: "mf", CB: "cb" });

/**
 * The short name the page gives each base by its id: `{ucf: "uCF", icf: "iCF", mf: "MF", cb: "CBF"}` (`hybrid.walk.abbrev.<id>`, the language file).
 * @param {{t: (key: string) => string}} i18n
 * @returns {Record<string, string>}
 */
export function baseNames(i18n) {
  return Object.fromEntries(Object.keys(BASE_NAV).map((id) => [id, i18n.t(`hybrid.walk.abbrev.${id}`)]));
}

/**
 * The display name of each engine abbreviation: `{uCF: "uCF", ..., CB: "CBF"}` - the trace keeps the engine's own `CB` (its fixtures and tables), the page says CBF.
 * @param {{t: (key: string) => string}} i18n
 * @returns {Record<string, string>}
 */
export function hybridAlias(i18n) {
  const names = baseNames(i18n);
  return Object.fromEntries(Object.entries(ENGINE_ABBREV).map(([abbrev, id]) => [abbrev, names[id]]));
}

/**
 * The route of a base's own page for the pair the walk is on: the nav row's page and its parameters, then the pair and the data set. null for an id that is no base, or a nav tree without the row.
 * @param {string} id a base id (`ucf` | `icf` | `mf` | `cb`)
 * @param {any[]} tree the nav tree (`ctx.nav.tree`)
 * @param {{u?: string | number | null, i?: string | number | null, ds?: string | null}} pair
 * @returns {{hash: string, labelKey: string} | null} the badge is in the base's label (`params.hybrid_base_<id>`, pinned to the nav row's icon by tests/app/test_hybrid_walk_page.py)
 */
export function baseRoute(id, tree, pair) {
  const navId = /** @type {Record<string, string>} */ (BASE_NAV)[id];
  const node = navId ? navNodeById(tree, navId) : null;
  if (!node || !node.page) return null;
  return { hash: toHash(node.page, { ...(node.params || {}), ds: pair.ds, u: pair.u, i: pair.i }), labelKey: String(node.label_key ?? "") };
}

/**
 * The settings in effect for a base: its page's `config/algorithms.yaml` block with the trace's own overrides (`meta.request.config.base_configs.<id>`) laid over it, reduced to the few values
 * the lesson names (neighbours and similarity for the two kNN bases, the algorithm and its factors for MF, the fields and the term frequency for the content base). Values are raw (null =
 * "all neighbours" for `k`); the page words them.
 * @param {string} id
 * @param {any} algorithms `/api/config/algorithms`
 * @param {Record<string, any> | null | undefined} overrides `base_configs` of the trace's request
 * @returns {Record<string, unknown> | null} null for an id that is no base
 */
export function baseSettings(id, algorithms, overrides) {
  const block = /** @type {Record<string, string>} */ (BASE_BLOCK)[id];
  if (!block) return null;
  /** @type {Record<string, any>} */
  const c = { ...(algorithms?.[block] ?? {}), ...(overrides?.[id] ?? {}) };
  if (id === "ucf" || id === "icf") return { k: c.k === undefined || c.k === null || Number(c.k) === 0 ? null : Number(c.k), similarity: c.similarity };
  if (id === "mf") return { algorithm: c.algorithm, factors: c.n_factors };
  return { fields: Array.isArray(c.fields) ? [...c.fields] : [], tf: c.tf };
}

/**
 * The words of a base's settings (`hybrid.walk.base.set_*`): a name the language file does not know (a similarity, an algorithm, a field) is written as the engine names it.
 * @param {string} id
 * @param {Record<string, unknown> | null} values `baseSettings`
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @returns {string} "" for an id that is no base
 */
export function settingsText(id, values, t) {
  if (!values) return "";
  /** a name of the language file, else the value itself @param {string} key @param {unknown} value */
  const named = (key, value) => {
    const text = t(key);
    return text === key ? String(value) : text;
  };
  if (id === "ucf" || id === "icf") {
    const k = values.k === null ? t("hybrid.walk.base.k_all") : values.k;
    return t("hybrid.walk.base.set_knn", { k, similarity: named(`formula.${values.similarity}`, values.similarity) });
  }
  if (id === "mf") return t("hybrid.walk.base.set_mf", { algorithm: named(`hybrid.walk.base.algo_${values.algorithm}`, values.algorithm), factors: values.factors });
  const fields = /** @type {string[]} */ (values.fields ?? []).map((f) => named(`params.field_${f}`, f)).join(", ");
  return t("hybrid.walk.base.set_cb", { fields, tf: values.tf });
}
