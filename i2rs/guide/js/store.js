// @ts-check
// WP-31: tiny synchronous pub/sub store. No framework, no async batching - state changes are
// applied immediately and every subscriber is called once per `set()`.

/**
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  /** @type {Set<(state: T) => void>} */
  const listeners = new Set();
  return {
    /** @returns {T} */
    get() {
      return state;
    },
    /** @param {Partial<T> | ((state: T) => Partial<T>)} patch */
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      for (const fn of listeners) fn(state);
    },
    /**
     * @param {(state: T) => void} fn
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
