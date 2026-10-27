// @ts-check
// WP-31: hash router. URL shape is `#/<page>?<key>=<value>&...` (plan §3.3: deep links like
// `#/ucf?ds=...&u=...&i=...&step=12`). This module only owns page + params; individual pages read
// the params they care about from `store.get().route.params`.

// WP-76: only the parser's fallback for an empty hash; the page the app actually opens on is
// config/app.yaml `defaults.page`, applied once by main.js after /api/meta is known.
const DEFAULT_PAGE = "data";

/**
 * @param {string} hash
 * @returns {{page: string, params: Record<string, string>}}
 */
export function parseHash(hash) {
  const raw = hash.replace(/^#\/?/, "");
  const qIndex = raw.indexOf("?");
  const page = (qIndex === -1 ? raw : raw.slice(0, qIndex)) || DEFAULT_PAGE;
  const query = qIndex === -1 ? "" : raw.slice(qIndex + 1);
  return { page, params: Object.fromEntries(new URLSearchParams(query)) };
}

/**
 * @param {string} page
 * @param {Record<string, string | number | boolean | undefined | null>} [params]
 */
export function toHash(page, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const query = qs.toString();
  return `#/${page}${query ? `?${query}` : ""}`;
}

/**
 * @param {import("./store.js").createStore<any>} store
 */
export function initRouter(store) {
  const apply = () => store.set({ route: parseHash(location.hash) });
  window.addEventListener("hashchange", apply);
  apply();
  return {
    /**
     * @param {string} page
     * @param {Record<string, string | number | boolean | undefined | null>} [params]
     */
    navigate(page, params) {
      location.hash = toHash(page, params);
    },
    /**
     * Update the URL without a history entry (e.g. the player's `step`), keeping the store's
     * route in sync - `replaceState` fires no hashchange, so the store must be told explicitly.
     * @param {string} page
     * @param {Record<string, string | number | boolean | undefined | null>} [params]
     */
    replace(page, params) {
      const hash = toHash(page, params);
      if (location.hash === hash) return;
      history.replaceState(null, "", hash);
      store.set({ route: parseHash(hash) });
    },
  };
}
