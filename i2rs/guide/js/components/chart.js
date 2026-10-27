// @ts-check
// WP-40: thin Plotly wrapper for the Data page's histograms and Lorenz curve. Colours are read
// from the live CSS custom properties (tokens.css) at render time so a chart never needs to be
// told the current theme - it just reads whatever the page is already painted with.

import { loadVendorScript } from "../vendor-loader.js";

/** @type {Promise<void> | null} */
let plotlyPromise = null;

function ensurePlotly() {
  if (!plotlyPromise) plotlyPromise = loadVendorScript("plotly-cartesian", "plotly-cartesian.min.js");
  return plotlyPromise;
}

/** Live theme colours (light/dark), for callers that need more than the navy/maroon default. */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ink: pick("--ink", "#333"),
    muted: pick("--muted", "#888"),
    line: pick("--line", "#e0e0e0"),
    navy: pick("--navy", "#1a237e"),
    maroon: pick("--maroon", "#800000"),
    green: pick("--green", "#1a9d54"),
  };
}

/** @param {Record<string, any>} [extra] */
function layoutDefaults(extra = {}) {
  const c = themeColors();
  return {
    margin: { l: 44, r: 12, t: 8, b: 34 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: c.ink, size: 12 },
    showlegend: false,
    ...extra,
    xaxis: { gridcolor: c.line, zerolinecolor: c.line, ...(extra.xaxis || {}) },
    yaxis: { gridcolor: c.line, zerolinecolor: c.line, ...(extra.yaxis || {}) },
  };
}

/**
 * @param {HTMLElement} root
 */
export function createChart(root) {
  root.classList.add("chart");
  return {
    /**
     * @param {any[]} traces
     * @param {Record<string, any>} [layoutExtra]
     */
    async render(traces, layoutExtra) {
      await ensurePlotly();
      const c = themeColors();
      const withColor = traces.map((t, i) => ({
        marker: { color: i === 0 ? c.navy : c.maroon },
        line: { color: i === 0 ? c.navy : c.maroon },
        ...t,
      }));
      /** @type {any} */
      const plotly = /** @type {any} */ (window).Plotly;
      plotly.react(root, withColor, layoutDefaults(layoutExtra), {
        displayModeBar: false,
        responsive: true,
      });
    },
    /** WP-158: take the host's size again (Plotly measures a host once; a chart drawn in a closed tab, or in a box that changed, needs this when it is shown) */
    resize() {
      /** @type {any} */
      const plotly = /** @type {any} */ (window).Plotly;
      if (plotly?.Plots?.resize && root.isConnected && root.offsetWidth > 0 && root.offsetHeight > 0 && root.querySelector(".plot-container")) plotly.Plots.resize(root);
    },
    destroy() {
      /** @type {any} */
      const plotly = /** @type {any} */ (window).Plotly;
      if (plotly) plotly.purge(root);
    },
  };
}
