// @ts-check
// WP-83: inline rating histogram - one bar per value of the rating scale (10 half-star bins on the
// 0.5-5 scale), normalised to the ROW's own tallest bin so every row shows its shape, not its size
// (the size is the neighbouring "ratings" column). Plain SVG with token colours only (--navy,
// --line), so the dark theme and the projector need nothing extra. Colour is never the only cue:
// the tallest bin (`.mode`) is a solid bar, an empty bin keeps a 1 px baseline notch (`.zero`) so
// the shape of the scale stays readable, and every bar carries a native <title> tooltip with its
// star value and count.
//
// Optional markers (WP-83, `markers`): vertical lines for the mean (solid), the median (dashed) and
// mean ± std (dotted) on the histogram's CONTINUOUS rating axis - bin i spans [min + (i - 0.5)·step,
// min + (i + 0.5)·step), so a value v sits at x = (v - (min - step/2)) / (max - min + step) · width
// (4.1 on the half-star scale: (4.1 - 0.25) / 5 = 77 % of the width). Each line has a halo (so it
// shows over a solid bar) and a native <title>; the line STYLES differ, colour is never the only
// cue. `markerLegend` is the one-line key under a big histogram.

import { fmtStars } from "../util/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const GAP = 1.5; // px between neighbouring bars
const MIN_NONZERO = 1.5; // a non-empty bin is never thinner than this, however small next to the mode
const CAPTION_H = 14; // room under the bars for the end labels when `captions` is on
const HIT_WIDTH = 8; // px of the invisible stroke that makes a 1.5 px marker line hoverable

/**
 * @param {string} name
 * @param {Record<string, string | number>} [attrs]
 * @returns {SVGElement}
 */
function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * x of a rating value on the histogram's continuous axis (see the header comment).
 * @param {number} value
 * @param {{min: number, max: number, step: number}} scale
 * @param {number} width
 */
export function markerX(value, scale, width) {
  return ((value - (scale.min - scale.step / 2)) / (scale.max - scale.min + scale.step)) * width;
}

/**
 * Mean, population std and median of a histogram over the scale values (exact for grid data).
 * @param {number[]} counts
 * @param {{min: number, step: number}} scale
 */
export function histStats(counts, scale) {
  const n = counts.reduce((a, b) => a + b, 0);
  if (n === 0) return { n: 0, mean: null, std: null, median: null, min: null, max: null };
  const values = counts.map((_, k) => scale.min + k * scale.step);
  const mean = counts.reduce((s, c, k) => s + c * values[k], 0) / n;
  const variance = counts.reduce((s, c, k) => s + c * (values[k] - mean) ** 2, 0) / n;
  /** @param {number} position 0-based rank in the sorted ratings */
  const at = (position) => {
    let seen = 0;
    for (let k = 0; k < counts.length; k += 1) {
      seen += counts[k];
      if (position < seen) return values[k];
    }
    return values[values.length - 1];
  };
  const median = (at(Math.floor((n - 1) / 2)) + at(Math.floor(n / 2))) / 2;
  const used = counts.map((c, k) => (c > 0 ? values[k] : null)).filter((v) => v !== null);
  return { n, mean, std: Math.sqrt(variance), median, min: Math.min(...used), max: Math.max(...used) };
}

/**
 * @typedef {Object} HistMarkers
 * @property {number | null | undefined} mean
 * @property {number | null | undefined} median
 * @property {number | null | undefined} std population std (drawn as mean - std and mean + std)
 * @property {{mean: string, median: string, std: string}} labels already translated
 */

/** Median: one decimal on a grid value (4.0), two when it falls between (3.25). @param {number} v */
export function fmtMedian(v) {
  return Number.isInteger(v * 2) ? v.toFixed(1) : v.toFixed(2);
}

/** @param {number | null | undefined} v @returns {v is number} */
function present(v) {
  return v !== null && v !== undefined && !Number.isNaN(v);
}

/**
 * @param {SVGElement} svg
 * @param {HistMarkers} m
 * @param {{min: number, max: number, step: number}} scale
 * @param {number} width
 * @param {number} top
 * @param {number} bottom
 */
function drawMarkers(svg, m, scale, width, top, bottom) {
  /** @type {[string, number, string][]} */
  const lines = [];
  if (present(m.mean) && present(m.std)) {
    lines.push(["std", m.mean - m.std, `${m.labels.mean} − ${m.labels.std} ${(m.mean - m.std).toFixed(2)}`]);
    lines.push(["std", m.mean + m.std, `${m.labels.mean} + ${m.labels.std} ${(m.mean + m.std).toFixed(2)}`]);
  }
  if (present(m.median)) lines.push(["median", m.median, `${m.labels.median} ${fmtMedian(m.median)}`]);
  if (present(m.mean)) lines.push(["mean", m.mean, `${m.labels.mean} ${m.mean.toFixed(2)}`]);
  for (const [kind, value, text] of lines) {
    const x = Math.min(width, Math.max(0, markerX(value, scale, width))).toFixed(2);
    const geometry = { x1: x, x2: x, y1: top, y2: bottom };
    const group = svgEl("g", { class: `spark-marker ${kind}` });
    group.dataset.value = String(value);
    const hit = svgEl("line", { class: "spark-hit", ...geometry, "stroke-width": HIT_WIDTH });
    const tip = svgEl("title");
    tip.textContent = text;
    hit.appendChild(tip);
    group.append(
      svgEl("line", { class: "spark-halo", ...geometry }), // card-coloured, so the line shows over a bar
      svgEl("line", { class: `spark-mark ${kind}`, ...geometry }),
      hit
    );
    svg.appendChild(group);
  }
}

