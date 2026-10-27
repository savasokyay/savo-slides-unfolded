// @ts-check
// WP-93a: which pages can print a user's name. In handles mode (ui.show_handles, instructor's machine) a class
// user's label is the real Letterboxd name, and the header carries a "Letterboxd names shown" badge - but only on
// the pages where a name can appear (Users, Items card, Data / Browse, the trace pages, the atlas, ...), not on
// the lecture boards, where it only confused the room. The pages are marked in config/nav.yaml (`shows_names:
// true`), the one list of pages; this module only reads that flag, so no page id is repeated in the code.

/**
 * True when `/api/config/nav` marks `pageId` with `shows_names: true` (on any node that opens that page).
 * @param {any} nav the nav object (`{tree: [...]}`); anything else means "no page"
 * @param {string} pageId the route's page id
 * @returns {boolean}
 */
export function pageShowsNames(nav, pageId) {
  /** @param {any} nodes */
  const walk = (nodes) =>
    Array.isArray(nodes) &&
    nodes.some((node) => (node?.page === pageId && node.shows_names === true) || walk(node?.children));
  return walk(nav?.tree);
}
