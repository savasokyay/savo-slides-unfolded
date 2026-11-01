// @ts-check
// WP-31: placeholder for every page module that hasn't been built yet (WP-40+). WP-32 turned it
// into a page object (`mount/update/unmount`) like the real pages. Replaced one page at a time as
// each work package lands; new pages simply stop being routed here.

/**
 * @param {string} page
 * @param {string} wp
 */
export function createPlaceholderPage(page, wp) {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  return {
    /**
     * @param {HTMLElement} rootEl
     * @param {any} context
     */
    mount(rootEl, context) {
      root = rootEl;
      ctx = context;
    },
    update() {
      if (!root) return;
      root.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "page-placeholder";
      const h2 = document.createElement("h2");
      h2.textContent = ctx.i18n.t(`nav.${page}`) === `nav.${page}` ? page : ctx.i18n.t(`nav.${page}`);
      const p = document.createElement("p");
      p.textContent = ctx.i18n.t("page.coming_soon", { wp });
      wrap.append(h2, p);
      root.appendChild(wrap);
    },
    unmount() {
      if (root) root.innerHTML = "";
    },
  };
}