/**
 * The one-line key under a big histogram: a swatch in each line's own style + its value.
 * @param {HistMarkers} m
 * @returns {HTMLElement}
 */
export function markerLegend(m) {
  const wrap = document.createElement("div");
  wrap.className = "hist-legend";
  /** @type {[string, string][]} */
  const items = [];
  if (present(m.mean)) items.push(["mean", `${m.labels.mean} ${m.mean.toFixed(2)}`]);
  if (present(m.median)) items.push(["median", `${m.labels.median} ${fmtMedian(m.median)}`]);
  if (present(m.std)) items.push(["std", `± ${m.labels.std} ${m.std.toFixed(2)}`]);
  for (const [kind, text] of items) {
    const item = document.createElement("span");
    item.className = "hist-legend-item";
    const swatch = svgEl("svg", { width: 18, height: 8, viewBox: "0 0 18 8", "aria-hidden": "true" });
    swatch.appendChild(svgEl("line", { class: `spark-mark ${kind}`, x1: 0, x2: 18, y1: 4, y2: 4 }));
    item.append(swatch, text);
    wrap.appendChild(item);
  }
  return wrap;
}

/**
 * @param {number[]} counts one count per scale value, lowest value first
 * @param {{
 *   scale: {min: number, max: number, step: number},
 *   width?: number,
 *   height?: number,
 *   captions?: boolean,
 *   markers?: HistMarkers,
 *   i18n?: {t: (key: string, params?: Record<string, unknown>) => string},
 * }} opts `captions` (the detail card) adds the end labels and the peak count; `markers` draws the
 *   mean / median / ± std lines (nothing when the histogram is empty)
 * @returns {SVGSVGElement}
 */
export function sparklineHist(counts, opts) {
  const { scale, width = 100, height = 24, captions = false, markers, i18n } = opts;
  const n = counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const peak = Math.max(0, ...counts);
  const modeIndex = peak > 0 ? counts.indexOf(peak) : -1;

  const svg = /** @type {SVGSVGElement} */ (
    svgEl("svg", {
      class: "spark",
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      focusable: "false",
    })
  );
  svg.setAttribute(
    "aria-label",
    i18n
      ? total > 0
        ? i18n.t("cohort.hist_aria", { n: total })
        : i18n.t("cohort.hist_empty")
      : String(total)
  );
  if (n === 0) return svg;

  const plotH = height - (captions ? CAPTION_H : 0) - (captions && peak > 0 ? 10 : 0);
  const plotTop = captions && peak > 0 ? 10 : 0; // the peak count sits above the tallest bar
  const slot = width / n;
  for (let k = 0; k < n; k += 1) {
    const count = counts[k];
    const h = count > 0 ? Math.max(MIN_NONZERO, (count / peak) * plotH) : 1;
    const bar = svgEl("rect", {
      class: `spark-bar${count === 0 ? " zero" : ""}${k === modeIndex ? " mode" : ""}`,
      x: (k * slot + GAP / 2).toFixed(2),
      y: (plotTop + plotH - h).toFixed(2),
      width: Math.max(1, slot - GAP).toFixed(2),
      height: h.toFixed(2),
    });
    bar.dataset.count = String(count);
    const tip = svgEl("title");
    tip.textContent = `${fmtStars(scale.min + k * scale.step)} · ${count}`;
    bar.appendChild(tip);
    svg.appendChild(bar);
  }

  if (markers && total > 0) drawMarkers(svg, markers, scale, width, plotTop, plotTop + plotH);

  if (captions) {
    const base = height - 3;
    const left = svgEl("text", { class: "spark-cap", x: 0, y: base, "text-anchor": "start" });
    left.textContent = fmtStars(scale.min);
    const right = svgEl("text", { class: "spark-cap", x: width, y: base, "text-anchor": "end" });
    right.textContent = fmtStars(scale.max);
    svg.append(left, right);
    if (modeIndex >= 0) {
      const top = svgEl("text", {
        class: "spark-cap spark-peak",
        x: (modeIndex * slot + slot / 2).toFixed(2),
        y: 8,
        "text-anchor": "middle",
      });
      top.textContent = String(peak);
      svg.appendChild(top);
    }
  }
  return svg;
}
