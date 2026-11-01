// @ts-check
// WP-82: download the lecture board as a standalone SVG file - the drawing exactly as it stands
// (ghost and inked parts, the current language and theme), for the instructor's own slides. The
// board's look lives in CSS classes and custom properties, which a bare SVG file would lose, so
// every element gets its COMPUTED paint copied inline, the stylesheet classes are dropped, and the
// watermark image is embedded as a data URL. The interactive version of the same board is the
// static bundle (`i2rs export`), which already freezes the decks; this is the picture only.

/** The presentation properties a standalone SVG needs; everything else is geometry (attributes). */
const COPY = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
];

/**
 * @param {string} url
 * @returns {Promise<string>}  the same image as a data URL (falls back to the URL itself)
 */
async function toDataUrl(url) {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

// WP-111: the file says which build and which moment it came from. Three places, all on the EXPORTED COPY (the board on the screen is
// not touched): the file name, a `<metadata>` element, and one faint line in a footer band under the drawing (the band is added to the
// copy's canvas, so the line can never collide with a board element, whatever the step). The stamp holds the deck, route, position,
// the app version and the time - no data set, no person's name: nothing else is read from the page.

/**
 * @typedef {{
 *   deck: string, route: string, index: number, sub: number,
 *   version: string, buildVersion: string, now: Date,
 * }} ExportStamp  `index` is the player's 0-based step, `sub` its sub-step (0 = none); `version` / `buildVersion` come from /api/meta
 */

/** the height (user units) of the footer band added under the drawing in the exported copy */
export const FOOTER_BAND = 16;
/** the XML namespace of the `<export>` element inside `<metadata>` (a URN: it names the format, it is no address) */
export const EXPORT_NS = "urn:savo-rslab:board-export:1";
const SVG_NS = "http://www.w3.org/2000/svg";

/** @param {number} n @returns {string} */
const pad2 = (n) => String(n).padStart(2, "0");

/**
 * The moment of the export in the three spellings the file uses. The compact and display forms are LOCAL time (the instructor's
 * clock; the compact one sorts like the calendar: YYMMDDHHMM), the ISO one is UTC.
 * @param {Date} now
 * @returns {{compact: string, display: string, iso: string}}
 */
export function stampTimes(now) {
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const clock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const compact = `${pad2(now.getFullYear() % 100)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  return { compact, display: `${date} ${clock}`, iso: now.toISOString() };
}

/**
 * The build as `vX.Y.z`: the build version when /api/meta has one (`v0.3.123`), else the plain version (`0.3.0` -> `v0.3.0`).
 * @param {Pick<ExportStamp, "version" | "buildVersion">} stamp
 * @returns {string}
 */
export function versionLabel(stamp) {
  const raw = (stamp.buildVersion || stamp.version || "").trim().replace(/^v/i, "");
  return raw ? `v${raw}` : "v?";
}

/** @param {string} text @returns {string} the text safe inside a file name */
function fileSafe(text) {
  return String(text).replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * `<deck>-<route>-<pos>_v<version>_<YYMMDDHHMM>.svg`, e.g. `rs_tree-textbook-step4.2_v0.3.123_2610051405.svg`
 * @param {ExportStamp} stamp
 * @returns {string}
 */
export function exportFileName(stamp) {
  const pos = `step${stamp.index + 1}${stamp.sub ? `.${stamp.sub}` : ""}`;
  const build = versionLabel(stamp);
  return `${fileSafe(stamp.deck)}-${fileSafe(stamp.route)}-${pos}_${fileSafe(build)}_${stampTimes(stamp.now).compact}.svg`;
}

/**
 * The one line under the drawing, e.g. `savo-rslab v0.3.123 · exported 2026-10-05 14:05`.
 * @param {ExportStamp} stamp
 * @returns {string}
 */
export function footerText(stamp) {
  return `savo-rslab ${versionLabel(stamp)} · exported ${stampTimes(stamp.now).display}`;
}

/**
 * The attributes of the `<export>` element in the file's `<metadata>`, in order. Exactly these - nothing else of the page goes in.
 * @param {ExportStamp} stamp
 * @returns {[string, string][]}
 */
export function metadataFields(stamp) {
  return [
    ["version", stamp.version],
    ["build_version", stamp.buildVersion],
    ["exported_at", stampTimes(stamp.now).iso],
    ["deck", stamp.deck],
    ["route", stamp.route],
    ["step", String(stamp.index + 1)],
    ["substep", String(stamp.sub)],
  ];
}

/**
 * Serialise the live board into a self-contained SVG document and trigger a download.
 * @param {SVGSVGElement} svg  the live `svg.board-svg`
 * @param {ExportStamp} stamp
 */
export async function exportBoardSvg(svg, stamp) {
  const { xml, fileName } = await buildBoardSvg(svg, stamp);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The exported document as text, plus its file name. Works on a CLONE: the live board is read (computed styles) and never changed.
 * @param {SVGSVGElement} svg  the live `svg.board-svg`
 * @param {ExportStamp} stamp
 * @returns {Promise<{xml: string, fileName: string}>}
 */
export async function buildBoardSvg(svg, stamp) {
  const clone = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
  const live = svg.querySelectorAll("*");
  const copies = clone.querySelectorAll("*");
  live.forEach((el, i) => {
    const target = copies[i];
    if (!(target instanceof Element)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") {
      target.remove();
      return;
    }
    const parts = [];
    for (const prop of COPY) {
      const v = cs.getPropertyValue(prop);
      if (v && v !== "normal" && v !== "none" && v !== "auto") parts.push(`${prop}:${v}`);
      else if (v === "none" && (prop === "stroke" || prop === "fill")) parts.push(`${prop}:none`);
    }
    target.setAttribute("style", parts.join(";"));
    target.removeAttribute("class");
  });
  // the page's card colour behind the drawing (the SVG itself is transparent in the app)
  const style = getComputedStyle(svg);
  const bg = style.getPropertyValue("--bd-card").trim() || "#ffffff";
  const vb = svg.viewBox.baseVal;
  // WP-111: the footer band lies UNDER the drawing (the copy's canvas grows by FOOTER_BAND), so the stamp cannot overlap anything
  const height = vb.height + FOOTER_BAND;
  const back = document.createElementNS(SVG_NS, "rect");
  back.setAttribute("x", String(vb.x));
  back.setAttribute("y", String(vb.y));
  back.setAttribute("width", String(vb.width));
  back.setAttribute("height", String(height));
  back.setAttribute("style", `fill:${bg}`);
  clone.insertBefore(back, clone.firstChild);
  const meta = document.createElementNS(SVG_NS, "metadata");
  const info = document.createElementNS(EXPORT_NS, "export");
  for (const [name, value] of metadataFields(stamp)) info.setAttribute(name, value);
  meta.appendChild(info);
  clone.insertBefore(meta, clone.firstChild);
  const muted = style.getPropertyValue("--bd-muted").trim() || "#6b7280";
  const stampLine = document.createElementNS(SVG_NS, "text");
  stampLine.setAttribute("id", "export-stamp");
  stampLine.setAttribute("x", String(vb.x + vb.width - 8));
  stampLine.setAttribute("y", String(vb.y + height - 5));
  stampLine.setAttribute("style", `fill:${muted};opacity:0.8;font-family:${style.fontFamily};font-size:9px;text-anchor:end`);
  stampLine.textContent = footerText(stamp);
  clone.appendChild(stampLine);
  clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${height}`);
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");
  clone.removeAttribute("role");
  for (const img of clone.querySelectorAll("image")) {
    const href = img.getAttribute("href");
    if (href && !href.startsWith("data:")) img.setAttribute("href", await toDataUrl(href));
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  return { xml, fileName: exportFileName(stamp) };
}
