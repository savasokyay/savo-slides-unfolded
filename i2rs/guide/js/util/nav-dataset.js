// @ts-check
// WP-214: a sidebar entry may name the data set its pages are taught on (`dataset:` in config/nav.yaml). The content-based entry names the class set: a content-based walk
// depends on the corpus (the same student and film, genres, item-based: 3.43 from 15 neighbours on the class set, 3.03 from 28 on the merged one), while the collaborative
// model pages are better on the merged set - so only the content-based pages ask for one, and everything else keeps the selector where the reader left it.
//
// The rule applies ONCE, when the route ENTERS the entry's group (from outside it, or at the first render): the header selector then takes the same path as a click on it
// (`store.set({ dataset })`, the pages follow it as for any change). Inside the group nothing is forced - the reader's own choice stands; leaving it brings nothing back;
// a route that names a data set itself (`ds`, a deep link) wins; a data set this machine has not registered is skipped (the caller logs a note).
// A `dataset` on a parent is inherited by the children (the nearest ancestor that sets one owns the row); its `id` names the group.
// Pure, so tests/app/js/nav_dataset_check.mjs can pin the rule under node.

/** @typedef {{ page?: string, params?: Record<string, string> }} Route */

/**
 * The sidebar row a route lights and the data set it asks for. A row matches when its `page` is the route's page; a row with a `route_key` (the content page's two methods are rows
 * of ONE page) matches only when the route's parameter equals the row's own value - or, with `route_default`, when the route names none (the rule of components/nav-tree.js).
 * A keyed match wins over a plain one; the first row in tree order wins a tie.
 * @param {any[]} tree
 * @param {Route} route
 * @returns {{ node: any, dataset: string | null, group: string | null } | null}
 */
export function navEntryFor(tree, route) {
  /** @type {{ node: any, ancestors: any[], score: number } | null} */
  let best = null;
  /** @param {any[]} nodes @param {any[]} ancestors */
  const walk = (nodes, ancestors) => {
    for (const node of nodes || []) {
      if (node.page !== undefined && node.page === route.page) {
        const key = typeof node.route_key === "string" ? node.route_key : null;
        let score = 1;
        if (key !== null) {
          const got = route.params?.[key];
          const mine = node.params?.[key];
          score = got === mine || (got === undefined && node.route_default === true) ? 2 : 0;
        }
        if (score > 0 && (best === null || score > best.score)) best = { node, ancestors, score };
      }
      walk(node.children || [], [node, ...ancestors]);
    }
  };
  walk(tree, []);
  if (best === null) return null;
  const { node, ancestors } = best;
  const owner = [node, ...ancestors].find((n) => typeof n.dataset === "string" && n.dataset !== "");
  return { node, dataset: owner ? owner.dataset : null, group: owner ? String(owner.id) : null };
}

/**
 * WP-221: the nav node whose `id` is `id` (the group `datasetOnEntry` reports), so the toast can name the group it switched the data set for by the sidebar's own label.
 * @param {any[]} tree
 * @param {string | null} id
 * @returns {any | null}
 */
export function navNodeById(tree, id) {
  if (id === null) return null;
  for (const node of tree || []) {
    if (String(node.id) === id) return node;
    const inner = navNodeById(node.children || [], id);
    if (inner) return inner;
  }
  return null;
}

/**
 * What to do when the route changed (or at the first render).
 * @param {{ tree: any[], route: Route, prevGroup: string | null, current: string | null | undefined, known: (name: string) => boolean }} s
 *   `prevGroup`: the group the previous call found (null: outside every group); `current`: the selector's data set; `known`: whether this machine has registered the data set
 * @returns {{ action: "none" | "switch" | "skip", group: string | null, dataset: string | null }} `group` is the value to remember for the next call
 */
export function datasetOnEntry(s) {
  const hit = navEntryFor(s.tree, s.route);
  const group = hit?.group ?? null;
  const dataset = hit?.dataset ?? null;
  if (group === null || dataset === null) return { action: "none", group: null, dataset: null }; // outside every group: the next entry counts again
  if (group === s.prevGroup) return { action: "none", group, dataset }; // still inside: the reader's own choice stands
  if (s.route.params?.ds) return { action: "none", group, dataset }; // a route that names a data set wins (the selector follows it, util/dataset-follow.js)
  if (s.current === dataset) return { action: "none", group, dataset };
  if (!s.known(dataset)) return { action: "skip", group, dataset };
  return { action: "switch", group, dataset };
}
