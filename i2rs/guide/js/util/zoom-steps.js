// @ts-check
// WP-107 (g / g2): the steps of a panel's text size (the - / + group at the right of the head of the Formula, Code, Flowchart and Candidate
// panels of the uCF / iCF pages), and the reader's choice kept in the browser, one entry per panel and page. Plain logic, no DOM: the
// component (components/zoom-control.js) draws, this decides.
// The steps are a LIST, never arithmetic on the current value (0.1 + 0.2 is not 0.3): a step is looked up, moved by index, clamped
// at both ends. A stored value that is not exactly one of the steps (a hand-edited or old entry) is no choice: the default applies.

/** the text size factors, smallest first; 1 is the size the page had before the buttons */
export const ZOOM_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
export const ZOOM_DEFAULT = 1;
/**
 * The localStorage key of a panel's choice on a page.
 * @param {string} panel "formula" | "code" | "flow" | "table"
 * @param {string} page "ucf" | "icf"
 * @returns {string}
 */
export function zoomKey(panel, page) {
  return `i2rs.zoom.${panel}.${page}`;
}

/**
 * @param {unknown} raw what was stored (a string, or nothing)
 * @returns {number} a step; the default for anything that is not exactly one
 */
export function parseZoom(raw) {
  if (typeof raw !== "string") return ZOOM_DEFAULT;
  return ZOOM_STEPS.find((s) => String(s) === raw) ?? ZOOM_DEFAULT;
}

/**
 * @param {number} current the factor now in use
 * @param {number} direction -1 smaller, +1 larger
 * @returns {number} the neighbouring step; the same step at an end; the default's neighbour for a value that is no step
 */
export function stepZoom(current, direction) {
  const known = ZOOM_STEPS.indexOf(current);
  const at = known < 0 ? ZOOM_STEPS.indexOf(ZOOM_DEFAULT) : known;
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, at + direction))];
}

/** @param {number} zoom @returns {string} e.g. "0.8×", "1.0×" - always one decimal, so the label has one width */
export function formatZoom(zoom) {
  return `${zoom.toFixed(1)}×`;
}

/**
 * @param {{getItem: (key: string) => string | null} | null | undefined} storage `window.localStorage`, or nothing
 * @param {string} key see `zoomKey`
 * @returns {number} the stored choice; the default when there is none, it is no step, or the storage cannot be read (a private
 *   window, blocked site data: reading throws)
 */
export function loadZoom(storage, key) {
  try {
    return parseZoom(storage?.getItem(key));
  } catch {
    return ZOOM_DEFAULT;
  }
}

/**
 * @param {{setItem: (key: string, value: string) => void} | null | undefined} storage
 * @param {number} zoom
 * @param {string} key see `zoomKey`
 */
export function saveZoom(storage, zoom, key) {
  try {
    storage?.setItem(key, String(zoom));
  } catch {
    /* the choice then lasts as long as the page: nothing else depends on it */
  }
}
