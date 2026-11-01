// @ts-check
// WP-40: the `.panel` box (`panel-head` + optional collapse caret + `panel-body`) used by the
// trace page (WP-32) and the Data page - extracted once a second page needed the same shell.
// `extraClass` is caller-supplied (e.g. the trace page passes "trace-panel area-heat" for its
// grid layout + no-default-margin styling; the Data page passes nothing and gets the plain,
// stacked `.panel` look with its normal margin).

/**
 * @param {string} id
 * @param {string} [extraClass]
 * @param {string} [heading]
 * @param {boolean} [collapsible]
 */
export function createPanel(id, extraClass, heading, collapsible = false) {
  const box = document.createElement("section");
  box.className = `panel ${extraClass || ""}`.trim();
  box.dataset.panel = id;
  if (heading) {
    const head = document.createElement("div");
    head.className = "panel-head";
    const h3 = document.createElement("h3");
    h3.textContent = heading;
    head.appendChild(h3);
    if (collapsible) {
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = "▾";
      head.appendChild(caret);
      head.style.cursor = "pointer";
      head.addEventListener("click", () => box.classList.toggle("collapsed"));
    }
    box.appendChild(head);
  }
  const body = document.createElement("div");
  body.className = "panel-body";
  box.appendChild(body);
  return { box, body };
}
