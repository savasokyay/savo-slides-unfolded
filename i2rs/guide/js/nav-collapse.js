// @ts-check
// WP-54: sidebar collapse (icon-only rail), same shape as theme.js - a small localStorage-backed
// toggle that also mirrors into the store so nav-tree.js re-renders on a change.

const KEY = "i2rs.navCollapsed";

function safeGet() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {boolean} collapsed */
function safeSet(collapsed) {
  try {
    localStorage.setItem(KEY, collapsed ? "1" : "0");
  } catch {
    /* private browsing / storage disabled - the toggle still works for this page view */
  }
}

/** @param {boolean} collapsed */
function apply(collapsed) {
  document.documentElement.classList.toggle("nav-collapsed", collapsed);
}

/**
 * @param {import("./store.js").createStore<any>} store
 */
export function initNavCollapse(store) {
  let collapsed = safeGet();
  apply(collapsed);
  const api = {
    get() {
      return collapsed;
    },
    /** @param {boolean} next */
    set(next) {
      collapsed = next;
      apply(collapsed);
      safeSet(collapsed);
      store.set({ navCollapsed: collapsed });
    },
    toggle() {
      api.set(!collapsed);
    },
  };
  store.set({ navCollapsed: collapsed });
  return api;
}
