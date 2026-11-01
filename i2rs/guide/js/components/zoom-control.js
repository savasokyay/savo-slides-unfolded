// @ts-check
// WP-107 (g / g2): the - / + group at the far right of a panel's head on the uCF / iCF pages: the panel's content size in steps
// (util/zoom-steps.js, 0.7x ... 1.4x), 1.0x by default, the reader's choice kept in localStorage per panel AND page
// (`i2rs.zoom.<panel>.<page>`). The Formula, Code, Flowchart and Candidate panels each get one; they look and behave the same. The
// size is a CSS variable on the panel (`cssVar`, e.g. `--formula-zoom`) that the layout-F rules turn into a font size or a row height -
// the flowchart, whose size is an svg, also hears `onChange`. Nothing here touches the panel's height: the body scrolls inside, so a
// larger content only scrolls more. The group lives in the HEAD (a head is never redrawn by a step) and the value between the buttons
// keeps one width, so no step moves it (the instructor's rule for controls).

import { formatZoom, loadZoom, saveZoom, stepZoom, ZOOM_STEPS, zoomKey } from "../util/zoom-steps.js";

/**
 * @param {HTMLElement | null} host where the group is appended (a panel head); null = the caller places `element` itself (the table
 *   puts it in its title row, which the table redraws with every trace)
 * @param {{
 *   i18n: any,
 *   panel: "formula" | "code" | "flow" | "table" | "text" | "network", // WP-116: "text" = the text size of a whole static page (Memory-based CF), labels `panel.zoom_text_*`; WP-154: "network" = the neural page's diagram
 *   page: string,
 *   target: HTMLElement,
 *   cssVar: string,
 *   storage?: Storage | null,
 *   onChange?: (zoom: number) => void,
 * }} ctx `target` gets `cssVar` = the factor; `onChange` is called with every new factor (also the initial one, once)
 */
export function createZoomControl(host, ctx) {
  const { i18n, panel, target } = ctx;
  const key = zoomKey(panel, ctx.page);
  let zoom = loadZoom(ctx.storage, key);

  const group = document.createElement("div");
  group.className = `zoom-buttons zoom-${panel}`;
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", i18n.t(`panel.zoom_${panel}_group`));
  /** @param {string} glyph @param {string} title @param {number} direction */
  const button = (glyph, title, direction) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "zoom-btn";
    b.textContent = glyph;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", () => set(stepZoom(zoom, direction), true));
    // Space / the arrows belong to the player (next step, previous step): a focused button must not also advance the trace
    b.addEventListener("keydown", (e) => e.stopPropagation());
    return b;
  };
  const smaller = button("−", i18n.t(`panel.zoom_${panel}_out`), -1);
  const larger = button("+", i18n.t(`panel.zoom_${panel}_in`), 1);
  const value = document.createElement("span");
  value.className = "zoom-value";
  group.append(smaller, value, larger);
  if (host) host.appendChild(group);

  /**
   * @param {number} next
   * @param {boolean} [persist] the reader chose it (the initial size, read from storage or the default, is not written back)
   */
  function set(next, persist = false) {
    zoom = next;
    target.style.setProperty(ctx.cssVar, String(zoom));
    value.textContent = formatZoom(zoom);
    value.title = i18n.t(`panel.zoom_${panel}_value`, { z: formatZoom(zoom) });
    /** @type {HTMLButtonElement} */ (smaller).disabled = zoom === ZOOM_STEPS[0];
    /** @type {HTMLButtonElement} */ (larger).disabled = zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1];
    if (persist) saveZoom(ctx.storage, zoom, key);
    if (ctx.onChange) ctx.onChange(zoom);
  }
  set(zoom);

  return {
    /** the group, for a host that is not known when the control is made */
    element: group,
    get zoom() {
      return zoom;
    },
  };
}
