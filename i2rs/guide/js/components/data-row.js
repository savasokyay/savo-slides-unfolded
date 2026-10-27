// @ts-check
// WP-242: the "Data" row at the top of a walk page's Parameters panel (what the page trained on, validated on and tested on; the words and the numbers are util/data-row.js). One read-only line in the panel's own
// caption-and-value look, its hover tip names the settings the shares come from. The parameter forms clear and rebuild the panel body, so the page asks the row to put itself first again after each build.

/**
 * @param {any} i18n
 * @returns {{
 *   el: HTMLElement,
 *   attach: (root: HTMLElement) => void,
 *   set: (spec: {kind: string, text: string, tip: string} | null) => void
 * }}
 */
export function createDataRow(i18n) {
  const el = document.createElement("div");
  el.className = "data-row";
  el.hidden = true;
  const label = document.createElement("span");
  label.className = "data-row-label";
  label.textContent = i18n.t("data_row.label");
  const text = document.createElement("span");
  text.className = "data-row-text";
  el.append(label, text);
  return {
    el,
    /** the row is the panel body's first child (a form that was built since cleared it) @param {HTMLElement} root */
    attach(root) {
      if (root.firstChild !== el) root.prepend(el);
    },
    /** @param {{kind: string, text: string, tip: string} | null} spec null hides the row (a page or a task with no split to state) */
    set(spec) {
      el.hidden = !spec;
      el.dataset.kind = spec?.kind ?? "";
      text.textContent = spec?.text ?? "";
      el.title = spec?.tip ?? "";
    },
  };
}
