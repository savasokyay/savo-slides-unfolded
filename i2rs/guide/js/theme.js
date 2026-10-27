// @ts-check
// WP-31: light/dark theme, explicit toggle only (no `prefers-color-scheme` auto mode - the
// classroom projector default is light regardless of the instructor's OS setting).

const KEY = "i2rs.theme";

function safeGet() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** @param {string} theme */
function safeSet(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private browsing / storage disabled - the toggle still works for this page view */
  }
}

/** @param {"light" | "dark"} theme */
function apply(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * @param {import("./store.js").createStore<any>} store
 */
export function initTheme(store) {
  let theme = safeGet() === "dark" ? "dark" : "light";
  apply(theme);
  const api = {
    get() {
      return theme;
    },
    /** @param {"light" | "dark"} next */
    set(next) {
      theme = next;
      apply(theme);
      safeSet(theme);
      store.set({ theme });
    },
    toggle() {
      api.set(theme === "light" ? "dark" : "light");
    },
  };
  store.set({ theme });
  return api;
}
