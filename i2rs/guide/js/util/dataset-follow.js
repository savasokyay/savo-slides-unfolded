// @ts-check
// WP-115 (12): the header's dataset selector and a page whose URL names a dataset (`ds`).
//
// The selector only sets `store.dataset`. A trace page (uCF / iCF / content / MF / DNN) read `routeParams.ds || state.dataset`, and its own links always carry `ds`
// (Random pick, Apply ...), so once the URL named a dataset the store's change was ignored: the user switched sRSd26 -> sRSd25 and nothing happened. The Users / Items
// page already did the right thing (cohort-page.js `storeDataset`); this is that rule as plain logic, so tests/app/js/dataset_follow_check.mjs can pin it under node.
//
// `seen` is the store's dataset the page last looked at - null until the page's first update after it was mounted:
//  - first update: a deep link naming a known dataset the selector does not show -> the SELECTOR follows the URL once ("adopt": what the header says is what the page shows);
//    nothing else changes - the page keeps the URL's dataset, as it always did;
//  - later updates: the store's dataset moved and the URL does not already name it -> the URL follows the selector ("follow"): the page drops what belongs to the old
//    dataset (the pair - dense indices mean another person in another dataset), keeps the parameters, and starts again from Setup.

/**
 * @param {{ seen: string | null, store: string | undefined, route: string | undefined, known: (name: string) => boolean }} s
 * @returns {{ action: "none" | "adopt" | "follow", seen: string }} `seen` is the value to remember for the next update
 */
export function followDataset(s) {
  const store = s.store ?? "";
  if (s.seen === null) {
    if (s.route && s.route !== store && s.known(s.route)) return { action: "adopt", seen: s.route };
    return { action: "none", seen: store };
  }
  if (store !== s.seen && store && store !== s.route) return { action: "follow", seen: store };
  return { action: "none", seen: store };
}

/** the route parameters that belong to the pair of the OLD dataset: dense indices, the neighbour and the player position */
export const PAIR_PARAMS = ["u", "i", "nb", "step"];

/**
 * The route after the selector moved to `dataset`: the new `ds`, no pair, every other parameter (similarity, k, ...) kept.
 * @param {Record<string, string | undefined>} params the current route's parameters
 * @param {string} dataset
 * @returns {Record<string, string | undefined>}
 */
export function routeForDataset(params, dataset) {
  /** @type {Record<string, string | undefined>} */
  const next = { ...params, ds: dataset };
  for (const key of PAIR_PARAMS) delete next[key];
  return next;
}
